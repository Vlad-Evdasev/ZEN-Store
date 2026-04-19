import { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewReviewSheetProps {
  open: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
}

export function NewReviewSheet({ open, submitting, error, onClose, onSubmit }: NewReviewSheetProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) {
      setRating(5);
      setText("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!text.trim() || submitting) return;
    onSubmit(rating, text.trim());
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.handle} aria-hidden />
        <h3 style={styles.title}>{t(lang, "reviewsFabNew")}</h3>

        <div style={styles.row}>
          <span style={styles.label}>{t(lang, "reviewsRatingLabel")}</span>
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              aria-label={`${r}`}
              style={{ ...styles.star, color: r <= rating ? "var(--accent)" : "var(--muted)" }}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className="zen-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(lang, "reviewsPlaceholder")}
          rows={4}
          style={styles.textarea}
        />
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.cancel}>{t(lang, "reviewsCancel")}</button>
          <button
            type="button"
            disabled={submitting || !text.trim()}
            onClick={handleSubmit}
            style={{ ...styles.submit, opacity: submitting || !text.trim() ? 0.5 : 1 }}
          >
            {submitting ? "..." : t(lang, "reviewsSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 100,
  },
  sheet: {
    width: "100%", maxWidth: 480,
    background: "var(--bg)",
    borderRadius: "16px 16px 0 0",
    padding: "12px 20px 24px",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    background: "var(--border)", margin: "0 auto 14px",
  },
  title: { margin: "0 0 14px", fontSize: 16, fontWeight: 700 },
  row: { display: "flex", alignItems: "center", gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: "var(--muted)", marginRight: 4 },
  star: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 0 },
  textarea: {
    width: "100%", padding: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)",
    fontSize: 14, fontFamily: "inherit",
    resize: "vertical", marginBottom: 10, boxSizing: "border-box",
  },
  error: { color: "var(--accent)", fontSize: 13, margin: "0 0 10px" },
  actions: { display: "flex", gap: 8 },
  cancel: {
    flex: 1, padding: 12,
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--muted)",
    fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  },
  submit: {
    flex: 1, padding: 12,
    background: "var(--accent)", border: "none",
    borderRadius: 10, color: "#fff",
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
};
