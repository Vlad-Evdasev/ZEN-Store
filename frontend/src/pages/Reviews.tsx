import { useState, useEffect, useMemo } from "react";
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

  const refresh = () => {
    setLoading(true);
    getReviews().then(setReviews).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const { average, distribution } = useMemo(() => {
    if (reviews.length === 0) return { average: 0, distribution: [0, 0, 0, 0, 0] };
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    reviews.forEach((r) => {
      const clamped = Math.min(5, Math.max(1, r.rating));
      dist[clamped - 1] += 1;
      sum += clamped;
    });
    return { average: sum / reviews.length, distribution: dist };
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

  const handleAddComment = async (reviewId: number) => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await addReviewComment(reviewId, userId, { user_name: firstName, text: commentText.trim() });
      setCommentText("");
      setCommentFor(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "reviewsCommentError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={styles.wrap}><p style={styles.loading}>{t(lang, "loading")}</p></div>;
  }

  const maxCount = Math.max(1, ...distribution);

  return (
    <div style={styles.wrap}>
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "reviewsTitle")}</h2>

      {reviews.length > 0 ? (
        <div style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.big}>{average.toFixed(1).replace(".", ",")}</div>
            <div style={styles.heroStars} aria-hidden>★★★★★</div>
            <div style={styles.heroCount}>
              {t(lang, "reviewsRatingBasedOn").replace("{n}", String(reviews.length))}
            </div>
          </div>
          <div style={styles.heroBars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const c = distribution[star - 1];
              const w = Math.round((c / maxCount) * 100);
              return (
                <div key={star} style={styles.barRow}>
                  <span style={styles.barN}>{star}</span>
                  <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${w}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
                <p style={styles.replyText}>{c.text}</p>
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
                <div style={styles.commentActions}>
                  <button type="button" onClick={() => handleAddComment(r.id)} disabled={submitting} style={styles.commentSubmit}>
                    {t(lang, "reviewsSend")}
                  </button>
                  <button type="button" onClick={() => { setCommentFor(null); setCommentText(""); }} style={styles.commentCancel}>
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px", position: "relative" },
  title: { marginBottom: 16 },
  hero: {
    background: "linear-gradient(135deg, var(--accent), var(--accent-dim))",
    color: "#fff",
    borderRadius: 18, padding: 14,
    display: "flex", gap: 12, alignItems: "center",
    marginBottom: 16,
  },
  heroLeft: { flexShrink: 0 },
  big: { fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 800, lineHeight: 1 },
  heroStars: { fontSize: 14, letterSpacing: 2, marginTop: 4 },
  heroCount: { fontSize: 11, opacity: 0.85, marginTop: 2 },
  heroBars: { flex: 1, display: "flex", flexDirection: "column", gap: 3 },
  barRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 10 },
  barN: { width: 8, opacity: 0.9 },
  barTrack: { flex: 1, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", background: "#fff" },
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
  commentForm: { marginTop: 4 },
  commentInput: {
    width: "100%", padding: 10,
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)",
    fontSize: 13, fontFamily: "inherit",
    marginBottom: 8, resize: "vertical", boxSizing: "border-box",
  },
  commentActions: { display: "flex", gap: 8 },
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
};
