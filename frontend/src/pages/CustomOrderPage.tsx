import { useState, useRef, useEffect } from "react";
import { submitCustomOrder, getCartSellerHandle } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

function SendArrowIcon() {
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
  // Несколько фоток (до 5). Раньше был single customPhoto.
  const [customPhotos, setCustomPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 5;
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);
  // Handle продавца для bot-bubble «Ответим от @…». Отдельная настройка
  // от admin_tg_handle: для заявок не из каталога админ может назначить
  // конкретного продавца, который и будет отвечать. Lazy-инициализация
  // из localStorage кэша, чтобы при повторных открытиях формы НЕ было
  // flash'а 'krot_eno' → актуальное значение. На первом запуске (нет
  // кэша) показываем пусто и подтянем с бэка, чтобы старое не мелькало.
  const [sellerHandle, setSellerHandle] = useState<string | null>(() => {
    try { return localStorage.getItem("zen-seller-handle") || null; } catch { return null; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Tracks keyboard state to disable the paperclip while textarea is
  // focused. Reason: iOS native file picker UI dismisses the keyboard
  // when it appears — that's unavoidable. So we only allow opening the
  // picker when keyboard is already collapsed; nothing to lose then.
  const [kbOpen, setKbOpen] = useState(false);


  useEffect(() => {
    let cancelled = false;
    getCartSellerHandle()
      .then((h) => {
        if (cancelled) return;
        setSellerHandle(h);
        try { localStorage.setItem("zen-seller-handle", h); } catch {}
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

  // refHeight captured at mount — используется в visualViewport effect
  // для определения «kb открыта» и для post-picker height reset.
  const refHeightRef = useRef<number>(typeof window !== "undefined" ? window.innerHeight : 800);
  const HEADER = 62;
  const NAV = 64;
  // Upper-bound предикат высоты iOS-клавиатуры (включая QuickType bar
  // на большом iPhone Pro Max). Лучше overshoot чем undershoot:
  //   undershoot → composer кончает анимацию НИЖЕ актуальной kb-top,
  //     vv.resize потом «вытягивает» его вверх → виден jump вверх.
  //   overshoot → composer кончает анимацию НАД актуальной kb-top,
  //     vv.resize потом «опускает» его вниз на 30-60px → ощущается
  //     как settling, естественнее.
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

  // ВАЖНО: предиктивно сетим wrap.height СРАЗУ на focus event'е,
  // не дожидаясь vv.resize. Иначе на iOS первый vv.resize fire'ит
  // с задержкой ~50-100ms, transition стартует поздно, composer
  // визуально едет ПОСЛЕ того как клавиатура уже наполовину поднялась.
  // С предиктом transition стартует ровно в момент когда iOS начинает
  // slide-up клавиатуры → они идут синхронно.
  // body.overflow управляется mount/unmount useEffect'ом, здесь не
  // трогаем (иначе на blur разлочим, и следующий focus получит race).
  const handleFocus = () => {
    setKbOpen(true);
    document.body.classList.add("zen-input-focused");
    const wrap = wrapRef.current;
    if (wrap) {
      const predicted = Math.max(200, refHeightRef.current - HEADER - PREDICTED_KB);
      wrap.style.bottom = "auto";
      wrap.style.height = `${predicted}px`;
    }
  };
  const handleBlur = () => {
    setKbOpen(false);
    document.body.classList.remove("zen-input-focused");
    // Симметрично focus'у: предиктивно возвращаем wrap.height на
    // full размер СРАЗУ. Без этого на iOS vv.resize приходит с
    // задержкой ~50-100ms после старта kb slide-down → 260ms
    // height transition стартует поздно и composer едет «вслед»
    // за клавиатурой с visible lag. С предиктом transition
    // стартует ровно когда iOS начинает opening kb-collapse →
    // composer и kb едут синхронно.
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.style.bottom = "auto";
      wrap.style.height = `${refHeightRef.current - HEADER - NAV}px`;
    }
  };
  // body.overflow=hidden ставим на МОНТАЖЕ страницы и держим на всё
  // время пока юзер на CustomOrderPage. Раньше overflow ставился в
  // handleFocus (поздно — iOS успевал сдвинуть layout → «прыжок»),
  // потом я пробовал pre-lock на touchstart textarea — но изменение
  // overflow во время touch-event'а на iOS иногда вмешивалось в focus
  // sequence, особенно после взаимодействия с file picker'ом → kb
  // не открывалась.
  // Mount-lock: стабильное состояние всё время на странице. Никаких
  // focus-time race conditions, никаких прыжков. body scroll на этой
  // странице и так не нужен (wrap fixed, thread скроллит отдельно).
  useEffect(() => {
    document.body.classList.add("zen-customorder-active");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("zen-customorder-active");
      document.body.classList.remove("zen-input-focused");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      if (textareaUnlockTimerRef.current != null) {
        clearTimeout(textareaUnlockTimerRef.current);
        textareaUnlockTimerRef.current = null;
      }
    };
  }, []);

  // Блокируем textarea на 1.5s после paperclip-клика
  // (pointer-events: none + opacity dim). Без этого быстрый тап
  // textarea после dismiss picker'а ловит iOS-state machine quirk:
  // kb открывается и сразу сама закрывается. iOS нужно ~1s чтобы
  // очистить state после file-input-клика; programmatic focus не
  // возвращает kb. Единственное надёжное решение — не дать юзеру
  // фокусить textarea до того как iOS очистит state. Этот же lock
  // митигирует action-sheet dismiss bug при `multiple` атрибуте.
  const [textareaLocked, setTextareaLocked] = useState(false);
  const textareaUnlockTimerRef = useRef<number | null>(null);

  // preventFocusSteal — на mobile тап по кнопке (paperclip, ✕, send)
  // блюрит textarea → клавиатура схлопывается. preventDefault на
  // pointerdown/mousedown не даёт кнопке стать focus target.
  const preventFocusSteal = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
  };

  const canSend = customDesc.trim().length > 0 && !customSubmitting;
  const paperclipDisabled = kbOpen || customPhotos.length >= MAX_PHOTOS;

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
        image_urls: customPhotos,
      });
      setCustomSuccess(true);
      setCustomDesc("");
      setCustomPhotos([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
    } finally {
      setCustomSubmitting(false);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - customPhotos.length;
    const accepted = files.slice(0, remaining);
    accepted.forEach((file) => {
      if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        const v = reader.result;
        if (typeof v === "string") {
          setCustomPhotos((prev) => prev.length >= MAX_PHOTOS ? prev : [...prev, v]);
        }
      };
      reader.readAsDataURL(file);
    });
    // После file picker'а iOS закрыл клавиатуру. Сбрасываем body class
    // (показываем nav обратно) и wrap.height возвращаем на full размер
    // (иначе остаётся в predicted shrink'нутом состоянии → photo
    // bubble + composer + хвост оказываются за пределами overflow:hidden
    // wrap'а → визуально исчезают). body.overflow НЕ трогаем — он
    // под mount-lock'ом весь lifetime страницы.
    document.body.classList.remove("zen-input-focused");
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.style.height = `${refHeightRef.current - HEADER - NAV}px`;
    }
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
            {/* Hint всегда рендерится (даже когда sellerHandle ещё не
                загружен) с visibility: hidden — резервирует место в
                bot-bubble, чтобы при resolve'е API bubble не вырос и
                не сдвинул layout на ~0.5s после открытия клавиатуры. */}
            <div
              style={{
                ...styles.botBubbleHint,
                visibility: sellerHandle ? "visible" : "hidden",
              }}
            >
              {t(lang, "customOrderReplyFrom")}{" "}
              <a
                href={SELLER_TG_URL || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.replyHintLink}
              >
                {SELLER_HANDLE || "@krot_eno"}
              </a>
            </div>
          </BotBubble>

          {/* Photo preview bubbles (multiple, до 5) */}
          {customPhotos.map((photo, i) => (
            <div key={i} style={styles.userBubbleRow}>
              <div style={styles.photoBubble}>
                <img src={photo} alt="" style={styles.photoBubbleImg} />
                <button
                  type="button"
                  onClick={() => setCustomPhotos((prev) => prev.filter((_, idx) => idx !== i))}
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
        </div>

        {/* Spacer убран — thread теперь flex:1 сам занимает всё
            свободное место выше composer'а. */}

        {/* Composer */}
        <div style={styles.composerWrap}>
          <div style={styles.composerRow}>
            {/* Paperclip pill — <button> + sibling <input>, не label-
                wrapped. Раньше использовали <label>-wrapped-<input> с
                disabled-управлением — в iOS Telegram WebView label-
                input synthetic click мог обходить disabled и открывать
                picker когда kb открыта. Button даёт явный контроль:
                input.click() вызывается ТОЛЬКО когда мы явно решили
                в handler'е. preventFocusSteal на mousedown/touchstart
                не даёт кнопке украсть focus у textarea — иначе kbOpen
                flippаs to false до handler'а, и kb-open ветка
                пропускается. */}
            <button
              type="button"
              style={{
                ...styles.paperclipPill,
                cursor: paperclipDisabled ? "not-allowed" : "pointer",
                opacity: paperclipDisabled ? 0.35 : 1,
              }}
              aria-label={t(lang, "customOrderPhotoAdd")}
              onMouseDown={preventFocusSteal}
              onTouchStart={preventFocusSteal}
              onClick={() => {
                if (kbOpen) {
                  textareaRef.current?.blur();
                  return;
                }
                if (customPhotos.length >= MAX_PHOTOS) return;
                setTextareaLocked(true);
                if (textareaUnlockTimerRef.current != null) {
                  clearTimeout(textareaUnlockTimerRef.current);
                }
                textareaUnlockTimerRef.current = window.setTimeout(() => {
                  setTextareaLocked(false);
                  textareaUnlockTimerRef.current = null;
                }, 1500);
                fileInputRef.current?.click();
              }}
            >
              <PaperclipIcon />
            </button>
            {/* `multiple` позволяет выбрать несколько фото за тап.
                iOS-state-machine bug (kb сразу закрывается после
                action sheet dismiss) митигируется textareaLocked
                на 1.5s после клика. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPhotoChange}
              style={{ display: "none" }}
              aria-hidden
            />

            <div style={styles.composer}>
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
                style={{
                  ...styles.composerTextarea,
                  // Lock на 1.2s после paperclip-клика чтобы iOS успел
                  // очистить state machine. pointer-events:none делает
                  // tap'ы прозрачными, opacity показывает «погоди».
                  pointerEvents: textareaLocked ? "none" : "auto",
                  opacity: textareaLocked ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
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
          </div>

          {/* Hint «Ответим от @…» перенесён в bot-bubble (см. ниже
              в thread'е), чтобы под пилюлей не торчал var(--bg) фон. */}
        </div>
      </form>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.botBubbleRow}>
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
    // height transition нужен по двум причинам:
    //  1) На iOS первый visualViewport.resize часто fire'ит с финальным
    //     значением ДО того как kb визуально начинает sliding up.
    //     Без transition wrap мгновенно snap'ается к kb-open layout
    //     ДО появления клавиатуры → ощущается как «прыжок страницы».
    //  2) Subsequent vv.resize события приходят дискретно (50-100ms
     //    apart), без transition каждый виден как ступенчатый jump.
    // 260ms cubic-bezier(0.32, 0.72, 0, 1) close to iOS keyboard
    // easing → composer едет плавно вместе с kb.
    transition: "height 260ms cubic-bezier(0.32, 0.72, 0, 1)",
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

  // form — positioning context для absolute composerWrap. Thread
  // занимает весь form height; composerWrap floating над ним.
  form: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  // Thread скроллит на полный height формы. paddingBottom оставляет
  // место под composer pill — содержимое не залипает за ним при
  // прокрутке к низу. Когда юзер прокручивает thread выше — фото и
  // bubbles ПРОХОДЯТ ПОД composer pill (composerWrap прозрачный).
  thread: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "8px 0 60px",
    WebkitOverflowScrolling: "touch",
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
    // Все четыре угла одинаковые — раньше bottom-left был 4px (tail к
    // R-аватару слева), но сам аватар убрали, и асимметричный угол
    // выглядел оторвано.
    borderRadius: 16,
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
  // Hint в bot-bubble — отделён от подзаголовка тонкой полосой.
  botBubbleHint: {
    fontSize: 11.5,
    color: "var(--muted)",
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px dashed var(--border)",
    lineHeight: 1.4,
    letterSpacing: "0.01em",
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

  /* composerWrap — absolute bottom, ПРОЗРАЧНЫЙ. Thread скроллится
     ПОД пилюлей, без var(--bg) полосы перекрывающей контент.
     Только сама пилюля (composer) имеет solid bg. */
  composerWrap: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "transparent",
    pointerEvents: "none",
  },
  // Horizontal row: paperclip-pill + composer-pill (как Telegram).
  // alignItems: center → пилюли выравниваются по вертикальному
  // центру, даже если их высоты слегка различаются (round vs rounded
  // rectangle могут отрисовываться чуть по-разному).
  // composerWrap имеет pointer-events: none, его потомки нужно явно
  // ставить в auto чтобы быть кликабельными.
  composerRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  // Standalone round paperclip button to the left of the composer pill.
  // box-sizing: border-box → external height = 44px, matches composer
  // pill (36 content + 6 padding + 2 border = 44). Both pills sit
  // bottom-aligned in composerRow.
  paperclipPill: {
    boxSizing: "border-box",
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    // override global .zen-app form label { margin-bottom: 6px } —
    // иначе margin делает label выше centerline ряда на 3px и пилюли
    // выглядят рассинхронизированными.
    margin: 0,
    gap: 0,
    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
    transition: "opacity 0.15s",
    pointerEvents: "auto",
  },
  // Compact chat-input pill. pointer-events: auto восстанавливает
  // interactivity (composerWrap родитель имеет pointer-events: none
  // чтобы тапы по transparent зоне проваливались в thread).
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
    pointerEvents: "auto",
  },
  composerIconBtn: {
    width: 30,
    height: 30,
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
    padding: "7px 8px",
    fontSize: 15,
    lineHeight: 1.4,
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
