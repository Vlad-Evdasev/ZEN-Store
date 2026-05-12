import { useState, useRef, useEffect } from "react";
import { submitCustomOrder, getAdminHandle } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

function SendArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

// Handle админа теперь берётся с бэка (app_settings: admin_tg_handle),
// его можно править из админки. Fallback на krot_eno если API failed.

function CheckCircleIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

interface CustomOrderPageProps {
  userId: string;
  userName: string | null;
  firstName: string;
  onBack?: () => void;
}

export function CustomOrderPage({ userId, userName, firstName }: CustomOrderPageProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const customName = firstName || "";
  const [customDesc, setCustomDesc] = useState("");
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);
  // Handle админа: lazy-инициализация из localStorage кэша, чтобы при
  // повторных открытиях формы НЕ было flash'а 'krot_eno' → актуальное
  // значение. На первом запуске (нет кэша) показываем пусто и подтянем
  // с бэка, чтобы старое значение не мелькало.
  const [sellerHandle, setSellerHandle] = useState<string | null>(() => {
    try { return localStorage.getItem("zen-admin-handle") || null; } catch { return null; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperclipRef = useRef<HTMLDivElement>(null);

  // Native non-passive MOUSEDOWN preventDefault на скрепке.
  // ТОЛЬКО mousedown, НЕ touchstart — touchstart preventDefault блокирует
  // синтетический click (iOS не дойдёт до onClick handler'а). mousedown
  // preventDefault блокирует focus shift на кнопку, но click продолжает
  // firing'ить нормально. Textarea сохраняет focus → keyboard остаётся.
  useEffect(() => {
    const el = paperclipRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      e.preventDefault();
    };
    el.addEventListener("mousedown", handler, { passive: false });
    return () => el.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAdminHandle()
      .then((h) => {
        if (cancelled) return;
        setSellerHandle(h);
        try { localStorage.setItem("zen-admin-handle", h); } catch {}
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const SELLER_TG_URL = sellerHandle ? `https://t.me/${sellerHandle}` : "";
  const SELLER_HANDLE = sellerHandle ? `@${sellerHandle}` : "";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [customDesc]);

  // refHeight captured at mount — используется и в visualViewport
  // effect, и в handleFocus для prediction'а keyboard size.
  const refHeightRef = useRef<number>(typeof window !== "undefined" ? window.innerHeight : 800);
  const HEADER = 62;
  const NAV = 64;
  // Прогноз клавиатуры iOS — 280-350px зависит от модели/QuickType bar.
  // Берём ВЕРХНЮЮ границу (360) специально: composer rises чуть выше
  // чем актуальный keyboard, hint-row («Ответим от @…») сразу остаётся
  // ВИДИМЫМ над клавиатурой. Когда vv.resize fires с реальным
  // значением (обычно меньше) — wrap чуть-чуть растёт, composer
  // опускается на пару пикселей — почти не заметно. Если бы prediction
  // был меньше реального — hint оказывался бы ПОД клавиатурой и
  // потом «дёргался» вверх когда vv.resize.
  const PREDICTED_KB = 360;

  useEffect(() => {
    const vv = window.visualViewport;
    const wrap = wrapRef.current;
    if (!vv || !wrap) return;
    let raf: number | null = null;
    const apply = () => {
      const kbOpen = vv.height < refHeightRef.current - 50;
      const navReserve = kbOpen ? 0 : NAV;
      const h = Math.max(200, vv.height - HEADER - navReserve);
      wrap.style.bottom = "auto";
      wrap.style.height = `${h}px`;
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
  }, []);

  // Body management + предсказание keyboard'а. Focus event firing'ит
  // ДО keyboard slide-up — здесь мгновенно адаптируем wrap.height под
  // прогнозируемый keyboard size, и CSS transition стартует синхронно
  // с iOS keyboard animation, а не после её окончания.
  const handleFocus = () => {
    document.body.classList.add("zen-input-focused");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const wrap = wrapRef.current;
    if (wrap) {
      const predicted = Math.max(200, refHeightRef.current - HEADER - PREDICTED_KB);
      wrap.style.bottom = "auto";
      wrap.style.height = `${predicted}px`;
    }
  };
  const handleBlur = () => {
    document.body.classList.remove("zen-input-focused");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    // wrap height вернётся к full размеру через vv.resize.
  };
  // Safety cleanup при unmount страницы.
  useEffect(() => {
    return () => {
      document.body.classList.remove("zen-input-focused");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // preventFocusSteal — на mobile тап по кнопке (paperclip, ✕, send)
  // блюрит textarea → клавиатура схлопывается. preventDefault на
  // pointerdown/mousedown не даёт кнопке стать focus target.
  const preventFocusSteal = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
  };

  const canSend = customDesc.trim().length > 0 && !customSubmitting;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSend) return;
    setCustomSubmitting(true);
    try {
      await submitCustomOrder(userId, {
        user_name: customName.trim() || undefined,
        user_username: userName ?? undefined,
        description: customDesc.trim(),
        size: "",
        image_data: customPhoto || undefined,
      });
      setCustomSuccess(true);
      setCustomDesc("");
      setCustomPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
    } finally {
      setCustomSubmitting(false);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setCustomPhoto((reader.result as string) || null);
    reader.readAsDataURL(file);
    // Множественные попытки refocus после file picker'а на iOS.
    // change event сам по себе user-initiated → focus() внутри него
    // может открыть keyboard. Доп. попытки через rAF и setTimeout —
    // на случай если первая не сработала (iOS варианты).
    textareaRef.current?.focus();
    requestAnimationFrame(() => textareaRef.current?.focus());
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // wrap.style.bottom управляется напрямую через visualViewport effect
  // (см. выше) — без React state, без re-render'ов во время keyboard
  // animation.

  if (customSuccess) {
    return (
      <div ref={wrapRef} style={styles.wrap} data-keyboard-aware="true">
        <div style={styles.threadSuccess}>
          <BotBubble>
            <div style={styles.successInner}>
              <CheckCircleIcon />
              <h3 style={styles.successTitle}>{t(lang, "customOrderSuccess")}</h3>
              <p style={styles.successHint}>{t(lang, "customOrderSubtitle")}</p>
              <button
                type="button"
                onClick={() => setCustomSuccess(false)}
                style={styles.newBtn}
              >
                <span style={styles.newBtnIcon} aria-hidden>↻</span>
                {t(lang, "customOrderNew")}
              </button>
            </div>
          </BotBubble>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={styles.wrap} data-keyboard-aware="true">
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Chat thread */}
        <div style={styles.thread}>
          <BotBubble>
            <div style={styles.botBubbleTitle}>{t(lang, "customOrderSubtitle")}</div>
            <div style={styles.botBubbleSubtitle}>{t(lang, "customOrderSubtitleHint")}</div>
          </BotBubble>

          {/* Photo preview bubble (if attached) */}
          {customPhoto && (
            <div style={styles.userBubbleRow}>
              <div style={styles.photoBubble}>
                <img src={customPhoto} alt="" style={styles.photoBubbleImg} />
                <button
                  type="button"
                  onClick={() => setCustomPhoto(null)}
                  onMouseDown={preventFocusSteal}
                  onTouchStart={preventFocusSteal}
                  style={styles.photoBubbleRemove}
                  aria-label={t(lang, "close")}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.spacer} />

        {/* Composer */}
        <div style={styles.composerWrap}>
          <div style={styles.composer}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              style={styles.fileHidden}
              aria-hidden
            />

            {/* DIV role=button + native mousedown preventDefault (см.
                useEffect). НЕ refocus'им textarea искусственно — если
                юзер тапнул скрепку без открытой клавиатуры, не надо
                триггерить handleFocus → wrap shrink (input подскакивал).
                Если клавиатура была — mousedown preventDefault сохраняет
                focus на textarea. */}
            <div
              ref={paperclipRef}
              role="button"
              tabIndex={-1}
              onClick={() => {
                fileInputRef.current?.click();
              }}
              style={{ ...styles.composerIconBtn, cursor: "pointer" }}
              aria-label={t(lang, "customOrderPhotoAdd")}
            >
              <PaperclipIcon />
            </div>

            <textarea
              ref={textareaRef}
              className="zen-textarea"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              onKeyDown={onComposerKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={t(lang, "customOrderPlaceholderDesc")}
              rows={1}
              style={styles.composerTextarea}
              required
            />

            <button
              type="submit"
              disabled={!canSend}
              style={{
                ...styles.composerSendBtn,
                ...(canSend ? {} : styles.composerSendBtnDisabled),
              }}
              aria-label={t(lang, "customOrderSubmit")}
            >
              <SendArrowIcon />
            </button>
          </div>

          {sellerHandle && (
            <div style={styles.replyHintRow}>
              {t(lang, "customOrderReplyFrom")}{" "}
              <a
                href={SELLER_TG_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.replyHintLink}
              >
                {SELLER_HANDLE}
              </a>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.botBubbleRow}>
      <div style={styles.botAvatar}>R</div>
      <div style={styles.botBubble}>{children}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    top: 62,
    // bottom НЕ задан — позиционируем через top+height в JS-effect'е.
    // Раньше top+bottom коллапсировали wrap на iOS при keyboard.
    left: 0,
    right: 0,
    maxWidth: 460,
    width: "100%",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "16px max(16px, env(safe-area-inset-left)) 0 max(16px, env(safe-area-inset-right))",
    background: "var(--bg)",
    zIndex: 5,
    // Smooth resize вместе с keyboard. CSS animates height — composer
    // (внизу flex-column) плавно поднимается с клавиатурой.
    transition: "height 280ms cubic-bezier(0.32, 0.72, 0, 1)",
  },
  headerBlock: {
    padding: "0 4px 6px",
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
    minHeight: 0,
  },
  threadCentered: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 32,
    paddingBottom: 24,
  },
  // Success-блок прижимается ближе к верху (а не центрируется по
  // вертикали), чтобы не висел низко. flex-start + умеренный top-padding.
  threadSuccess: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingTop: 48,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
    color: "var(--text)",
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  subtitle: {
    fontSize: 12,
    color: "var(--muted)",
    margin: "4px 0 0",
    lineHeight: 1.4,
  },

  form: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 0,
  },
  thread: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "8px 0 2px",
    flexShrink: 0,
  },
  replyHint: {
    fontSize: 11,
    color: "var(--muted)",
    paddingLeft: 36,
    letterSpacing: "0.04em",
  },

  /* Bot bubble */
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
    marginBottom: 0,
  },
  botBubble: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 13px",
    fontSize: 13.5,
    lineHeight: 1.45,
    color: "var(--text)",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  botBubbleTitle: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  botBubbleSubtitle: {
    fontSize: 12.5,
    color: "var(--muted)",
    marginTop: 4,
    lineHeight: 1.4,
  },
  /* Author row */
  authorRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 0 0 36px",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  authorTextCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  authorNameInput: {
    minHeight: 32,
    padding: "4px 10px",
    fontSize: 13,
    fontWeight: 600,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "var(--radius-md)",
  },
  authorUsername: {
    fontSize: 11,
    color: "var(--muted)",
    paddingLeft: 10,
    letterSpacing: "0.02em",
  },

  /* User-side attachments */
  userBubbleRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  photoBubble: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid var(--border)",
    maxWidth: "70%",
  },
  photoBubbleImg: {
    display: "block",
    width: "100%",
    maxHeight: 220,
    objectFit: "cover",
  },
  photoBubbleRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
  },

  /* Composer */
  composerWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 6,
    paddingBottom: 10,
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
  },
  composerTextarea: {
    flex: 1,
    minHeight: 36,
    maxHeight: 180,
    padding: "8px 4px",
    fontSize: 14,
    lineHeight: 1.45,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 0,
    resize: "none",
    outline: "none",
  },
  composerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s, transform 0.15s",
  },
  composerSendBtnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  replyHintRow: {
    paddingLeft: 14,
    paddingRight: 14,
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.4,
    letterSpacing: "0.01em",
  },
  replyHintLink: {
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
  },

  fileHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },

  /* Success */
  successInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "6px 4px",
    textAlign: "center",
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "var(--text)",
  },
  successHint: {
    fontSize: 13,
    color: "var(--muted)",
    margin: 0,
    lineHeight: 1.4,
  },
  newBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    marginTop: 6,
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  newBtnIcon: { fontSize: 16, lineHeight: 1 },
};
