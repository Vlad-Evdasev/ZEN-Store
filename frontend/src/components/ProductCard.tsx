import { useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { useProductImageIdx, setProductImageIdx } from "../lib/imageIndexStore";
import type { Product } from "../api";

interface ProductCardProps {
  product: Product;
  /** Принимает rect картинки-thumbnail в момент клика — используется
   *  для FLIP-анимации открытия ProductPage. */
  onClick: (thumbRect: DOMRect | null) => void;
  inWishlist?: boolean;
  onWishlistClick?: (e: React.MouseEvent) => void;
  compact?: boolean;
  reviewCount?: number;
  reviewAvg?: number;
  /** Заполнять высоту ячейки (сетка новинок) */
  fillHeight?: boolean;
  /** Минимальная высота блока с названием и ценой (для одинаковой высоты в сетке новинок) */
  descBlockMinHeight?: number;
  /** Ещё компактнее блок описания (новинки) */
  smallDescBlock?: boolean;
  /** Вариант соотношения сторон для masonry: по умолчанию 1:1, tall = 4:5 */
  sizeVariant?: "default" | "tall";
  /** Скрыть thumb (когда товар сейчас в полёте — открыт в ProductPage
   *  или анимируется обратно в thumb). Сохраняет место в сетке. */
  isHidden?: boolean;
}

export function ProductCard({ product, onClick, inWishlist, onWishlistClick, compact, reviewCount, reviewAvg, fillHeight, descBlockMinHeight, smallDescBlock, sizeVariant = "default", isHidden = false }: ProductCardProps) {
  const { formatPrice } = useSettings();
  const imgWrapRef = useRef<HTMLDivElement>(null);
  // Свайп по фото в карточке. Индекс шарится через imageIndexStore с
  // ProductPage'ом — закрытие FLIP лендится в thumb с правильной картинкой.
  const imageUrls = (product.image_urls && product.image_urls.length > 0)
    ? product.image_urls
    : (product.image_url ? [product.image_url] : []);
  const currentIdx = useProductImageIdx(product.id);
  const safeIdx = Math.min(currentIdx, Math.max(imageUrls.length - 1, 0));
  const isMulti = imageUrls.length > 1;
  const touchStartX = useRef<number | null>(null);
  const touchMoveDx = useRef(0);
  const handleClick = () => {
    // На iOS Safari порядок touch-click такой: touchstart → blur input →
    // click. К моменту click activeElement УЖЕ body (blur произошёл),
    // поэтому проверка `instanceof HTMLInputElement` не сработает.
    // Используем timestamp последнего blur'а (см. focusout-listener в
    // App.tsx) — если input был активен <250ms назад, считаем что это
    // клик «снять клавиатуру», и НЕ открываем товар.
    const lastBlur = (window as unknown as { __zenLastInputBlur?: number }).__zenLastInputBlur ?? 0;
    const active = document.activeElement;
    const inputFocused = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (inputFocused) {
      (active as HTMLElement).blur();
      return;
    }
    if (Date.now() - lastBlur < 250) return;
    // Если был свайп (>10px) — не открываем оверлей.
    if (Math.abs(touchMoveDx.current) > 10) {
      touchMoveDx.current = 0;
      return;
    }
    const rect = imgWrapRef.current?.getBoundingClientRect() ?? null;
    onClick(rect);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMulti) return;
    touchStartX.current = e.touches[0].clientX;
    touchMoveDx.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMulti || touchStartX.current === null) return;
    touchMoveDx.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (!isMulti || touchStartX.current === null) {
      touchStartX.current = null;
      return;
    }
    const dx = touchMoveDx.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) {
      const next = dx < 0
        ? Math.min(imageUrls.length - 1, safeIdx + 1)
        : Math.max(0, safeIdx - 1);
      setProductImageIdx(product.id, next);
    }
  };
  const cardStyle = compact
    ? { ...styles.card, ...styles.cardCompact, ...(fillHeight ? styles.cardFillHeight : {}) }
    : { ...styles.card, ...(fillHeight ? styles.cardFillHeight : {}) };
  const noShrink = fillHeight ? { flexShrink: 0 as const } : {};
  const nameStyle = compact ? { ...styles.name, ...styles.nameCompact, ...noShrink } : { ...styles.name, ...noShrink };
  const priceStyle = compact ? { ...styles.price, ...styles.priceCompact, ...noShrink } : { ...styles.price, ...noShrink };
  const imageWrapStyle = compact
    ? {
        ...styles.imageWrap,
        ...styles.imageWrapCompact,
        ...(fillHeight ? styles.imageWrapFillHeight : {}),
        ...(!fillHeight && sizeVariant === "tall" ? styles.imageWrapTall : {}),
      }
    : {
        ...styles.imageWrap,
        ...(fillHeight ? styles.imageWrapFillHeight : {}),
        ...(!fillHeight && sizeVariant === "tall" ? styles.imageWrapTall : {}),
      };
  const wishlistBtnStyle = compact ? { ...styles.wishlistBtn, ...styles.wishlistBtnCompact } : styles.wishlistBtn;
  const hasReviews = reviewCount != null && reviewCount > 0;
  const descWrapStyle: React.CSSProperties = {
    ...styles.descWrap,
    ...(compact ? styles.descWrapCompact : {}),
    ...(compact && smallDescBlock ? styles.descWrapCompactSmall : {}),
    ...(fillHeight ? styles.descWrapFillHeight : {}),
    ...(descBlockMinHeight != null ? { minHeight: descBlockMinHeight } : {}),
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };
  return (
    <div
      className="product-card product-card--text-below"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={cardStyle}
    >
      <div
        ref={imgWrapRef}
        className="product-card__image-wrap"
        style={{ ...imageWrapStyle, visibility: isHidden ? "hidden" : "visible" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          key={safeIdx}
          src={imageUrls[safeIdx] || product.image_url || "https://via.placeholder.com/200"}
          alt={product.name}
          style={styles.image}
        />
        {isMulti && (
          <div style={styles.dotsRow} aria-hidden>
            {imageUrls.map((_, i) => (
              <span
                key={i}
                style={{ ...styles.dot, ...(i === safeIdx ? styles.dotActive : null) }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="product-card-desc" style={descWrapStyle}>
        <div style={compact ? styles.nameRowCompact : styles.nameRow}>
          <p className="product-card-name" style={nameStyle} title={product.name}>{product.name}</p>
          {/* Heart-кнопка перенесена ИЗ image-overlay в строку под фото,
              справа от названия товара. Чище визуально, не загораживает
              картинку и проще тапать. */}
          {onWishlistClick && (
            <button
              type="button"
              className={`product-card-wishlist-btn${inWishlist ? " is-active" : ""}`}
              onClick={(e) => { e.stopPropagation(); onWishlistClick(e); }}
              style={{ ...wishlistBtnStyle, color: inWishlist ? "var(--accent)" : "var(--text)" }}
              aria-label={inWishlist ? "Убрать из избранного" : "В избранное"}
            >
              <svg
                width={compact ? 18 : 20}
                height={compact ? 18 : 20}
                viewBox="0 0 24 24"
                fill={inWishlist ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
                style={{ display: "block" }}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}
        </div>
        {product.brand?.trim() && (
          <span style={compact ? styles.brandCompact : styles.brand}>{product.brand.trim()}</span>
        )}
        {product.sizes?.trim() && (
          <span className="zen-bag-item-size product-card-size">
            Размер:{" "}
            <strong>
              {product.sizes
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .join(", ")}
            </strong>
          </span>
        )}
        <div style={compact ? styles.priceRowCompact : styles.priceRow}>
          <p className="product-card-price" style={priceStyle}>{formatPrice(product.price)}</p>
          {hasReviews && (
            <span style={{ ...(compact ? styles.reviewsCompact : styles.reviews), ...noShrink }}>
              <svg
                aria-hidden="true"
                focusable="false"
                width={compact ? 10 : 11}
                height={compact ? 10 : 11}
                viewBox="0 0 24 24"
                style={styles.reviewsStar}
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="currentColor"
                />
              </svg>
              {reviewAvg?.toFixed(1) ?? "—"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    background: "transparent",
    border: "none",
    borderRadius: 0,
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
    transition: "transform var(--transition-normal)",
  },
  imageWrap: {
    position: "relative",
    aspectRatio: "1",
    overflow: "hidden",
    background: "var(--surface-elevated)",
    borderRadius: 12,
    // touch-action: pan-y — освобождает горизонтальный жест для нашего
    // swipe-handler. Без этого iOS Safari трактует горизонтальный
    // touchmove как page-pan и наши touchmove события прерываются.
    touchAction: "pan-y",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  // Стиль точек идентичен ProductPage gallery-dots — pill-bg
  // с blur, активная точка превращается в widened pill.
  dotsRow: {
    position: "absolute",
    bottom: 8,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.28)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    pointerEvents: "none",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.45)",
    transition: "background 0.2s ease, width 0.25s ease, border-radius 0.25s ease",
  },
  dotActive: {
    background: "#fff",
    width: 18,
    borderRadius: 3,
  },
  nameRow: {
    display: "flex",
    // flex-start вместо center — иначе на 2-line title heart смещается
    // вниз (между двумя строками). С flex-start + marginTop shift
    // на wishlistBtn heart всегда aligned с первой строкой.
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 0,
    minHeight: 0,
  },
  nameRowCompact: {
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 0,
    minHeight: 0,
  },
  // Wishlist-кнопка живёт в строке name (inline). marginRight: -6
  // bleeds в правый padding descWrap (heart ближе к краю карточки).
  // marginTop: смещаем кнопку вверх так, чтобы её визуальный центр
  // лёг на центр первой строки названия (а не на середину 2-line
  // блока). Расчёт: btn 32px center=16, line 15px*1.3=19.5 center=9.75,
  // shift = -(16-9.75) ≈ -6. Это same fix для 1-line И 2-line cases.
  wishlistBtn: {
    flexShrink: 0,
    width: 32,
    height: 32,
    padding: 0,
    marginLeft: 8,
    marginRight: -6,
    marginTop: -6,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    lineHeight: 0,
    transition: "color 0.18s ease, transform 0.08s ease",
    WebkitTapHighlightColor: "transparent",
  },
  wishlistBtnCompact: {
    width: 28,
    height: 28,
    marginRight: -4,
    // btn 28 center=14, line 16*1.25=20 center=10, shift=-4.
    marginTop: -4,
  },
  descWrap: {
    position: "relative",
    width: "100%",
    boxSizing: "border-box",
    background: "transparent",
    padding: "6px 10px 8px 4px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    lineHeight: 1.3,
    minHeight: 0,
    flex: "1 1 auto",
  },
  descWrapCompact: {
    padding: "4px 10px 6px 4px",
    gap: 0,
  },
  descWrapCompactSmall: { padding: "3px 10px 5px 4px", gap: 0 },
  name: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    margin: 0,
    fontSize: 15,
    fontWeight: 400,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--text)",
    lineHeight: 1.3,
    letterSpacing: "0.02em",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  brand: {
    padding: 0,
    margin: "3px 0 0",
    fontSize: 10,
    fontWeight: 500,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.3,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  brandCompact: {
    padding: 0,
    margin: "2px 0 0",
    fontSize: 9,
    fontWeight: 500,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.25,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  priceRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
    padding: 0,
    minHeight: 0,
  },
  priceRowCompact: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 5,
    padding: 0,
    minHeight: 0,
  },
  price: {
    padding: 0,
    margin: 0,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--text)",
    lineHeight: 1.2,
    letterSpacing: "0.01em",
    flexShrink: 1,
    minWidth: 0,
    fontVariantNumeric: "tabular-nums",
  },
  reviews: {
    padding: 0,
    margin: 0,
    flexShrink: 0,
    fontSize: 11,
    color: "var(--muted)",
    lineHeight: 1.2,
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
  },
  reviewsCompact: {
    padding: 0,
    margin: 0,
    flexShrink: 0,
    fontSize: 10,
    color: "var(--muted)",
    lineHeight: 1.2,
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
  },
  reviewsStar: {
    color: "var(--accent)",
    display: "block",
    flexShrink: 0,
  },
  cardCompact: { borderRadius: 0 },
  cardFillHeight: { flex: 1, minHeight: 0, height: "100%" },
  imageWrapCompact: {},
  imageWrapTall: { aspectRatio: "4/5" },
  imageWrapFillHeight: { flex: "1 1 0%", minHeight: 120, aspectRatio: "unset" as const },
  descWrapFillHeight: { flex: "0 0 auto", minHeight: 52, flexShrink: 0 },
  nameCompact: { padding: 0, margin: "0 0 3px", fontSize: 16, lineHeight: 1.25, letterSpacing: "-0.01em" },
  priceCompact: { padding: 0, margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-0.01em" },
};
