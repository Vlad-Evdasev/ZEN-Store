import { useState, useMemo } from "react";
import type { Product, Store } from "../api";
import { ProductCard } from "../components/ProductCard";
import { StoreCard } from "../components/StoreCard";
import { getCategoryLabel } from "../utils/categories";

interface CatalogProps {
  products: Product[];
  stores: Store[];
  onProductClick: (id: number) => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
}

const CATEGORIES = ["all", "tee", "hoodie", "pants", "jacket", "accessories"];

export function Catalog({
  products,
  stores,
  onProductClick,
  wishlistIds,
  onToggleWishlist,
}: CatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedStoreId !== null) {
      list = list.filter((p) => (p.store_id ?? 1) === selectedStoreId);
    }
    if (category !== "all") {
      list = list.filter((p) => p.category === category);
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
  }, [products, selectedStoreId, category, search]);

  return (
    <div style={styles.wrap}>
      {stores.length > 0 && (
        <div style={styles.storesRow}>
          {stores.map((s) => (
            <StoreCard
              key={s.id}
              store={s}
              onClick={() =>
                setSelectedStoreId((prev) => (prev === s.id ? null : s.id))
              }
              selected={selectedStoreId === s.id}
            />
          ))}
        </div>
      )}

      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>

      <div style={styles.tabsWrap}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              ...styles.tab,
              ...(category === cat ? styles.tabActive : {}),
            }}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
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
  storesRow: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 12,
    marginBottom: 20,
    WebkitOverflowScrolling: "touch",
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
  tabsWrap: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 8,
    marginBottom: 20,
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    flexShrink: 0,
    padding: "10px 16px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    color: "var(--muted)",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  tabActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
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
