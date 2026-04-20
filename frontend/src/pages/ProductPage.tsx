import { useState, useEffect, useRef } from "react";
import { addToCart, getProductReviews, addProductReview, type Product, type ProductReview } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import "./ProductPage.css";

interface ProductPageProps {
  product: Product | undefined;
  onBack: () => void;
  onCart: () => void;
  onAddedToCart?: () => void;
  userId: string;
  userName?: string;
  inWishlist: boolean;
  onToggleWishlist: () => void;
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

export function ProductPage({
  product,
  onBack,
  onCart,
  onAddedToCart,
  userId,
  userName,
  inWishlist,
  onToggleWishlist,
}: ProductPageProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [size, setSize] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const sizes = product ? product.sizes.split(",").map((s) => s.trim()) : [];
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

  useEffect(() => {
    if (product && sizes.length) setSize(sizes[0]);
  }, [product?.id]);

  useEffect(() => {
    if (product) {
      getProductReviews(product.id).then(setReviews).catch(console.error);
    }
  }, [product?.id]);

  const handleAddReview = async () => {
    if (!product || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      await addProductReview(product.id, userId, {
        user_name: userName || "Гость",
        rating: reviewRating,
        text: reviewText.trim(),
      });
      setReviewText("");
      setReviewRating(5);
      setShowReviewForm(false);
      const updated = await getProductReviews(product.id);
      setReviews(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingReview(false);
    }
  };

  const goPrevImage = () => setImageIndex((i) => (i === 0 ? imageUrls.length - 1 : i - 1));
  const goNextImage = () => setImageIndex((i) => (i === imageUrls.length - 1 ? 0 : i + 1));

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (imageUrls.length <= 1) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - touchStartX.current;
    const minSwipe = 50;
    if (dx > minSwipe) goPrevImage();
    else if (dx < -minSwipe) goNextImage();
  };

  if (!product) {
    return (
      <div className="product-v2-loading">
        <p>Загрузка...</p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!size) return;
    setAdding(true);
    setJustAdded(false);
    try {
      await addToCart(userId, product.id, size);
      onAddedToCart?.();
      setJustAdded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const hasLongDesc = (product.description?.length ?? 0) > 140;

  return (
    <div ref={rootRef} className="product-v2">
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

        <button
          type="button"
          onClick={onBack}
          className="product-v2__floating-btn product-v2__floating-btn--back"
          aria-label={t(lang, "back")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onToggleWishlist}
          className={`product-v2__floating-btn product-v2__floating-btn--heart${inWishlist ? " is-active" : ""}`}
          aria-label={inWishlist ? "Убрать из избранного" : "В избранное"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

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

        <div className="product-v2__divider" />

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

        <div className="product-v2__divider" />

        <section className="product-v2__reviews">
          <div className="product-v2__section-head">
            <h3 className="product-v2__section-title">
              {t(lang, "reviewsOnProduct")}
              {reviews.length > 0 && <span className="product-v2__section-meta">· {reviews.length}</span>}
            </h3>
            {!showReviewForm && (
              <button onClick={() => setShowReviewForm(true)} type="button" className="product-v2__pill-btn product-v2__pill-btn--ghost">
                {t(lang, "leaveReview")}
              </button>
            )}
          </div>

          {showReviewForm && (
            <div className="product-v2__review-form">
              <div className="product-v2__rating-row">
                <span className="product-v2__rating-label">Оценка</span>
                <div className="product-v2__stars">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReviewRating(r)}
                      className={`product-v2__star-btn${r <= reviewRating ? " is-filled" : ""}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="zen-textarea product-v2__review-textarea"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Напишите отзыв о товаре..."
                rows={3}
              />
              <div className="product-v2__review-actions">
                <button type="button" onClick={handleAddReview} disabled={submittingReview} className="product-v2__review-submit">
                  {submittingReview ? "..." : "Отправить"}
                </button>
                <button type="button" onClick={() => { setShowReviewForm(false); setReviewText(""); }} className="product-v2__review-cancel">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {reviews.length === 0 && !showReviewForm && (
            <div className="product-v2__empty-bubble-row">
              <div className="product-v2__empty-avatar" aria-hidden>R</div>
              <div className="product-v2__empty-bubble">
                <div className="product-v2__empty-bubble-text">
                  {t(lang, "reviewsEmptyFirst")}
                </div>
              </div>
            </div>
          )}

          <div className="product-v2__reviews-list">
            {reviews.map((r, idx) => (
              <div key={r.id} className={`product-v2__review${idx === 0 ? " is-first" : ""}`}>
                <div className="product-v2__review-head">
                  <span className="product-v2__review-author">{r.user_name || "Гость"}</span>
                  <span className="product-v2__review-date">{formatDate(r.created_at)}</span>
                </div>
                <div className="product-v2__review-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={`product-v2__review-star${s <= r.rating ? " is-filled" : ""}`}>★</span>
                  ))}
                </div>
                <p className="product-v2__review-text">{r.text}</p>
              </div>
            ))}
          </div>
        </section>
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
          {justAdded ? (
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
