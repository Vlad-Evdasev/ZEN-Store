import { useState, useMemo } from "react";
import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";
import { getCategoryLabel } from "../utils/categories";

interface StoreCatalogProps {
  store: { id: number; name: string } | { category: string; name: string };
  products: Product[];
  onProductClick: (id: number) => void;
  onBack: () => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
}

export function StoreCatalog({
  store,
  products,
  onProductClick,
  onBack,
  wishlistIds,
  onToggleWishlist,
}: StoreCatalogProps) {
  const [search, setSearch] = useState("");
  const isStoreById = "id" in store;

  const filtered = useMemo(() => {
    let list = products;
    if (isStoreById) {
      list = list.filter((p) => (p.store_id ?? 1) === store.id);
    } else {
      list = list.filter((p) => p.category === store.category);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, store, isStoreById, search]);

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {isStoreById ? store.name : getCategoryLabel(store.category)}
      </button>
      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Поиск в каталоге..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>
      {filtered.length === 0 ? (
        <div style={styles.empty}>
          <p>Ничего не найдено</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => onProductClick(p.id)}
              inWishlist={wishlistIds.has(p.id)}
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
  wrap: { paddingBottom: 24 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 16,
  },
  searchWrap: { marginBottom: 16 },
  search: {
    width: "100%",
    padding: "12px 16px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 15,
    fontFamily: "inherit",
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
};
