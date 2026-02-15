import { useSettings } from "../context/SettingsContext";
import type { Product } from "../api";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  inWishlist?: boolean;
  onWishlistClick?: (e: React.MouseEvent) => void;
  compact?: boolean;
}

export function ProductCard({ product, onClick, inWishlist, onWishlistClick, compact }: ProductCardProps) {
  const { formatPrice } = useSettings();
  const cardStyle = compact ? { ...styles.card, ...styles.cardCompact } : styles.card;
  const nameStyle = compact ? { ...styles.name, ...styles.nameCompact } : styles.name;
  const priceStyle = compact ? { ...styles.price, ...styles.priceCompact } : styles.price;
  const imageWrapStyle = compact ? { ...styles.imageWrap, ...styles.imageWrapCompact } : styles.imageWrap;
  const wishlistBtnStyle = compact ? { ...styles.wishlistBtn, ...styles.wishlistBtnCompact } : styles.wishlistBtn;
  return (
    <button onClick={onClick} style={cardStyle}>
      <div style={imageWrapStyle}>
        <img
          src={product.image_url || "https://via.placeholder.com/200"}
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
      <p style={nameStyle}>{product.name}</p>
      <p style={priceStyle}>{formatPrice(product.price)}</p>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
    transition: "border-color 0.2s, transform 0.15s",
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
  name: {
    padding: "14px 14px 4px",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  price: {
    padding: "0 14px 14px",
    fontSize: 15,
    color: "var(--accent)",
    fontWeight: 700,
  },
  cardCompact: { borderRadius: 10 },
  imageWrapCompact: {},
  wishlistBtnCompact: { top: 8, right: 8, width: 30, height: 30, fontSize: 15 },
  nameCompact: { padding: "10px 10px 2px", fontSize: 12 },
  priceCompact: { padding: "0 10px 10px", fontSize: 13 },
};
