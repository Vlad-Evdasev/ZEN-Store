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
}

export function ProductCard({ product, onClick, inWishlist, onWishlistClick, compact, reviewCount, reviewAvg, fillHeight, descBlockMinHeight, smallDescBlock }: ProductCardProps) {
  const { formatPrice } = useSettings();
  const cardStyle = compact
    ? { ...styles.card, ...styles.cardCompact, ...(fillHeight ? styles.cardFillHeight : {}) }
    : { ...styles.card, ...(fillHeight ? styles.cardFillHeight : {}) };
  const noShrink = fillHeight ? { flexShrink: 0 as const } : {};
  const nameStyle = compact ? { ...styles.name, ...styles.nameCompact, ...noShrink } : { ...styles.name, ...noShrink };
  const priceStyle = compact ? { ...styles.price, ...styles.priceCompact, ...noShrink } : { ...styles.price, ...noShrink };
  const imageWrapStyle = compact
    ? { ...styles.imageWrap, ...styles.imageWrapCompact, ...(fillHeight ? styles.imageWrapFillHeight : {}) }
    : { ...styles.imageWrap, ...(fillHeight ? styles.imageWrapFillHeight : {}) };
  const wishlistBtnStyle = compact ? { ...styles.wishlistBtn, ...styles.wishlistBtnCompact } : styles.wishlistBtn;
  const hasReviews = reviewCount != null && reviewCount > 0;
  const descWrapStyle: React.CSSProperties = {
    ...styles.descWrap,
    ...(compact ? styles.descWrapCompact : {}),
    ...(compact && smallDescBlock ? styles.descWrapCompactSmall : {}),
    ...(descBlockMinHeight != null ? { minHeight: descBlockMinHeight } : {}),
  };
  return (
    <button onClick={onClick} style={cardStyle}>
      <div style={imageWrapStyle}>
        <img
          src={(product.image_urls && product.image_urls[0]) || product.image_url || "https://via.placeholder.com/200"}
          alt={product.name}
          style={styles.image}
        />
        {onWishlistClick && (
          <button
            onClick={onWishlistClick}
            style={{ ...wishlistBtnStyle, color: inWishlist ? "var(--accent)" : "#fff" }}
            aria-label={inWishlist ? "Убрать из избранного" : "В избранное"}
          >
            {inWishlist ? "♥" : "♡"}
          </button>
        )}
      </div>
      <div style={descWrapStyle}>
        <p style={nameStyle} title={product.name}>{product.name}</p>
        {hasReviews && (
          <p style={{ ...(compact ? styles.reviewsCompact : styles.reviews), ...noShrink }}>
            ★ {reviewAvg?.toFixed(1) ?? "—"} {reviewCount !== undefined && `(${reviewCount})`}
          </p>
        )}
        <p style={priceStyle}>{formatPrice(product.price)}</p>
      </div>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 12,
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
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.5)",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
  },
  descWrap: {
    position: "absolute",
    bottom: "calc(-1 * var(--card-desc-bleed, 2px))",
    left: "calc(-1 * var(--card-desc-bleed, 2px))",
    right: "calc(-1 * var(--card-desc-bleed, 2px))",
    width: "calc(100% + 2 * var(--card-desc-bleed, 2px))",
    boxSizing: "border-box",
    background: "var(--card-desc-bg)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: "var(--card-desc-outer, none)",
    padding: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  descWrapCompact: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  descWrapCompactSmall: {},
  name: {
    padding: "8px calc(8px + var(--card-desc-bleed, 2px)) 2px calc(8px + var(--card-desc-bleed, 2px))",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  price: {
    padding: "0 calc(8px + var(--card-desc-bleed, 2px)) calc(8px + var(--card-desc-bleed, 2px)) calc(8px + var(--card-desc-bleed, 2px))",
    fontSize: 15,
    color: "var(--text)",
    fontWeight: 700,
  },
  reviews: {
    padding: "0 calc(8px + var(--card-desc-bleed, 2px)) 2px calc(8px + var(--card-desc-bleed, 2px))",
    fontSize: 12,
    color: "var(--muted)",
  },
  reviewsCompact: {
    padding: "0 calc(6px + var(--card-desc-bleed, 2px)) 2px calc(6px + var(--card-desc-bleed, 2px))",
    fontSize: 11,
    color: "var(--muted)",
  },
  cardCompact: { borderRadius: 10 },
  cardFillHeight: { flex: 1, minHeight: 0, height: "100%" },
  imageWrapCompact: {},
  imageWrapFillHeight: { flex: 1, minHeight: 0, aspectRatio: "unset" as const },
  wishlistBtnCompact: { top: 8, right: 8, width: 30, height: 30, fontSize: 15 },
  nameCompact: { padding: "4px calc(6px + var(--card-desc-bleed, 2px)) 2px calc(6px + var(--card-desc-bleed, 2px))", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  priceCompact: { padding: "0 calc(6px + var(--card-desc-bleed, 2px)) calc(4px + var(--card-desc-bleed, 2px)) calc(6px + var(--card-desc-bleed, 2px))", fontSize: 13 },
};
