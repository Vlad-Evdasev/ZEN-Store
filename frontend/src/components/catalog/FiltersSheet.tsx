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

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (open) {
      setDraft({
        priceMin: appliedPriceMin,
        priceMax: appliedPriceMax,
        priceSort: appliedPriceSort,
        brand: appliedBrand,
        categories: new Set(appliedCategories),
      });
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
            <div className="zen-filters-facet">
              <span className="zen-filters-facet-name">{t(lang, "priceFilter")}</span>
              <span className="zen-filters-facet-values">
                <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>
              </span>
              <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
            </div>
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
