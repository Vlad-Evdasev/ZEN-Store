import { useState, useMemo, useRef, useEffect } from "react";
import type { Product, Store, Category, ProductReviewStats } from "../api";
import { getProductReviewStats, getSiteContent } from "../api";
import { FilterIcon } from "../components/FilterIcon";
import { ProductCard } from "../components/ProductCard";
import { StoreCard } from "../components/StoreCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const DEFAULT_CUSTOM_IMG = "https://images.unsplash.com/photo-1526868158330-2d5492f0e50b?w=800&q=75";
const DEFAULT_ARRIVED_IMG = "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&q=75";

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
  /** Колбэки для карточек-баннеров */
  onCustomOrder?: () => void;
  onNewArrivals?: () => void;
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
  onCustomOrder,
  onNewArrivals,
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
  const [sectionOpen, setSectionOpen] = useState({ price: false, brand: false, categories: false });
  const [panelDragY, setPanelDragY] = useState(0);
  const [customOrderImg, setCustomOrderImg] = useState(DEFAULT_CUSTOM_IMG);
  const [arrivedImg, setArrivedImg] = useState(DEFAULT_ARRIVED_IMG);
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  const filtersDragHandleRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const panelDragYRef = useRef(0);
  const priceSliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderActiveThumbRef = useRef<"min" | "max" | null>(null);
  const handlePriceSliderTrackRef = useRef<(clientX: number) => void>(() => {});
  const priceMinPercentRef = useRef(0);
  const priceMaxPercentRef = useRef(0);
  const marqueePausedRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const lastAutoScrollRef = useRef(0);
  const isTouchOnly = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const brandChipRowRef = useRef<HTMLDivElement>(null);
  const categoryChipRowRef = useRef<HTMLDivElement>(null);
  const brandAutoScrollIdRef = useRef<number | null>(null);
  const categoryAutoScrollIdRef = useRef<number | null>(null);
  const userScrolledBrandRef = useRef(false);
  const userScrolledCategoryRef = useRef(false);
  const chipScrollProgrammaticRef = useRef(false);

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
    getSiteContent()
      .then((content) => {
        if (content.custom_order_image_url) setCustomOrderImg(content.custom_order_image_url);
        if (content.arrived_image_url) setArrivedImg(content.arrived_image_url);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (filtersOpen || filtersClosing) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [filtersOpen, filtersClosing]);

  useEffect(() => {
    if (!filtersOpen || filtersClosing) {
      if (brandAutoScrollIdRef.current) {
        clearInterval(brandAutoScrollIdRef.current);
        brandAutoScrollIdRef.current = null;
      }
      if (categoryAutoScrollIdRef.current) {
        clearInterval(categoryAutoScrollIdRef.current);
        categoryAutoScrollIdRef.current = null;
      }
      userScrolledBrandRef.current = false;
      userScrolledCategoryRef.current = false;
      return;
    }
    const step = 1;
    const intervalMs = 45;
    const startCarousel = (el: HTMLDivElement | null, intervalIdRef: React.MutableRefObject<number | null>, userScrolledRef: React.MutableRefObject<boolean>) => {
      if (!el || userScrolledRef.current) return;
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const id = window.setInterval(() => {
        if (userScrolledRef.current) return;
        const max = el.scrollWidth - el.clientWidth;
        if (max <= 0) return;
        chipScrollProgrammaticRef.current = true;
        if (el.scrollLeft >= max - 2) {
          el.scrollLeft = 0;
        } else {
          el.scrollLeft += step;
        }
        requestAnimationFrame(() => { chipScrollProgrammaticRef.current = false; });
      }, intervalMs);
      intervalIdRef.current = id;
    };
    const t = window.setTimeout(() => {
      if (brandChipRowRef.current && brandChipRowRef.current.scrollWidth > brandChipRowRef.current.clientWidth) {
        startCarousel(brandChipRowRef.current, brandAutoScrollIdRef, userScrolledBrandRef);
      }
      if (categoryChipRowRef.current && categoryChipRowRef.current.scrollWidth > categoryChipRowRef.current.clientWidth) {
        startCarousel(categoryChipRowRef.current, categoryAutoScrollIdRef, userScrolledCategoryRef);
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      if (brandAutoScrollIdRef.current) clearInterval(brandAutoScrollIdRef.current);
      if (categoryAutoScrollIdRef.current) clearInterval(categoryAutoScrollIdRef.current);
    };
  }, [filtersOpen, filtersClosing]);

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

  const resetAllFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setPriceSort("none");
    setSelectedBrand("all");
    setSelectedCategories(new Set(["all"]));
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
    if (showPriceFilter && ((minNum != null && !Number.isNaN(minNum)) || (maxNum != null && !Number.isNaN(maxNum)))) {
      const label = [minNum != null && !Number.isNaN(minNum) ? String(minNum) : "", maxNum != null && !Number.isNaN(maxNum) ? String(maxNum) : ""].filter(Boolean).join(" – ");
      if (label) parts.push({ key: "price", label, onClear: () => { setPriceMin(""); setPriceMax(""); } });
    }
    if (selectedBrand !== "all") {
      parts.push({ key: "brand", label: selectedBrand, onClear: () => setSelectedBrand("all") });
    }
    if (!selectedCategories.has("all") && selectedCategories.size > 0) {
      const labels = categoryTabs.filter((t) => t.code !== "all" && selectedCategories.has(t.code)).map((t) => t.label);
      if (labels.length) parts.push({ key: "cat", label: labels.join(", "), onClear: () => setSelectedCategories(new Set(["all"])) });
    }
    return parts;
  }, [showPriceFilter, priceMin, priceMax, selectedBrand, selectedCategories, categoryTabs]);

  const priceRange = catalogPriceMax - catalogPriceMin || 1;
  const priceMinNum = Math.max(catalogPriceMin, Math.min(catalogPriceMax, Number(priceMin.trim()) || catalogPriceMin));
  const priceMaxNum = Math.min(catalogPriceMax, Math.max(catalogPriceMin, Number(priceMax.trim()) || catalogPriceMax));
  const priceMinPercent = ((priceMinNum - catalogPriceMin) / priceRange) * 100;
  const priceMaxPercent = ((priceMaxNum - catalogPriceMin) / priceRange) * 100;
  const priceRangePercent = ((priceMaxNum - priceMinNum) / priceRange) * 100;

  const SLIDER_PAD = 14;
  const handlePriceSliderTrack = (clientX: number) => {
    const track = priceSliderTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const trackLeft = rect.left + SLIDER_PAD;
    const trackWidth = rect.width - SLIDER_PAD * 2;
    const percent = trackWidth > 0 ? Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth)) : 0;
    const value = Math.round(catalogPriceMin + percent * (catalogPriceMax - catalogPriceMin));
    const thumb = sliderActiveThumbRef.current;
    if (thumb === "min") {
      const newMin = Math.min(value, priceMaxNum - 1);
      setPriceMin(String(Math.max(catalogPriceMin, newMin)));
    } else if (thumb === "max") {
      const newMax = Math.max(value, priceMinNum + 1);
      setPriceMax(String(Math.min(catalogPriceMax, newMax)));
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
    panelDragYRef.current = panelDragY;
  }, [panelDragY]);

  useEffect(() => {
    if (!filtersOpen) setPanelDragY(0);
  }, [filtersOpen]);

  useEffect(() => {
    const track = priceSliderTrackRef.current;
    if (!track || !filtersOpen || !sectionOpen.price) return;
    const sliderTouchTargetRef = { current: null as HTMLElement | null };
    const onTouchMove = (e: TouchEvent) => {
      if (sliderActiveThumbRef.current && e.touches.length > 0) {
        e.preventDefault();
        handlePriceSliderTrackRef.current(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      const el = sliderTouchTargetRef.current;
      if (el) {
        el.removeEventListener("touchmove", onTouchMove as EventListener, { passive: false } as EventListenerOptions);
        el.removeEventListener("touchend", onTouchEnd as EventListener);
        el.removeEventListener("touchcancel", onTouchEnd as EventListener);
        sliderTouchTargetRef.current = null;
      }
      sliderActiveThumbRef.current = null;
    };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!track.contains(t)) return;
      const rect = track.getBoundingClientRect();
      const trackLeft = rect.left + SLIDER_PAD;
      const trackWidth = rect.width - SLIDER_PAD * 2;
      const clientX = e.touches[0].clientX;
      if (t.closest(".zen-filters-price-slider-thumb--min")) {
        sliderActiveThumbRef.current = "min";
      } else if (t.closest(".zen-filters-price-slider-thumb--max")) {
        sliderActiveThumbRef.current = "max";
      } else {
        const pos = trackWidth > 0 ? (clientX - trackLeft) / trackWidth : 0;
        const toMin = Math.abs(pos - priceMinPercentRef.current / 100);
        const toMax = Math.abs(pos - priceMaxPercentRef.current / 100);
        sliderActiveThumbRef.current = toMin <= toMax ? "min" : "max";
      }
      handlePriceSliderTrackRef.current(clientX);
      if (sliderActiveThumbRef.current !== null) {
        sliderTouchTargetRef.current = t;
        t.addEventListener("touchmove", onTouchMove as EventListener, { passive: false });
        t.addEventListener("touchend", onTouchEnd as EventListener);
        t.addEventListener("touchcancel", onTouchEnd as EventListener);
      }
    };
    track.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    return () => {
      track.removeEventListener("touchstart", onTouchStart, { capture: true });
      const el = sliderTouchTargetRef.current;
      if (el) {
        el.removeEventListener("touchmove", onTouchMove as EventListener, { passive: false } as EventListenerOptions);
        el.removeEventListener("touchend", onTouchEnd as EventListener);
        el.removeEventListener("touchcancel", onTouchEnd as EventListener);
      }
    };
  }, [filtersOpen, sectionOpen.price]);

  useEffect(() => {
    const handle = filtersDragHandleRef.current;
    if (!filtersOpen || !handle) return;
    const onStart = (clientY: number) => {
      touchStartYRef.current = clientY;
      touchStartTimeRef.current = Date.now();
    };
    const onMove = (clientY: number) => {
      const dy = clientY - touchStartYRef.current;
      const val = Math.max(0, dy);
      panelDragYRef.current = val;
      setPanelDragY(val);
    };
    const onEnd = () => {
      const dy = panelDragYRef.current;
      const dt = Date.now() - touchStartTimeRef.current;
      const velocity = dt > 0 ? dy / dt : 0;
      if (dy > 60 || velocity > 0.3) closeFilters();
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

      {(onCustomOrder || onNewArrivals) && (
        <div style={catalogBannerStyles.row}>
          {onCustomOrder && (
            <button type="button" onClick={onCustomOrder} style={catalogBannerStyles.card(customOrderImg)}>
              <span className="landing-tile-overlay" />
              <span style={catalogBannerStyles.inner}>
                <span style={catalogBannerStyles.title}>Заказать не из каталога</span>
                <span style={catalogBannerStyles.sub}>Под заказ из Китая</span>
              </span>
            </button>
          )}
          {onNewArrivals && (
            <button type="button" onClick={onNewArrivals} style={catalogBannerStyles.card(arrivedImg)}>
              <span className="landing-tile-overlay" />
              <span style={catalogBannerStyles.inner}>
                <span style={catalogBannerStyles.title}>Товары которые мы привезли</span>
                <span style={catalogBannerStyles.sub}>Вещи в наличии</span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className={`zen-catalog-search-row ${filtersOpen || filtersClosing ? "zen-catalog-search-row--filter-open" : ""}`}>
        {showPriceFilter && (
          <button
            ref={filterButtonRef}
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
          <div className={`zen-filters-overlay ${filtersClosing ? "zen-filters-overlay--closing" : ""}`} onClick={closeFilters} aria-hidden />
          <div
            ref={filtersPanelRef}
            className={`zen-filters-panel ${filtersClosing ? "zen-filters-panel--closing" : ""}`}
            role="dialog"
            aria-label={t(lang, "filters")}
            onAnimationEnd={handleFiltersPanelAnimationEnd}
            style={!filtersClosing && panelDragY > 0 ? { transform: `translateY(${panelDragY}px)` } : undefined}
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
                      <span className="zen-filters-panel-section-chevron" aria-hidden>▶</span>
                    </button>
                    <div className="zen-filters-panel-section-content">
                      <div className="zen-filters-price-block">
                        <div className="zen-filters-price-range-row">
                          <label className="zen-filters-price-label">
                            <span className="zen-filters-price-label-text">{t(lang, "priceFrom")}</span>
                            <input
                              type="number"
                              className="zen-filters-panel-input zen-filters-price-input"
                              min={catalogPriceMin}
                              max={catalogPriceMax}
                              value={priceMin}
                              onChange={(e) => setPriceMin(e.target.value)}
                              placeholder={String(catalogPriceMin)}
                              aria-label={t(lang, "priceFrom")}
                            />
                          </label>
                          <span className="zen-filters-panel-input-sep">—</span>
                          <label className="zen-filters-price-label">
                            <span className="zen-filters-price-label-text">{t(lang, "priceTo")}</span>
                            <input
                              type="number"
                              className="zen-filters-panel-input zen-filters-price-input"
                              min={catalogPriceMin}
                              max={catalogPriceMax}
                              value={priceMax}
                              onChange={(e) => setPriceMax(e.target.value)}
                              placeholder={String(catalogPriceMax)}
                              aria-label={t(lang, "priceTo")}
                            />
                          </label>
                        </div>
                        <div
                          ref={priceSliderTrackRef}
                          className="zen-filters-price-slider"
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            const rect = priceSliderTrackRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const trackLeft = rect.left + SLIDER_PAD;
                            const trackWidth = rect.width - SLIDER_PAD * 2;
                            const pos = trackWidth > 0 ? (e.clientX - trackLeft) / trackWidth : 0;
                            const toMin = Math.abs(pos - priceMinPercent / 100);
                            const toMax = Math.abs(pos - priceMaxPercent / 100);
                            sliderActiveThumbRef.current = toMin <= toMax ? "min" : "max";
                            handlePriceSliderTrack(e.clientX);
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            if (sliderActiveThumbRef.current) handlePriceSliderTrack(e.clientX);
                          }}
                          onPointerUp={(e) => { (e.target as HTMLElement).releasePointerCapture(e.pointerId); sliderActiveThumbRef.current = null; }}
                          onPointerLeave={() => { sliderActiveThumbRef.current = null; }}
                        >
                          <div className="zen-filters-price-slider-track" />
                          <div className="zen-filters-price-slider-range" style={{ left: `calc(14px + (100% - 28px) * ${priceMinPercent / 100})`, width: `calc((100% - 28px) * ${priceRangePercent / 100})` }} />
                          <div className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--min" style={{ left: `calc(14px + (100% - 28px) * ${priceMinPercent / 100})` }} onPointerDown={(e) => { e.stopPropagation(); sliderActiveThumbRef.current = "min"; priceSliderTrackRef.current?.setPointerCapture(e.pointerId); }} />
                          <div className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--max" style={{ left: `calc(14px + (100% - 28px) * ${priceMaxPercent / 100})` }} onPointerDown={(e) => { e.stopPropagation(); sliderActiveThumbRef.current = "max"; priceSliderTrackRef.current?.setPointerCapture(e.pointerId); }} />
                        </div>
                        <div className="zen-filters-price-slider-labels">
                          <span>{priceMinNum}</span>
                          <span>{priceMaxNum}</span>
                        </div>
                        <div className="zen-filters-price-sort-row">
                          <div className="zen-filters-sort-segmented" role="group" aria-label={t(lang, "priceFilter")}>
                            <button
                              type="button"
                              className={`zen-filters-sort-btn ${priceSort === "asc" ? "zen-filters-sort-btn-active" : ""}`}
                              onClick={() => setPriceSort((s) => (s === "asc" ? "none" : "asc"))}
                              title={t(lang, "sortPriceAsc")}
                              aria-pressed={priceSort === "asc"}
                            >
                              <span className="zen-filters-sort-icon" aria-hidden>↑</span>
                              <span className="zen-filters-sort-text">{t(lang, "sortAscShort")}</span>
                            </button>
                            <button
                              type="button"
                              className={`zen-filters-sort-btn ${priceSort === "desc" ? "zen-filters-sort-btn-active" : ""}`}
                              onClick={() => setPriceSort((s) => (s === "desc" ? "none" : "desc"))}
                              title={t(lang, "sortPriceDesc")}
                              aria-pressed={priceSort === "desc"}
                            >
                              <span className="zen-filters-sort-icon" aria-hidden>↓</span>
                              <span className="zen-filters-sort-text">{t(lang, "sortDescShort")}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                  {uniqueBrands.length > 0 && (
                    <section className={`zen-filters-panel-section zen-filters-panel-section--accordion ${sectionOpen.brand ? "zen-filters-panel-section--open" : ""}`}>
                      <button type="button" className="zen-filters-panel-section-head" onClick={() => setSectionOpen((s) => ({ ...s, brand: !s.brand }))} aria-expanded={sectionOpen.brand}>
                        <h4 className="zen-filters-panel-section-title">{t(lang, "brand")}</h4>
                        <span className="zen-filters-panel-section-chevron" aria-hidden>▶</span>
                      </button>
                      <div className="zen-filters-panel-section-content">
                        <div className="zen-filters-chip-row-wrap">
                          <div
                            ref={brandChipRowRef}
                            className="zen-filters-chip-row"
                            onScroll={() => {
                              if (chipScrollProgrammaticRef.current) return;
                              if (brandAutoScrollIdRef.current) {
                                clearInterval(brandAutoScrollIdRef.current);
                                brandAutoScrollIdRef.current = null;
                              }
                              userScrolledBrandRef.current = true;
                            }}
                          >
                            <button type="button" className={`zen-filters-chip ${selectedBrand === "all" ? "zen-filters-chip-active" : ""}`} onClick={() => setSelectedBrand("all")}>{t(lang, "all")}</button>
                            {uniqueBrands.map((b) => (
                              <button key={b} type="button" className={`zen-filters-chip ${selectedBrand === b ? "zen-filters-chip-active" : ""}`} onClick={() => setSelectedBrand(b)}>{b}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                  <section className={`zen-filters-panel-section zen-filters-panel-section--accordion ${sectionOpen.categories ? "zen-filters-panel-section--open" : ""}`}>
                    <button type="button" className="zen-filters-panel-section-head" onClick={() => setSectionOpen((s) => ({ ...s, categories: !s.categories }))} aria-expanded={sectionOpen.categories}>
                      <h4 className="zen-filters-panel-section-title">{t(lang, "categories")}</h4>
                      <span className="zen-filters-panel-section-chevron" aria-hidden>▶</span>
                    </button>
                    <div className="zen-filters-panel-section-content">
                      <div className="zen-filters-chip-row-wrap">
                        <div
                          ref={categoryChipRowRef}
                          className="zen-filters-chip-row"
                          onScroll={() => {
                            if (chipScrollProgrammaticRef.current) return;
                            if (categoryAutoScrollIdRef.current) {
                              clearInterval(categoryAutoScrollIdRef.current);
                              categoryAutoScrollIdRef.current = null;
                            }
                            userScrolledCategoryRef.current = true;
                          }}
                        >
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
                      </div>
                    </div>
                  </section>
                </div>
            <div className="zen-filters-panel-footer">
              <button type="button" className="zen-filters-reset-btn" onClick={resetAllFilters}>
                {t(lang, "resetFilters")}
              </button>
              <div className="zen-filters-panel-collapse-wrap">
                <button type="button" className="zen-filters-panel-close-arrow" onClick={closeFilters} aria-label={t(lang, "close")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
              </div>
            </div>
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

const catalogBannerStyles = {
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    margin: "0 0 12px",
  } as React.CSSProperties,
  card: (bgImg: string): React.CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    minHeight: 130,
    border: "none",
    borderRadius: 16,
    cursor: "pointer",
    overflow: "hidden",
    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.35) 100%), url(${bgImg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }),
  inner: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    textAlign: "center",
    width: "100%",
  } as React.CSSProperties,
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.3,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    textShadow: "0 1px 8px rgba(0,0,0,0.5)",
    fontFamily: "inherit",
  } as React.CSSProperties,
  sub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.88)",
    fontFamily: "inherit",
    lineHeight: 1.3,
    textShadow: "0 1px 6px rgba(0,0,0,0.4)",
  } as React.CSSProperties,
};
