import { useState, useEffect, useMemo, useRef } from "react";
import { addToCart, type Product, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import "./ProductPage.css";

interface ProductPageProps {
  product: Product | undefined;
  cartItems: CartItem[];
  onBack: () => void;
  onCart: () => void;
  onAddedToCart?: () => void;
  userId: string;
  inWishlist: boolean;
  onToggleWishlist: () => void;
}

export function ProductPage({
  product,
  cartItems,
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
  // Локально записываем размер сразу после успешного add, чтобы кнопка тут же
  // переключилась в success-состояние, не дожидаясь refresh из App.
  const [optimisticSizes, setOptimisticSizes] = useState<Set<string>>(new Set());
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const wheelLockedRef = useRef(false);

  const sizes = product ? product.sizes.split(",").map((s) => s.trim()) : [];

  // Reset user-chosen size when navigating to a different product (synchronous,
  // before paint — avoids a one-frame mismatch where the sub-label and CTA
  // briefly render in the "no size" state).
  if (product && productIdRef.current !== product.id) {
    productIdRef.current = product.id;
    if (chosenSize !== "") setChosenSize("");
    if (optimisticSizes.size > 0) setOptimisticSizes(new Set());
  }

  // Effective size: user pick falls back to first available size so the bottom
  // bar always renders the sub-label and the active CTA from the very first paint.
  const size = chosenSize || sizes[0] || "";
  const setSize = setChosenSize;

  const imageUrls = product
    ? ((product.image_urls && product.image_urls.length > 0) ? product.image_urls : (product.image_url ? [product.image_url] : []))
    : [];
  const currentImage = imageUrls[imageIndex] || product?.image_url || "https://via.placeholder.com/400";

  useEffect(() => {
    setImageIndex(0);
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id) return;
    const scrollToTop = () => {
      rootRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollToTop();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTop);
    });
    const tm = setTimeout(scrollToTop, 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
  }, [product?.id]);

  // Какие размеры этого товара уже в корзине. Берём из cartItems (lifted-state
  // в App), чтобы значение было синхронно доступно с первого рендера —
  // без useEffect-задержки, которая давала «моргание» кнопки В корзину →
  // В корзине при открытии товара.
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
    // Игнорируем жест, если он более вертикальный, чем горизонтальный —
    // пользователь скроллил страницу, а не листал галерею.
    if (Math.abs(dx) <= Math.abs(dy)) return;
    const minSwipe = 50;
    if (dx > minSwipe) goPrevImage();
    else if (dx < -minSwipe) goNextImage();
  };

  // Скролл-колесо/тачпад: горизонтальный wheel-event на ноутбуке
  // (Mac trackpad two-finger swipe) переключает фото. Throttle,
  // чтобы один жест не пролистал сразу всю галерею.
  const handleGalleryWheel = (e: React.WheelEvent) => {
    if (imageUrls.length <= 1) return;
    if (wheelLockedRef.current) return;
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    if (ax <= ay || ax < 18) return; // не достаточно горизонтально
    if (e.deltaX > 0) goNextImage();
    else goPrevImage();
    wheelLockedRef.current = true;
    window.setTimeout(() => {
      wheelLockedRef.current = false;
    }, 400);
  };

  if (!product) {
    return (
      <div className="product-v2-loading">
        <p>Загрузка...</p>
      </div>
    );
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

  return (
    <div ref={rootRef} className="product-v2">
      {/* Back-arrow расположена НАД hero фотографией, не приклеена в угол —
          стоит с воздухом сверху + 12px слева (как в постах expanded view,
          но без glue-к-углу). */}
      <button
        type="button"
        onClick={onBack}
        className="product-v2__back-arrow"
        aria-label={t(lang, "back")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="product-v2__hero">
        {imageUrls.length <= 1 ? (
          <img
            key={`${product.id}-img`}
            src={currentImage}
            alt={product.name}
            className="product-v2__hero-img"
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
                <img src={url} alt={`${product.name} — ${i + 1}`} className="product-v2__hero-img" />
              </div>
            ))}
          </div>
        )}

        <div className="product-v2__hero-gradient" aria-hidden />
        <div className="product-v2__hero-fade" aria-hidden />

        {imageUrls.length > 1 && (
          <div className="product-v2__gallery-dots">
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

      <div className="product-v2__sheet">
        <header className="product-v2__header">
          <h1 className="product-v2__title">{product.name}</h1>
          {/* Heart-кнопка справа от названия товара. SVG 30px — в размер
              шрифта title (30px), чтобы зрительно балансировал заголовок. */}
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

      <div className="zen-bag-summary zen-bag-summary--bottom">
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
  );
}
