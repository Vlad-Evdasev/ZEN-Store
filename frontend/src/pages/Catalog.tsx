import { useState, useMemo, useRef, useEffect } from "react";
import type { Product, Store } from "../api";
import { ProductCard } from "../components/ProductCard";
import { StoreCard } from "../components/StoreCard";
import { getCategoryLabel } from "../utils/categories";

interface CatalogProps {
  products: Product[];
  stores: Store[];
  onProductClick: (id: number) => void;
  onStoreClick: (store: { id: number; name: string } | { category: string; name: string }) => void;
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
  onStoreClick,
  wishlistIds,
  onToggleWishlist,
}: CatalogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(["all"]));
  const scrollRef = useRef<HTMLDivElement>(null);
  const marqueePausedRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const lastAutoScrollRef = useRef(0);

  type DisplayStore =
    | { id: number; name: string; image: string; desc: string; isReal: true }
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

  const pauseAndResume = () => {
    marqueePausedRef.current = true;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => {
      marqueePausedRef.current = false;
      pauseTimeoutRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || displayStores.length === 0) return;

    const handleScroll = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) return;

      if (Date.now() - lastAutoScrollRef.current < 80) return;

      pauseAndResume();

      if (el.scrollLeft < 5) {
        lastAutoScrollRef.current = Date.now();
        el.scrollLeft = half - 5;
      } else if (el.scrollLeft > half - 5) {
        lastAutoScrollRef.current = Date.now();
        el.scrollLeft = 5;
      }
    };

    const step = () => {
      if (marqueePausedRef.current) return;
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      lastAutoScrollRef.current = Date.now();
      el.scrollLeft += 1.5;
      if (el.scrollLeft >= half - 1) el.scrollLeft = 0;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    const id = setInterval(step, 30);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearInterval(id);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, [displayStores.length]);

  const filtered = useMemo(() => {
    let list = products;
    if (!selectedCategories.has("all")) {
      list = list.filter((p) => selectedCategories.has(p.category));
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
  }, [products, selectedCategories, search]);

  const handleCategoryClick = (cat: string) => {
    if (cat === "all") {
      setSelectedCategories(new Set(["all"]));
      return;
    }
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.delete("all");
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      if (next.size === 0) return new Set(["all"]);
      return next;
    });
  };

  const handleStoreClick = (item: DisplayStore) => {
    if (item.isReal && typeof item.id === "number") {
      onStoreClick({ id: item.id, name: item.name });
    } else if (!item.isReal && item.category) {
      onStoreClick({ category: item.category, name: item.name });
    }
  };

  return (
    <div style={styles.wrap}>
      {displayStores.length > 0 && (
        <div style={styles.storesRowWrap}>
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) {
                const half = el.scrollWidth / 2;
                if (el.scrollLeft <= 20) el.scrollLeft = half - 20;
                else el.scrollBy({ left: -200, behavior: "smooth" });
              }
              pauseAndResume();
            }}
            style={styles.scrollBtn}
            aria-label="Влево"
          >
            ‹
          </button>
          <div
            ref={scrollRef}
            style={styles.storesRow}
            className="hide-scrollbar"
            onMouseDown={pauseAndResume}
            onMouseUp={pauseAndResume}
            onMouseLeave={pauseAndResume}
            onTouchStart={pauseAndResume}
            onTouchEnd={pauseAndResume}
          >
          {[...displayStores, ...displayStores].map((s, i) => (
            <StoreCard
              key={`${String(s.id)}-${i}`}
              store={{
                id: typeof s.id === "number" ? s.id : 0,
                name: s.name,
                image_url: s.image,
                description: s.desc,
              }}
              onClick={() => handleStoreClick(s)}
            />
          ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) {
                const half = el.scrollWidth / 2;
                if (el.scrollLeft >= half - 20) el.scrollLeft = 0;
                else el.scrollBy({ left: 200, behavior: "smooth" });
              }
              pauseAndResume();
            }}
            style={styles.scrollBtn}
            aria-label="Вправо"
          >
            ›
          </button>
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

      <div style={styles.tabsWrap} className="hide-scrollbar">
        {CATEGORIES.map((cat) => {
          const isSelected = cat === "all" ? selectedCategories.has("all") : selectedCategories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              className="catalog-tab-btn"
              onClick={() => handleCategoryClick(cat)}
              style={{
                ...styles.tab,
                ...(isSelected ? styles.tabActive : {}),
                outline: "none",
                boxShadow: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {getCategoryLabel(cat)}
            </button>
          );
        })}
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
              compact
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
  wrap: { paddingBottom: 24, overflowX: "visible" },
  storesRowWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  storesRow: {
    flex: 1,
    display: "flex",
    gap: 12,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 12,
    WebkitOverflowScrolling: "touch",
    minWidth: 0,
  },
  scrollBtn: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 24,
    cursor: "pointer",
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
    boxShadow: "none",
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
