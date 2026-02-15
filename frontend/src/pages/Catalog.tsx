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

const FALLBACK_STORES: { id: string; name: string; category: string; image: string; desc: string }[] = [
  { id: "tee", name: "Футболки", category: "tee", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", desc: "Базовые и оверсайз" },
  { id: "hoodie", name: "Худи", category: "hoodie", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", desc: "Худи и свитшоты" },
  { id: "pants", name: "Штаны", category: "pants", image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", desc: "Карго и классика" },
  { id: "jacket", name: "Верхняя одежда", category: "jacket", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", desc: "Куртки и аксессуары" },
];

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
  const [selectedStoreCategory, setSelectedStoreCategory] = useState<string | null>(null);

  type DisplayStore =
    | { id: number; name: string; image: string; desc: string; isReal: true; category?: never }
    | { id: string; name: string; image: string; desc: string; isReal: false; category: string };

  const displayStores = useMemo((): DisplayStore[] => {
    if (stores.length > 0) {
      return stores.map((s) => ({
        id: s.id,
        name: s.name,
        image: s.image_url || "",
        desc: s.description || "",
        isReal: true as const,
      }));
    }
    return FALLBACK_STORES.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.image,
      desc: s.desc,
      isReal: false as const,
      category: s.category,
    }));
  }, [stores]);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedStoreId !== null) {
      list = list.filter((p) => (p.store_id ?? 1) === selectedStoreId);
    }
    if (selectedStoreCategory !== null) {
      list = list.filter((p) => p.category === selectedStoreCategory);
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
  }, [products, selectedStoreId, selectedStoreCategory, category, search]);

  const handleStoreClick = (item: DisplayStore) => {
    if (item.isReal) {
      const newVal = selectedStoreId === item.id ? null : item.id;
      setSelectedStoreId(newVal);
      setSelectedStoreCategory(null);
    } else {
      const newVal = selectedStoreCategory === item.category ? null : item.category;
      setSelectedStoreCategory(newVal);
      setSelectedStoreId(null);
    }
  };

  const isStoreSelected = (item: DisplayStore) => {
    if (item.isReal) return selectedStoreId === item.id;
    return selectedStoreCategory === item.category;
  };

  return (
    <div style={styles.wrap}>
      {displayStores.length > 0 && (
        <div style={styles.storesRow}>
          {displayStores.map((s) => (
            <StoreCard
              key={String(s.id)}
              store={{
                id: typeof s.id === "number" ? s.id : 0,
                name: s.name,
                image_url: s.image,
                description: s.desc,
              }}
              onClick={() => handleStoreClick(s)}
              selected={isStoreSelected(s)}
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
