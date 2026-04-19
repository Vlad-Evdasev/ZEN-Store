import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject, RefObject } from "react";
import { t } from "../../i18n";
import type { DraftFiltersValue, FiltersSheetProps } from "./FiltersSheet.types";

export interface FiltersSheetHandle {
  /** Применяет текущий draft и запускает анимацию закрытия. */
  commitAndClose: () => void;
}

interface PriceSliderProps {
  draftMin: string;
  draftMax: string;
  priceMinNum: number;
  priceMaxNum: number;
  priceMinPercent: number;
  priceMaxPercent: number;
  priceRangePercent: number;
  SLIDER_PAD: number;
  trackRef: RefObject<HTMLDivElement>;
  activeThumbRef: MutableRefObject<"min" | "max" | null>;
  handleTrack: (clientX: number) => void;
}

function PriceSlider(p: PriceSliderProps) {
  const bubblesMerged = p.priceMaxPercent - p.priceMinPercent < 15;
  const currencyFormat = (n: number) => `₽${n.toLocaleString("ru-RU")}`;

  return (
    <div className="zen-filters-price-block">
      <div className="zen-filters-price-bubbles" aria-hidden>
        {bubblesMerged ? (
          <span
            className="zen-filters-price-bubble zen-filters-price-bubble--merged"
            style={{
              left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${(p.priceMinPercent + p.priceMaxPercent) / 200 / 100})`,
            }}
          >
            {currencyFormat(p.priceMinNum)} – {currencyFormat(p.priceMaxNum)}
          </span>
        ) : (
          <>
            <span
              className="zen-filters-price-bubble"
              style={{
                left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMinPercent / 100})`,
              }}
            >
              {currencyFormat(p.priceMinNum)}
            </span>
            <span
              className="zen-filters-price-bubble"
              style={{
                left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMaxPercent / 100})`,
              }}
            >
              {currencyFormat(p.priceMaxNum)}
            </span>
          </>
        )}
      </div>
      <div
        ref={p.trackRef}
        className="zen-filters-price-slider"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const rect = p.trackRef.current?.getBoundingClientRect();
          if (!rect) return;
          const trackLeft = rect.left + p.SLIDER_PAD;
          const trackWidth = rect.width - p.SLIDER_PAD * 2;
          const pos = trackWidth > 0 ? (e.clientX - trackLeft) / trackWidth : 0;
          const toMin = Math.abs(pos - p.priceMinPercent / 100);
          const toMax = Math.abs(pos - p.priceMaxPercent / 100);
          p.activeThumbRef.current = toMin <= toMax ? "min" : "max";
          p.handleTrack(e.clientX);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (p.activeThumbRef.current) p.handleTrack(e.clientX);
        }}
        onPointerUp={(e) => {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          p.activeThumbRef.current = null;
        }}
        onPointerLeave={() => {
          p.activeThumbRef.current = null;
        }}
      >
        <div className="zen-filters-price-slider-track" />
        <div
          className="zen-filters-price-slider-range"
          style={{
            left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMinPercent / 100})`,
            width: `calc((100% - ${p.SLIDER_PAD * 2}px) * ${p.priceRangePercent / 100})`,
          }}
        />
        <div
          className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--min"
          style={{
            left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMinPercent / 100})`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            p.activeThumbRef.current = "min";
            p.trackRef.current?.setPointerCapture(e.pointerId);
          }}
        />
        <div
          className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--max"
          style={{
            left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMaxPercent / 100})`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            p.activeThumbRef.current = "max";
            p.trackRef.current?.setPointerCapture(e.pointerId);
          }}
        />
      </div>
    </div>
  );
}

export const FiltersSheet = forwardRef<FiltersSheetHandle, FiltersSheetProps>(
  function FiltersSheet(props, ref) {
    const {
      open,
      closing,
      onAnimationEnd,
      onClose,
      appliedPriceMin,
      appliedPriceMax,
      appliedPriceSort,
      appliedBrand,
      appliedCategories,
      countForDraft,
      onApply,
      lang,
    } = props;

    const [draft, setDraft] = useState<DraftFiltersValue>(() => ({
      priceMin: appliedPriceMin,
      priceMax: appliedPriceMax,
      priceSort: appliedPriceSort,
      brand: appliedBrand,
      categories: new Set(appliedCategories),
    }));

    const draftRef = useRef(draft);
    useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

    const priceSliderTrackRef = useRef<HTMLDivElement>(null);
    const sliderActiveThumbRef = useRef<"min" | "max" | null>(null);
    const SLIDER_PAD = 14;

    const filtersDragHandleRef = useRef<HTMLDivElement>(null);
    const touchStartYRef = useRef(0);
    const touchStartTimeRef = useRef(0);
    const panelDragYRef = useRef(0);
    const [panelDragY, setPanelDragY] = useState(0);

    const { catalogPriceMin, catalogPriceMax } = props;

    const priceMinNum =
      draft.priceMin.trim() !== "" && !Number.isNaN(Number(draft.priceMin))
        ? Math.max(catalogPriceMin, Math.min(catalogPriceMax, Number(draft.priceMin)))
        : catalogPriceMin;
    const priceMaxNum =
      draft.priceMax.trim() !== "" && !Number.isNaN(Number(draft.priceMax))
        ? Math.max(catalogPriceMin, Math.min(catalogPriceMax, Number(draft.priceMax)))
        : catalogPriceMax;
    const priceRange = Math.max(1, catalogPriceMax - catalogPriceMin);
    const priceMinPercent = ((priceMinNum - catalogPriceMin) / priceRange) * 100;
    const priceMaxPercent = ((priceMaxNum - catalogPriceMin) / priceRange) * 100;
    const priceRangePercent = priceMaxPercent - priceMinPercent;

    const handlePriceSliderTrack = (clientX: number) => {
      const track = priceSliderTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const trackLeft = rect.left + SLIDER_PAD;
      const trackWidth = rect.width - SLIDER_PAD * 2;
      const pos = trackWidth > 0 ? Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth)) : 0;
      const value = Math.round(catalogPriceMin + pos * (catalogPriceMax - catalogPriceMin));
      const thumb = sliderActiveThumbRef.current;
      if (thumb === "min") {
        setDraft((d) => {
          const maxVal =
            d.priceMax.trim() !== "" && !Number.isNaN(Number(d.priceMax))
              ? Number(d.priceMax)
              : catalogPriceMax;
          return { ...d, priceMin: String(Math.min(value, maxVal)) };
        });
      } else if (thumb === "max") {
        setDraft((d) => {
          const minVal =
            d.priceMin.trim() !== "" && !Number.isNaN(Number(d.priceMin))
              ? Number(d.priceMin)
              : catalogPriceMin;
          return { ...d, priceMax: String(Math.max(value, minVal)) };
        });
      }
    };

    const priceHasActive =
      draft.priceMin.trim() !== "" || draft.priceMax.trim() !== "" || draft.priceSort !== "none";

    const toggleCategoryInDraft = (code: string) => {
      setDraft((d) => {
        const next = new Set(d.categories);
        if (code === "all") {
          return { ...d, categories: new Set(["all"]) };
        }
        if (next.has("all")) {
          return { ...d, categories: new Set([code]) };
        }
        if (next.has(code)) {
          next.delete(code);
          if (next.size === 0) return { ...d, categories: new Set(["all"]) };
          return { ...d, categories: next };
        }
        next.add(code);
        return { ...d, categories: next };
      });
    };

    const brandHasActive = draft.brand !== "all";
    const categoriesHasActive = !draft.categories.has("all");
    const hasAnyActiveDraft = priceHasActive || brandHasActive || categoriesHasActive;

    useEffect(() => {
      if (open) {
        setDraft({
          priceMin: appliedPriceMin,
          priceMax: appliedPriceMax,
          priceSort: appliedPriceSort,
          brand: appliedBrand,
          categories: new Set(appliedCategories),
        });
        setPanelDragY(0);
        panelDragYRef.current = 0;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const count = useMemo(() => countForDraft(draft), [draft, countForDraft]);

    const commitAndClose = () => {
      onApply(draftRef.current);
      onClose();
    };

    useImperativeHandle(ref, () => ({ commitAndClose }), []);

    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") commitAndClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
      if (!open && !closing) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }, [open, closing]);

    useEffect(() => {
      const handle = filtersDragHandleRef.current;
      if (!open || !handle) return;
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
        const shouldClose = dy > 60 || velocity > 0.3;
        setPanelDragY(0);
        panelDragYRef.current = 0;
        if (shouldClose) commitAndClose();
      };
      const touchStart = (e: TouchEvent) => {
        onStart(e.touches[0].clientY);
      };
      const touchMove = (e: TouchEvent) => {
        e.preventDefault();
        onMove(e.touches[0].clientY);
      };
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    return (
      <>
        <div
          className={`zen-filters-overlay ${closing ? "zen-filters-overlay--closing" : ""}`}
          onClick={commitAndClose}
          aria-hidden
        />
        <div
          className={`zen-filters-panel ${closing ? "zen-filters-panel--closing" : ""}`}
          role="dialog"
          aria-label={t(lang, "filters")}
          onAnimationEnd={onAnimationEnd}
          style={!closing && panelDragY > 0 ? { transform: `translateY(${panelDragY}px)` } : undefined}
        >
          <div
            ref={filtersDragHandleRef}
            className="zen-filters-panel-drag-handle"
          >
            <span className="zen-filters-panel-drag-bar" aria-hidden />
          </div>

          {hasAnyActiveDraft && (
            <button
              type="button"
              className="zen-filters-reset-top"
              onClick={() =>
                setDraft({
                  priceMin: "",
                  priceMax: "",
                  priceSort: "none",
                  brand: "all",
                  categories: new Set(["all"]),
                })
              }
            >
              {t(lang, "resetFilters")}
            </button>
          )}

          <div className="zen-filters-panel-body">
            {props.showPriceFilter && (
              <section
                className="zen-filters-section"
                style={{ animationDelay: "120ms" }}
              >
                <div className="zen-filters-section-label">{t(lang, "priceFilter")}</div>
                <PriceSlider
                  draftMin={draft.priceMin}
                  draftMax={draft.priceMax}
                  priceMinNum={priceMinNum}
                  priceMaxNum={priceMaxNum}
                  priceMinPercent={priceMinPercent}
                  priceMaxPercent={priceMaxPercent}
                  priceRangePercent={priceRangePercent}
                  SLIDER_PAD={SLIDER_PAD}
                  trackRef={priceSliderTrackRef}
                  activeThumbRef={sliderActiveThumbRef}
                  handleTrack={handlePriceSliderTrack}
                />
                <div className="zen-filters-sort-round">
                  <button
                    type="button"
                    className={`zen-filters-sort-round-btn ${draft.priceSort === "asc" ? "zen-filters-sort-round-btn--active" : ""}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        priceSort: d.priceSort === "asc" ? "none" : "asc",
                      }))
                    }
                    title={t(lang, "sortPriceAsc")}
                    aria-pressed={draft.priceSort === "asc"}
                    aria-label={t(lang, "sortPriceAsc")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`zen-filters-sort-round-btn ${draft.priceSort === "desc" ? "zen-filters-sort-round-btn--active" : ""}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        priceSort: d.priceSort === "desc" ? "none" : "desc",
                      }))
                    }
                    title={t(lang, "sortPriceDesc")}
                    aria-pressed={draft.priceSort === "desc"}
                    aria-label={t(lang, "sortPriceDesc")}
                  >
                    ↓
                  </button>
                </div>
              </section>
            )}

            {props.showPriceFilter && <div className="zen-filters-divider" />}

            <section
              className="zen-filters-section"
              style={{ animationDelay: "160ms" }}
            >
              <div className="zen-filters-section-label">{t(lang, "categories")}</div>
              <div className="zen-filters-chip-wrap">
                {props.categoryTabs.map(({ code, label }) => {
                  const isSelected =
                    code === "all" ? draft.categories.has("all") : draft.categories.has(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`zen-filters-chip ${isSelected ? "zen-filters-chip-active" : ""}`}
                      onClick={() => toggleCategoryInDraft(code)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {props.uniqueBrands.length >= 2 && (
              <>
                <div className="zen-filters-divider" />
                <section
                  className="zen-filters-section"
                  style={{ animationDelay: "200ms" }}
                >
                  <div className="zen-filters-section-label">{t(lang, "brand")}</div>
                  <div className="zen-filters-chip-wrap">
                    <button
                      type="button"
                      className={`zen-filters-chip ${draft.brand === "all" ? "zen-filters-chip-active" : ""}`}
                      onClick={() => setDraft((d) => ({ ...d, brand: "all" }))}
                    >
                      {t(lang, "all")}
                    </button>
                    {props.uniqueBrands.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={`zen-filters-chip ${draft.brand === b ? "zen-filters-chip-active" : ""}`}
                        onClick={() => setDraft((d) => ({ ...d, brand: b }))}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>

          <div className="zen-filters-panel-footer">
            <button
              type="button"
              className={`zen-filters-apply-btn ${count === 0 ? "zen-filters-apply-btn--disabled" : ""}`}
              onClick={commitAndClose}
              disabled={count === 0}
              aria-disabled={count === 0}
            >
              {count === 0
                ? t(lang, "filtersNothingFound")
                : t(lang, "filtersShowN").replace("{n}", String(count))}
            </button>
          </div>
        </div>
      </>
    );
  }
);
