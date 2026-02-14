import type { Product } from "../api";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <button onClick={onClick} style={styles.card}>
      <div style={styles.imageWrap}>
        <img
          src={product.image_url || "https://via.placeholder.com/200"}
          alt={product.name}
          style={styles.image}
        />
      </div>
      <p style={styles.name}>{product.name}</p>
      <p style={styles.price}>{product.price.toLocaleString("ru-RU")} ₽</p>
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
  },
  imageWrap: {
    aspectRatio: "1",
    overflow: "hidden",
    background: "var(--bg)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  name: {
    padding: "12px 12px 4px",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text)",
  },
  price: {
    padding: "0 12px 12px",
    fontSize: 14,
    color: "var(--accent)",
    fontWeight: 600,
  },
};
