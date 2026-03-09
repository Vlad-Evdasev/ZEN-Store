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
        <p className="product-card-name" style={nameStyle} title={product.name}>{product.name}</p>
        <p className="product-card-price" style={priceStyle}>{formatPrice(product.price)}</p>
        {hasReviews && (
          <span style={{ ...(compact ? styles.reviewsCompact : styles.reviews), ...noShrink }}>
            ★ {reviewAvg?.toFixed(1) ?? "—"} {reviewCount !== undefined && `(${reviewCount})`}
          </span>
        )}
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
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  wishlistBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 4,
    margin: 0,
    border: "none",
    background: "none",
    fontSize: 16,
    cursor: "pointer",
    lineHeight: 1,
  },
  wishlistBtnCompact: {
    top: 8,
    right: 8,
    padding: 2,
    fontSize: 14,
  },
  descWrap: {
    position: "relative",
    width: "100%",
    boxSizing: "border-box",
    background: "transparent",
    padding: "6px 24px 8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    lineHeight: 1.3,
    minHeight: 0,
    flex: "1 1 auto",
  },
  descWrapCompact: {
    padding: "4px 20px 6px 8px",
    gap: 0,
  },
  descWrapCompactSmall: { padding: "3px 18px 5px 6px", gap: 0 },
  name: {
    padding: 0,
    margin: 0,
    fontSize: 14,
    fontWeight: 400,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.35,
    letterSpacing: "0.03em",
  },
  price: {
    padding: 0,
    margin: "2px 0 0",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'Georgia, "Times New Roman", serif',
    lineHeight: 1.3,
    letterSpacing: "0.02em",
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
  imageWrapFillHeight: { flex: 1, minHeight: 0, aspectRatio: "unset" as const },
  nameCompact: { padding: 0, margin: "0 0 2px", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 },
  priceCompact: { padding: 0, margin: "1px 0 0", fontSize: 13, fontWeight: 500, lineHeight: 1.25 },
};
