import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ReviewLightboxProps {
  images: string[];
  startIndex: number;
  /** Rect of the thumbnail at click moment — for FLIP-open animation
   *  (scroller grows from clicked thumb to fullscreen). */
  startRect: DOMRect | null;
  /** Rects ВСЕХ thumb'ов в коллаже в момент открытия (по индексам).
   *  Используется для FLIP-close: после swipe на photo N close идёт
   *  обратно в thumb N, а не в thumb с которого открыли. Для скрытых
   *  фото (4+ в +N case) item = null → fallback на last visible. */
  thumbRects?: (DOMRect | null)[];
  /** Парент трекает текущий видимый индекс, чтобы скрывать thumb этой
   *  фотки в коллаже (visibility: hidden) — иначе во время FLIP-open
   *  видны сразу два экземпляра картинки: летящий и оригинал в коллаже.
   *  Зовётся на mount (startIndex) и каждый раз при свайпе. */
  onIndexChange?: (idx: number) => void;
  onClose: () => void;
}

const ANIM = 480;
const EASING = "cubic-bezier(0.45, 0, 0.55, 1)";

/**
 * Fullscreen image viewer для отзывов. FLIP-open из thumbRect →
 * полный экран. Горизонтальный свайп между фото теперь нативный через
 * scroll-snap (раньше был один <img key={currentIdx}> с JS-cycle на
 * touchend, фото мгновенно подменялось без drag-feedback). FLIP-close
 * обратно в thumbRect того изображения которое сейчас видно.
 */
export function ReviewLightbox({ images, startIndex, startRect, thumbRects, onIndexChange, onClose }: ReviewLightboxProps) {
  const [currentIdx, setCurrentIdx] = useState(Math.min(startIndex, Math.max(images.length - 1, 0)));
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const scrollerRef = useRef<HTMLDivElement>(null);
  // imageRef — на первую <img> для load-check перед FLIP. Если первое
  // фото ещё не закэшировано браузером, без этого guard'а
  // getBoundingClientRect на scroller может вернуть 0×0.
  const imageRef = useRef<HTMLImageElement>(null);

  // Body-scroll lock + body class для z-index хедера/футера. Header
  // и nav остаются ВИДИМЫ (как в catalog product page) — просто на
  // z-index 1300 (выше overlay 1100), чтобы image при FLIP «уходила
  // под них», а не накрывала их. Никакого visibility:hidden.
  //
  // position: fixed на body — единственный надёжный способ заблокировать
  // скролл страницы под лайтбоксом на iOS. overflow: hidden один тут не
  // помогает: pull-down-to-close жест попутно тащил страницу отзывов
  // вниз. Сохраняем scrollY и восстанавливаем при размонтировании.
  useEffect(() => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.body.classList.add("zen-review-lightbox-open");
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      document.body.classList.remove("zen-review-lightbox-open");
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Sync store → scrollLeft. На mount устанавливает scrollLeft = startIndex,
  // чтобы FLIP-open начал с того же фото, что был в thumb. На программное
  // изменение currentIdx (ArrowLeft/Right с клавиатуры) тоже подтягивает.
  // Tolerance > clientWidth/2 — не прерывать нативный snap, инициированный
  // юзером пальцем (он сам сойдётся в нужный таргет, и onScroll обновит store).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const target = currentIdx * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > el.clientWidth / 2) {
      el.scrollLeft = target;
    }
  }, [currentIdx]);

  // FLIP-open: scroller starts at startRect position+size, animates to natural.
  // Retry-loop через rAF если getBoundingClientRect() ещё не отдаёт
  // финальные размеры (data-URL картинки могут на первом frame показать
  // 0x0 пока браузер не уложил layout).
  useLayoutEffect(() => {
    if (!startRect) {
      requestAnimationFrame(() => setPhase("open"));
      return;
    }
    let applied = false;
    let raf: number | null = null;
    const tryApply = () => {
      if (applied) return;
      const el = scrollerRef.current;
      if (!el) return;
      const final = el.getBoundingClientRect();
      if (final.width < 10 || final.height < 10) {
        // Layout ещё не готов — пробуем на следующем frame.
        raf = requestAnimationFrame(tryApply);
        return;
      }
      applied = true;
      const dx = startRect.left - final.left;
      const dy = startRect.top - final.top;
      const sx = startRect.width / final.width;
      const sy = startRect.height / final.height;
      el.style.transformOrigin = "top left";
      el.style.transition = "none";
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      // Force reflow чтобы initial transform применился ДО transition.
      void el.offsetWidth;
      el.style.transition = `transform ${ANIM}ms ${EASING}`;
      el.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
      setPhase("open");
    };
    raf = requestAnimationFrame(tryApply);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycle = useCallback((delta: 1 | -1) => {
    if (images.length <= 1) return;
    setCurrentIdx((prev) => (prev + delta + images.length) % images.length);
  }, [images.length]);

  // Сообщаем парент-компоненту текущий идекс, чтобы он спрятал нужный
  // thumb в коллаже на время лайтбокса. Включая mount (с startIndex)
  // и каждый свайп через scroll-snap. На close парент сам сбросит null.
  useEffect(() => {
    onIndexChange?.(currentIdx);
  }, [currentIdx, onIndexChange]);

  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    setPhase("closing");
    const el = scrollerRef.current;
    // FLIP-close target: rect TEКУЩЕЙ свайпнутой картинки, не той с
    // которой открыли. Если thumbRects переданы и items[currentIdx]
    // существует — используем его. Если currentIdx указывает на
    // скрытое фото (null в thumbRects) — walk back до last visible
    // rect (так close animates к видимому +N thumb'у в коллаже).
    // Если всё null — fallback на startRect (старое поведение).
    let closeRect: DOMRect | null = null;
    if (thumbRects && thumbRects.length > 0) {
      let idx = currentIdx;
      while (idx >= 0 && !thumbRects[idx]) idx--;
      closeRect = idx >= 0 ? thumbRects[idx] : null;
    }
    if (!closeRect) closeRect = startRect;

    if (el && closeRect) {
      const final = el.getBoundingClientRect();
      const dx = closeRect.left - final.left;
      const dy = closeRect.top - final.top;
      const sx = closeRect.width / Math.max(final.width, 1);
      const sy = closeRect.height / Math.max(final.height, 1);
      el.style.transformOrigin = "top left";
      // Только transform, без opacity-фейда: scroller и thumb теперь
      // имеют одинаковый aspect-ratio и одинаковый object-fit: cover,
      // поэтому в момент unmount юзер видит ровно тот же crop в том же
      // месте — никакого визуального скачка между состояниями. (Раньше
      // тут был fade в последние 120ms чтобы скрыть переход между
      // contain-letterbox и cover-cropped, но это создавало небольшое
      // «тусение» картинки в конце анимации.)
      el.style.transition = `transform ${ANIM}ms ${EASING}`;
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    }
    setTimeout(onClose, ANIM);
  }, [phase, startRect, thumbRects, currentIdx, onClose]);

  // Escape closes, Arrow keys cycle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose, cycle]);

  // Detect snap-target из текущего scrollLeft. Math.round — ближайший
  // слайд. Обновляем currentIdx, чтобы dots индикатор переключился на
  // лету, и FLIP-close знал какой thumb-rect использовать.
  const onScrollerScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== currentIdx && idx >= 0 && idx < images.length) {
      setCurrentIdx(idx);
    }
  };

  if (typeof document === "undefined") return null;

  // z-index 1100: ВЫШЕ default header (10) и nav (30), НО body class
  // zen-review-lightbox-clipped поднимет header/nav до 1300/1200 на
  // время opening/closing — image будет clipped ими (FLIP проходит
  // «за хедер»). На phase=open класс снимается, lightbox оказывается
  // выше всего → image fully visible.
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: phase === "opening" ? "rgba(0,0,0,0)" : phase === "open" ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0)",
    transition: phase === "opening" ? "none" : `background-color ${ANIM}ms ${EASING}`,
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    cursor: "zoom-out",
  };

  // Wrapper берёт aspect-ratio из тампбейла-источника, чтобы FLIP-open
  // и FLIP-close выглядели бесшовно (раньше thumb был 1:1 / 4:5 с
  // object-fit: cover, а scroller — на весь экран с object-fit: contain,
  // и юзер видел резкое переключение между «обрезанным квадратом» и
  // «полной картинкой с letterbox» в момент открытия и закрытия). Теперь
  // и thumb и slide имеют одинаковую форму + одинаковый cover-crop, FLIP
  // проходит как простое масштабирование одного и того же изображения.
  // max-width/height 100% — чтобы wrapper вписался в overlay (минус
  // padding 16); aspect-ratio сам определит вторую сторону. Внутри wrapper'а
  // — scroller (100% × 100%) и dots с position: absolute (привязаны к
  // нижнему краю картинки, а не overlay).
  const thumbAspect = startRect && startRect.height > 0
    ? startRect.width / startRect.height
    : null;
  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "auto",
    height: "auto",
    maxWidth: "100%",
    maxHeight: "100%",
    aspectRatio: thumbAspect ? `${thumbAspect}` : undefined,
  };
  const scrollerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    willChange: "transform",
  };

  // Dots indicator — на нижнем краю самой картинки (внутри wrapper'а,
  // не overlay'а). Раньше точки висели снизу overlay'а (над bottom-nav'ом)
  // и выглядели оторванными от фото. Теперь как в ExpandedView постов
  // «Вдохновиться» — точки нативно на изображении, чуть отступают от низа.
  const dotsStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 14,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    opacity: phase === "open" && images.length > 1 ? 1 : 0,
    transition: `opacity ${ANIM}ms ${EASING}`,
    pointerEvents: "none",
    zIndex: 2,
  };

  return createPortal(
    <div
      style={overlayStyle}
      onClick={requestClose}
    >
      <div style={wrapperStyle}>
        <div
          ref={scrollerRef}
          className="zen-post-image-scroller zen-review-lightbox-scroller"
          style={scrollerStyle}
          onScroll={onScrollerScroll}
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((src, i) => (
            <div key={i} className="zen-card-image-slide zen-review-lightbox-slide">
              <img
                ref={i === 0 ? imageRef : undefined}
                src={src}
                alt=""
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
                decoding={i === 0 ? "sync" : "async"}
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div style={dotsStyle} aria-hidden>
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: i === currentIdx ? 18 : 6,
                  height: 6,
                  borderRadius: i === currentIdx ? 3 : "50%",
                  background: i === currentIdx ? "#fff" : "rgba(255,255,255,0.5)",
                  transition: "width 0.25s ease, background 0.2s ease, border-radius 0.2s ease",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
