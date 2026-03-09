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
  const wishlistBtnStyle = compact ? styles.wishlistBtnCompact : styles.wishlistBtn;
  const hasReviews = reviewCount != null && reviewCount > 0;
  const descWrapStyle: React.CSSProperties = {
    ...styles.descWrap,
    ...(compact ? styles.descWrapCompact : {}),
    ...(compact && smallDescBlock ? styles.descWrapCompactSmall : {}),
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
      <div style={imageWrapStyle}>
        <img
          src={(product.image_urls && product.image_urls[0]) || product.image_url || "https://via.placeholder.com/200"}
          alt={product.name}
          style={styles.image}
        />
      </div>
      <div className="product-card-desc" style={descWrapStyle}>
        <p className="product-card-name" style={nameStyle} title={product.name}>{product.name}</p>
        <div style={compact ? styles.descBottomRowCompact : styles.descBottomRow}>
          <p className="product-card-price" style={priceStyle}>{formatPrice(product.price)}</p>
          <span style={styles.descBottomRight}>
            {hasReviews && (
              <span style={{ ...(compact ? styles.reviewsCompact : styles.reviews), ...noShrink }}>
                ★ {reviewAvg?.toFixed(1) ?? "—"} {reviewCount !== undefined && `(${reviewCount})`}
              </span>
            )}
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
          </span>
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
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
    transition: "border-color var(--transition-fast), transform var(--transition-normal), box-shadow var(--transition-normal)",
  },
  imageWrap: {
    position: "relative",
    aspectRatio: "1",
    overflow: "hidden",
    background: "var(--bg)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  wishlistBtn: {
    flexShrink: 0,
    padding: 4,
    margin: 0,
    border: "none",
    background: "none",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },
  wishlistBtnCompact: {
    flexShrink: 0,
    padding: 2,
    margin: 0,
    border: "none",
    background: "none",
    fontSize: 16,
    cursor: "pointer",
    lineHeight: 1,
  },
  descBottomRight: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  descWrap: {
    position: "relative",
    width: "100%",
    boxSizing: "border-box",
    background: "var(--surface)",
    padding: "12px 14px 14px",
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.25,
    minHeight: 0,
    flex: "1 1 auto",
  },
  descWrapCompact: {
    padding: "10px 12px 12px",
  },
  descWrapCompactSmall: { padding: "8px 10px 10px" },
  name: {
    padding: 0,
    margin: "0 0 4px",
    fontSize: 14,
    fontWeight: 400,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.35,
  },
  descBottomRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    padding: 0,
    margin: 0,
    minHeight: 0,
    lineHeight: 1.25,
  },
  descBottomRowCompact: {
    padding: 0,
    margin: 0,
    gap: 6,
    minHeight: 0,
    lineHeight: 1.25,
  },
  price: {
    padding: 0,
    margin: 0,
    fontSize: 14,
    color: "var(--text)",
    fontWeight: 500,
    lineHeight: 1.25,
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
  cardCompact: { borderRadius: "var(--radius-md)" },
  cardFillHeight: { flex: 1, minHeight: 0, height: "100%" },
  imageWrapCompact: {},
  imageWrapTall: { aspectRatio: "4/5" },
  imageWrapFillHeight: { flex: 1, minHeight: 0, aspectRatio: "unset" as const },
  nameCompact: { padding: 0, margin: "0 0 2px", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 },
  priceCompact: { padding: 0, margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.25 },
};
