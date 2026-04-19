import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n";
import type { DraftFiltersValue, FiltersSheetProps } from "./FiltersSheet.types";

export function FiltersSheet(props: FiltersSheetProps) {
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

  const [sectionOpen, setSectionOpen] = useState({ price: false, brand: false, categories: false });

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const priceSliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderActiveThumbRef = useRef<"min" | "max" | null>(null);
  const SLIDER_PAD = 14;

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
  const priceSummaryLabel = (() => {
    const from = draft.priceMin.trim() !== "" ? draft.priceMin : String(catalogPriceMin);
    const to = draft.priceMax.trim() !== "" ? draft.priceMax : String(catalogPriceMax);
    const range = `${from}–${to}`;
    if (draft.priceSort === "asc") return `${range} ↑`;
    if (draft.priceSort === "desc") return `${range} ↓`;
    return range;
  })();

  useEffect(() => {
    if (open) {
      setDraft({
        priceMin: appliedPriceMin,
        priceMax: appliedPriceMax,
        priceSort: appliedPriceSort,
        brand: appliedBrand,
        categories: new Set(appliedCategories),
      });
      setSectionOpen({ price: false, brand: false, categories: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = useMemo(() => countForDraft(draft), [draft, countForDraft]);

  const commitAndClose = () => {
    onApply(draftRef.current);
    onClose();
  };

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
      >
        <div className="zen-filters-panel-header">
          <span className="zen-filters-panel-drag-bar" aria-hidden />
          <h3 className="zen-filters-panel-title">{t(lang, "filters")}</h3>
        </div>

        <div className="zen-filters-panel-body">
          {props.showPriceFilter && (
            <>
              <div
                className={`zen-filters-facet ${sectionOpen.price ? "zen-filters-facet--open" : ""}`}
                onClick={() => setSectionOpen((s) => ({ ...s, price: !s.price }))}
                role="button"
                aria-expanded={sectionOpen.price}
              >
                <span className="zen-filters-facet-name">{t(lang, "priceFilter")}</span>
                <span className="zen-filters-facet-values">
                  {priceHasActive ? (
                    <span className="zen-filters-facet-chip">
                      <span className="zen-filters-facet-chip-label">{priceSummaryLabel}</span>
                      <button
                        type="button"
                        className="zen-filters-facet-chip-x"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraft((d) => ({ ...d, priceMin: "", priceMax: "", priceSort: "none" }));
                        }}
                        aria-label="×"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>
                  )}
                </span>
                <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
              </div>
              {sectionOpen.price && (
                <div className="zen-filters-facet-expanded">
                  <div className="zen-filters-price-block">
                    <div className="zen-filters-price-range-row">
                      <label className="zen-filters-price-label">
                        <span className="zen-filters-price-label-text">{t(lang, "priceFrom")}</span>
                        <input
                          type="number"
                          className="zen-filters-panel-input zen-filters-price-input"
                          min={catalogPriceMin}
                          max={catalogPriceMax}
                          value={draft.priceMin}
                          onChange={(e) => setDraft((d) => ({ ...d, priceMin: e.target.value }))}
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
                          value={draft.priceMax}
                          onChange={(e) => setDraft((d) => ({ ...d, priceMax: e.target.value }))}
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
                      onPointerUp={(e) => {
                        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        sliderActiveThumbRef.current = null;
                      }}
                      onPointerLeave={() => {
                        sliderActiveThumbRef.current = null;
                      }}
                    >
                      <div className="zen-filters-price-slider-track" />
                      <div
                        className="zen-filters-price-slider-range"
                        style={{
                          left: `calc(${SLIDER_PAD}px + (100% - ${SLIDER_PAD * 2}px) * ${priceMinPercent / 100})`,
                          width: `calc((100% - ${SLIDER_PAD * 2}px) * ${priceRangePercent / 100})`,
                        }}
                      />
                      <div
                        className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--min"
                        style={{
                          left: `calc(${SLIDER_PAD}px + (100% - ${SLIDER_PAD * 2}px) * ${priceMinPercent / 100})`,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          sliderActiveThumbRef.current = "min";
                          priceSliderTrackRef.current?.setPointerCapture(e.pointerId);
                        }}
                      />
                      <div
                        className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--max"
                        style={{
                          left: `calc(${SLIDER_PAD}px + (100% - ${SLIDER_PAD * 2}px) * ${priceMaxPercent / 100})`,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          sliderActiveThumbRef.current = "max";
                          priceSliderTrackRef.current?.setPointerCapture(e.pointerId);
                        }}
                      />
                    </div>
                    <div className="zen-filters-price-slider-labels">
                      <span>{priceMinNum}</span>
                      <span>{priceMaxNum}</span>
                    </div>
                    <div className="zen-filters-price-sort-row">
                      <div
                        className="zen-filters-sort-segmented"
                        role="group"
                        aria-label={t(lang, "priceFilter")}
                      >
                        <button
                          type="button"
                          className={`zen-filters-sort-btn ${draft.priceSort === "asc" ? "zen-filters-sort-btn-active" : ""}`}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              priceSort: d.priceSort === "asc" ? "none" : "asc",
                            }))
                          }
                          title={t(lang, "sortPriceAsc")}
                          aria-pressed={draft.priceSort === "asc"}
                        >
                          <span className="zen-filters-sort-icon" aria-hidden>↑</span>
                          <span className="zen-filters-sort-text">{t(lang, "sortAscShort")}</span>
                        </button>
                        <button
                          type="button"
                          className={`zen-filters-sort-btn ${draft.priceSort === "desc" ? "zen-filters-sort-btn-active" : ""}`}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              priceSort: d.priceSort === "desc" ? "none" : "desc",
                            }))
                          }
                          title={t(lang, "sortPriceDesc")}
                          aria-pressed={draft.priceSort === "desc"}
                        >
                          <span className="zen-filters-sort-icon" aria-hidden>↓</span>
                          <span className="zen-filters-sort-text">{t(lang, "sortDescShort")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {props.uniqueBrands.length >= 2 && (
            <div className="zen-filters-facet">
              <span className="zen-filters-facet-name">{t(lang, "brand")}</span>
              <span className="zen-filters-facet-values">
                <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>
              </span>
              <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
            </div>
          )}
          <div className="zen-filters-facet">
            <span className="zen-filters-facet-name">{t(lang, "categories")}</span>
            <span className="zen-filters-facet-values">
              <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>
            </span>
            <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
          </div>
        </div>

        {/* TODO: final footer (Task 8) */}
        <div className="zen-filters-panel-footer">
          <button
            type="button"
            className="zen-filters-footer-cta"
            onClick={commitAndClose}
          >
            [DEBUG] Закрыть / применить ({count})
          </button>
        </div>
      </div>
    </>
  );
}
