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
// Upper-bound предикат высоты iOS-клавиатуры (см. CustomOrderPage).
// Лучше overshoot чем undershoot — overshoot ощущается как settling,
// undershoot как jump вверх когда vv.resize корректирует.
const PREDICTED_KB = 360;
// Минимальный отступ сверху sheet'а (видна страница за ним).
const SHEET_TOP_GAP = 56;

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.5l2.95 6.13 6.55.95-4.75 4.63 1.12 6.5L12 17.7l-5.87 3.01 1.12-6.5L2.5 9.58l6.55-.95L12 2.5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ratingLabel(lang: string, r: number): string {
  if (lang === "ru") {
    return ["", "Плохо", "Так себе", "Нормально", "Хорошо", "Отлично!"][r] || "";
  }
  return ["", "Bad", "So-so", "OK", "Good", "Excellent!"][r] || "";
}

function botPrompt(lang: string, isEdit: boolean): string {
  if (isEdit) {
    return lang === "ru"
      ? "Поправьте отзыв, если что-то изменилось."
      : "Update your review if anything changed.";
  }
  return lang === "ru"
    ? "Поделитесь впечатлениями. Можно приложить фото."
    : "Share your impression. You can attach photos.";
}

export function NewReviewSheet({ open, submitting, error, initial, onClose, onSubmit }: NewReviewSheetProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [text, setText] = useState(initial?.text ?? "");
  const [photos, setPhotos] = useState<string[]>(initial?.image_urls ?? []);
  const [localError, setLocalError] = useState("");
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [textareaLocked, setTextareaLocked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaUnlockTimerRef = useRef<number | null>(null);
  // refHeight — full viewport height на момент открытия sheet'а.
  // Используется для предикта overlay-height при focus event'е и для
  // post-picker reset (см. onPhotoChange).
  const refHeightRef = useRef<number>(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  const [overlayHeight, setOverlayHeight] = useState<number>(
    typeof window !== "undefined" && window.visualViewport
      ? window.visualViewport.height
      : (typeof window !== "undefined" ? window.innerHeight : 800)
  );

  // visualViewport listener — overlay.height = vv.height. Когда
  // клавиатура открывается, vv.height shrinks → overlay shrinks →
  // sheet inside (flex-end) поднимается вместе с keyboard top.
  // Когда клавиатура закрывается — vv.height grows back → sheet
  // плавно опускается. Без monotonic shrink: естественное поведение
  // (как в CustomOrderPage). height transition сглаживает дискретные
  // vv.resize события в smooth animation.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let raf: number | null = null;
    const apply = () => {
      setOverlayHeight(vv.height);
      setKbOpen(vv.height < refHeightRef.current - 50);
    };
    const schedule = () => {
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener("resize", schedule);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
    };
  }, [open]);

  // Body management — lock scroll пока sheet open. zen-input-focused
  // класс отдельно — на focus/blur textarea'и (скрывает nav только
  // когда юзер действительно печатает).
  useEffect(() => {
    if (!open) return;
    refHeightRef.current = window.innerHeight;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.classList.remove("zen-input-focused");
      if (textareaUnlockTimerRef.current != null) {
        clearTimeout(textareaUnlockTimerRef.current);
        textareaUnlockTimerRef.current = null;
      }
    };
  }, [open]);

  // Predictive shrink на focus — сетим overlayHeight СРАЗУ к
  // predicted post-kb значению, не дожидаясь vv.resize. На iOS первый
  // vv.resize fire'ит с задержкой ~50-100ms, без предикта transition
  // стартует поздно и sheet «опаздывает» за keyboard'ом.
  const handleTextareaFocus = () => {
    document.body.classList.add("zen-input-focused");
    setKbOpen(true);
    const predicted = Math.max(280, refHeightRef.current - PREDICTED_KB);
    setOverlayHeight(predicted);
  };
  const handleTextareaBlur = () => {
    document.body.classList.remove("zen-input-focused");
    setKbOpen(false);
    // overlayHeight восстановится через vv.resize listener когда
    // клавиатура реально закроется.
  };

  // Sheet mount/unmount animation
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

  // Hydrate fields when sheet opens (new/edit transitions).
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

  // Textarea auto-grow up to 120px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  // Auto-scroll thread to bottom when new photo added (chat UX).
  useEffect(() => {
    if (photos.length === 0) return;
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [photos.length]);

  if (!mounted) return null;

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    // iOS закрыл kb после file picker'а — сбрасываем nav-hidden класс.
    document.body.classList.remove("zen-input-focused");
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!text.trim() || submitting) return;
    onSubmit(rating, text.trim(), photos);
  };

  // paperclip: при kb-open сначала закрываем kb (blur textarea),
  // picker НЕ открываем. preventDefault блокирует default label
  // behaviour (синхронный synthetic click на input → file picker).
  // Плюс input disabled когда kbOpen — belt-and-suspenders.
  // Повторный тап (когда kb уже закрыта) откроет picker нормально.
  const handlePaperclipClick = (e: React.MouseEvent<HTMLLabelElement>) => {
    if (kbOpen) {
      e.preventDefault();
      textareaRef.current?.blur();
      return;
    }
    // Блокируем textarea на 1.2s — без этого быстрая sequence
    // paperclip → dismiss picker → tap textarea ловит iOS-state-machine
    // bug (kb открывается и сразу сама закрывается).
    setTextareaLocked(true);
    if (textareaUnlockTimerRef.current != null) {
      clearTimeout(textareaUnlockTimerRef.current);
    }
    textareaUnlockTimerRef.current = window.setTimeout(() => {
      setTextareaLocked(false);
      textareaUnlockTimerRef.current = null;
    }, 1200);
  };

  const preventFocusSteal = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Click stops on visible surface — не закрываем sheet при тапе на
  // rating-card, bot-bubble, фото или composer. Тап в «пустую» зону
  // sheet'а (gaps между surfaces, dimmed backdrop сверху) пропускает
  // event до overlay.onClick → sheet закрывается.
  const stopPropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const canSubmit = text.trim().length > 0 && !submitting;
  const isEdit = !!initial;
  // kbOpen в paperclipDisabled — input disabled пока kb открыта, label
  // не сможет триггернуть picker через synthetic click. Single-tap
  // только закроет kb. Next tap откроет picker (как в CustomOrderPage).
  const paperclipDisabled = kbOpen || photos.length >= MAX_PHOTOS;

  const overlayStyle: React.CSSProperties = {
    ...styles.overlay,
    height: overlayHeight,
    background: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
    transition:
      `background-color ${SHEET_ANIM}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
      `height 260ms cubic-bezier(0.32, 0.72, 0, 1)`,
  };
  const sheetStyle: React.CSSProperties = {
    ...styles.sheet,
    maxHeight: Math.max(280, overlayHeight - SHEET_TOP_GAP),
    transform: visible ? "translateY(0)" : "translateY(100%)",
    transition:
      `transform ${SHEET_ANIM}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
      `max-height 260ms cubic-bezier(0.32, 0.72, 0, 1)`,
  };

  return (
    <div style={overlayStyle} onClick={onClose} data-keyboard-aware="true">
      <div
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
      >
        {/* НЕТ handle / header / close X — тап в dimmed зону закрывает sheet. */}
        <div ref={threadRef} style={styles.thread}>
          {/* Rating hero block — большие интерактивные звёзды + label */}
          <div style={styles.ratingBlock} onClick={stopPropClick}>
            <div style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((r) => {
                const active = r <= rating;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    onMouseDown={preventFocusSteal}
                    onTouchStart={preventFocusSteal}
                    aria-label={`${r}`}
                    style={{
                      ...styles.starBtn,
                      color: active ? "var(--accent)" : "var(--border)",
                      transform: active ? "scale(1)" : "scale(0.92)",
                    }}
                  >
                    <StarIcon filled={active} />
                  </button>
                );
              })}
            </div>
            <div style={styles.ratingLabel} aria-live="polite">
              {ratingLabel(lang, rating)}
            </div>
          </div>

          {/* Bot bubble — friendly explainer / edit hint */}
          <div style={styles.botBubbleRow} onClick={stopPropClick}>
            <div style={styles.botAvatar}>R</div>
            <div style={styles.botBubble}>{botPrompt(lang, isEdit)}</div>
          </div>

          {/* Photo bubbles (user-side, chat-style). */}
          {photos.map((p, i) => (
            <div key={i} style={styles.userBubbleRow} onClick={stopPropClick}>
              <div style={styles.photoBubble}>
                <img src={p} alt="" style={styles.photoBubbleImg} />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  onMouseDown={preventFocusSteal}
                  onTouchStart={preventFocusSteal}
                  style={styles.photoBubbleRemove}
                  aria-label={t(lang, "close")}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {(error || localError) && (
            <p style={styles.error}>{error || localError}</p>
          )}
        </div>

        {/* Composer pill — paperclip / textarea / send. */}
        <div style={styles.composerWrap} onClick={stopPropClick}>
          <div style={styles.composerRow}>
            <label
              style={{
                ...styles.paperclipPill,
                cursor: paperclipDisabled ? "not-allowed" : "pointer",
                opacity: paperclipDisabled ? 0.35 : 1,
              }}
              aria-label="add photo"
              onClick={handlePaperclipClick}
            >
              {/* НЕТ `multiple` атрибута — критично. С `multiple` iOS
                  показывает action sheet, dismiss которого оставляет
                  dirty state и ломает следующий focus textarea
                  (см. длинный comment в CustomOrderPage). */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPhotoChange}
                disabled={paperclipDisabled}
                style={{ display: "none" }}
                aria-hidden
              />
              <PaperclipIcon />
            </label>

            <div style={styles.composer}>
              <textarea
                ref={textareaRef}
                className="zen-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onComposerKeyDown}
                onFocus={handleTextareaFocus}
                onBlur={handleTextareaBlur}
                placeholder={t(lang, "reviewsPlaceholder")}
                rows={1}
                style={{
                  ...styles.composerTextarea,
                  pointerEvents: textareaLocked ? "none" : "auto",
                  opacity: textareaLocked ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
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
                  <SendIcon />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    // top + height (не inset:0 → bottom:0) — overlay занимает доступную
    // над-клавиатурой область, его bottom edge движется вверх когда
    // vvHeight уменьшается → sheet внутри (flex-end) автоматически
    // прижимается к keyboard top.
    top: 0,
    left: 0,
    right: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 1500,
  },
  sheet: {
    // Прозрачный sheet — содержимое (rating-card, bot-bubble, photo
    // bubbles, composer) плавает на dimmed/blurred backdrop как
    // независимые элементы. Без bg, border-radius, тени — sheet это
    // только layout-контейнер. Тап в dim-зону (НЕ на visible surface)
    // пропускается до overlay.onClick → закрывает форму.
    // safe-area-inset-bottom уехал внутрь composerWrap (часть его
    // tap-area со stopPropagation), чтобы тап в home-indicator зону
    // не закрывал случайно форму.
    width: "100%",
    maxWidth: 520,
    background: "transparent",
    padding: 0,
    display: "flex",
    flexDirection: "column",
  },

  thread: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    // Padding-top больше — сверху видна dimmed зона (тапаешь = закрываешь).
    padding: "20px 16px 14px",
    WebkitOverflowScrolling: "touch",
  },

  /* Rating hero — звёзды + dynamic label. По центру, генерит
     ощущение «главного действия» в форме. */
  ratingBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "10px 0 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  },
  starsRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  starBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    lineHeight: 0,
    transition: "color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
    WebkitTapHighlightColor: "transparent",
  },
  ratingLabel: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--accent)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    minHeight: 16,
  },

  /* Bot bubble (как CustomOrderPage) */
  botBubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  botAvatar: {
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
  botBubble: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "9px 13px",
    fontSize: 13.5,
    lineHeight: 1.4,
    color: "var(--text)",
    maxWidth: "82%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },

  /* User-side photo bubbles */
  userBubbleRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  photoBubble: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid var(--border)",
    maxWidth: "62%",
  },
  photoBubbleImg: {
    display: "block",
    width: "100%",
    maxHeight: 180,
    objectFit: "cover",
  },
  photoBubbleRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    WebkitTapHighlightColor: "transparent",
  },

  error: { color: "var(--accent)", fontSize: 13, margin: "2px 0 0" },

  /* Composer — bottom pill row (paperclip + composer + send). bg
     transparent чтобы вся форма «плавала» на dimmed-backdrop. Сами
     pills (paperclip + composer) имеют surface bg → visible.
     safe-area-inset-bottom включён в padding-bottom — tap в home-
     indicator зону регистрируется на composerWrap (со stopProp)
     → не закрывает форму случайно. */
  composerWrap: {
    flexShrink: 0,
    padding: "8px 16px calc(14px + env(safe-area-inset-bottom, 0))",
    background: "transparent",
  },
  composerRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  paperclipPill: {
    boxSizing: "border-box",
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    margin: 0,
    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
    transition: "opacity 0.15s",
  },
  composer: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 24,
    padding: "3px 4px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
  },
  composerTextarea: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    padding: "7px 10px",
    fontSize: 15,
    lineHeight: 1.4,
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
