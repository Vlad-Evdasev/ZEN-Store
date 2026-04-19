import type { Dispatch, SetStateAction } from "react";

export type PriceSort = "none" | "asc" | "desc";

export interface DraftFiltersValue {
  priceMin: string;
  priceMax: string;
  priceSort: PriceSort;
  brand: string;
  categories: Set<string>;
}

export interface CategoryTab {
  code: string;
  label: string;
}

export interface FiltersSheetProps {
  /** Включает рендер шторки и overlay. */
  open: boolean;
  /** true во время анимации закрытия; overlay и панель получают *--closing класс. */
  closing: boolean;
  /** Вызывается при завершении CSS-анимации закрытия; Catalog сбрасывает open/closing. */
  onAnimationEnd: () => void;
  /** Триггер закрытия: запускает commit + анимацию. */
  onClose: () => void;

  /** Применённые (текущие) фильтры — инициализируют draft при каждом open. */
  appliedPriceMin: string;
  appliedPriceMax: string;
  appliedPriceSort: PriceSort;
  appliedBrand: string;
  appliedCategories: Set<string>;

  /** Границы слайдера цены — уже посчитанные в Catalog. */
  catalogPriceMin: number;
  catalogPriceMax: number;

  /** Данные для чипов. uniqueBrands фильтрует внутри: рендерим секцию если length >= 2. */
  uniqueBrands: string[];
  categoryTabs: CategoryTab[];

  /** Показывать секцию «Цена» (в Catalog прокидывается showPriceFilter). */
  showPriceFilter: boolean;

  /** Считает число товаров для произвольного draft-состояния. Чистая функция. */
  countForDraft: (draft: DraftFiltersValue) => number;

  /** Вызывается при КАЖДОМ закрытии шторки (любым способом). */
  onApply: (draft: DraftFiltersValue) => void;

  lang: "ru" | "en";
}

export type SetDraft = Dispatch<SetStateAction<DraftFiltersValue>>;
