import { useState, useEffect, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewReviewSheetProps {
  open: boolean;
  submitting: boolean;
  error: string;
  /** Если есть — sheet в edit-режиме: pre-fill значениями отзыва. */
  initial?: { rating: number; text: string; image_urls: string[] };
  onClose: () => void;
  onSubmit: (rating: number, text: string, photos: string[]) => void;
}

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SHEET_ANIM = 320;

export function NewReviewSheet({ open, submitting, error, initial, onClose, onSubmit }: NewReviewSheetProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [text, setText] = useState(initial?.text ?? "");
  const [photos, setPhotos] = useState<string[]>(initial?.image_urls ?? []);
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);


  const [vvHeight, setVvHeight] = useState<number | null>(
    typeof window !== "undefined" && window.visualViewport ? window.visualViewport.height : null
  );
  // keyboardOffset — на сколько px поднять sheet ВЫШЕ viewport-bottom'а
  // чтобы он встал над keyboard. Высчитывается из (innerHeight - vv.height)
  // — это и есть высота keyboard в layout-координатах. С meta
  // interactive-widget=overlays-content position:fixed элементы НЕ
  // репозиционируются автоматически, делаем это вручную через transform.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const refHeight = window.innerHeight;
    const update = () => {
      setVvHeight(vv.height);
      const overlap = Math.max(0, refHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(overlap);
    };
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [open]);

  // Body management — body.overflow lock пока sheet open (предотвращает
  // jump страницы за sheet'ом). zen-input-focused класс отдельно — на
  // focus/blur textarea'и (чтобы nav скрывался только когда юзер
  // действительно печатает).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      // Безопасный cleanup класса (если blur не успел firing).
      document.body.classList.remove("zen-input-focused");
    };
  }, [open]);

  const handleTextareaFocus = () => {
    document.body.classList.add("zen-input-focused");
    // KEYBOARD PREDICTION: 290 — типовая высота iOS keyboard без
    // QuickType bar. Раньше брал 360 — sheet «улетал» сильно выше
    // фактической keyboard top'ы, потом резко опускался к ней.
    // 290 — sheet встаёт чуть НИЖЕ реальной keyboard (если у юзера
    // keyboard 340 с QuickType), после vv.resize sheet поднимется
    // ещё на 50 — менее раздражающе чем «упасть» с 360 → 290.
    if (keyboardOffset === 0) {
      setKeyboardOffset(290);
      if (vvHeight) {
        setVvHeight(Math.max(280, vvHeight - 290));
      }
    }
  };
  const handleTextareaBlur = () => {
    document.body.classList.remove("zen-input-focused");
    // vv.resize firing-нет с актуальным значением (keyboard hide)
    // и сбросит offset обратно в 0.
  };

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), SHEET_ANIM);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Hydrate fields when sheet opens (handles edit/new transitions).
  useEffect(() => {
    if (open) {
      setRating(initial?.rating ?? 5);
      setText(initial?.text ?? "");
      setPhotos(initial?.image_urls ?? []);
      setLocalError("");
    } else {
      const t = setTimeout(() => {
        setRating(5);
        setText("");
        setPhotos([]);
        setLocalError("");
      }, SHEET_ANIM);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Textarea auto-grow up to 140px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  if (!mounted) return null;

  const handlePickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    const accepted = files.slice(0, remaining);
    let lastErr = "";
    accepted.forEach((file) => {
      if (!file.type.startsWith("image/")) { lastErr = "only images"; return; }
      if (file.size > MAX_FILE_SIZE) { lastErr = "max 2 MB"; return; }
      const reader = new FileReader();
      reader.onload = () => {
        const v = reader.result;
        if (typeof v === "string") {
          setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, v]));
        }
      };
      reader.readAsDataURL(file);
    });
    setLocalError(lastErr);
    // Множественные refocus попытки. change event user-initiated →
    // focus() внутри может открыть keyboard на iOS.
    textareaRef.current?.focus();
    requestAnimationFrame(() => textareaRef.current?.focus());
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!text.trim() || submitting) return;
    onSubmit(rating, text.trim(), photos);
  };

  const preventFocusSteal = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const canSubmit = text.trim().length > 0 && !submitting;
  const sheetMaxHeight = vvHeight ? Math.max(280, vvHeight - 24) : "85vh";
  const isEdit = !!initial;

  const overlayStyle: React.CSSProperties = {
    ...styles.overlay,
    background: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
    transition: `background-color ${SHEET_ANIM}ms cubic-bezier(0.32, 0.72, 0, 1)`,
  };
  // Slide-in: transform translateY 100% → 0.
  // Keyboard offset: margin-bottom (поднимает sheet над клавиатурой).
  // Эти две анимации НЕЗАВИСИМЫ — раньше комбинировались в одном
  // transform и при keyboard prediction → vv.resize получали
  // конфликтующие transition'ы (sheet «улетал куда-то»).
  const sheetStyle: React.CSSProperties = {
    ...styles.sheet,
    maxHeight: sheetMaxHeight,
    marginBottom: keyboardOffset,
    transform: visible ? "translateY(0)" : "translateY(100%)",
    transition:
      `transform ${SHEET_ANIM}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
      `margin-bottom 280ms cubic-bezier(0.32, 0.72, 0, 1), ` +
      `max-height 240ms cubic-bezier(0.32, 0.72, 0, 1)`,
  };

  return (
    <div style={overlayStyle} onClick={onClose} data-keyboard-aware="true">
      <div
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={styles.handle} aria-hidden />
        <div style={styles.scrollArea}>
          {/* Header: title + close + stars в одной композиции */}
          <div style={styles.headerRow}>
            <h3 style={styles.title}>
              {isEdit ? t(lang, "reviewsEditTitle") : t(lang, "reviewsFabNew")}
            </h3>
            <button
              type="button"
              onClick={onClose}
              onMouseDown={preventFocusSteal}
              onTouchStart={preventFocusSteal}
              style={styles.closeBtn}
              aria-label={t(lang, "close")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <div style={styles.starsRow}>
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

          {/* Photo previews — 3-col grid, max 10. Add-btn внутри grid'а. */}
          {(photos.length > 0 || isEdit) && (
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
            </div>
          )}

          {(error || localError) && (
            <p style={styles.error}>{error || localError}</p>
          )}
        </div>

        <input
          ref={fileInputRef}
          id="new-review-photo-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handlePickPhotos}
          style={{ display: "none" }}
        />

        {/* Pill composer — paperclip / textarea / send (как CustomOrderPage). */}
        <div style={styles.composerWrap}>
          <div style={styles.composer}>
            <div
              role="button"
              tabIndex={-1}
              aria-label="add photo"
              onClick={() => {
                if (photos.length >= MAX_PHOTOS) return;
                fileInputRef.current?.click();
              }}
              style={{
                ...styles.composerIconBtn,
                cursor: photos.length >= MAX_PHOTOS ? "not-allowed" : "pointer",
                opacity: photos.length >= MAX_PHOTOS ? 0.35 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </div>
            <textarea
              ref={textareaRef}
              className="zen-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={handleTextareaFocus}
              onBlur={handleTextareaBlur}
              placeholder={t(lang, "reviewsPlaceholder")}
              rows={1}
              style={styles.composerTextarea}
            />
            <button
              type="button"
              onClick={handleSubmit}
              onMouseDown={preventFocusSteal}
              onTouchStart={preventFocusSteal}
              disabled={!canSubmit}
              style={{
                ...styles.composerSendBtn,
                opacity: canSubmit ? 1 : 0.35,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
              aria-label={t(lang, "reviewsSubmit")}
            >
              {submitting ? (
                <span style={{ fontSize: 14, color: "#fff" }}>...</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
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
    padding: "8px 20px 16px",
    WebkitOverflowScrolling: "touch",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    WebkitTapHighlightColor: "transparent",
  },
  starsRow: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    marginBottom: 14,
  },
  star: {
    background: "none",
    border: "none",
    fontSize: 26,
    cursor: "pointer",
    padding: "2px 4px",
    lineHeight: 1,
    WebkitTapHighlightColor: "transparent",
  },
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
  error: { color: "var(--accent)", fontSize: 13, margin: "4px 0 12px" },

  // Pill composer внизу sheet'а (как в CustomOrderPage).
  composerWrap: {
    padding: "8px 16px 14px",
    background: "var(--bg)",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  composer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 2,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 22,
    padding: "4px 6px 4px 4px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
  },
  composerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    WebkitTapHighlightColor: "transparent",
  },
  composerTextarea: {
    flex: 1,
    minHeight: 36,
    maxHeight: 140,
    padding: "8px 4px",
    fontSize: 14,
    lineHeight: 1.45,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 0,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    color: "var(--text)",
  },
  composerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    transition: "opacity 0.15s, transform 0.15s",
    WebkitTapHighlightColor: "transparent",
  },
};
