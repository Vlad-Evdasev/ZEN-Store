import { useState, useMemo, useRef, useEffect } from "react";
import type { Product, Store, Category, ProductReviewStats } from "../api";
import { getProductReviewStats } from "../api";
import { ProductCard } from "../components/ProductCard";
import { StoreCard } from "../components/StoreCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface CatalogProps {
  products: Product[];
  stores: Store[];
  categories?: Category[];
  /** Выбранные категории (если заданы — каталог в режиме controlled, выбор сохраняется при уходе на товар и назад) */
  selectedCategories?: Set<string>;
  onSelectedCategoriesChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
  onProductClick: (id: number) => void;
  onStoreClick: (store: { id: number; name: string } | { category: string; name: string }) => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
  hideStores?: boolean;
  /** Показывать фильтр по цене (для страницы полного каталога) */
  showPriceFilter?: boolean;
}

/** Теги категорий в каталоге: «Всё» + категории из API (синхронизированы с админкой) */
const FALLBACK_CATEGORY_CODES = ["all", "tee", "hoodie", "pants", "jacket", "accessories"];

const FALLBACK_BY_CODE: Record<string, { image: string; desc: string }> = {
  tee: { image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", desc: "Базовые и оверсайз" },
  hoodie: { image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", desc: "Худи и свитшоты" },
  pants: { image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", desc: "Карго и классика" },
  jacket: { image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", desc: "Куртки и аксессуары" },
  accessories: { image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400", desc: "Аксессуары" },
};
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400";

export function Catalog({
  products,
  stores,
  categories = [],
  selectedCategories: selectedCategoriesProp,
  onSelectedCategoriesChange,
  onProductClick,
  onStoreClick,
  wishlistIds,
  onToggleWishlist,
  hideStores = false,
  showPriceFilter = false,
}: CatalogProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [search, setSearch] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [internalCategories, setInternalCategories] = useState<Set<string>>(new Set(["all"]));
  const selectedCategories = selectedCategoriesProp ?? internalCategories;
  const setSelectedCategories = onSelectedCategoriesChange ?? setInternalCategories;
  const [reviewStats, setReviewStats] = useState<ProductReviewStats>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const marqueePausedRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const lastAutoScrollRef = useRef(0);
  const isTouchOnly = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  type DisplayStore =
    | { id: number; name: string; image: string; desc: string; isReal: true }
    | { id: string; name: string; image: string; desc: string; isReal: false; category: string };

  const displayStores = useMemo((): DisplayStore[] => {
    const realStores: DisplayStore[] =
      stores.length > 0
        ? stores.map((s) => ({
            id: s.id,
            name: s.name,
            image: s.image_url || "",
            desc: s.description || "",
            isReal: true as const,
          }))
        : [];
    const categoryTiles: DisplayStore[] =
      realStores.length === 0
        ? categories.length > 0
          ? categories.map((c) => {
              const fallback = FALLBACK_BY_CODE[c.code];
              return {
                id: c.code,
                name: c.name,
                image: fallback?.image ?? DEFAULT_IMAGE,
                desc: fallback?.desc ?? "",
                isReal: false as const,
                category: c.code,
              };
            })
          : Object.entries(FALLBACK_BY_CODE).map(([code, { image, desc }]) => ({
              id: code,
              name: { tee: "Футболки", hoodie: "Худи", pants: "Штаны", jacket: "Куртки", accessories: "Аксессуары" }[code] ?? code,
              image,
              desc,
              isReal: false as const,
              category: code,
            }))
        : [];
    return realStores.length > 0 ? realStores : categoryTiles;
  }, [stores, categories]);

  const pauseAndResume = () => {
    marqueePausedRef.current = true;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => {
      marqueePausedRef.current = false;
      pauseTimeoutRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    getProductReviewStats().then(setReviewStats).catch(console.error);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || displayStores.length === 0) return;

    const handleScroll = () => {
      if (isTouchOnly) return;
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      if (Date.now() - lastAutoScrollRef.current < 80) return;

      pauseAndResume();

      const left = el.scrollLeft;
      if (left < 3) {
        lastAutoScrollRef.current = Date.now();
        requestAnimationFrame(() => { el.scrollLeft = half - 3; });
      } else if (left > half - 3) {
        lastAutoScrollRef.current = Date.now();
        requestAnimationFrame(() => { el.scrollLeft = 3; });
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
    const id = isTouchOnly ? null : setInterval(step, 30);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (id !== null) clearInterval(id);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, [displayStores.length, isTouchOnly]);

  const categoryTabs = useMemo(() => {
    if (categories.length > 0) {
      return [{ code: "all", label: t(lang, "all") }, ...categories.map((c) => ({ code: c.code, label: c.name }))];
    }
    return FALLBACK_CATEGORY_CODES.map((code) => ({ code, label: t(lang, code) }));
  }, [categories, lang]);

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
    if (showPriceFilter && priceMin.trim() !== "") {
      const min = Number(priceMin.trim());
      if (!Number.isNaN(min)) list = list.filter((p) => p.price >= min);
    }
    if (showPriceFilter && priceMax.trim() !== "") {
      const max = Number(priceMax.trim());
      if (!Number.isNaN(max)) list = list.filter((p) => p.price <= max);
    }
    return list;
  }, [products, selectedCategories, search, showPriceFilter, priceMin, priceMax]);

  const displayList = useMemo(() => {
    if (priceSort === "asc") return [...filtered].sort((a, b) => a.price - b.price);
    if (priceSort === "desc") return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [filtered, priceSort]);

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
      {!hideStores && displayStores.length > 0 && (
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
            style={{ ...styles.storesRow, touchAction: "pan-x" }}
            className="hide-scrollbar"
            onMouseDown={pauseAndResume}
            onMouseUp={pauseAndResume}
            onMouseLeave={pauseAndResume}
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
          className="zen-input"
          placeholder={t(lang, "search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>

      {showPriceFilter && (
        <div style={styles.priceFilterWrap}>
          <span style={styles.priceFilterLabel}>{t(lang, "priceFilter")}:</span>
          <div
            style={styles.priceSortSegmented}
            role="group"
            aria-label={t(lang, "priceFilter")}
          >
            <div
              style={{
                ...styles.priceSortSegment,
                ...(priceSort === "asc" ? styles.priceSortSegmentActive : {}),
              }}
              onClick={() => setPriceSort((s) => (s === "asc" ? "none" : "asc"))}
              title={t(lang, "sortPriceAsc")}
              aria-hidden
            >
              ↑
            </div>
            <div
              style={{
                ...styles.priceSortSegment,
                ...(priceSort === "desc" ? styles.priceSortSegmentActive : {}),
              }}
              onClick={() => setPriceSort((s) => (s === "desc" ? "none" : "desc"))}
              title={t(lang, "sortPriceDesc")}
              aria-hidden
            >
              ↓
            </div>
          </div>
          <input
            type="number"
            className="zen-input"
            min={0}
            step={100}
            placeholder={t(lang, "priceFrom")}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            style={styles.priceInput}
          />
          <input
            type="number"
            className="zen-input"
            min={0}
            step={100}
            placeholder={t(lang, "priceTo")}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            style={styles.priceInput}
          />
        </div>
      )}

      <div style={styles.tabsWrap} className="hide-scrollbar">
        {categoryTabs.map(({ code, label }) => {
          const isSelected = code === "all" ? selectedCategories.has("all") : selectedCategories.has(code);
          return (
            <button
              key={code}
              type="button"
              className="catalog-tab-btn"
              onClick={(e) => {
                handleCategoryClick(code);
                (e.currentTarget as HTMLButtonElement).blur();
              }}
              style={{
                ...styles.tab,
                ...(isSelected ? styles.tabActive : {}),
                outline: "none",
                boxShadow: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {displayList.length === 0 ? (
        <div style={styles.empty}>
          <p>{t(lang, "nothingFound")}</p>
        </div>
      ) : (
        <div className="catalog-grid" style={styles.grid}>
          {displayList.map((p) => (
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
              reviewCount={reviewStats[p.id]?.count}
              reviewAvg={reviewStats[p.id]?.avg}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { paddingBottom: 24, overflowX: "hidden", minWidth: 0 },
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
    paddingLeft: 12,
    paddingRight: 12,
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
  priceFilterWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  priceFilterLabel: {
    fontSize: 14,
    color: "var(--muted)",
    fontWeight: 500,
  },
  priceSortSegmented: {
    display: "flex",
    flexShrink: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
  },
  priceSortSegment: {
    flex: 1,
    minWidth: 40,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted)",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  },
  priceSortSegmentActive: {
    background: "var(--accent)",
    color: "#fff",
  },
  priceInput: { width: 100 },
  search: {},
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
    outline: "none",
  },
  tabActive: {
    background: "var(--accent)",
    border: "1px solid var(--accent)",
    color: "#fff",
    outline: "none",
    boxShadow: "none",
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
