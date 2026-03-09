import { useState, useMemo, useEffect } from "react";
import type { Product, Category } from "../api";
import { getProductReviewStats, type ProductReviewStats } from "../api";
import { ProductCard } from "../components/ProductCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const FALLBACK_CATEGORY_CODES = ["all", "tee", "hoodie", "pants", "jacket", "accessories"];

function FilterIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

interface NewArrivalsPageProps {
  products: Product[];
  categories?: Category[];
  onBack: () => void;
  onProductClick: (id: number) => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
}

export function NewArrivalsPage({
  products,
  categories = [],
  onBack,
  onProductClick,
  wishlistIds,
  onToggleWishlist,
}: NewArrivalsPageProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [search, setSearch] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(["all"]));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewStats, setReviewStats] = useState<ProductReviewStats>({});

  useEffect(() => {
    getProductReviewStats().then(setReviewStats).catch(console.error);
  }, []);

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
    if (priceMin.trim() !== "") {
      const min = Number(priceMin.trim());
      if (!Number.isNaN(min)) list = list.filter((p) => p.price >= min);
    }
    if (priceMax.trim() !== "") {
      const max = Number(priceMax.trim());
      if (!Number.isNaN(max)) list = list.filter((p) => p.price <= max);
    }
    return list;
  }, [products, selectedCategories, search, priceMin, priceMax]);

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

  const tabStyles = {
    tab: {
      flexShrink: 0 as const,
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
  };

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>
        ← {t(lang, "back")}
      </button>
      <h1 className="zen-new-arrivals-title" style={styles.title}>{t(lang, "newArrivals")}</h1>

      <div style={styles.gridArea}>
      {filtersOpen && (
            <>
              <div className="zen-filters-overlay" onClick={() => setFiltersOpen(false)} aria-hidden />
              <div className="zen-filters-panel" role="dialog">
                <h3 className="zen-filters-panel-title">{t(lang, "filters")}</h3>
                <div className="zen-price-filter-wrap" style={{ flexDirection: "column", alignItems: "stretch", border: "none", padding: 0 }}>
                  <span className="zen-price-filter-label" style={{ marginBottom: 8 }}>{t(lang, "priceFilter")}</span>
                  <div className="zen-price-sort-segmented" style={{ marginBottom: 16 }}>
                    <div className={`zen-price-sort-segment ${priceSort === "asc" ? "zen-price-sort-segment-active" : ""}`} onClick={() => setPriceSort((s) => (s === "asc" ? "none" : "asc"))}>↑</div>
                    <div className={`zen-price-sort-segment ${priceSort === "desc" ? "zen-price-sort-segment-active" : ""}`} onClick={() => setPriceSort((s) => (s === "desc" ? "none" : "desc"))}>↓</div>
                  </div>
                  <div className="zen-price-inputs" style={{ marginBottom: 20 }}>
                    <input type="number" className="zen-price-input" min={0} step={100} placeholder={t(lang, "priceFrom")} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                    <input type="number" className="zen-price-input" min={0} step={100} placeholder={t(lang, "priceTo")} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
                  </div>
                </div>
                <span className="zen-price-filter-label" style={{ marginBottom: 8, display: "block" }}>{t(lang, "categories")}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {categoryTabs.map(({ code, label }) => {
                    const isSelected = code === "all" ? selectedCategories.has("all") : selectedCategories.has(code);
                    return (
                      <button key={code} type="button" className="catalog-tab-btn" onClick={() => handleCategoryClick(code)} style={{ ...tabStyles.tab, ...(isSelected ? tabStyles.tabActive : {}) }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
            <button type="button" className="zen-filters-apply-btn" onClick={() => setFiltersOpen(false)}>{t(lang, "apply")}</button>
          </div>
        </>
      )}

      {displayList.length === 0 ? (
        <div className="zen-empty-state" style={styles.empty}>
          <strong>{t(lang, "nothingFound")}</strong>
        </div>
      ) : (
        <div className="catalog-grid catalog-grid--masonry catalog-grid--concept">
          {displayList.map((p, idx) => (
            <ProductCard
              key={p.id}
              product={p}
              compact
              sizeVariant={idx % 3 === 0 ? "tall" : "default"}
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

      <div className="zen-catalog-search-row" style={styles.searchRow}>
        <input
          type="search"
          className="zen-input zen-catalog-search-input"
          placeholder={t(lang, "search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t(lang, "search")}
        />
        <button
          type="button"
          className="zen-filter-icon-btn"
          onClick={() => setFiltersOpen(true)}
          aria-label={t(lang, "filters")}
          title={t(lang, "filters")}
        >
          <FilterIcon />
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    paddingBottom: 0,
  },
  back: { marginBottom: 8, flexShrink: 0 },
  title: { margin: "0 0 12px", flexShrink: 0 },
  gridArea: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    marginBottom: 16,
  },
  searchRow: { flexShrink: 0 },
  empty: {},
};
