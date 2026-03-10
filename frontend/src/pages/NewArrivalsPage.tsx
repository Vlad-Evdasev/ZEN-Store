import { useState, useMemo, useEffect, useRef } from "react";
import type { Product, Category } from "../api";
import { getProductReviewStats, type ProductReviewStats } from "../api";
import { FilterIcon } from "../components/FilterIcon";
import { ProductCard } from "../components/ProductCard";
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
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(["all"]));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState({ price: true, categories: true });
  const [panelDragY, setPanelDragY] = useState(0);
  const filtersDragHandleRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const panelDragYRef = useRef(0);
  const priceSliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderActiveThumbRef = useRef<"min" | "max" | null>(null);
  const handlePriceSliderTrackRef = useRef<(clientX: number) => void>(() => {});
  const priceMinPercentRef = useRef(0);
  const priceMaxPercentRef = useRef(0);
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
    return list;
  }, [products, selectedCategories, search]);

  const { catalogPriceMin, catalogPriceMax } = useMemo(() => {
    if (baseListForPrice.length === 0) return { catalogPriceMin: 0, catalogPriceMax: 100000 };
    const prices = baseListForPrice.map((p) => p.price);
    return { catalogPriceMin: Math.min(...prices), catalogPriceMax: Math.max(...prices) };
  }, [baseListForPrice]);

  const countAfterPrice = useMemo(() => {
    let list = baseListForPrice;
    if (priceMin.trim() !== "") {
      const min = Number(priceMin.trim());
      if (!Number.isNaN(min)) list = list.filter((p) => p.price >= min);
    }
    if (priceMax.trim() !== "") {
      const max = Number(priceMax.trim());
      if (!Number.isNaN(max)) list = list.filter((p) => p.price <= max);
    }
    return list.length;
  }, [baseListForPrice, priceMin, priceMax]);

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

  const activeSummary = useMemo(() => {
    const parts: { key: string; label: string; onClear: () => void }[] = [];
    const minNum = priceMin.trim() !== "" ? Number(priceMin.trim()) : null;
    const maxNum = priceMax.trim() !== "" ? Number(priceMax.trim()) : null;
    if ((minNum != null && !Number.isNaN(minNum)) || (maxNum != null && !Number.isNaN(maxNum))) {
      const label = [minNum != null && !Number.isNaN(minNum) ? String(minNum) : "", maxNum != null && !Number.isNaN(maxNum) ? String(maxNum) : ""].filter(Boolean).join(" – ");
      if (label) parts.push({ key: "price", label, onClear: () => { setPriceMin(""); setPriceMax(""); } });
    }
    if (!selectedCategories.has("all") && selectedCategories.size > 0) {
      const labels = categoryTabs.filter((t) => t.code !== "all" && selectedCategories.has(t.code)).map((t) => t.label);
      if (labels.length) parts.push({ key: "cat", label: labels.join(", "), onClear: () => setSelectedCategories(new Set(["all"])) });
    }
    return parts;
  }, [priceMin, priceMax, selectedCategories, categoryTabs]);

  const priceRange = catalogPriceMax - catalogPriceMin || 1;
  const priceMinNum = Math.max(catalogPriceMin, Math.min(catalogPriceMax, Number(priceMin.trim()) || catalogPriceMin));
  const priceMaxNum = Math.min(catalogPriceMax, Math.max(catalogPriceMin, Number(priceMax.trim()) || catalogPriceMax));
  const priceMinPercent = ((priceMinNum - catalogPriceMin) / priceRange) * 100;
  const priceMaxPercent = ((priceMaxNum - catalogPriceMin) / priceRange) * 100;
  const priceRangePercent = ((priceMaxNum - priceMinNum) / priceRange) * 100;

  const handlePriceSliderTrack = (clientX: number) => {
    const track = priceSliderTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const value = Math.round(catalogPriceMin + percent * (catalogPriceMax - catalogPriceMin));
    const thumb = sliderActiveThumbRef.current;
    if (thumb === "min") {
      setPriceMin(String(Math.max(catalogPriceMin, Math.min(value, priceMaxNum - 1))));
    } else if (thumb === "max") {
      setPriceMax(String(Math.min(catalogPriceMax, Math.max(value, priceMinNum + 1))));
    }
  };
  useEffect(() => {
    handlePriceSliderTrackRef.current = handlePriceSliderTrack;
  });
  useEffect(() => {
    priceMinPercentRef.current = priceMinPercent;
    priceMaxPercentRef.current = priceMaxPercent;
  }, [priceMinPercent, priceMaxPercent]);

  useEffect(() => {
    const track = priceSliderTrackRef.current;
    if (!track || !filtersOpen || !sectionOpen.price) return;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!track.contains(t)) return;
      const rect = track.getBoundingClientRect();
      const clientX = e.touches[0].clientX;
      if (t.closest(".zen-filters-price-slider-thumb--min")) {
        sliderActiveThumbRef.current = "min";
      } else if (t.closest(".zen-filters-price-slider-thumb--max")) {
        sliderActiveThumbRef.current = "max";
      } else {
        const pos = (clientX - rect.left) / rect.width;
        const toMin = Math.abs(pos - priceMinPercentRef.current / 100);
        const toMax = Math.abs(pos - priceMaxPercentRef.current / 100);
        sliderActiveThumbRef.current = toMin <= toMax ? "min" : "max";
      }
      handlePriceSliderTrackRef.current(clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (sliderActiveThumbRef.current && e.touches.length > 0) {
        e.preventDefault();
        handlePriceSliderTrackRef.current(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      sliderActiveThumbRef.current = null;
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
    const onTouchStartCapture = (e: TouchEvent) => {
      onTouchStart(e);
      if (sliderActiveThumbRef.current !== null) {
        document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
        document.addEventListener("touchend", onTouchEnd, { capture: true });
        document.addEventListener("touchcancel", onTouchEnd, { capture: true });
      }
    };
    track.addEventListener("touchstart", onTouchStartCapture, { passive: true, capture: true });
    return () => {
      track.removeEventListener("touchstart", onTouchStartCapture, { capture: true });
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
  }, [filtersOpen, sectionOpen.price]);

  useEffect(() => {
    panelDragYRef.current = panelDragY;
  }, [panelDragY]);
  useEffect(() => {
    if (!filtersOpen) setPanelDragY(0);
  }, [filtersOpen]);
  useEffect(() => {
    const handle = filtersDragHandleRef.current;
    if (!filtersOpen || !handle) return;
    const onStart = (clientY: number) => {
      touchStartYRef.current = clientY;
      touchStartTimeRef.current = Date.now();
    };
    const onMove = (clientY: number) => {
      const val = Math.max(0, clientY - touchStartYRef.current);
      panelDragYRef.current = val;
      setPanelDragY(val);
    };
    const onEnd = () => {
      const dy = panelDragYRef.current;
      const dt = Date.now() - touchStartTimeRef.current;
      const velocity = dt > 0 ? dy / dt : 0;
      if (dy > 60 || velocity > 0.3) setFiltersOpen(false);
      setPanelDragY(0);
    };
    const touchStart = (e: TouchEvent) => { onStart(e.touches[0].clientY); };
    const touchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientY); };
    handle.addEventListener("touchstart", touchStart, { passive: true });
    handle.addEventListener("touchmove", touchMove, { passive: false });
    handle.addEventListener("touchend", onEnd);
    handle.addEventListener("touchcancel", onEnd);
    return () => {
      handle.removeEventListener("touchstart", touchStart);
      handle.removeEventListener("touchmove", touchMove);
      handle.removeEventListener("touchend", onEnd);
      handle.removeEventListener("touchcancel", onEnd);
    };
  }, [filtersOpen]);

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
              <div
                className="zen-filters-panel"
                role="dialog"
                style={panelDragY > 0 ? { transform: `translateY(${panelDragY}px)` } : undefined}
              >
                <div ref={filtersDragHandleRef} className="zen-filters-panel-header zen-filters-panel-drag-handle">
                  <span className="zen-filters-panel-drag-bar" aria-hidden />
                  <h3 className="zen-filters-panel-title">{t(lang, "filters")}</h3>
                </div>
                <div className="zen-filters-panel-summary">
                  <span className="zen-filters-panel-summary-count">{displayList.length} {t(lang, "resultsCount")}</span>
                  {activeSummary.length > 0 && (
                    <div className="zen-filters-panel-summary-tags">
                      {activeSummary.map(({ key, label, onClear }) => (
                        <button key={key} type="button" className="zen-filters-panel-summary-tag" onClick={onClear}>{label} ×</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="zen-filters-panel-body">
                  <section className={`zen-filters-panel-section zen-filters-panel-section--accordion ${sectionOpen.price ? "zen-filters-panel-section--open" : ""}`}>
                    <button type="button" className="zen-filters-panel-section-head" onClick={() => setSectionOpen((s) => ({ ...s, price: !s.price }))} aria-expanded={sectionOpen.price}>
                      <h4 className="zen-filters-panel-section-title">{t(lang, "priceFilter")}</h4>
                      <span className="zen-filters-panel-section-count">{countAfterPrice}</span>
                      <span className="zen-filters-panel-section-chevron" aria-hidden>▼</span>
                    </button>
                    <div className="zen-filters-panel-section-content">
                      <div className="zen-filters-panel-price-row">
                        <div className="zen-price-sort-segmented zen-filters-panel-sort" role="group" aria-label={t(lang, "priceFilter")}>
                          <button type="button" className={`zen-price-sort-btn zen-price-sort-btn--first ${priceSort === "asc" ? "zen-price-sort-btn-active" : ""}`} onClick={() => setPriceSort((s) => (s === "asc" ? "none" : "asc"))} title={t(lang, "sortPriceAsc")} aria-pressed={priceSort === "asc"}><span className="zen-price-sort-icon" aria-hidden>↓</span></button>
                          <button type="button" className={`zen-price-sort-btn zen-price-sort-btn--last ${priceSort === "desc" ? "zen-price-sort-btn-active" : ""}`} onClick={() => setPriceSort((s) => (s === "desc" ? "none" : "desc"))} title={t(lang, "sortPriceDesc")} aria-pressed={priceSort === "desc"}><span className="zen-price-sort-icon" aria-hidden>↑</span></button>
                        </div>
                        <div
                          ref={priceSliderTrackRef}
                          className="zen-filters-price-slider"
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            const rect = priceSliderTrackRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const pos = (e.clientX - rect.left) / rect.width;
                            sliderActiveThumbRef.current = Math.abs(pos - priceMinPercent / 100) <= Math.abs(pos - priceMaxPercent / 100) ? "min" : "max";
                            handlePriceSliderTrack(e.clientX);
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                          }}
                          onPointerMove={(e) => { if (sliderActiveThumbRef.current) handlePriceSliderTrack(e.clientX); }}
                          onPointerUp={(e) => { (e.target as HTMLElement).releasePointerCapture(e.pointerId); sliderActiveThumbRef.current = null; }}
                          onPointerLeave={() => { sliderActiveThumbRef.current = null; }}
                        >
                          <div className="zen-filters-price-slider-track" />
                          <div className="zen-filters-price-slider-range" style={{ left: `${priceMinPercent}%`, width: `${priceRangePercent}%` }} />
                          <div className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--min" style={{ left: `${priceMinPercent}%` }} onPointerDown={(e) => { e.stopPropagation(); sliderActiveThumbRef.current = "min"; priceSliderTrackRef.current?.setPointerCapture(e.pointerId); }} />
                          <div className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--max" style={{ left: `${priceMaxPercent}%` }} onPointerDown={(e) => { e.stopPropagation(); sliderActiveThumbRef.current = "max"; priceSliderTrackRef.current?.setPointerCapture(e.pointerId); }} />
                        </div>
                        <div className="zen-filters-price-slider-labels">
                          <span>{priceMinNum}</span>
                          <span>{priceMaxNum}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className={`zen-filters-panel-section zen-filters-panel-section--accordion ${sectionOpen.categories ? "zen-filters-panel-section--open" : ""}`}>
                    <button type="button" className="zen-filters-panel-section-head" onClick={() => setSectionOpen((s) => ({ ...s, categories: !s.categories }))} aria-expanded={sectionOpen.categories}>
                      <h4 className="zen-filters-panel-section-title">{t(lang, "categories")}</h4>
                      <span className="zen-filters-panel-section-count">{displayList.length}</span>
                      <span className="zen-filters-panel-section-chevron" aria-hidden>▼</span>
                    </button>
                    <div className="zen-filters-panel-section-content">
                      <div className="zen-filters-chip-row-wrap">
                        <div className="zen-filters-chip-row">
                          {categoryTabs.map(({ code, label }) => {
                            const isSelected = code === "all" ? selectedCategories.has("all") : selectedCategories.has(code);
                            return (
                              <button key={code} type="button" className={`zen-filters-chip ${isSelected ? "zen-filters-chip-active" : ""}`} onClick={() => handleCategoryClick(code)}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
            <div className="zen-filters-panel-collapse-wrap">
              <button type="button" className="zen-filters-panel-close-arrow" onClick={() => setFiltersOpen(false)} aria-label={t(lang, "close")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
              </button>
            </div>
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
        <button
          type="button"
          className="zen-filter-icon-btn"
          onClick={() => setFiltersOpen(true)}
          aria-label={t(lang, "filters")}
          title={t(lang, "filters")}
        >
          <FilterIcon />
        </button>
        <input
          type="search"
          className="zen-input zen-catalog-search-input"
          placeholder={t(lang, "search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t(lang, "search")}
        />
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
    marginBottom: 8,
  },
  searchRow: { flexShrink: 0 },
  empty: {},
};
