import { useState, useEffect, useMemo, useRef } from "react";
import {
  getReviews,
  addReview,
  addReviewComment,
  type Review,
  type ReviewComment,
} from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { NewReviewSheet } from "../components/NewReviewSheet";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPhoto, setCommentPhoto] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleAddReview = async (rating: number, text: string) => {
    setSubmitting(true);
    setError("");
    try {
      await addReview(userId, { user_name: firstName, rating, text });
      setSheetOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "reviewsAddError"));
    } finally {
      setSubmitting(false);
    }
  };

  const resetCommentForm = () => {
    setCommentFor(null);
    setCommentText("");
    setCommentPhoto(null);
  };

  const handleAddComment = async (reviewId: number) => {
    if (!commentText.trim() && !commentPhoto) return;
    setSubmitting(true);
    try {
      await addReviewComment(reviewId, userId, {
        user_name: firstName,
        text: commentText.trim(),
        image_url: commentPhoto,
      });
      resetCommentForm();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "reviewsCommentError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setCommentPhoto((reader.result as string) || null);
    reader.readAsDataURL(file);
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
        <div style={styles.emptyWrap}>
          <p style={styles.empty}>{t(lang, "reviewsEmptyFirst")}</p>
        </div>
      )}

      <div style={styles.list}>
        {reviews.map((r) => (
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

            {r.comments?.map((c: ReviewComment) => (
              <div key={c.id} style={styles.reply}>
                <b style={styles.replyName}>{c.user_name || t(lang, "guest")}</b>
                <span style={styles.replyDate}>{formatDate(c.created_at, lang)}</span>
                {c.text && <p style={styles.replyText}>{c.text}</p>}
                {c.image_url && (
                  <button
                    type="button"
                    onClick={() => setLightbox(c.image_url || null)}
                    style={styles.replyImgBtn}
                    aria-label="image"
                  >
                    <img src={c.image_url} alt="" style={styles.replyImg} />
                  </button>
                )}
              </div>
            ))}

            {commentFor === r.id ? (
              <div style={styles.commentForm}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t(lang, "reviewsCommentPlaceholder")}
                  rows={2}
                  style={styles.commentInput}
                />
                {commentPhoto && (
                  <div style={styles.previewWrap}>
                    <img src={commentPhoto} alt="" style={styles.preview} />
                    <button
                      type="button"
                      onClick={() => setCommentPhoto(null)}
                      style={styles.previewRemove}
                      aria-label={t(lang, "reviewsRemovePhoto")}
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickPhoto}
                  style={{ display: "none" }}
                />
                <div style={styles.commentActions}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={styles.attachBtn}
                    aria-label={t(lang, "reviewsAttachPhoto")}
                    title={t(lang, "reviewsAttachPhoto")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddComment(r.id)}
                    disabled={submitting || (!commentText.trim() && !commentPhoto)}
                    style={{
                      ...styles.commentSubmit,
                      opacity: submitting || (!commentText.trim() && !commentPhoto) ? 0.5 : 1,
                    }}
                  >
                    {t(lang, "reviewsSend")}
                  </button>
                  <button type="button" onClick={resetCommentForm} style={styles.commentCancel}>
                    {t(lang, "reviewsCancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCommentFor(r.id)} style={styles.replyBtn}>
                {t(lang, "reviewsReply")}
              </button>
            )}
          </article>
        ))}
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
        onClose={() => setSheetOpen(false)}
        onSubmit={handleAddReview}
      />

      {lightbox && (
        <div style={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} />
        </div>
      )}
    </div>
  );
}

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
  emptyWrap: { padding: "48px 24px", textAlign: "center" },
  empty: { color: "var(--muted)", fontSize: 14, margin: 0 },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: 12,
    display: "flex", flexDirection: "column", gap: 8,
  },
  cardHead: { display: "flex", alignItems: "center", gap: 8 },
  av: {
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(165,42,42,0.15)", color: "var(--accent)",
    fontWeight: 700, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  reviewName: { fontSize: 13, fontWeight: 700, margin: 0 },
  reviewDate: { fontSize: 11, color: "var(--muted)" },
  starsRight: { color: "var(--accent)", fontSize: 12, letterSpacing: 1 },
  text: { fontSize: 13, lineHeight: 1.5, margin: 0, color: "var(--text)" },
  reply: {
    background: "var(--bg)", borderLeft: "3px solid var(--accent)",
    padding: "8px 10px", borderRadius: 10,
  },
  replyName: { fontSize: 11, fontWeight: 700 },
  replyDate: { fontSize: 10, color: "var(--muted)", marginLeft: 8 },
  replyText: { fontSize: 12, margin: "4px 0 0" },
  replyImgBtn: {
    display: "block", marginTop: 6, padding: 0,
    background: "none", border: "none", cursor: "pointer",
  },
  replyImg: {
    maxWidth: "100%", maxHeight: 180,
    borderRadius: 8, display: "block",
  },
  commentForm: { marginTop: 4 },
  commentInput: {
    width: "100%", padding: 10,
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)",
    fontSize: 13, fontFamily: "inherit",
    marginBottom: 8, resize: "vertical", boxSizing: "border-box",
  },
  previewWrap: {
    position: "relative", display: "inline-block",
    marginBottom: 8,
  },
  preview: {
    maxHeight: 120, maxWidth: "100%",
    borderRadius: 8, display: "block",
    border: "1px solid var(--border)",
  },
  previewRemove: {
    position: "absolute", top: 4, right: 4,
    width: 22, height: 22, borderRadius: "50%",
    background: "rgba(0,0,0,0.6)", color: "#fff",
    border: "none", cursor: "pointer",
    fontSize: 16, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  commentActions: { display: "flex", gap: 8, alignItems: "center" },
  attachBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: "var(--bg)", border: "1px solid var(--border)",
    color: "var(--muted)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  commentSubmit: {
    padding: "8px 14px", background: "var(--accent)",
    border: "none", borderRadius: 10, color: "#fff",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  commentCancel: {
    padding: "8px 14px", background: "transparent",
    border: "1px solid var(--border)", borderRadius: 10,
    color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  replyBtn: {
    alignSelf: "flex-start", background: "none", border: "none",
    color: "var(--accent)", fontSize: 12, cursor: "pointer",
    padding: 0, fontFamily: "inherit",
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
