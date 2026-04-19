import { useState, useMemo, useRef, useEffect } from "react";
import type { Product, Store, Category, ProductReviewStats } from "../api";
import { getProductReviewStats } from "../api";
import { FilterIcon } from "../components/FilterIcon";
import { SearchIcon } from "../components/SearchIcon";
import { ProductCard } from "../components/ProductCard";
import { StoreCard } from "../components/StoreCard";
import { FiltersSheet } from "../components/catalog/FiltersSheet";
import type { FiltersSheetHandle } from "../components/catalog/FiltersSheet";
import type { DraftFiltersValue } from "../components/catalog/FiltersSheet.types";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400";

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
  const [filtersClosing, setFiltersClosing] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtersSheetRef = useRef<FiltersSheetHandle>(null);
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

  const closeFilters = () => {
    if (filtersClosing) return;
    setFiltersClosing(true);
  };

  const handleFiltersPanelAnimationEnd = () => {
    if (filtersClosing) {
      setFiltersOpen(false);
      setFiltersClosing(false);
    }
  };

  const handleApplyFilters = (draft: DraftFiltersValue) => {
    setPriceMin(draft.priceMin);
    setPriceMax(draft.priceMax);
    setPriceSort(draft.priceSort);
    setSelectedBrand(draft.brand);
    setSelectedCategories(new Set(draft.categories));
  };

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

  const baseListForPrice = useMemo(() => {
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
    if (selectedBrand !== "all") {
      list = list.filter((p) => (p.brand?.trim() ?? "") === selectedBrand);
    }
    return list;
  }, [products, selectedCategories, search, selectedBrand]);

  const { catalogPriceMin, catalogPriceMax } = useMemo(() => {
    if (baseListForPrice.length === 0) return { catalogPriceMin: 0, catalogPriceMax: 100000 };
    const prices = baseListForPrice.map((p) => p.price);
    return {
      catalogPriceMin: Math.min(...prices),
      catalogPriceMax: Math.max(...prices),
    };
  }, [baseListForPrice]);

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

  const countForDraft = (draft: DraftFiltersValue): number => {
    let list = products;
    if (!draft.categories.has("all")) {
      list = list.filter((p) => draft.categories.has(p.category));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    if (showPriceFilter && draft.priceMin.trim() !== "") {
      const min = Number(draft.priceMin.trim());
      if (!Number.isNaN(min)) list = list.filter((p) => p.price >= min);
    }
    if (showPriceFilter && draft.priceMax.trim() !== "") {
      const max = Number(draft.priceMax.trim());
      if (!Number.isNaN(max)) list = list.filter((p) => p.price <= max);
    }
    if (draft.brand !== "all") {
      list = list.filter((p) => (p.brand?.trim() ?? "") === draft.brand);
    }
    return list.length;
  };

  const hasActiveFilters =
    (showPriceFilter && (priceMin.trim() !== "" || priceMax.trim() !== "")) ||
    selectedBrand !== "all" ||
    (!selectedCategories.has("all") && selectedCategories.size > 0);

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

      <div className="zen-catalog-search-shelf" aria-hidden />
      <div className={`zen-catalog-search-row ${filtersOpen && !filtersClosing ? "zen-catalog-search-row--filter-open" : ""}`}>
        <span className="zen-catalog-search-icon zen-catalog-search-row-search-slot" aria-hidden>
          <SearchIcon />
        </span>
        <input
          type="search"
          className="zen-input zen-catalog-search-input zen-catalog-search-row-search-slot"
          placeholder={t(lang, "search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t(lang, "search")}
          aria-hidden={filtersOpen && !filtersClosing}
          tabIndex={filtersOpen && !filtersClosing ? -1 : 0}
        />
        <span
          className="zen-catalog-search-row-filters-title"
          aria-hidden={!(filtersOpen || filtersClosing)}
        >
          {t(lang, "filters")}
        </span>
        {showPriceFilter && (
          <button
            type="button"
            className={`zen-filter-icon-btn ${hasActiveFilters ? "zen-filter-icon-btn--active" : ""} ${(filtersOpen && !filtersClosing) ? "zen-filter-icon-btn--open" : ""}`}
            onClick={() => {
              if (filtersOpen && !filtersClosing) {
                filtersSheetRef.current?.commitAndClose();
              } else {
                setFiltersOpen(true);
              }
            }}
            aria-label={t(lang, "filters")}
            aria-expanded={filtersOpen && !filtersClosing}
            title={t(lang, "filters")}
          >
            <span className="zen-filter-icon-main" aria-hidden>
              <FilterIcon />
            </span>
            <svg
              className="zen-filter-icon-btn-x"
              viewBox="0 0 16 16"
              aria-hidden
            >
              <path d="M4 4 L12 12 M12 4 L4 12" strokeLinecap="round" />
            </svg>
            {hasActiveFilters && (
              <span className="zen-filter-icon-btn-dot" aria-hidden />
            )}
          </button>
        )}
      </div>

      <FiltersSheet
        ref={filtersSheetRef}
        open={showPriceFilter && filtersOpen}
        closing={filtersClosing}
        onAnimationEnd={handleFiltersPanelAnimationEnd}
        onClose={closeFilters}
        appliedPriceMin={priceMin}
        appliedPriceMax={priceMax}
        appliedPriceSort={priceSort}
        appliedBrand={selectedBrand}
        appliedCategories={selectedCategories}
        catalogPriceMin={catalogPriceMin}
        catalogPriceMax={catalogPriceMax}
        uniqueBrands={uniqueBrands}
        categoryTabs={categoryTabs}
        showPriceFilter={showPriceFilter}
        countForDraft={countForDraft}
        onApply={handleApplyFilters}
        lang={lang}
      />

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


