import { useState, useEffect, useMemo } from "react";
import {
  getReviews,
  addReview,
  updateReview,
  type Review,
} from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { NewReviewSheet } from "../components/NewReviewSheet";
import { ReviewLightbox } from "../components/ReviewLightbox";

interface ReviewsProps {
  userId: string;
  firstName: string;
  onBack: () => void;
}

function formatDate(s: string, lang: string) {
  try {
    return new Date(s).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return s; }
}

export function Reviews({ userId, firstName }: ReviewsProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  // editingReview — если задан, sheet открывается в edit-режиме с
  // pre-fill значениями. submit идёт через updateReview API.
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reviewLightbox, setReviewLightbox] = useState<{
    images: string[];
    startIndex: number;
    rect: DOMRect | null;
  } | null>(null);

  const refresh = () => {
    setLoading(true);
    getReviews().then(setReviews).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + Math.min(5, Math.max(1, r.rating)), 0);
    return sum / reviews.length;
  }, [reviews]);

  const handleSubmitReview = async (rating: number, text: string, photos: string[]) => {
    setSubmitting(true);
    setError("");
    try {
      if (editingReview) {
        await updateReview(editingReview.id, userId, { rating, text, image_urls: photos });
      } else {
        await addReview(userId, { user_name: firstName, rating, text, image_urls: photos });
      }
      setSheetOpen(false);
      setEditingReview(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "reviewsAddError"));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: Review) => {
    setEditingReview(r);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingReview(null);
  };

  if (loading) {
    return <div style={styles.wrap}><p style={styles.loading}>{t(lang, "loading")}</p></div>;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.titleRow}>
        <h2 className="zen-page-title" style={styles.title}>{t(lang, "reviewsTitle")}</h2>
        {reviews.length > 0 && (
          <div style={styles.ratingInline} aria-label={`${average.toFixed(1)} / 5`}>
            <span style={styles.ratingNumber}>
              {average.toFixed(1).replace(".", lang === "ru" ? "," : ".")}
            </span>
            <span style={styles.ratingStar} aria-hidden>★</span>
          </div>
        )}
      </div>

      {reviews.length === 0 && (
        <div style={styles.emptyBubbleRow}>
          <div style={styles.emptyAvatar}>R</div>
          <div style={styles.emptyBubble}>
            <div style={styles.emptyBubbleText}>
              {t(lang, "reviewsEmptyFirst")}
            </div>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {reviews.map((r) => {
          const images = r.image_urls ?? [];
          return (
          <article key={r.id} style={styles.card}>
            <header style={styles.cardHead}>
              <div style={styles.av}>{(r.user_name?.[0] || "?").toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.reviewName}>{r.user_name || t(lang, "guest")}</div>
                <div style={styles.reviewDate}>{formatDate(r.created_at, lang)}</div>
              </div>
              <div style={styles.starsRight} aria-label={`${r.rating} / 5`}>
                {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
              </div>
            </header>
            <p style={styles.text}>{r.text}</p>

            {/* Photo collage — масштабируется по количеству фоток. */}
            {images.length > 0 && (
              <PhotoCollage
                images={images}
                onOpen={(idx, rect) => setReviewLightbox({ images, startIndex: idx, rect })}
              />
            )}

            {/* Edit-кнопка показывается ТОЛЬКО на своём отзыве. */}
            {r.user_id === userId && (
              <button type="button" onClick={() => openEdit(r)} style={styles.editBtn}>
                {t(lang, "reviewsEdit")}
              </button>
            )}
          </article>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        style={styles.fab}
        aria-label={t(lang, "reviewsFabNew")}
      >
        +
      </button>

      <NewReviewSheet
        open={sheetOpen}
        submitting={submitting}
        error={error}
        initial={editingReview ? {
          rating: editingReview.rating,
          text: editingReview.text,
          image_urls: editingReview.image_urls ?? [],
        } : undefined}
        onClose={closeSheet}
        onSubmit={handleSubmitReview}
      />

      {reviewLightbox && (
        <ReviewLightbox
          images={reviewLightbox.images}
          startIndex={reviewLightbox.startIndex}
          startRect={reviewLightbox.rect}
          onClose={() => setReviewLightbox(null)}
        />
      )}
    </div>
  );
}

// PhotoCollage — компактная сетка фоток в отзыве.
// onOpen передаёт thumbRect для FLIP-анимации лайтбокса.
// 1 фото — 60% ширины 4:5; 2 — 2 столбца квадратами; 3+ — 3 столбца
// квадратами + индикатор «+N» на 4-й ячейке если фоток больше 4.
function PhotoCollage({ images, onOpen }: { images: string[]; onOpen: (idx: number, rect: DOMRect | null) => void }) {
  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <button
        type="button"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onOpen(0, rect);
        }}
        style={collageStyles.singleBtn}
        aria-label="фото"
      >
        <img src={images[0]} alt="" style={collageStyles.singleImg} />
      </button>
    );
  }
  const cols = images.length === 2 ? 2 : 3;
  const visible = images.slice(0, 4);
  const extra = images.length - visible.length;
  return (
    <div style={{ ...collageStyles.grid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {visible.map((src, i) => {
        const isLastVisible = i === visible.length - 1 && extra > 0;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onOpen(i, rect);
            }}
            style={collageStyles.cellBtn}
            aria-label="фото"
          >
            <img src={src} alt="" style={collageStyles.cellImg} />
            {isLastVisible && (
              <span style={collageStyles.extraOverlay}>+{extra}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const collageStyles: Record<string, React.CSSProperties> = {
  // Single image — 60% ширины, центр, 4:5 ratio. Раньше full-width
  // 4:5 — занимало пол-экрана и доминировало над текстом отзыва.
  singleBtn: {
    display: "block",
    width: "60%",
    maxWidth: 240,
    aspectRatio: "4 / 5",
    background: "none",
    border: "none",
    padding: 0,
    borderRadius: 10,
    overflow: "hidden",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  singleImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  grid: {
    display: "grid",
    gap: 3,
    maxWidth: 320,
  },
  cellBtn: {
    position: "relative",
    aspectRatio: "1",
    background: "none",
    border: "none",
    padding: 0,
    borderRadius: 6,
    overflow: "hidden",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  cellImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  extraOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
};

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px", position: "relative" },
  titleRow: {
    display: "flex", alignItems: "baseline", justifyContent: "space-between",
    gap: 12, marginBottom: 16,
  },
  title: { margin: 0 },
  ratingInline: {
    display: "inline-flex", alignItems: "baseline", gap: 4,
    color: "var(--accent)",
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    lineHeight: 1,
  },
  ratingNumber: { fontSize: 24 },
  ratingStar: { fontSize: 18 },
  emptyBubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 32,
  },
  emptyAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    flexShrink: 0,
  },
  emptyBubble: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 13px",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  emptyBubbleText: {
    fontSize: 13.5,
    color: "var(--text)",
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
  },
  list: { display: "flex", flexDirection: "column", gap: 18 },
  // Карточка отзыва — editorial-стиль: больше воздуха, крупная
  // типографика, фото-collage. Border убран — отзывы разделяются
  // hairline снизу (как в журналах), card-as-background исчезает.
  card: {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid var(--border)",
    borderRadius: 0,
    padding: "0 0 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardHead: { display: "flex", alignItems: "center", gap: 10 },
  av: {
    width: 40, height: 40, borderRadius: "50%",
    background: "rgba(165,42,42,0.12)", color: "var(--accent)",
    fontWeight: 700, fontSize: 15,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  reviewName: {
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  reviewDate: {
    fontSize: 11,
    color: "var(--muted)",
    letterSpacing: "0.02em",
    marginTop: 2,
  },
  starsRight: {
    color: "var(--accent)",
    fontSize: 13,
    letterSpacing: 1.5,
    flexShrink: 0,
  },
  text: {
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
    color: "var(--text)",
    // Inherit от .zen-app — Proxima Nova / system. Раньше Georgia
    // serif выбивался из общей типографики приложения.
    fontFamily: "inherit",
    letterSpacing: "0.01em",
  },
  // Edit-кнопка для своего отзыва — accent-цвет, под текстом отзыва.
  editBtn: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    WebkitTapHighlightColor: "transparent",
  },
  fab: {
    position: "fixed",
    right: "max(20px, env(safe-area-inset-right))",
    bottom: "calc(64px + 20px + env(safe-area-inset-bottom))",
    width: 52, height: 52, borderRadius: "50%",
    background: "var(--accent)", color: "#fff",
    fontSize: 28, fontWeight: 400, lineHeight: 1,
    border: "none", cursor: "pointer",
    boxShadow: "0 4px 12px rgba(165,42,42,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 30,
  },
  loading: { textAlign: "center", padding: 48, color: "var(--muted)" },
  lightbox: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 200, padding: 16, cursor: "zoom-out",
  },
  lightboxImg: {
    maxWidth: "100%", maxHeight: "100%",
    borderRadius: 8, display: "block",
  },
};
