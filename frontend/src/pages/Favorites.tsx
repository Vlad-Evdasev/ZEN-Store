import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";

interface FavoritesProps {
  products: Product[];
  wishlistIds: Set<number>;
  onProductClick: (id: number) => void;
  onToggleWishlist: (id: number) => void;
  onBack: () => void;
}

export function Favorites({
  products,
  wishlistIds,
  onProductClick,
  onToggleWishlist,
  onBack,
}: FavoritesProps) {
  const favorites = products.filter((p) => wishlistIds.has(p.id));

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>
      <h2 style={styles.title}>Избранное</h2>
      {favorites.length === 0 ? (
        <div style={styles.empty}>
          <p>В избранном пока пусто</p>
          <p style={styles.emptyHint}>Добавляйте товары, нажимая ♡ в каталоге</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {favorites.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => onProductClick(p.id)}
              inWishlist={true}
              onWishlistClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(p.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
  empty: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
  emptyHint: {
    fontSize: 13,
    marginTop: 8,
    opacity: 0.8,
  },
};
