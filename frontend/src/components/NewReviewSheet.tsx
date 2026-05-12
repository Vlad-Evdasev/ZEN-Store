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
// SHEET_OPEN_ANIM — открытие. Front-loaded easing (sheet быстро
// «появляется», затем плавно оседает). 520ms feel'ит снэппи но
// не резко.
const SHEET_OPEN_ANIM = 520;
const OPEN_EASING = "cubic-bezier(0.25, 1, 0.5, 1)"; // ~easeOutQuart
// SHEET_CLOSE_ANIM — закрытие. Дольше + ease-in-out: sheet начинает
// двигаться плавно (премиальное замешательство), середина — ровный
// glide, в конце мягко оседает за экраном. Без ease-in-out close
// казался слишком резким — front-loaded easing зашвыривал sheet
// быстро вниз и большую часть anim не было видно ничего.
const SHEET_CLOSE_ANIM = 720;
const CLOSE_EASING = "cubic-bezier(0.4, 0, 0.4, 1)"; // smooth in-out
// Backdrop blur amount. Animated 0px→BLUR_AMOUNT при open, обратно при
// close. Раньше блюр был статичный (всегда 6px пока overlay в DOM) →
// при open/close виден мгновенный «pop» blur'а. Animated → fade.
const BLUR_AMOUNT = 8;
// EASING для не-open/close transitions (kb padding-bottom etc).
// iOS-keyboard-style curve — лучше всего трекается с реальной
// клавиатурой когда юзер фокусирует/блюрит textarea.
const EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
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
  // kbClosingUntil — timestamp до которого vv.resize updates ограничены
  // monotonic-grow'ом. На iOS Telegram WebView во время kb-close может
  // прилететь vv.resize с DIPPED vv.height (даже меньше pre-close
  // значения) — без guard'а это shrink'нуло бы overlayHeight, padding-
  // bottom (overlay) скакнул бы вверх, sheet «подпрыгнул» бы.
  const kbClosingUntilRef = useRef<number>(0);

  const [overlayHeight, setOverlayHeight] = useState<number>(
    typeof window !== "undefined" && window.visualViewport
      ? window.visualViewport.height
      : (typeof window !== "undefined" ? window.innerHeight : 800)
  );
  // frozenHeight — snapshot overlayHeight в момент когда sheet начинает
  // closing-анимацию. Если kb закрывается параллельно с sheet-close
  // (юзер тапает outside пока печатал), vv.resize может прилететь
  // mid-anim → overlayHeight скакнёт → CSS height transition будет
  // competить с translateY анимацией sheet'а → визуальный jank.
  // Frozen height отключает реакцию overlay'а на vv.resize пока sheet
  // уезжает вниз. После unmount всё сбрасывается.
  const [frozenHeight, setFrozenHeight] = useState<number | null>(null);

  // visualViewport listener — overlay.height = vv.height. Когда
  // клавиатура открывается, vv.height shrinks → overlay shrinks →
  // sheet inside (flex-end) поднимается вместе с keyboard top.
  // Когда клавиатура закрывается — vv.height grows back → sheet
  // плавно опускается. Без monotonic shrink: естественное поведение
  // (как в CustomOrderPage). height transition сглаживает дискретные
  // vv.resize события в smooth animation.
  //
  // ВАЖНО: НЕ обновляем kbOpen из этого листенера. kbOpen tracked
  // ИСКЛЮЧИТЕЛЬНО через focus/blur handlers — это совпадает с
  // CustomOrderPage. На iOS Telegram WebApp vv.height может вести
  // себя нестандартно (не shrink'аться с kb или давать false-trigger'ы
  // > refHeight - 50), и vv-listener устанавливал бы kbOpen=false
  // даже когда textarea has focus и kb actually open → paperclip
  // переставал быть disabled и picker открывался при кb-open.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let raf: number | null = null;
    const apply = () => {
      const now = Date.now();
      if (now < kbClosingUntilRef.current) {
        // Во время kb-close (500ms после blur) — только grow, не shrink.
        // Это устраняет up-jump формы когда vv.resize прилетает с
        // intermediate/dipped значением во время iOS kb-close animation.
        setOverlayHeight((prev) => Math.max(prev, vv.height));
      } else {
        setOverlayHeight(vv.height);
      }
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

  // Body management — POSITION lock пока sheet open. Раньше был только
  // overflow:hidden — но iOS на focus в textarea всё равно auto-scroll'ит
  // body чтобы вернуть input в viewport. Этот scroll сдвигает контент,
  // backdrop-filter пересчитывается → юзер видит «мерцание» под blur'ом
  // при открытии клавиатуры.
  //
  // position:fixed + top:-scrollY полностью замораживает страницу.
  // App.tsx делает то же самое для non-keyboard-aware inputs (см. lockBody
  // там). Для нашего sheet'а (data-keyboard-aware=true) App пропускает
  // lockBody — поэтому делаем сами.
  //
  // Dep [mounted] (не [open]) — чтобы body оставался locked всю close-
  // анимацию. Иначе на open=false body unlocks мгновенно → за 400ms
  // close-анима страница может прыгнуть.
  useEffect(() => {
    if (!mounted) return;
    refHeightRef.current = window.innerHeight;

    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevLeft = document.body.style.left;
    const prevRight = document.body.style.right;
    const prevWidth = document.body.style.width;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.left = prevLeft;
      document.body.style.right = prevRight;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
      document.body.classList.remove("zen-input-focused");
      if (textareaUnlockTimerRef.current != null) {
        clearTimeout(textareaUnlockTimerRef.current);
        textareaUnlockTimerRef.current = null;
      }
    };
  }, [mounted]);

  // Predictive shrink на focus — сетим overlayHeight СРАЗУ к
  // predicted post-kb значению, не дожидаясь vv.resize. На iOS первый
  // vv.resize fire'ит с задержкой ~50-100ms, без предикта transition
  // стартует поздно и sheet «опаздывает» за keyboard'ом.
  const handleTextareaFocus = () => {
    document.body.classList.add("zen-input-focused");
    setKbOpen(true);
    kbClosingUntilRef.current = 0; // отменяем close-guard если был
    const predicted = Math.max(280, refHeightRef.current - PREDICTED_KB);
    setOverlayHeight(predicted);
  };
  const handleTextareaBlur = () => {
    document.body.classList.remove("zen-input-focused");
    setKbOpen(false);
    // Predictive grow: сразу сетим overlayHeight на fullHeight,
    // CSS transition (260ms) плавно тянет padding-bottom к 0. БЕЗ
    // предикта vv.resize прилетал бы с intermediate vv.height и
    // дёргал бы значение (включая возможные dip'ы — iOS Telegram
    // может в первый momentum kb-close'а отрепортить vv.height
    // МЕНЬШЕ pre-close значения → padding-bottom вверх → форма
    // подпрыгивает). Plus monotonic-grow guard (см. vv listener)
    // на 500ms блокирует любые shrinks от vv.resize.
    kbClosingUntilRef.current = Date.now() + 500;
    setOverlayHeight(refHeightRef.current);
  };

  // Sheet mount/unmount animation
  useEffect(() => {
    if (open) {
      setFrozenHeight(null);
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else if (mounted) {
      // Snapshot текущей overlayHeight ДО setVisible(false) — иначе
      // vv.resize в kb-close моменте может вырастить overlayHeight,
      // и sheet прыгнет вниз mid-animation.
      setFrozenHeight((prev) => prev ?? overlayHeight);
      setVisible(false);
      const t = setTimeout(() => setMounted(false), SHEET_CLOSE_ANIM);
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
      }, SHEET_CLOSE_ANIM);
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

  // paperclip behaviour (matches CustomOrderPage UX):
  // - kb open: paperclip визуально disabled (opacity 0.35, not-allowed).
  //   Тап → blur textarea (kb closes), picker НЕ открывается. Юзер
  //   тапнет повторно когда kb закрыта.
  // - kb closed: тап → блокируем textarea на 1.5s + программно дёргаем
  //   input.click() → picker открывается синхронно в user gesture.
  //
  // Реализовано через <button> + sibling <input>. Раньше использовали
  // <label>-wrapped-<input> с disabled-управлением — в iOS Telegram
  // WebView label-input synthetic click мог обходить и disabled, и
  // e.preventDefault(), и picker открывался при kbOpen=true. Button
  // даёт явный контроль: input.click() вызывается ТОЛЬКО когда мы
  // явно так решили в handler'е.
  const handlePaperclipClick = () => {
    if (kbOpen) {
      textareaRef.current?.blur();
      return;
    }
    if (photos.length >= MAX_PHOTOS) return;
    setTextareaLocked(true);
    if (textareaUnlockTimerRef.current != null) {
      clearTimeout(textareaUnlockTimerRef.current);
    }
    textareaUnlockTimerRef.current = window.setTimeout(() => {
      setTextareaLocked(false);
      textareaUnlockTimerRef.current = null;
    }, 1500);
    // input.click() синхронный в onClick → user gesture context
    // сохраняется → iOS откроет picker.
    fileInputRef.current?.click();
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

  // isClosing = frozenHeight != null. Завязали на frozenHeight, а не
  // на (mounted && !visible), потому что на первом mount-frame'е visible
  // ещё false (rAF chain ставит true позже) — это совпало бы с
  // close-state'ом и engine применил бы close-стили на open-frame'е.
  // frozenHeight ставится ТОЛЬКО на close (open сбрасывает в null).
  const isClosing = frozenHeight != null;
  // fullHeight — снэпшот window.innerHeight на момент монтирования
  // sheet'а (до того как откроется kb). Не пересчитывается, потому что
  // на iOS Telegram WebView window.innerHeight МОЖЕТ shrink'нуться
  // когда kb открыта (разные платформы ведут себя по-разному). Если бы
  // использовали current window.innerHeight, closeTranslate был бы
  // недостаточным при kb-open → sheet не уезжал бы за экран.
  const fullHeight = refHeightRef.current;
  // kbHeight — разница между full screen и текущим vv.height. Когда kb
  // закрыта = 0, когда открыта = высота клавиатуры.
  const kbHeight = Math.max(0, fullHeight - overlayHeight);

  // Direction-specific transition timing:
  // - open: SHEET_OPEN_ANIM + OPEN_EASING (front-loaded ~easeOutQuart)
  // - close: SHEET_CLOSE_ANIM + CLOSE_EASING (smooth ease-in-out)
  // Close дольше потому что sheet уезжает на гораздо большую дистанцию
  // (closeTranslate ≈ fullHeight+80 vs open's translateY(100%) = sheetHeight).
  // С одинаковой длительностью close по velocity получался 2-3x быстрее
  // open'а → юзер чувствовал что закрытие резкое.
  const animDur = isClosing ? SHEET_CLOSE_ANIM : SHEET_OPEN_ANIM;
  const animEasing = isClosing ? CLOSE_EASING : OPEN_EASING;

  // Overlay теперь ВСЕГДА full-screen (height: fullHeight). Раньше
  // overlay shrink'ался до vv.height (выше kb), и между bottom overlay'я
  // и top клавиатуры мог появиться un-blurred gap во время kb-open
  // animation (CSS height transition не синхронен с iOS kb-rise).
  // Теперь overlay покрывает весь экран → blur'а зона тоже всегда
  // полная → нет un-blurred области под формой при kb-open.
  // Sheet остаётся выше kb за счёт padding-bottom: kbHeight (sheet
  // на flex-end → align к inner-area bottom = fullHeight - kbHeight).
  const overlayStyle: React.CSSProperties = {
    ...styles.overlay,
    height: fullHeight,
    paddingBottom: kbHeight,
    background: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
    backdropFilter: visible ? `blur(${BLUR_AMOUNT}px)` : "blur(0px)",
    WebkitBackdropFilter: visible ? `blur(${BLUR_AMOUNT}px)` : "blur(0px)",
    transition:
      `background-color ${animDur}ms ${animEasing}, ` +
      `backdrop-filter ${animDur}ms ${animEasing}, ` +
      `-webkit-backdrop-filter ${animDur}ms ${animEasing}` +
      // padding-bottom transition только при open — на close padding
      // фиксирован (overlayHeight не меняется т.к. vv listener снят
      // на close). Sheet не дрейфует от kb-retract во время close.
      // 260ms + iOS-easing — это привязано к kb rise/fall, не к sheet.
      (isClosing ? "" : `, padding-bottom 260ms ${EASING}`),
  };

  // Close translate distance:
  // - При open initial (визибл ещё false, isClosing false): translateY(100%)
  //   — sheet ниже своего natural-position на свою высоту, готов к slide-up.
  // - При close (isClosing): translateY(fullHeight + 80) — sheet уходит
  //   полностью за нижний край экрана (с запасом 80px на округление).
  //   Использует fullHeight (captured at mount, full-screen pre-kb size),
  //   а не текущий window.innerHeight — на iOS Telegram WebView innerHeight
  //   может сжиматься с kb-open → закрытие при kb-open уезжало неполностью.
  const closeTranslate = `${fullHeight + 80}px`;
  const sheetTransform = visible
    ? "translateY(0)"
    : (isClosing ? `translateY(${closeTranslate})` : "translateY(100%)");

  const sheetStyle: React.CSSProperties = {
    ...styles.sheet,
    maxHeight: Math.max(280, overlayHeight - SHEET_TOP_GAP),
    transform: sheetTransform,
    transition: isClosing
      ? `transform ${animDur}ms ${animEasing}`
      : `transform ${animDur}ms ${animEasing}, max-height 260ms ${EASING}`,
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
            {/* Paperclip — button, не label-wrapped-input. В iOS Telegram
                WebView label-input synthetic click мог обходить disabled
                и preventDefault и открывать picker при kbOpen. Button +
                programmatic input.click() даёт явный контроль: picker
                открывается только когда handler решает.
                preventFocusSteal на mousedown/touchstart предотвращает
                кражу focus'а с textarea — иначе textarea теряла бы
                focus, kbOpen flippаs to false, и handler пропускал бы
                kb-open ветку. */}
            <button
              type="button"
              style={{
                ...styles.paperclipPill,
                cursor: paperclipDisabled ? "not-allowed" : "pointer",
                opacity: paperclipDisabled ? 0.35 : 1,
              }}
              aria-label="add photo"
              onClick={handlePaperclipClick}
              onMouseDown={preventFocusSteal}
              onTouchStart={preventFocusSteal}
            >
              <PaperclipIcon />
            </button>
            {/* Hidden file input — sibling, не wrapped. picker triggered
                ТОЛЬКО programmatically через fileInputRef.current?.click()
                из handlePaperclipClick. `multiple` атрибут позволяет
                выбрать несколько фото за раз. iOS-state-machine bug
                (kb сразу закрывается после dismiss action sheet'а)
                митигируется через textareaLocked 1.5s после клика. */}
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
    // Overlay ВСЕГДА full-screen (height: fullHeight применяется выше).
    // Padding-bottom: kbHeight адаптируется к клавиатуре → sheet (flex-
    // end в inner area) автоматически выше kb-top. Это устраняет
    // un-blurred gap, который раньше появлялся при kb-open transition
    // (overlay height shrink не успевал за kb-rise).
    // background + backdropFilter применяются динамически (animated
    // fade-in/out при open/close).
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 1500,
    // willChange — даём браузеру шанс promote'нуть overlay в свой
    // compositing layer, чтобы animation backdrop-filter была smooth
    // (особенно важно на iOS Safari).
    willChange: "backdrop-filter, background-color",
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
    // Anti-native-button-feedback: убирает iOS Safari built-in tap
    // depression (pseudo-inset transform на :active), tap highlight,
    // text-select на long-press и outline focus-ring. Без этих стилей
    // нажатие button'а вызывает 1-2px visual shift вверх (iOS-native
    // press effect) — юзер видит как «sheet подпрыгивает» на тап.
    outline: "none",
    WebkitTapHighlightColor: "transparent",
    WebkitAppearance: "none",
    appearance: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    cursor: "pointer",
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
