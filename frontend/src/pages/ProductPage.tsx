import { useState, useEffect } from "react";
import { addToCart, type Product } from "../api";
import { useSettings } from "../context/SettingsContext";

interface ProductPageProps {
  product: Product | undefined;
  onBack: () => void;
  onCart: () => void;
  onAddedToCart?: () => void;
  userId: string;
  inWishlist: boolean;
  onToggleWishlist: () => void;
}

export function ProductPage({
  product,
  onBack,
  onCart,
  onAddedToCart,
  userId,
  inWishlist,
  onToggleWishlist,
}: ProductPageProps) {
  const { formatPrice } = useSettings();
  const [size, setSize] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const sizes = product ? product.sizes.split(",").map((s) => s.trim()) : [];
  useEffect(() => {
    if (product && sizes.length) setSize(sizes[0]);
  }, [product?.id]);

  if (!product) {
    return (
      <div style={styles.loading}>
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

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <button onClick={onBack} style={styles.back}>
          ← Назад
        </button>
        <button
          onClick={onToggleWishlist}
          style={{ ...styles.wishlistBtn, color: inWishlist ? "var(--accent)" : "var(--muted)" }}
        >
          {inWishlist ? "♥" : "♡"}
        </button>
      </div>

      <div style={styles.imageWrap}>
        <img
          src={product.image_url || "https://via.placeholder.com/400"}
          alt={product.name}
          style={styles.image}
        />
      </div>

      <h1 style={styles.title}>{product.name}</h1>
      <p style={styles.desc}>{product.description}</p>

      <div style={styles.sizeSection}>
        <p style={styles.label}>Размер</p>
        <div style={styles.sizes}>
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              style={{
                ...styles.sizeBtn,
                ...(size === s ? styles.sizeBtnActive : {}),
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
        <span style={styles.price}>{formatPrice(product.price)}</span>
        {justAdded ? (
          <button onClick={onCart} style={styles.addBtn}>
            Перейти в корзину
          </button>
        ) : (
          <button onClick={handleAdd} disabled={adding} style={styles.addBtn}>
            {adding ? "..." : "В корзину"}
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  wishlistBtn: {
    background: "none",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
  },
  imageWrap: {
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--surface)",
    aspectRatio: "1",
    marginBottom: 24,
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 8,
    letterSpacing: "-0.02em",
  },
  desc: {
    color: "var(--muted)",
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  sizeSection: { marginBottom: 24 },
  label: {
    fontSize: 12,
    color: "var(--muted)",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  sizes: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  sizeBtn: {
    padding: "12px 18px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  sizeBtnActive: {
    borderColor: "var(--accent)",
    color: "var(--accent)",
    background: "rgba(196, 30, 58, 0.1)",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  price: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--accent)",
  },
  addBtn: {
    flex: 1,
    padding: 16,
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
