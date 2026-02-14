import { useEffect, useState } from "react";
import { getProducts, addToCart, type Product } from "../api";

interface ProductPageProps {
  productId: number;
  onBack: () => void;
  onCart: () => void;
  userId: string;
}

export function ProductPage({ productId, onBack, onCart, userId }: ProductPageProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [size, setSize] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getProducts().then((list) => {
      const p = list.find((x) => x.id === productId) ?? null;
      setProduct(p);
      if (p) setSize(p.sizes.split(",")[0]?.trim() || "");
      setLoading(false);
    });
  }, [productId]);

  const handleAdd = async () => {
    if (!product || !size) return;
    setAdding(true);
    try {
      await addToCart(userId, product.id, size);
      onCart();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  if (loading || !product) {
    return (
      <div style={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  const sizes = product.sizes.split(",").map((s) => s.trim());

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>

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
        <span style={styles.price}>{product.price.toLocaleString("ru-RU")} ₽</span>
        <button
          onClick={handleAdd}
          disabled={adding}
          style={styles.addBtn}
        >
          {adding ? "..." : "В корзину"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto" },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 16,
  },
  imageWrap: {
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--surface)",
    aspectRatio: "1",
    marginBottom: 20,
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 8,
  },
  desc: {
    color: "var(--muted)",
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  sizeSection: { marginBottom: 24 },
  label: {
    fontSize: 12,
    color: "var(--muted)",
    marginBottom: 8,
  },
  sizes: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  sizeBtn: {
    padding: "10px 16px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  sizeBtnActive: {
    borderColor: "var(--accent)",
    color: "var(--accent)",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  price: {
    fontSize: 20,
    fontWeight: 600,
    color: "var(--accent)",
  },
  addBtn: {
    flex: 1,
    padding: 14,
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "var(--bg)",
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
