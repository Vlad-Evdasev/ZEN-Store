import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ReviewLightboxProps {
  images: string[];
  startIndex: number;
  /** Rect of the thumbnail at click moment — for FLIP-open / FLIP-close
   *  animation (image grows from thumb to fullscreen and shrinks back). */
  startRect: DOMRect | null;
  onClose: () => void;
}

const ANIM = 480;
const EASING = "cubic-bezier(0.45, 0, 0.55, 1)";

/**
 * Fullscreen image viewer для отзывов. FLIP-open из thumbRect →
 * полный экран. Horizontal swipe / wheel переключает между фото.
 * FLIP-close обратно в thumbRect (того изображения которое сейчас видно).
 */
export function ReviewLightbox({ images, startIndex, startRect, onClose }: ReviewLightboxProps) {
  const [currentIdx, setCurrentIdx] = useState(Math.min(startIndex, Math.max(images.length - 1, 0)));
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDx = useRef(0);
  const touchDy = useRef(0);
  const wheelLocked = useRef(false);

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

  // FLIP-open: image starts at startRect position+size, animates to natural.
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
      const img = imgRef.current;
      if (!img) return;
      const final = img.getBoundingClientRect();
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
      img.style.transformOrigin = "top left";
      img.style.transition = "none";
      img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      // Force reflow чтобы initial transform применился ДО transition.
      void img.offsetWidth;
      img.style.transition = `transform ${ANIM}ms ${EASING}`;
      img.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
      setPhase("open");
    };
    raf = requestAnimationFrame(tryApply);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    setPhase("closing");
    const img = imgRef.current;
    if (img && startRect) {
      const final = img.getBoundingClientRect();
      const dx = startRect.left - final.left;
      const dy = startRect.top - final.top;
      const sx = startRect.width / Math.max(final.width, 1);
      const sy = startRect.height / Math.max(final.height, 1);
      img.style.transformOrigin = "top left";
      img.style.transition = `transform ${ANIM}ms ${EASING}`;
      img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    }
    setTimeout(onClose, ANIM);
  }, [phase, startRect, onClose]);

  // Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestClose]);

  const cycle = (delta: 1 | -1) => {
    if (images.length <= 1) return;
    setCurrentIdx((prev) => (prev + delta + images.length) % images.length);
  };

  // Touch swipe: horizontal → switch image, vertical pull-down → close.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDx.current = 0;
    touchDy.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDx.current = e.touches[0].clientX - touchStartX.current;
    touchDy.current = e.touches[0].clientY - (touchStartY.current ?? 0);
  };
  const onTouchEnd = () => {
    const dx = touchDx.current;
    const dy = touchDy.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchDx.current = 0;
    touchDy.current = 0;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      cycle(dx < 0 ? 1 : -1);
    } else if (dy > 80) {
      requestClose();
    }
  };

  // Trackpad: horizontal wheel → switch image.
  const onWheel = (e: React.WheelEvent) => {
    if (images.length <= 1) return;
    if (wheelLocked.current) return;
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    if (ax <= ay || ax < 18) return;
    cycle(e.deltaX > 0 ? 1 : -1);
    wheelLocked.current = true;
    window.setTimeout(() => { wheelLocked.current = false; }, 400);
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
    // touch-action: none — блокируем default-скролл body когда юзер
    // свайпает по лайтбоксу. Все жесты (swipe фото, pull-down close)
    // обрабатываем сами.
    touchAction: "none",
  };

  const dotsStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    opacity: phase === "open" && images.length > 1 ? 1 : 0,
    transition: `opacity ${ANIM}ms ${EASING}`,
    pointerEvents: "none",
  };

  return createPortal(
    <div
      ref={overlayRef}
      style={overlayStyle}
      onClick={requestClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <img
        ref={imgRef}
        key={currentIdx}
        src={images[currentIdx]}
        alt=""
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: 12,
          willChange: "transform",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <div style={dotsStyle} aria-hidden>
          {images.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === currentIdx ? 14 : 5,
                height: 5,
                borderRadius: i === currentIdx ? 3 : "50%",
                background: i === currentIdx ? "#fff" : "rgba(255,255,255,0.55)",
                transition: "width 0.2s ease, background 0.2s ease, border-radius 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
