import { useState, useMemo, useRef, useEffect } from "react";
import type { Product, Store, Category, ProductReviewStats } from "../api";
import { getProductReviewStats } from "../api";
import { FilterIcon } from "../components/FilterIcon";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const filtersPanelTouchStartY = useRef<number>(0);
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

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const b = p.brand?.trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

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
    if (selectedBrand !== "all") {
      list = list.filter((p) => (p.brand?.trim() ?? "") === selectedBrand);
    }
    return list;
  }, [products, selectedCategories, search, showPriceFilter, priceMin, priceMax, selectedBrand]);

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

      <div className="zen-catalog-search-row">
        {showPriceFilter && (
          <button
            type="button"
            className="zen-filter-icon-btn"
            onClick={() => setFiltersOpen(true)}
            aria-label={t(lang, "filters")}
            title={t(lang, "filters")}
          >
            <FilterIcon />
          </button>
        )}
        <input
          type="search"
          className="zen-input zen-catalog-search-input"
          placeholder={t(lang, "search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t(lang, "search")}
        />
      </div>

      {showPriceFilter && filtersOpen && (
        <>
          <div className="zen-filters-overlay" onClick={() => setFiltersOpen(false)} aria-hidden />
          <div
            className="zen-filters-panel"
            role="dialog"
            aria-label={t(lang, "priceFilter")}
            onTouchStart={(e) => { filtersPanelTouchStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              const dy = e.changedTouches[0].clientY - filtersPanelTouchStartY.current;
              if (dy > 60) setFiltersOpen(false);
            }}
          >
                <div className="zen-filters-panel-header">
                  <h3 className="zen-filters-panel-title">{t(lang, "filters")}</h3>
                  <button type="button" className="zen-filters-panel-close" onClick={() => setFiltersOpen(false)} aria-label={t(lang, "close")}>×</button>
                </div>
                <div className="zen-price-filter-wrap" style={{ flexDirection: "column", alignItems: "stretch", border: "none", padding: 0 }}>
                  <span className="zen-price-filter-label" style={{ marginBottom: 8 }}>{t(lang, "priceFilter")}</span>
                  <div className="zen-price-sort-segmented" style={{ marginBottom: 16 }} role="group">
                    <div
                      className={`zen-price-sort-segment ${priceSort === "asc" ? "zen-price-sort-segment-active" : ""}`}
                      onClick={() => setPriceSort((s) => (s === "asc" ? "none" : "asc"))}
                      title={t(lang, "sortPriceAsc")}
                    >↑</div>
                    <div
                      className={`zen-price-sort-segment ${priceSort === "desc" ? "zen-price-sort-segment-active" : ""}`}
                      onClick={() => setPriceSort((s) => (s === "desc" ? "none" : "desc"))}
                      title={t(lang, "sortPriceDesc")}
                    >↓</div>
                  </div>
                  <div className="zen-price-inputs" style={{ marginBottom: 20 }}>
                    <input type="number" className="zen-price-input" min={0} step={100} placeholder={t(lang, "priceFrom")} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                    <input type="number" className="zen-price-input" min={0} step={100} placeholder={t(lang, "priceTo")} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
                  </div>
                </div>
                {uniqueBrands.length > 0 && (
                  <>
                    <span className="zen-price-filter-label" style={{ marginBottom: 8, display: "block" }}>{t(lang, "brand")}</span>
                    <div className="zen-filters-chip-row" style={{ marginBottom: 16 }}>
                      <button type="button" className={`zen-filters-chip ${selectedBrand === "all" ? "zen-filters-chip-active" : ""}`} onClick={() => setSelectedBrand("all")}>{t(lang, "all")}</button>
                      {uniqueBrands.map((b) => (
                        <button key={b} type="button" className={`zen-filters-chip ${selectedBrand === b ? "zen-filters-chip-active" : ""}`} onClick={() => setSelectedBrand(b)}>{b}</button>
                      ))}
                    </div>
                  </>
                )}
                <span className="zen-price-filter-label" style={{ marginBottom: 8, display: "block" }}>{t(lang, "categories")}</span>
                <div className="zen-filters-chip-row" style={{ marginBottom: 16 }}>
                  {categoryTabs.map(({ code, label }) => {
                    const isSelected = code === "all" ? selectedCategories.has("all") : selectedCategories.has(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        className={`zen-filters-chip ${isSelected ? "zen-filters-chip-active" : ""}`}
                        onClick={() => { handleCategoryClick(code); }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
            <button type="button" className="zen-filters-apply-btn" onClick={() => setFiltersOpen(false)}>
              {t(lang, "apply")}
            </button>
          </div>
        </>
      )}

      {displayList.length === 0 ? (
        <div className="zen-empty-state" style={styles.empty}>
          <strong>{t(lang, "nothingFound")}</strong>
        </div>
      ) : (
        <div className="catalog-grid catalog-grid--tight" style={styles.grid}>
          {displayList.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              compact
              sizeVariant="default"
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
  wrap: { paddingTop: 0, paddingBottom: 24, overflowX: "hidden", minWidth: 0 },
  storesRowWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 0,
    marginBottom: 8,
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
  searchWrap: {},
  search: {},
  tabsWrap: {
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    flexShrink: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "none",
    outline: "none",
  },
  tabActive: {
    background: "var(--accent)",
    border: "1px solid var(--accent)",
    color: "#fff",
  },
  grid: {},
  empty: {},
};
