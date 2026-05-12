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
    // Rects ВСЕХ thumbnail'ов в коллаже на момент открытия. Нужно
    // чтобы FLIP-close возвращался к thumb'у ТЕКУЩЕЙ (свайпнутой)
    // картинки, а не первой открытой. Для скрытых photos (4+ в
    // grid'е с +N) item = null → lightbox упадёт на last visible.
    thumbRects: (DOMRect | null)[];
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
          const isOwn = r.user_id === userId;
          return (
          <article key={r.id} style={styles.bubbleRow}>
            {/* Avatar СЛЕВА но bottom-aligned (alignItems: flex-end в
                bubbleRow). Bubble tail (4px corner) у bottom-left,
                направлен ровно к avatar — выглядит как «sign» автора
                под сообщением. */}
            <div style={{ ...styles.av, ...(isOwn ? styles.avOwn : {}) }}>
              {(r.user_name?.[0] || "?").toUpperCase()}
            </div>
            <div style={styles.bubble}>
              <header style={styles.cardHead}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.reviewName}>{r.user_name || t(lang, "guest")}</div>
                  <div style={styles.reviewDate}>{formatDate(r.created_at, lang)}</div>
                </div>
                <div style={styles.starsPill} aria-label={`${r.rating} / 5`}>
                  <span style={styles.starsPillStar} aria-hidden>★</span>
                  <span>{r.rating}</span>
                </div>
              </header>

              <p style={styles.text}>{r.text}</p>

              {/* Photo collage — масштабируется по количеству фоток. */}
              {images.length > 0 && (
                <PhotoCollage
                  images={images}
                  onOpen={(idx, rect, thumbRects) =>
                    setReviewLightbox({ images, startIndex: idx, rect, thumbRects })
                  }
                />
              )}

              {/* Edit-кнопка показывается ТОЛЬКО на своём отзыве. */}
              {isOwn && (
                <button type="button" onClick={() => openEdit(r)} style={styles.editBtn}>
                  {t(lang, "reviewsEdit")}
                </button>
              )}
            </div>
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
          thumbRects={reviewLightbox.thumbRects}
          onClose={() => setReviewLightbox(null)}
        />
      )}
    </div>
  );
}

// PhotoCollage — компактная сетка фоток в отзыве.
// onOpen передаёт rect of clicked thumb + thumbRects ВСЕХ thumbs
// в коллаже (для FLIP-close возврата к свайпнутой картинке).
// 1 фото — 60% ширины 4:5; 2 — 2 столбца квадратами; 3+ — 3 столбца
// квадратами + индикатор «+N» на 4-й ячейке если фоток больше 4.
// Для скрытых фото (4+ в +N case) rect = null → lightbox использует
// last visible rect для FLIP-close.
function PhotoCollage({
  images,
  onOpen,
}: {
  images: string[];
  onOpen: (idx: number, rect: DOMRect | null, thumbRects: (DOMRect | null)[]) => void;
}) {
  if (images.length === 0) return null;

  // Захватываем rects ВСЕХ видимых thumbs в коллаже. Querying через
  // data-thumb-idx внутри ближайшего [data-photo-collage] — единая
  // точка вместо ref-array boilerplate. Для photos 4+ (скрытые в +N
  // collage) thumbRect = null → lightbox упадёт на last visible.
  const captureThumbRects = (originEl: HTMLElement): (DOMRect | null)[] => {
    const container = originEl.closest<HTMLElement>("[data-photo-collage]") ?? originEl;
    return images.map((_, i) => {
      const el = container.querySelector<HTMLElement>(`[data-thumb-idx="${i}"]`);
      return el?.getBoundingClientRect() ?? null;
    });
  };

  if (images.length === 1) {
    return (
      <div data-photo-collage>
        <button
          type="button"
          data-thumb-idx={0}
          onClick={(e) => {
            const el = e.currentTarget as HTMLElement;
            const rect = el.getBoundingClientRect();
            const thumbRects = captureThumbRects(el);
            onOpen(0, rect, thumbRects);
          }}
          style={collageStyles.singleBtn}
          aria-label="фото"
        >
          <img src={images[0]} alt="" style={collageStyles.singleImg} />
        </button>
      </div>
    );
  }
  const cols = images.length === 2 ? 2 : 3;
  const visible = images.slice(0, 4);
  const extra = images.length - visible.length;
  return (
    <div
      data-photo-collage
      style={{ ...collageStyles.grid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {visible.map((src, i) => {
        const isLastVisible = i === visible.length - 1 && extra > 0;
        return (
          <button
            key={i}
            type="button"
            data-thumb-idx={i}
            onClick={(e) => {
              const el = e.currentTarget as HTMLElement;
              const rect = el.getBoundingClientRect();
              const thumbRects = captureThumbRects(el);
              onOpen(i, rect, thumbRects);
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
  list: { display: "flex", flexDirection: "column", gap: 16 },
  // Chat-bubble layout: avatar плавает слева, bubble справа.
  // alignItems: flex-end — avatar bottom-aligned с дном bubble'а
  // (визуально «подпись» автора под отзывом). Bubble tail (4px corner)
  // в bottom-left направлен к avatar'у. Cohesive с CustomOrderPage,
  // где такая же логика для bot bubble.
  bubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
  },
  // Avatar — small neutral badge. Surface bg + accent letter в Georgia
  // serif (в стилистике серифных rating-цифр выше). Inset ring (1px
  // border-tinted) + лёгкая drop-shadow для depth. Намного спокойнее
  // и компактнее предыдущего solid-accent варианта.
  av: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--surface)",
    color: "var(--accent)",
    fontWeight: 700,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: 'Georgia, "Times New Roman", serif',
    letterSpacing: "0.02em",
    border: "none",
    boxShadow:
      "inset 0 0 0 1px var(--border), " +
      "0 1px 3px rgba(0,0,0,0.04)",
    marginBottom: 0,
  },
  // Own-review avatar: чуть более выраженный accent-tint (вместо
  // прежнего solid-fill) — субтильный signal ownership, без
  // визуального крика.
  avOwn: {
    background: "rgba(165,42,42,0.08)",
    color: "var(--accent)",
    boxShadow:
      "inset 0 0 0 1.5px rgba(165,42,42,0.30), " +
      "0 1px 4px rgba(165,42,42,0.08)",
  },
  bubble: {
    flex: 1,
    minWidth: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    // Asymmetric radius — tail (4px) bottom-left → к avatar'у внизу.
    // Остальные углы 18 для мягкого card-look.
    borderRadius: "18px 18px 18px 4px",
    padding: "12px 14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: 700,
    margin: 0,
    letterSpacing: "-0.01em",
    color: "var(--text)",
    lineHeight: 1.2,
  },
  reviewDate: {
    fontSize: 11,
    color: "var(--muted)",
    letterSpacing: "0.04em",
    marginTop: 3,
  },
  // Stars pill — компактный accent-pill справа. Цифра rating рядом
  // со звездой → информативно, не перегружено.
  starsPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "3px 9px 3px 7px",
    borderRadius: 999,
    background: "rgba(165,42,42,0.10)",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'Georgia, "Times New Roman", serif',
    lineHeight: 1,
    flexShrink: 0,
    letterSpacing: "0.02em",
  },
  starsPillStar: {
    fontSize: 13,
    lineHeight: 1,
  },
  text: {
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
    color: "var(--text)",
    fontFamily: "inherit",
    letterSpacing: "0.005em",
    wordBreak: "break-word",
  },
  // Edit-кнопка для своего отзыва — small accent pill.
  editBtn: {
    alignSelf: "flex-start",
    background: "rgba(165,42,42,0.08)",
    border: "1px solid rgba(165,42,42,0.18)",
    color: "var(--accent)",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: "5px 11px",
    borderRadius: 999,
    fontFamily: "inherit",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginTop: 2,
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
