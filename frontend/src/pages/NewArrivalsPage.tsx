import { useState, useMemo, useEffect } from "react";
import type { Product, Category } from "../api";
import { getProductReviewStats, type ProductReviewStats } from "../api";
import { ProductCard } from "../components/ProductCard";
import { CollapsibleSearch } from "../components/CollapsibleSearch";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const FALLBACK_CATEGORY_CODES = ["all", "tee", "hoodie", "pants", "jacket", "accessories"];

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
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(["all"]));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewStats, setReviewStats] = useState<ProductReviewStats>({});
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );

  useEffect(() => {
    getProductReviewStats().then(setReviewStats).catch(console.error);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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

      <CollapsibleSearch
        value={search}
        onChange={setSearch}
        placeholder={t(lang, "search")}
        expanded={searchExpanded}
        onExpand={() => setSearchExpanded(true)}
        onCollapse={() => setSearchExpanded(false)}
        aria-label={t(lang, "search")}
      />

      {!isMobile && (
        <div className="zen-catalog-filters">
          <div className="zen-price-filter-wrap">
            <span className="zen-price-filter-label">{t(lang, "priceFilter")}</span>
            <div className="zen-price-sort-segmented" role="group">
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
            <div className="zen-price-inputs">
              <input type="number" className="zen-price-input" min={0} step={100} placeholder={t(lang, "priceFrom")} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
              <input type="number" className="zen-price-input" min={0} step={100} placeholder={t(lang, "priceTo")} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="catalog-tabs-wrap hide-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          {categoryTabs.map(({ code, label }) => {
            const isSelected = code === "all" ? selectedCategories.has("all") : selectedCategories.has(code);
            return (
              <button
                key={code}
                type="button"
                className="catalog-tab-btn"
                onClick={() => handleCategoryClick(code)}
                style={{ ...tabStyles.tab, ...(isSelected ? tabStyles.tabActive : {}) }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {isMobile && (
        <>
          <button type="button" className="zen-filters-fab" onClick={() => setFiltersOpen(true)}>
            {t(lang, "filters")}
          </button>
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
        </>
      )}

      {displayList.length === 0 ? (
        <div className="zen-empty-state" style={styles.empty}>
          <strong>{t(lang, "nothingFound")}</strong>
        </div>
      ) : (
        <div className="catalog-grid catalog-grid--masonry">
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
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { paddingBottom: 80 },
  back: { marginBottom: 8 },
  title: { margin: "0 0 20px" },
  empty: {},
};
