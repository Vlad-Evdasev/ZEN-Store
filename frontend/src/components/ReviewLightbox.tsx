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
export function ReviewLightbox({ images, startIndex, startRect, thumbRects, onClose }: ReviewLightboxProps) {
  const [currentIdx, setCurrentIdx] = useState(Math.min(startIndex, Math.max(images.length - 1, 0)));
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const scrollerRef = useRef<HTMLDivElement>(null);
  // imageRef — на первую <img> для load-check перед FLIP. Если первое
  // фото ещё не закэшировано браузером, без этого guard'а
  // getBoundingClientRect на scroller может вернуть 0×0.
  const imageRef = useRef<HTMLImageElement>(null);
  // Pull-down-to-close: трекаем cumulative dy на overlay-уровне.
  // События пробулькивают от скроллера → onTouchMove получает каждое
  // движение пальца. Горизонтальный жест уходит в нативный scroll-snap
  // параллельно, мы его не трогаем. Если в конце vertical-down > 80px
  // и он доминирует над horizontal — закрываем.
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDx = useRef(0);
  const touchDy = useRef(0);

  // Body-scroll lock + body class для z-index хедера/футера. Header
  // и nav остаются ВИДИМЫ (как в catalog product page) — просто на
  // z-index 1300 (выше overlay 1100), чтобы image при FLIP «уходила
  // под них», а не накрывала их. Никакого visibility:hidden.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("zen-review-lightbox-open");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("zen-review-lightbox-open");
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

  const onOverlayTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDx.current = 0;
    touchDy.current = 0;
  };
  const onOverlayTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    touchDx.current = e.touches[0].clientX - touchStartX.current;
    touchDy.current = e.touches[0].clientY - touchStartY.current;
  };
  const onOverlayTouchEnd = () => {
    const dx = touchDx.current;
    const dy = touchDy.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchDx.current = 0;
    touchDy.current = 0;
    // Pull-down-to-close: только если вертикаль вниз доминирует и > 80px.
    // Горизонтальный жест уходит в нативный scroll-snap и сюда не лезет.
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      requestClose();
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
    alignItems: "stretch",
    justifyContent: "stretch",
    padding: 16,
    cursor: "zoom-out",
  };

  // scroll-snap карусель: full-screen контейнер с N слайдами по 100%
  // ширины. Раньше тут был один <img key={currentIdx}>, который ремоунтился
  // при свайпе и менялся мгновенно — пальцу не за что было «потянуть».
  // Теперь браузер тянет содержимое за палец и сам мягко сажает на
  // соседний слайд.
  const scrollerStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
    willChange: "transform",
  };

  // Dots indicator — match catalog product gallery (.product-v2__gallery-dots).
  // Darker bg + larger active dot для лучшей видимости на чёрном backdrop'е.
  //
  // Bottom-offset: 64px (.zen-bottom-nav height) + 20px gap + safe-area.
  // Bottom-nav (z-index 1250/1300) рендерится ПОВЕРХ overlay (1100) — это
  // by design для FLIP-эффекта «image проходит за nav». Если оставить
  // dots на bottom: 28 — они уходят под nav и не видны. Поэтому
  // поднимаем их РОВНО над nav'ом.
  const dotsStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(64px + 20px + env(safe-area-inset-bottom))",
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
      onTouchStart={onOverlayTouchStart}
      onTouchMove={onOverlayTouchMove}
      onTouchEnd={onOverlayTouchEnd}
    >
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
    </div>,
    document.body
  );
}
