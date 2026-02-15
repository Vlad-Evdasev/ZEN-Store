import { useState, useMemo } from "react";
import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";
import { FeaturedCard } from "../components/FeaturedCard";
import { getCategoryLabel } from "../utils/categories";

interface CatalogProps {
  products: Product[];
  onProductClick: (id: number) => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
}

const CATEGORIES = ["all", "tee", "hoodie", "pants", "jacket", "accessories"];

export function Catalog({ products, onProductClick, wishlistIds, onToggleWishlist }: CatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const featuredProducts = useMemo(() => {
    const cats = ["tee", "hoodie", "pants", "jacket"];
    const seen = new Set<string>();
    return products.filter((p) => {
      if (seen.has(p.category) || !cats.includes(p.category)) return false;
      seen.add(p.category);
      return true;
    }).slice(0, 4);
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
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
  }, [products, category, search]);

  return (
    <div style={styles.wrap}>
      {featuredProducts.length > 0 && (
        <div style={styles.featuredGrid}>
          {featuredProducts.map((p) => (
            <FeaturedCard
              key={p.id}
              image={p.image_url || "https://via.placeholder.com/300"}
              title={p.name}
              description={
                (p.description || "").length > 60
                  ? (p.description || "").slice(0, 60) + "..."
                  : p.description || ""
              }
              onClick={() => onProductClick(p.id)}
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
  featuredGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
    marginBottom: 20,
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
