import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";

interface CatalogProps {
  products: Product[];
  onProductClick: (id: number) => void;
}

export function Catalog({ products, onProductClick }: CatalogProps) {
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
};
