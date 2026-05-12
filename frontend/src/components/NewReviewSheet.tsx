import { useState, useEffect, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewReviewSheetProps {
  open: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string, photos: string[]) => void;
}

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB per photo

export function NewReviewSheet({ open, submitting, error, onClose, onSubmit }: NewReviewSheetProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // visualViewport.height — при открытии клавиатуры sheet остаётся
  // полностью видимым (max-height сжимается под доступную область).
  const [vvHeight, setVvHeight] = useState<number | null>(
    typeof window !== "undefined" && window.visualViewport ? window.visualViewport.height : null
  );
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setRating(5);
      setText("");
      setPhotos([]);
      setLocalError("");
    }
  }, [open]);

  if (!open) return null;

  const handlePickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    const accepted = files.slice(0, remaining);
    const errors: string[] = [];
    accepted.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        errors.push("only images");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push("max 2 MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const v = reader.result;
        if (typeof v === "string") {
          setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, v]));
        }
      };
      reader.readAsDataURL(file);
    });
    if (errors.length > 0) setLocalError(errors[0]);
    else setLocalError("");
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!text.trim() || submitting) return;
    onSubmit(rating, text.trim(), photos);
  };

  // preventFocusSteal: на mobile тап по кнопке убирает фокус с textarea
  // → клавиатура схлопывается. preventDefault на mousedown/touchstart
  // не даёт кнопке стать focus target — textarea сохраняет фокус,
  // клавиатура остаётся открытой.
  const preventFocusSteal = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const canSubmit = text.trim().length > 0 && !submitting;
  const sheetMaxHeight = vvHeight ? Math.max(280, vvHeight - 24) : "85vh";

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{ ...styles.sheet, maxHeight: sheetMaxHeight }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={styles.handle} aria-hidden />
        <div style={styles.scrollArea}>
          <h3 style={styles.title}>{t(lang, "reviewsFabNew")}</h3>

          <div style={styles.row}>
            <span style={styles.label}>{t(lang, "reviewsRatingLabel")}</span>
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r)}
                onMouseDown={preventFocusSteal}
                onTouchStart={preventFocusSteal}
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

          {/* Photo grid + add button */}
          <div style={styles.photoGrid}>
            {photos.map((p, i) => (
              <div key={i} style={styles.photoCell}>
                <img src={p} alt="" style={styles.photoImg} />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  onMouseDown={preventFocusSteal}
                  onTouchStart={preventFocusSteal}
                  style={styles.photoRemove}
                  aria-label="remove"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onMouseDown={preventFocusSteal}
                onTouchStart={preventFocusSteal}
                style={styles.photoAdd}
                aria-label="add photo"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span style={styles.photoAddLabel}>
                  {photos.length === 0 ? "Фото" : `+${photos.length}/${MAX_PHOTOS}`}
                </span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePickPhotos}
            style={{ display: "none" }}
          />

          {(error || localError) && (
            <p style={styles.error}>{error || localError}</p>
          )}
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            onMouseDown={preventFocusSteal}
            onTouchStart={preventFocusSteal}
            style={styles.cancel}
          >
            {t(lang, "reviewsCancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            onMouseDown={preventFocusSteal}
            onTouchStart={preventFocusSteal}
            style={{ ...styles.submit, opacity: canSubmit ? 1 : 0.5 }}
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
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    // z-index выше bottom-nav (10-30), header (1300 он чужой), но
    // overlay sheets обычно 100-1500. 1500 — safe.
    zIndex: 1500,
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    background: "var(--bg)",
    borderRadius: "20px 20px 0 0",
    padding: 0,
    boxShadow: "0 -8px 30px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    paddingBottom: "env(safe-area-inset-bottom, 0)",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: "var(--border)",
    margin: "10px auto 6px",
    flexShrink: 0,
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "8px 20px 0",
    WebkitOverflowScrolling: "touch",
  },
  title: { margin: "6px 0 14px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" },
  row: { display: "flex", alignItems: "center", gap: 4, marginBottom: 12, flexWrap: "wrap" },
  label: { fontSize: 13, color: "var(--muted)", marginRight: 6 },
  star: {
    background: "none",
    border: "none",
    fontSize: 26,
    cursor: "pointer",
    padding: "2px 4px",
    lineHeight: 1,
    WebkitTapHighlightColor: "transparent",
  },
  textarea: {
    width: "100%",
    padding: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--text)",
    fontSize: 14,
    lineHeight: 1.5,
    fontFamily: "inherit",
    resize: "vertical",
    marginBottom: 12,
    boxSizing: "border-box",
    minHeight: 92,
  },

  // Photo grid: автоматическая сетка 3 столбца, квадратные ячейки.
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  photoCell: {
    position: "relative",
    aspectRatio: "1",
    borderRadius: 10,
    overflow: "hidden",
    background: "var(--surface)",
    border: "1px solid var(--border)",
  },
  photoImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.65)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: "20px",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
  },
  photoAdd: {
    aspectRatio: "1",
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px dashed var(--border)",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 0,
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  },
  photoAddLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  error: { color: "var(--accent)", fontSize: 13, margin: "4px 0 12px" },

  // Action bar — приклеена к низу sheet'а, ВНЕ scrollArea, всегда видна.
  actions: {
    display: "flex",
    gap: 8,
    padding: "12px 20px 16px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg)",
    flexShrink: 0,
  },
  cancel: {
    flex: 1,
    padding: 13,
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--muted)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  },
  submit: {
    flex: 1.4,
    padding: 13,
    background: "var(--accent)",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  },
};
