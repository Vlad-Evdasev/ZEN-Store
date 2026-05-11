import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { addToCart, type Product, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import "./ProductPage.css";

interface ProductPageProps {
  product: Product | undefined;
  cartItems: CartItem[];
  /** rect картинки-thumbnail в caталоге — нужен для FLIP-анимации
   *  открытия (hero растёт ИЗ этого прямоугольника на весь экран)
   *  и закрытия (hero сворачивается ОБРАТНО в этот же прямоугольник). */
  thumbRect: DOMRect | null;
  onBack: () => void;
  onCart: () => void;
  onAddedToCart?: () => void;
  userId: string;
  inWishlist: boolean;
  onToggleWishlist: () => void;
}

const ANIM_DURATION = 520; // ms — синхронно с inspire-postом для единого ощущения

export function ProductPage({
  product,
  cartItems,
  thumbRect,
  onBack,
  onCart,
  onAddedToCart,
  userId,
  inWishlist,
  onToggleWishlist,
}: ProductPageProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [chosenSize, setChosenSize] = useState<string>("");
  const productIdRef = useRef<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [optimisticSizes, setOptimisticSizes] = useState<Set<string>>(new Set());
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  // FLIP применяем к ВСЕМУ hero-контейнеру (а не только к image): иначе
  // фон контейнера (var(--surface) + box-shadow + border-radius) виден
  // в полный размер позади маленькой FLIP-картинки → выглядит как
  // огромный скелетон. С FLIP контейнера всё растёт ОДНИМ блоком.
  const heroRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const wheelLockedRef = useRef(false);

  // Phase управляет анимациями overlay-sheet:
  //  - opening: image FLIP-анимируется из thumbRect → fullscreen
  //  - open:    закончился FLIP, всё видно, контент готов
  //  - closing: image FLIP-back в thumbRect, sheet bg fade-out
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  // contentReady — показывать НЕ-image содержимое (back-кнопка, sheet с
  // описанием, размерами, CTA). False во время opening/closing — только
  // image видна (она «звезда» анимации). После 520ms становится true.
  const [contentReady, setContentReady] = useState(false);

  const sizes = product ? product.sizes.split(",").map((s) => s.trim()) : [];

  if (product && productIdRef.current !== product.id) {
    productIdRef.current = product.id;
    if (chosenSize !== "") setChosenSize("");
    if (optimisticSizes.size > 0) setOptimisticSizes(new Set());
  }

  const size = chosenSize || sizes[0] || "";
  const setSize = setChosenSize;

  const imageUrls = product
    ? ((product.image_urls && product.image_urls.length > 0) ? product.image_urls : (product.image_url ? [product.image_url] : []))
    : [];
  const currentImage = imageUrls[imageIndex] || product?.image_url || "https://via.placeholder.com/400";

  useEffect(() => {
    setImageIndex(0);
  }, [product?.id]);

  // Body-class управление: ДВА класса с разным жизненным циклом,
  // симметрично inspire-overlay:
  //  - zen-product-overlay-on:  dim main + frosted header bg
  //  - zen-product-header-up:   z-index хедера 1300 (выше overlay 1100)
  // overlay-on снимается СРАЗУ на close (main расправляется параллельно
  // с close-анимацией). header-up снимается ТОЛЬКО на полный unmount
  // (через cleanup), чтобы image при FLIP-back была под хедером.
  useEffect(() => {
    document.body.classList.add("zen-product-overlay-on");
    document.body.classList.add("zen-product-header-up");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("zen-product-overlay-on");
      document.body.classList.remove("zen-product-header-up");
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // FLIP-open: seamless thumb → hero с сохранением:
  //  1) content crop (object-fit:cover показал бы РАЗНЫЕ области image
  //     в thumb 1:1 vs hero 4:5),
  //  2) rounded corners (thumb имеет 12px, hero — 18px; чистый scale
  //     transform на container даёт визуально square углы при scale<1).
  //
  // Реализация:
  //  - Container scales using MAX(thumbW/finalW, thumbH/finalH).
  //  - Clip-path inset на image cuts excess до visible thumb-area.
  //  - Clip-path round задаёт visible border-radius. Round COMPENSATED
  //    за scale: round = visible_radius / scale → visible_radius constant.
  //    На FLIP-start: round = 12/scale (= 12px visible), на end: 18 (full).
  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || !thumbRect) {
      requestAnimationFrame(() => setPhase("open"));
      return;
    }
    const apply = () => {
      const final = hero.getBoundingClientRect();
      if (final.width === 0 || final.height === 0) return;
      const scale = Math.max(
        thumbRect.width / final.width,
        thumbRect.height / final.height,
      );
      const scaledW = final.width * scale;
      const scaledH = final.height * scale;
      const excessW = scaledW - thumbRect.width;
      const excessH = scaledH - thumbRect.height;
      const dx = (thumbRect.left - excessW / 2) - final.left;
      const dy = (thumbRect.top - excessH / 2) - final.top;
      const insetY = (excessH / (2 * scaledH)) * 100;
      const insetX = (excessW / (2 * scaledW)) * 100;
      const RADIUS_THUMB = 12;
      const RADIUS_HERO = 18;
      // round в image-coords. При scale<1 image rendered меньше → visible
      // round = round * scale. Нам нужен visible 12px при scale=N → round = 12/N.
      const roundStart = RADIUS_THUMB / scale;

      hero.style.transformOrigin = "top left";
      hero.style.transition = "none";
      hero.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
      const imgs = hero.querySelectorAll("img");
      imgs.forEach((img) => {
        img.style.transition = "none";
        img.style.clipPath = `inset(${insetY}% ${insetX}% round ${roundStart}px)`;
      });

      void hero.offsetWidth;

      hero.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.45, 0, 0.55, 1)`;
      hero.style.transform = "translate3d(0, 0, 0) scale(1)";
      imgs.forEach((img) => {
        img.style.transition = `clip-path ${ANIM_DURATION}ms cubic-bezier(0.45, 0, 0.55, 1)`;
        img.style.clipPath = `inset(0 round ${RADIUS_HERO}px)`;
      });
      setPhase("open");
    };
    apply();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // contentReady through delay — content появляется когда FLIP-image
  // закончился. На close становится false мгновенно (FLIP-back уходит
  // в одиночку, описание исчезает сразу как тапнули back).
  useEffect(() => {
    const tm = setTimeout(() => setContentReady(true), ANIM_DURATION);
    return () => clearTimeout(tm);
  }, []);

  const cartSizes = useMemo(() => {
    const s = new Set<string>();
    if (product) {
      for (const i of cartItems) {
        if (i.product_id === product.id && i.size) s.add(i.size);
      }
    }
    optimisticSizes.forEach((x) => s.add(x));
    return s;
  }, [cartItems, product?.id, optimisticSizes]);

  const goPrevImage = () => setImageIndex((i) => (i === 0 ? imageUrls.length - 1 : i - 1));
  const goNextImage = () => setImageIndex((i) => (i === imageUrls.length - 1 ? 0 : i + 1));

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (imageUrls.length <= 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartX.current;
    const dy = endY - touchStartY.current;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    const minSwipe = 50;
    if (dx > minSwipe) goPrevImage();
    else if (dx < -minSwipe) goNextImage();
  };

  const handleGalleryWheel = (e: React.WheelEvent) => {
    if (imageUrls.length <= 1) return;
    if (wheelLockedRef.current) return;
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    if (ax <= ay || ax < 18) return;
    if (e.deltaX > 0) goNextImage();
    else goPrevImage();
    wheelLockedRef.current = true;
    window.setTimeout(() => {
      wheelLockedRef.current = false;
    }, 400);
  };

  // requestClose: зеркало open — container FLIP-back в thumb position +
  // image clip-path возвращается к thumb-crop с rounded thumb-corners.
  // Visible image+corners при close ВСЕГДА матчат thumb.
  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    document.body.classList.remove("zen-product-overlay-on");
    setContentReady(false);
    const hero = heroRef.current;
    if (hero && thumbRect) {
      const final = hero.getBoundingClientRect();
      const scale = Math.max(
        thumbRect.width / Math.max(final.width, 1),
        thumbRect.height / Math.max(final.height, 1),
      );
      const scaledW = final.width * scale;
      const scaledH = final.height * scale;
      const excessW = scaledW - thumbRect.width;
      const excessH = scaledH - thumbRect.height;
      const dx = (thumbRect.left - excessW / 2) - final.left;
      const dy = (thumbRect.top - excessH / 2) - final.top;
      const insetY = (excessH / (2 * scaledH)) * 100;
      const insetX = (excessW / (2 * scaledW)) * 100;
      const RADIUS_THUMB = 12;
      const roundEnd = RADIUS_THUMB / scale;

      hero.style.transformOrigin = "top left";
      hero.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.45, 0, 0.55, 1)`;
      hero.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
      const imgs = hero.querySelectorAll("img");
      imgs.forEach((img) => {
        img.style.transition = `clip-path ${ANIM_DURATION}ms cubic-bezier(0.45, 0, 0.55, 1)`;
        img.style.clipPath = `inset(${insetY}% ${insetX}% round ${roundEnd}px)`;
      });
    }
    setPhase("closing");
    setTimeout(onBack, ANIM_DURATION);
  }, [phase, onBack, thumbRect]);

  // Esc → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  if (!product) {
    return null;
  }

  const isInCartForSize = !!size && cartSizes.has(size);

  const handleAdd = async () => {
    if (!size || isInCartForSize) return;
    setAdding(true);
    try {
      await addToCart(userId, product.id, size);
      setOptimisticSizes((prev) => {
        const next = new Set(prev);
        next.add(size);
        return next;
      });
      onAddedToCart?.();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const hasLongDesc = (product.description?.length ?? 0) > 140;

  // Sheet bg fade: opening — transparent, open — opaque, closing —
  // fades back transparent (через 520ms). Image-FLIP уже работает
  // через inline transform на heroImgRef.
  const sheetBgStyle: React.CSSProperties = phase === "opening"
    ? { backgroundColor: "rgba(var(--bg-rgb), 0)", transition: "none" }
    : phase === "open"
      ? { backgroundColor: "rgba(var(--bg-rgb), 1)", transition: `background-color ${ANIM_DURATION}ms cubic-bezier(0.45, 0, 0.55, 1)` }
      : { backgroundColor: "rgba(var(--bg-rgb), 0)", transition: `background-color ${ANIM_DURATION}ms cubic-bezier(0.45, 0, 0.55, 1)` };

  const contentStyle: React.CSSProperties = {
    opacity: contentReady ? 1 : 0,
    transition: contentReady
      ? "opacity 240ms cubic-bezier(0.4, 0, 0.2, 1)"
      : "opacity 0s",
    pointerEvents: contentReady ? "auto" : "none",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    // Враппер с className="zen-app" нужен чтобы CSS-правила с
    // селектором `.zen-app .zen-bag-summary`, `.zen-app .zen-bag-checkout-btn`
    // и т.п. (75+ правил в index.css) применялись к контенту портала.
    // Без этого pill «добавить в корзину» теряет стили (background,
    // border-radius, shadow, цвета) и выглядит сломанной.
    <div className="zen-app">
      {/* Back-кнопка приклеена в верхний-левый угол viewport — отдельный
          элемент внутри того же портала, position:fixed + z-index 1400. */}
      {contentReady && (
        <button
          type="button"
          onClick={() => {
            // Скрываем сразу через CSS — иначе она торчит ещё 520ms
            // во время close-анимации.
            setContentReady(false);
            requestClose();
          }}
          className="product-v2__hero-back-floating"
          aria-label={t(lang, "back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      )}
      <div
        ref={sheetRef}
        className="product-v2-overlay"
        style={{
          ...sheetBgStyle,
          pointerEvents: phase === "closing" ? "none" : "auto",
        }}
      >
      <div className="product-v2">
        <div ref={heroRef} className="product-v2__hero">
          {imageUrls.length <= 1 ? (
            <img
              key={`${product.id}-img`}
              src={currentImage}
              alt={product.name}
              className="product-v2__hero-img"
              decoding="sync"
              loading="eager"
            />
          ) : (
            <div
              className="product-v2__gallery"
              onTouchStart={handleGalleryTouchStart}
              onTouchEnd={handleGalleryTouchEnd}
              onWheel={handleGalleryWheel}
            >
              {imageUrls.map((url, i) => (
                <div
                  key={`${product.id}-${i}`}
                  className="product-v2__gallery-layer"
                  style={{ opacity: i === imageIndex ? 1 : 0, pointerEvents: i === imageIndex ? "auto" : "none" }}
                >
                  <img
                    src={url}
                    alt={`${product.name} — ${i + 1}`}
                    className="product-v2__hero-img"
                    decoding={i === 0 ? "sync" : "async"}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
          )}

          {imageUrls.length > 1 && (
            <div className="product-v2__gallery-dots" style={contentStyle}>
              {imageUrls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImageIndex(i); }}
                  className={`product-v2__gallery-dot${i === imageIndex ? " is-active" : ""}`}
                  aria-label={`Фото ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="product-v2__sheet" style={contentStyle}>
          <header className="product-v2__header">
            <h1 className="product-v2__title">{product.name}</h1>
            <button
              type="button"
              onClick={onToggleWishlist}
              className={`product-v2__title-heart${inWishlist ? " is-active" : ""}`}
              aria-label={inWishlist ? "Убрать из избранного" : "В избранное"}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </header>

          {product.description && (
            <div className="product-v2__desc-wrap">
              <p
                className={`product-v2__desc${descExpanded ? " is-expanded" : ""}${hasLongDesc ? " is-clampable" : ""}`}
              >
                {product.description}
              </p>
              {hasLongDesc && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="product-v2__desc-toggle"
                  aria-expanded={descExpanded}
                >
                  <span>{descExpanded ? "Свернуть" : "Подробнее"}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className="product-v2__size-block">
            <div className="product-v2__section-head">
              <h3 className="product-v2__section-title">
                {t(lang, "size")}
                {size && <span className="product-v2__section-meta">· {size}</span>}
              </h3>
              <button type="button" onClick={() => setShowSizeGuide(true)} className="product-v2__pill-btn product-v2__pill-btn--ghost">
                {t(lang, "sizeGuide")}
              </button>
            </div>
            <div className="product-v2__sizes">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`product-v2__size${size === s ? " is-active" : ""}`}
                  aria-pressed={size === s}
                >
                  <span className="product-v2__size-label">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Без --bottom модификатора — pill располагается над BottomNavBar
            (bottom: 64+safe+10 из .zen-bag-summary). Иначе nav (z-index 1250)
            покрывает CTA, и пользователь не может тапнуть кнопку. */}
        <div className="zen-bag-summary" style={contentStyle}>
          <div
            className="zen-bag-summary-bar"
            role="group"
            aria-label={t(lang, "addToCart")}
          >
            <div className="zen-bag-summary-info">
              <span className="zen-bag-summary-info-value">
                {formatPrice(product.price)}
              </span>
              {size && (
                <span className="zen-bag-summary-info-label zen-bag-summary-info-label--sub">
                  Размер {size}
                </span>
              )}
            </div>
            {isInCartForSize ? (
              <button
                type="button"
                onClick={onCart}
                className="zen-bag-checkout-btn zen-bag-checkout-btn--success"
                aria-label={t(lang, "goToCart")}
              >
                <span className="zen-bag-checkout-label">{t(lang, "goToCart")}</span>
                <span className="zen-bag-checkout-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || !size}
                className={`zen-bag-checkout-btn${adding || !size ? " zen-bag-checkout-btn--disabled" : ""}`}
                aria-label={t(lang, "addToCart")}
              >
                <span className="zen-bag-checkout-label">
                  {adding ? (lang === "ru" ? "Добавляем..." : "Adding...") : t(lang, "addToCart")}
                </span>
                <span className="zen-bag-checkout-arrow" aria-hidden="true">
                  {adding ? (
                    <svg viewBox="0 0 24 24" className="zen-bag-checkout-spinner">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        {showSizeGuide && (
          <div className="product-v2__modal-overlay" onClick={() => setShowSizeGuide(false)} aria-hidden>
            <div className="product-v2__modal" onClick={(e) => e.stopPropagation()}>
              <div className="product-v2__modal-head">
                <h3 className="product-v2__modal-title">{t(lang, "sizeGuide")}</h3>
                <button type="button" onClick={() => setShowSizeGuide(false)} className="product-v2__modal-close" aria-label="Закрыть">×</button>
              </div>
              <div className="product-v2__modal-body">
                <p className="product-v2__modal-text">
                  Таблица размеров зависит от категории товара (футболки, худи, штаны и т.д.).
                  Рекомендуем ориентироваться на размерную сетку в описании товара или уточнить у продавца.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>,
    document.body
  );
}
