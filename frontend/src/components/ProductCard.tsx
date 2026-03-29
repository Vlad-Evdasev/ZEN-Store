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
      </div>
      <div className="product-card-desc" style={descWrapStyle}>
        <div style={compact ? styles.nameRowCompact : styles.nameRow}>
          <p className="product-card-name" style={nameStyle} title={product.name}>{product.name}</p>
          {onWishlistClick && (
            <button
              type="button"
              className="product-card-wishlist-btn"
              onClick={(e) => { e.stopPropagation(); onWishlistClick(e); }}
              style={{ ...wishlistBtnStyle, color: inWishlist ? "var(--accent)" : "var(--muted)" }}
              aria-label={inWishlist ? "Убрать из избранного" : "В избранное"}
            >
              {inWishlist ? "♥" : "♡"}
            </button>
          )}
        </div>
        {product.brand?.trim() && (
          <span style={compact ? styles.brandCompact : styles.brand}>{product.brand.trim()}</span>
        )}
        <div style={compact ? styles.priceRowCompact : styles.priceRow}>
          <p className="product-card-price" style={priceStyle}>{formatPrice(product.price)}</p>
          {hasReviews && (
            <span style={{ ...(compact ? styles.reviewsCompact : styles.reviews), ...noShrink }}>
              ★ {reviewAvg?.toFixed(1) ?? "—"}
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
  wishlistBtn: {
    flexShrink: 0,
    padding: 2,
    margin: 0,
    border: "none",
    background: "none",
    fontSize: 20,
    cursor: "pointer",
    lineHeight: 1,
  },
  wishlistBtnCompact: {
    padding: 2,
    fontSize: 18,
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
    lineHeight: 1.35,
    letterSpacing: "0.03em",
    wordBreak: "break-word",
    overflowWrap: "break-word",
  },
  brand: {
    padding: 0,
    margin: "2px 0 0",
    fontSize: 12,
    fontWeight: 400,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.3,
  },
  brandCompact: {
    padding: 0,
    margin: "1px 0 0",
    fontSize: 11,
    fontWeight: 400,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.25,
  },
  priceRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
    padding: 0,
    minHeight: 0,
  },
  priceRowCompact: {
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 3,
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
    lineHeight: 1.3,
    letterSpacing: "0.02em",
    flexShrink: 1,
    minWidth: 0,
  },
  reviews: {
    padding: 0,
    margin: 0,
    flexShrink: 0,
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.25,
  },
  reviewsCompact: {
    padding: 0,
    margin: 0,
    flexShrink: 0,
    fontSize: 11,
    color: "var(--muted)",
    lineHeight: 1.25,
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
