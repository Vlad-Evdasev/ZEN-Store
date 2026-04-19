import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { t } from "../../i18n";
import { useSettings } from "../../context/SettingsContext";
import type { DraftFiltersValue, FiltersSheetProps } from "./FiltersSheet.types";

export interface FiltersSheetHandle {
  /** Применяет текущий draft и запускает анимацию закрытия. */
  commitAndClose: () => void;
}

interface PriceSliderProps {
  priceMinNum: number;
  priceMaxNum: number;
  priceMinPercent: number;
  priceMaxPercent: number;
  priceRangePercent: number;
  SLIDER_PAD: number;
  trackRef: RefObject<HTMLDivElement>;
  activeThumbRef: MutableRefObject<"min" | "max" | null>;
  handleTrack: (clientX: number) => void;
  formatValue: (n: number) => string;
}

function PriceSlider(p: PriceSliderProps) {
  // Подписи min/max приклеены к краям трека — так читается стабильнее и не
  // «скачет» за полозком на мобильных. Совпадающие значения отображаем как
  // одиночную подпись посередине.
  const isCollapsed = p.priceMaxNum - p.priceMinNum <= 0;

  const beginDragFromTrack = (e: ReactPointerEvent<HTMLDivElement>) => {
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
  };

  const beginDragFromThumb = (thumb: "min" | "max") => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    p.activeThumbRef.current = thumb;
  };

  return (
    <div className="zen-filters-price-block">
      <div className="zen-filters-price-bubbles" aria-hidden>
        {isCollapsed ? (
          <span className="zen-filters-price-bubble zen-filters-price-bubble--sticky-center">
            {p.formatValue(p.priceMinNum)}
          </span>
        ) : (
          <>
            <span className="zen-filters-price-bubble zen-filters-price-bubble--sticky-left">
              {p.formatValue(p.priceMinNum)}
            </span>
            <span className="zen-filters-price-bubble zen-filters-price-bubble--sticky-right">
              {p.formatValue(p.priceMaxNum)}
            </span>
          </>
        )}
      </div>
      <div
        ref={p.trackRef}
        className="zen-filters-price-slider"
        onPointerDown={beginDragFromTrack}
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
          onPointerDown={beginDragFromThumb("min")}
        />
        <div
          className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--max"
          style={{
            left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMaxPercent / 100})`,
          }}
          onPointerDown={beginDragFromThumb("max")}
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
    const { formatPrice } = useSettings();

    const filtersDragHandleRef = useRef<HTMLDivElement>(null);
    const touchStartYRef = useRef(0);
    const touchStartTimeRef = useRef(0);
    const panelDragYRef = useRef(0);
    const [panelDragY, setPanelDragY] = useState(0);

    // Анимация «шторки»: панель растёт по max-height от 0 до реальной высоты
    // контента (меньше, чем остаток вьюпорта). Мы держим целевую высоту в
    // стейте и двигаем её синхронно с `open` / `closing`.
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelMaxHeight, setPanelMaxHeight] = useState<number>(0);
    const measurePanelHeight = () => {
      const el = panelRef.current;
      if (!el) return 0;
      // Чтобы получить реальный scrollHeight, временно снимаем верхний
      // лимит max-height: иначе scrollHeight равен тому, что уже выставлено.
      const prev = el.style.maxHeight;
      el.style.maxHeight = "none";
      const content = el.scrollHeight;
      el.style.maxHeight = prev;
      const viewportCap =
        typeof window !== "undefined"
          ? Math.max(0, window.innerHeight - 118 - 20)
          : content;
      return Math.min(content, viewportCap);
    };

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

    // При каждом открытии панели сбрасываем draft к текущим applied-* значениям.
    // Намеренно зависим только от `open`: изменения applied-* во время открытой
    // панели не должны затирать пользовательский draft в процессе редактирования.
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
        setPanelMaxHeight(0);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Как только DOM готов, измеряем высоту и запускаем transition.
    // Используем useLayoutEffect, чтобы перейти от 0 к финальной высоте
    // уже после первой раскладки — иначе transition не сыграет.
    useLayoutEffect(() => {
      if (!open || closing) return;
      // requestAnimationFrame гарантирует, что стартовый max-height:0 был
      // применён отдельным кадром до финального значения.
      const id = requestAnimationFrame(() => {
        setPanelMaxHeight(measurePanelHeight());
      });
      return () => cancelAnimationFrame(id);
    }, [open, closing]);

    // При смене контента (размер/количество брендов) обновляем целевую
    // высоту, чтобы панель «дотягивалась» без перерисовки.
    useEffect(() => {
      if (!open || closing) return;
      const id = requestAnimationFrame(() => {
        setPanelMaxHeight(measurePanelHeight());
      });
      return () => cancelAnimationFrame(id);
    }, [open, closing, draft, props.uniqueBrands.length, props.categoryTabs.length, hasAnyActiveDraft]);

    // Ставим стартовое max-height:0 сразу при переходе в closing, чтобы
    // transition сыграл обратно.
    useLayoutEffect(() => {
      if (closing) setPanelMaxHeight(0);
    }, [closing]);

    const count = useMemo(() => countForDraft(draft), [draft, countForDraft]);

    // Применяет текущий draft и закрывает панель. Держим актуальную функцию в ref,
    // чтобы effect'ы и imperative handle никогда не захватывали stale onApply/onClose.
    const commitAndCloseRef = useRef<() => void>(() => {});
    useEffect(() => {
      commitAndCloseRef.current = () => {
        onApply(draftRef.current);
        onClose();
      };
    });
    const commitAndClose = () => commitAndCloseRef.current();

    useImperativeHandle(ref, () => ({ commitAndClose: () => commitAndCloseRef.current() }), []);

    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") commitAndCloseRef.current();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // Глобальные pointer-обработчики для ползунков цены: пока любой из thumbs
    // «захвачен», мы продолжаем двигать выбранное значение даже если палец/курсор
    // уходит за пределы трека. Так драг на мобильных не обрывается.
    const handleTrackRef = useRef(handlePriceSliderTrack);
    useEffect(() => {
      handleTrackRef.current = handlePriceSliderTrack;
    });
    useEffect(() => {
      if (!open) return;
      const onMove = (e: PointerEvent) => {
        if (!sliderActiveThumbRef.current) return;
        e.preventDefault();
        handleTrackRef.current(e.clientX);
      };
      const onUp = () => {
        sliderActiveThumbRef.current = null;
      };
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
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
        if (shouldClose) commitAndCloseRef.current();
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
          ref={panelRef}
          className="zen-filters-panel"
          data-state={closing ? "closing" : "open"}
          role="dialog"
          aria-label={t(lang, "filters")}
          onTransitionEnd={(e) => {
            // Игнорируем transition-конец других свойств (transform от свайпа,
            // box-shadow). Завершаем open/close жизненный цикл только после
            // окончания max-height.
            if (e.propertyName !== "max-height") return;
            onAnimationEnd();
          }}
          style={{
            maxHeight: `${panelMaxHeight}px`,
            ...(!closing && panelDragY > 0
              ? { transform: `translateX(-50%) translateY(${panelDragY}px)` }
              : {}),
          }}
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
                  priceMinNum={priceMinNum}
                  priceMaxNum={priceMaxNum}
                  priceMinPercent={priceMinPercent}
                  priceMaxPercent={priceMaxPercent}
                  priceRangePercent={priceRangePercent}
                  SLIDER_PAD={SLIDER_PAD}
                  trackRef={priceSliderTrackRef}
                  activeThumbRef={sliderActiveThumbRef}
                  handleTrack={handlePriceSliderTrack}
                  formatValue={formatPrice}
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
