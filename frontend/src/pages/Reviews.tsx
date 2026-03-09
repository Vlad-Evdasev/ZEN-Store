import { useState, useEffect } from "react";
import {
  getReviews,
  addReview,
  addReviewComment,
  type Review,
  type ReviewComment,
} from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface ReviewsProps {
  userId: string;
  firstName: string;
  onBack: () => void;
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

export function Reviews({ userId, firstName, onBack }: ReviewsProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");

  const refresh = () => {
    setLoading(true);
    getReviews()
      .then(setReviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await addReview(userId, {
        user_name: firstName,
        rating: newRating,
        text: newText.trim(),
      });
      setNewText("");
      setNewRating(5);
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
    setError("");
    try {
      await addReviewComment(reviewId, userId, {
        user_name: firstName,
        text: commentText.trim(),
      });
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
    return (
      <div style={styles.loading}>
        <p>{t(lang, "loading")}</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>
        ← {t(lang, "backToCatalog")}
      </button>

      <h2 className="zen-page-title" style={styles.title}>{t(lang, "reviewsTitle")}</h2>

      <form onSubmit={handleAddReview} style={styles.form}>
        <div style={styles.ratingRow}>
          <span style={styles.label}>{t(lang, "reviewsRatingLabel")}</span>
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setNewRating(r)}
              style={{
                ...styles.starBtn,
                color: r <= newRating ? "var(--accent)" : "var(--muted)",
              }}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          className="zen-textarea"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={t(lang, "reviewsPlaceholder")}
          rows={3}
          style={styles.textarea}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" className="zen-btn-primary" disabled={submitting} style={styles.submitBtn}>
          {submitting ? "..." : t(lang, "reviewsSubmit")}
        </button>
      </form>

      <div style={styles.list}>
        {reviews.map((r) => (
          <div key={r.id} style={styles.review}>
            <div style={styles.reviewHead}>
              <span style={styles.reviewName}>{r.user_name || t(lang, "guest")}</span>
              <span style={styles.reviewDate}>{formatDate(r.created_at)}</span>
            </div>
            <div style={styles.reviewStars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  style={{
                    color: s <= r.rating ? "var(--accent)" : "var(--muted)",
                    fontSize: 14,
                  }}
                >
                  ★
                </span>
              ))}
            </div>
            <p style={styles.reviewText}>{r.text}</p>

            <div style={styles.comments}>
              {r.comments?.map((c: ReviewComment) => (
                <div key={c.id} style={styles.comment}>
                  <span style={styles.commentName}>{c.user_name || t(lang, "guest")}</span>
                  <span style={styles.commentDate}>{formatDate(c.created_at)}</span>
                  <p style={styles.commentText}>{c.text}</p>
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
                    <button
                      type="button"
                      onClick={() => handleAddComment(r.id)}
                      disabled={submitting}
                      style={styles.commentSubmit}
                    >
                      {t(lang, "reviewsSend")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCommentFor(null);
                        setCommentText("");
                      }}
                      style={styles.commentCancel}
                    >
                      {t(lang, "reviewsCancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCommentFor(r.id)}
                  style={styles.replyBtn}
                >
                  {t(lang, "reviewsReply")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <p style={styles.empty}>{t(lang, "reviewsEmpty")}</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 20,
  },
  form: {
    marginBottom: 24,
    padding: 20,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  ratingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  label: { fontSize: 14, color: "var(--muted)" },
  starBtn: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    padding: 12,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    marginBottom: 12,
    resize: "vertical",
  },
  error: {
    color: "var(--accent)",
    fontSize: 13,
    marginBottom: 12,
  },
  submitBtn: {
    padding: 12,
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: 16 },
  review: {
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  reviewHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewName: { fontWeight: 600, fontSize: 14 },
  reviewDate: { fontSize: 12, color: "var(--muted)" },
  reviewStars: { marginBottom: 8 },
  reviewText: { fontSize: 14, lineHeight: 1.6, color: "var(--text)", marginBottom: 12 },
  comments: { marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" },
  comment: {
    marginBottom: 12,
    paddingLeft: 12,
    borderLeft: "2px solid var(--border)",
  },
  commentName: { fontSize: 12, fontWeight: 600 },
  commentDate: { fontSize: 11, color: "var(--muted)", marginLeft: 8 },
  commentText: { fontSize: 13, marginTop: 4 },
  commentForm: { marginTop: 8 },
  commentInput: {
    width: "100%",
    padding: 10,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "inherit",
    marginBottom: 8,
    resize: "vertical",
  },
  commentActions: { display: "flex", gap: 8 },
  commentSubmit: {
    padding: "8px 14px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
  },
  commentCancel: {
    padding: "8px 14px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--muted)",
    fontSize: 13,
    cursor: "pointer",
  },
  replyBtn: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 13,
    cursor: "pointer",
  },
  empty: { textAlign: "center", color: "var(--muted)", padding: 24 },
  loading: { textAlign: "center", padding: 48, color: "var(--muted)" },
};
