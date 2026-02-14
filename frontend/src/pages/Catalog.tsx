import { useEffect, useState } from "react";
import { getProducts, type Product } from "../api";
import { ProductCard } from "../components/ProductCard";

interface CatalogProps {
  onProductClick: (id: number) => void;
}

export function Catalog({ onProductClick }: CatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onClick={() => onProductClick(p.id)} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
