import { useSettings } from "../context/SettingsContext";
import type { Product } from "../api";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
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
}

export function ProductCard({ product, onClick, inWishlist, onWishlistClick, compact, reviewCount, reviewAvg, fillHeight, descBlockMinHeight, smallDescBlock, sizeVariant = "default" }: ProductCardProps) {
  const { formatPrice } = useSettings();
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
      onClick();
    }
  };
  return (
    <div
      className="product-card product-card--text-below"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={cardStyle}
    >
      <div className="product-card__image-wrap" style={imageWrapStyle}>
        <img
          src={(product.image_urls && product.image_urls[0]) || product.image_url || "https://via.placeholder.com/200"}
          alt={product.name}
          style={styles.image}
        />
        {onWishlistClick && (
          <button
            type="button"
            className={`product-card-wishlist-btn${inWishlist ? " is-active" : ""}`}
            onClick={(e) => { e.stopPropagation(); onWishlistClick(e); }}
            style={{ ...wishlistBtnStyle, color: inWishlist ? "var(--accent)" : "#1a1a1a" }}
            aria-label={inWishlist ? "Убрать из избранного" : "В избранное"}
          >
            <svg
              width={compact ? 16 : 18}
              height={compact ? 16 : 18}
              viewBox="0 0 24 24"
              fill={inWishlist ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
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
      <div className="product-card-desc" style={descWrapStyle}>
        <div style={compact ? styles.nameRowCompact : styles.nameRow}>
          <p className="product-card-name" style={nameStyle} title={product.name}>{product.name}</p>
        </div>
        {product.brand?.trim() && (
          <span style={compact ? styles.brandCompact : styles.brand}>{product.brand.trim()}</span>
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
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 0,
    minHeight: 0,
  },
  nameRowCompact: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 0,
    minHeight: 0,
  },
  wishlistBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 32,
    height: 32,
    padding: 0,
    margin: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(14px) saturate(1.2)",
    WebkitBackdropFilter: "blur(14px) saturate(1.2)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    cursor: "pointer",
    lineHeight: 0,
    transition: "transform 0.18s ease, background 0.18s ease, color 0.18s ease",
  },
  wishlistBtnCompact: {
    top: 6,
    right: 6,
    width: 28,
    height: 28,
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
  nameCompact: { padding: 0, margin: "0 0 3px", fontSize: 13, lineHeight: 1.3 },
  priceCompact: { padding: 0, margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text)", lineHeight: 1.25 },
};
