# Catalog Filters Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переписать шторку фильтров каталога на дизайн «фасет + inline-пилюли» с draft-состоянием и главной кнопкой «Показать N товаров», одновременно починив пропажу секции «Бренд».

**Architecture:** Выносим шторку из `Catalog.tsx` в отдельный компонент `FiltersSheet` с локальным draft-состоянием. `Catalog` передаёт applied-фильтры + функцию подсчёта и колбэк `onApply(draft)`, который вызывается при ЛЮБОМ закрытии (кнопка «Показать N», ✕, свайп, фон, Escape). Inline-аккордеон, активные значения — пилюлями внутри строки своей фасеты. Секция «Бренд» видна только при 2+ уникальных брендах.

**Tech Stack:** React 18 + TypeScript + Vite, стили в `frontend/src/index.css` (классы `.zen-filters-*`), локализация через `frontend/src/i18n.ts`.

**Spec:** `docs/superpowers/specs/2026-04-19-catalog-filters-redesign-design.md`

---

## File Structure

**Создаём:**
- `frontend/src/components/catalog/FiltersSheet.tsx` — новый компонент шторки фильтров.
- `frontend/src/components/catalog/FiltersSheet.types.ts` — типы `DraftFiltersValue`, `FiltersSheetProps`.

**Модифицируем:**
- `frontend/src/pages/Catalog.tsx` — убираем inline-разметку шторки (строки ~605–803) и часть связанного state/эффектов, вместо них рендерим `<FiltersSheet />`. Добавляем функцию `countForDraft`.
- `frontend/src/i18n.ts` — добавляем ключи `filtersShowN`, `filtersNothingFound`, `filtersAllValue`.
- `frontend/src/index.css` — добавляем новые классы `.zen-filters-facet*`, `.zen-filters-footer-cta`, `.zen-filters-footer-reset`, удаляем устаревшие `.zen-filters-panel-summary*`, `.zen-filters-panel-close-arrow*`, `.zen-filters-panel-collapse-wrap`, `.zen-filters-panel-section-chevron`, `.zen-filters-panel-section--accordion*`. Сохраняем `.zen-filters-overlay`, `.zen-filters-panel`, `.zen-filters-panel--closing`, `.zen-filters-panel-header`, `.zen-filters-panel-drag-handle`, `.zen-filters-panel-drag-bar`, `.zen-filters-panel-title`, `.zen-filters-price-slider*`, `.zen-filters-sort-segmented`, `.zen-filters-sort-btn*`, `.zen-filters-chip*`, `.zen-filters-chip-row*`, `.zen-filters-price-input`, `.zen-filters-panel-input*`.

**Не трогаем:**
- `frontend/src/api.ts` — тип `Product.brand` уже есть.
- `frontend/src/components/FilterIcon.tsx`.
- Бэкенд — никаких серверных изменений.

## Notes for the implementing engineer

- **Нет автотестов на UI в проекте.** Верификация — ручная по сценариям в конце плана + визуальная проверка в `pnpm run dev` (или `npm run dev`) в `frontend/`.
- **Стиль кода** — проект использует двойные кавычки в JSX, функциональные компоненты, хуки, именованные экспорты. CSS — БЭМ-подобные классы `zen-*`.
- **Локализация** — везде через `t(lang, "key")`, где `lang = "ru" | "en"`, см. существующий `i18n.ts`.
- **Типы** — `Product.brand?: string | null`. Не забываем про оба варианта (undefined / null / "").
- **Шорткат до dev-сервера:** `cd frontend && npm run dev` (или `pnpm dev`, см. `frontend/package.json`).
- **TSC:** `cd frontend && npx tsc --noEmit` для проверки типов.
- **Коммиты:** после каждой группы связанных шагов. Префиксы: `feat:`, `refactor:`, `style:`, `fix:`.

---

## Task 1: Добавить ключи локализации

**Files:**
- Modify: `frontend/src/i18n.ts`

- [ ] **Step 1: Открыть `frontend/src/i18n.ts` и найти RU-блок с ключом `filters: "Фильтры"` (около строки 27)**

Нужно добавить три ключа в RU-блок и три аналогичных в EN-блок (около строки 181).

- [ ] **Step 2: Добавить ключи в RU-блок**

В RU-блоке (рядом с `filters: "Фильтры"`) добавить:

```ts
    filtersShowN: (n: number) => {
      const last2 = n % 100;
      const last1 = n % 10;
      const form =
        last2 >= 11 && last2 <= 14 ? "товаров" :
        last1 === 1 ? "товар" :
        last1 >= 2 && last1 <= 4 ? "товара" :
        "товаров";
      return `Показать ${n} ${form}`;
    },
    filtersNothingFound: "Ничего не найдено",
    filtersAllValue: "все",
```

**Важно:** в `i18n.ts` уже используются функции для плюрализации (проверь на существующих ключах типа `resultsCount` — если он функция, следуй тому же стилю). Если словарь строго `Record<string, string>` — тогда вместо функции сделай ключ-строку `filtersShowN: "Показать {n} товаров"` и передавай число через простую замену в компоненте:

```ts
t(lang, "filtersShowN").replace("{n}", String(n))
```

Перед тем как писать — **прочти существующий `i18n.ts` целиком** (500 строк максимум) и посмотри, какой паттерн уже применяется. Следуй ему.

- [ ] **Step 3: Добавить ключи в EN-блок**

```ts
    filtersShowN: (n: number) => `Show ${n} ${n === 1 ? "product" : "products"}`,
    filtersNothingFound: "Nothing found",
    filtersAllValue: "all",
```

(или строковый вариант, если в файле нет функциональных ключей)

- [ ] **Step 4: Проверка типов**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если в `i18n.ts` строгий тип словаря — возможно, потребуется добавить ключи в интерфейс/тип словаря.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n.ts
git commit -m "feat(i18n): add filter keys for catalog redesign"
```

---

## Task 2: Создать типы для FiltersSheet

**Files:**
- Create: `frontend/src/components/catalog/FiltersSheet.types.ts`

- [ ] **Step 1: Создать директорию**

```bash
mkdir -p frontend/src/components/catalog
```

- [ ] **Step 2: Написать файл типов**

Содержимое `frontend/src/components/catalog/FiltersSheet.types.ts`:

```ts
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
```

- [ ] **Step 3: Проверка типов**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.types.ts
git commit -m "feat(catalog): add FiltersSheet types"
```

---

## Task 3: Скелет компонента FiltersSheet

**Цель:** пустой компонент, который просто рендерит overlay + панель с заголовком и счётчиком. Без фасет и без кнопок. Подключить в Catalog и убедиться, что открытие/закрытие работает.

**Files:**
- Create: `frontend/src/components/catalog/FiltersSheet.tsx`

- [ ] **Step 1: Написать скелет компонента**

Содержимое `frontend/src/components/catalog/FiltersSheet.tsx`:

```tsx
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

  // Draft инициализируется applied на каждое открытие.
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

  // При КАЖДОМ open=true → перезаливаем draft из applied.
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

  // Закрытие любым способом → commit через onApply + onClose (запускает анимацию).
  const commitAndClose = () => {
    onApply(draftRef.current);
    onClose();
  };

  // Escape = close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") commitAndClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Блокируем скролл body при open.
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

        {/* TODO: facets здесь (Task 5+) */}
        <div className="zen-filters-panel-body">
          <div style={{ padding: "20px", color: "var(--muted)" }}>
            [DEBUG] draft count = {count}
          </div>
        </div>

        {/* TODO: footer здесь (Task 8) */}
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
```

Прокомментируй, почему здесь нет «отмены»: согласно спеку X2 — любое закрытие применяет draft. Мы намеренно не делаем `onCancel`.

- [ ] **Step 2: Проверка типов**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. В Catalog компонент ещё не подключён — это нормально.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx
git commit -m "feat(catalog): scaffold FiltersSheet with draft state and close-commits-draft"
```

---

## Task 4: Подключить FiltersSheet в Catalog, убрать inline-разметку старой шторки

**Цель:** заменить блок `{showPriceFilter && filtersOpen && (...)}` в `Catalog.tsx` на `<FiltersSheet />`, подключить `countForDraft`, удалить больше не нужный state/эффекты, специфичные для старой шторки.

**Files:**
- Modify: `frontend/src/pages/Catalog.tsx` (строки ~63–71, 145–202, 216–222, 357–373, 416–505, 605–803)

- [ ] **Step 1: В `Catalog.tsx` добавить импорт FiltersSheet**

В блоке импортов в начале файла (рядом с `import { FilterIcon } from ...`) добавить:

```ts
import { FiltersSheet } from "../components/catalog/FiltersSheet";
import type { DraftFiltersValue } from "../components/catalog/FiltersSheet.types";
```

- [ ] **Step 2: Добавить функцию `countForDraft` в компоненте**

Найди функцию `filtered = useMemo(...)` (около строки 309). Сразу после неё добавь чистую функцию `countForDraft` (НЕ хук — обычная функция, использующая снаружи замкнутые `products`, `search`, `showPriceFilter`):

```ts
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
```

Т.к. это обычная функция внутри компонента, она пересоздаётся каждый ререндер — это ОК: `FiltersSheet` сам мемоизирует `count` через `useMemo`. Если TypeScript ругнётся на то, что функция передаётся через props и заставляет шторку ререндериться слишком часто — оберни в `useCallback` с зависимостями `[products, search, showPriceFilter]`.

- [ ] **Step 3: Написать колбэк `handleApplyFilters`**

Рядом с `resetAllFilters` (около строки 216) добавь:

```ts
const handleApplyFilters = (draft: DraftFiltersValue) => {
  setPriceMin(draft.priceMin);
  setPriceMax(draft.priceMax);
  setPriceSort(draft.priceSort);
  setSelectedBrand(draft.brand);
  setSelectedCategories(new Set(draft.categories));
};
```

- [ ] **Step 4: Удалить из Catalog.tsx state и эффекты, которые теперь живут в FiltersSheet**

Удалить (ОСТОРОЖНО — проверяй точные строки при редактировании):

1. State, связанный только со старой шторкой:
   - `const [sectionOpen, setSectionOpen] = useState(...)` — полностью удалить.
   - `const [panelDragY, setPanelDragY] = useState(0);` — удалить.
   - `panelDragYRef` — удалить.
   - `filtersDragHandleRef` — удалить (перенесли в FiltersSheet, там создадим заново).
   - `priceSliderTrackRef` — пока оставляем! Используется в Catalog для slider-логики, но она перекочует в FiltersSheet. В этой таске УДАЛЯЕМ его и всю связанную логику (handlePriceSliderTrack, priceMinPercent/priceMaxPercent/…), потому что Catalog больше не рендерит слайдер.
   - `sliderActiveThumbRef`, `handlePriceSliderTrackRef`, `priceMinPercentRef`, `priceMaxPercentRef` — удалить.
   - `brandChipRowRef`, `categoryChipRowRef`, `brandAutoScrollIdRef`, `categoryAutoScrollIdRef`, `userScrolledBrandRef`, `userScrolledCategoryRef`, `chipScrollProgrammaticRef` — удалить (были для авто-карусели чипов в старой шторке; в новой шторке убираем автокарусель, т.к. в фасет-строках активные пилюли не нуждаются в прокрутке).
   - `touchStartYRef`, `touchStartTimeRef` — удалить.

2. Эффекты:
   - `useEffect` с `if (filtersOpen || filtersClosing) { document.body.style.overflow = ...; }` (строки 146–152) — удалить (теперь это внутри FiltersSheet).
   - `useEffect` с карусельным auto-scroll брендов/категорий (строки 154–202) — удалить.
   - `useEffect` на `handlePriceSliderTrackRef.current = handlePriceSliderTrack;` (строки 400–402) — удалить.
   - `useEffect` на `priceMinPercentRef.current = ...` (строки 403–406) — удалить.
   - `useEffect` на `panelDragYRef.current = panelDragY;` (408–410) — удалить.
   - `useEffect` на `if (!filtersOpen) setPanelDragY(0);` (412–414) — удалить.
   - Большой `useEffect` со слайдером `touchstart/touchmove/touchend` (строки 416–471) — удалить.
   - Большой `useEffect` c drag-handle (строки 473–505) — удалить.

3. Локальные переменные слайдера цены, объявленные в теле компонента (не внутри JSX):
   - `priceRange`, `priceMinNum`, `priceMaxNum`, `priceMinPercent`, `priceMaxPercent`, `priceRangePercent`, `SLIDER_PAD`, `handlePriceSliderTrack` (строки 375–399) — удалить.

4. `activeSummary` (357–373) — удалить полностью (был для старой summary-ленты; в новой шторке активные значения рендерятся по-другому внутри фасет).

5. Сам JSX-блок шторки (605–803) — удалить целиком и заменить следующим:

```tsx
<FiltersSheet
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
```

**ВАЖНО:** оставляем `filtersOpen`, `filtersClosing`, `closeFilters`, `handleFiltersPanelAnimationEnd`, `filtersPanelRef`, `filterButtonRef` — они нужны для кнопки открытия и общей анимации в Catalog (см. строки 576–602). Кнопка-триггер открытия фильтров остаётся нетронутой.

- [ ] **Step 5: Проверка типов**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если вылезут ошибки про неиспользуемые импорты — удали их из `Catalog.tsx` (обычно `useRef` или типы, которые больше не используются).

- [ ] **Step 6: Запустить dev-сервер и проверить вручную**

Run: `cd frontend && npm run dev`
Expected: dev-сервер стартует, в каталоге старая шторка не появляется, а открывается новая (пока с debug-текстом). Закрытие через ✕, фон, Escape вызывает `handleApplyFilters`, draft применяется, каталог обновляется. Проверь числом товаров на кнопке.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Catalog.tsx frontend/src/components/catalog/FiltersSheet.tsx
git commit -m "refactor(catalog): extract filters sheet into FiltersSheet component"
```

---

## Task 5: Верстка фасет-строк в FiltersSheet (свёрнутое состояние)

**Цель:** заменить debug-заглушку на три строки фасет: «Цена», «Бренд» (условно), «Категории». Без раскрытия, без активных пилюль — просто строки с названиями и стрелками.

**Files:**
- Modify: `frontend/src/components/catalog/FiltersSheet.tsx`

- [ ] **Step 1: Заменить body debug-заглушку на реальные фасеты**

В `FiltersSheet.tsx` в JSX заменить блок `<div className="zen-filters-panel-body">...[DEBUG]...</div>` на:

```tsx
<div className="zen-filters-panel-body">
  {showPriceFilter && (
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
```

- [ ] **Step 2: Добавить CSS-классы фасет-строки в `index.css`**

В `frontend/src/index.css` найти место после последнего `.zen-filters-panel-*` блока (примерно после `.zen-filters-panel--closing` или между правилами фильтров). Добавить:

```css
.zen-filters-facet {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-width: 0;
  flex-wrap: wrap;
}
.zen-filters-facet:last-child {
  border-bottom: none;
}
.zen-filters-facet--open {
  background: var(--surface-elevated);
}
.zen-filters-facet-name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
  min-width: 96px;
  flex-shrink: 0;
}
.zen-filters-facet-values {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
  align-items: center;
}
.zen-filters-facet-empty {
  font-size: 13px;
  color: var(--muted);
  opacity: 0.7;
}
.zen-filters-facet-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  max-width: 100%;
}
.zen-filters-facet-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.zen-filters-facet-chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.zen-filters-facet-chip-x:hover {
  color: var(--text);
}
.zen-filters-facet-arrow {
  margin-left: auto;
  font-size: 10px;
  color: var(--muted);
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  flex-shrink: 0;
}
.zen-filters-facet--open .zen-filters-facet-arrow {
  transform: rotate(90deg);
}
.zen-filters-facet-expanded {
  padding: 10px 4px 18px;
  background: var(--surface-elevated);
  border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 3: Визуальная проверка**

Run: `cd frontend && npm run dev`
Expected: в открытой шторке три строки фасет со словом «все» справа и стрелкой «▸». Секция «Бренд» появляется только если в каталоге 2+ разных `brand`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx frontend/src/index.css
git commit -m "feat(catalog): add collapsed facet rows to FiltersSheet"
```

---

## Task 6: Раскрытие фасет (inline-аккордеон) + слайдер цены

**Цель:** кликом по фасет-строке раскрываем секцию. Сначала делаем «Цена» — со слайдером, input-полями и сортировкой.

**Files:**
- Modify: `frontend/src/components/catalog/FiltersSheet.tsx`

- [ ] **Step 1: Добавить state для раскрытых секций**

В начало функции `FiltersSheet` (после `useState<DraftFiltersValue>`) добавить:

```tsx
const [openSections, setOpenSections] = useState<{ price: boolean; brand: boolean; categories: boolean }>({
  price: false,
  brand: false,
  categories: false,
});

const toggleSection = (key: "price" | "brand" | "categories") => {
  setOpenSections((s) => ({ ...s, [key]: !s[key] }));
};
```

При каждом открытии шторки — сбрасываем в закрытое состояние:

В существующем `useEffect` с `if (open) { setDraft(...) }` (Task 3) добавить после `setDraft(...)`:

```tsx
setOpenSections({ price: false, brand: false, categories: false });
```

- [ ] **Step 2: Вынести refs для слайдера цены в компонент**

В начале `FiltersSheet` (рядом с `draftRef`):

```tsx
const priceSliderTrackRef = useRef<HTMLDivElement>(null);
const sliderActiveThumbRef = useRef<"min" | "max" | null>(null);
```

- [ ] **Step 3: Вычисления для слайдера**

После `count`:

```tsx
const { catalogPriceMin, catalogPriceMax } = props;
const priceRange = catalogPriceMax - catalogPriceMin || 1;
const priceMinNum = Math.max(
  catalogPriceMin,
  Math.min(catalogPriceMax, Number(draft.priceMin.trim()) || catalogPriceMin)
);
const priceMaxNum = Math.min(
  catalogPriceMax,
  Math.max(catalogPriceMin, Number(draft.priceMax.trim()) || catalogPriceMax)
);
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
    setDraft((d) => ({ ...d, priceMin: String(Math.max(catalogPriceMin, newMin)) }));
  } else if (thumb === "max") {
    const newMax = Math.max(value, priceMinNum + 1);
    setDraft((d) => ({ ...d, priceMax: String(Math.min(catalogPriceMax, newMax)) }));
  }
};
```

- [ ] **Step 4: Touch-handling слайдера через useEffect**

После блока выше:

```tsx
useEffect(() => {
  const track = priceSliderTrackRef.current;
  if (!track || !open || !openSections.price) return;
  const onTouchMove = (e: TouchEvent) => {
    if (sliderActiveThumbRef.current && e.touches.length > 0) {
      e.preventDefault();
      handlePriceSliderTrack(e.touches[0].clientX);
    }
  };
  const onTouchEnd = () => {
    sliderActiveThumbRef.current = null;
  };
  const onTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!track.contains(target)) return;
    const clientX = e.touches[0].clientX;
    if (target.closest(".zen-filters-price-slider-thumb--min")) {
      sliderActiveThumbRef.current = "min";
    } else if (target.closest(".zen-filters-price-slider-thumb--max")) {
      sliderActiveThumbRef.current = "max";
    } else {
      const rect = track.getBoundingClientRect();
      const trackLeft = rect.left + SLIDER_PAD;
      const trackWidth = rect.width - SLIDER_PAD * 2;
      const pos = trackWidth > 0 ? (clientX - trackLeft) / trackWidth : 0;
      const toMin = Math.abs(pos - priceMinPercent / 100);
      const toMax = Math.abs(pos - priceMaxPercent / 100);
      sliderActiveThumbRef.current = toMin <= toMax ? "min" : "max";
    }
    handlePriceSliderTrack(clientX);
    track.addEventListener("touchmove", onTouchMove, { passive: false });
    track.addEventListener("touchend", onTouchEnd);
    track.addEventListener("touchcancel", onTouchEnd);
  };
  track.addEventListener("touchstart", onTouchStart, { passive: true });
  return () => {
    track.removeEventListener("touchstart", onTouchStart);
    track.removeEventListener("touchmove", onTouchMove as EventListener);
    track.removeEventListener("touchend", onTouchEnd as EventListener);
    track.removeEventListener("touchcancel", onTouchEnd as EventListener);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, openSections.price, priceMinPercent, priceMaxPercent]);
```

- [ ] **Step 5: Обновить JSX фасеты «Цена»**

Заменить блок `{showPriceFilter && (<div className="zen-filters-facet">...)}` на:

```tsx
{showPriceFilter && (
  <>
    <div
      className={`zen-filters-facet ${openSections.price ? "zen-filters-facet--open" : ""}`}
      onClick={() => toggleSection("price")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection("price"); } }}
      aria-expanded={openSections.price}
    >
      <span className="zen-filters-facet-name">{t(lang, "priceFilter")}</span>
      <span className="zen-filters-facet-values">
        {(draft.priceMin.trim() !== "" || draft.priceMax.trim() !== "") ? (
          <span className="zen-filters-facet-chip">
            <span className="zen-filters-facet-chip-label">
              {draft.priceMin.trim() && draft.priceMax.trim()
                ? `${draft.priceMin} — ${draft.priceMax} ₽`
                : draft.priceMin.trim()
                  ? `от ${draft.priceMin} ₽`
                  : `до ${draft.priceMax} ₽`}
            </span>
            <button
              type="button"
              className="zen-filters-facet-chip-x"
              aria-label={t(lang, "close")}
              onClick={(e) => {
                e.stopPropagation();
                setDraft((d) => ({ ...d, priceMin: "", priceMax: "" }));
              }}
            >×</button>
          </span>
        ) : (
          <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>
        )}
      </span>
      <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
    </div>
    {openSections.price && (
      <div className="zen-filters-facet-expanded">
        <div className="zen-filters-price-block">
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
            onPointerLeave={() => { sliderActiveThumbRef.current = null; }}
          >
            <div className="zen-filters-price-slider-track" />
            <div
              className="zen-filters-price-slider-range"
              style={{
                left: `calc(14px + (100% - 28px) * ${priceMinPercent / 100})`,
                width: `calc((100% - 28px) * ${priceRangePercent / 100})`,
              }}
            />
            <div
              className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--min"
              style={{ left: `calc(14px + (100% - 28px) * ${priceMinPercent / 100})` }}
              onPointerDown={(e) => { e.stopPropagation(); sliderActiveThumbRef.current = "min"; priceSliderTrackRef.current?.setPointerCapture(e.pointerId); }}
            />
            <div
              className="zen-filters-price-slider-thumb zen-filters-price-slider-thumb--max"
              style={{ left: `calc(14px + (100% - 28px) * ${priceMaxPercent / 100})` }}
              onPointerDown={(e) => { e.stopPropagation(); sliderActiveThumbRef.current = "max"; priceSliderTrackRef.current?.setPointerCapture(e.pointerId); }}
            />
          </div>
          <div className="zen-filters-price-slider-labels">
            <span>{priceMinNum}</span>
            <span>{priceMaxNum}</span>
          </div>
          <div className="zen-filters-price-sort-row">
            <div className="zen-filters-sort-segmented" role="group" aria-label={t(lang, "priceFilter")}>
              <button
                type="button"
                className={`zen-filters-sort-btn ${draft.priceSort === "asc" ? "zen-filters-sort-btn-active" : ""}`}
                onClick={() => setDraft((d) => ({ ...d, priceSort: d.priceSort === "asc" ? "none" : "asc" }))}
                title={t(lang, "sortPriceAsc")}
                aria-pressed={draft.priceSort === "asc"}
              >
                <span className="zen-filters-sort-icon" aria-hidden>↑</span>
                <span className="zen-filters-sort-text">{t(lang, "sortAscShort")}</span>
              </button>
              <button
                type="button"
                className={`zen-filters-sort-btn ${draft.priceSort === "desc" ? "zen-filters-sort-btn-active" : ""}`}
                onClick={() => setDraft((d) => ({ ...d, priceSort: d.priceSort === "desc" ? "none" : "desc" }))}
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
```

- [ ] **Step 6: Проверка типов и ручная проверка**

Run: `cd frontend && npx tsc --noEmit` → без ошибок.

Run: `cd frontend && npm run dev`
Expected: тап по «Цене» — раскрывается слайдер и кнопки сортировки. Таскаем ручки — активная пилюля «X — Y ₽» появляется справа от названия секции. «×» на пилюле сбрасывает цену, не раскрывая секцию.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx
git commit -m "feat(catalog): expand price facet with slider and sort in FiltersSheet"
```

---

## Task 7: Секции «Бренд» и «Категории»

**Files:**
- Modify: `frontend/src/components/catalog/FiltersSheet.tsx`

- [ ] **Step 1: Добавить секцию «Бренд»**

Заменить блок `{props.uniqueBrands.length >= 2 && ...}` на:

```tsx
{props.uniqueBrands.length >= 2 && (
  <>
    <div
      className={`zen-filters-facet ${openSections.brand ? "zen-filters-facet--open" : ""}`}
      onClick={() => toggleSection("brand")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection("brand"); } }}
      aria-expanded={openSections.brand}
    >
      <span className="zen-filters-facet-name">{t(lang, "brand")}</span>
      <span className="zen-filters-facet-values">
        {draft.brand !== "all" ? (
          <span className="zen-filters-facet-chip">
            <span className="zen-filters-facet-chip-label">{draft.brand}</span>
            <button
              type="button"
              className="zen-filters-facet-chip-x"
              aria-label={t(lang, "close")}
              onClick={(e) => {
                e.stopPropagation();
                setDraft((d) => ({ ...d, brand: "all" }));
              }}
            >×</button>
          </span>
        ) : (
          <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>
        )}
      </span>
      <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
    </div>
    {openSections.brand && (
      <div className="zen-filters-facet-expanded">
        <div className="zen-filters-chip-row-wrap">
          <div className="zen-filters-chip-row">
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
        </div>
      </div>
    )}
  </>
)}
```

- [ ] **Step 2: Добавить секцию «Категории»**

Заменить существующий блок категорий на:

```tsx
<div
  className={`zen-filters-facet ${openSections.categories ? "zen-filters-facet--open" : ""}`}
  onClick={() => toggleSection("categories")}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection("categories"); } }}
  aria-expanded={openSections.categories}
>
  <span className="zen-filters-facet-name">{t(lang, "categories")}</span>
  <span className="zen-filters-facet-values">
    {(() => {
      const selectedLabels = props.categoryTabs
        .filter((c) => c.code !== "all" && draft.categories.has(c.code))
        .map((c) => c);
      if (selectedLabels.length === 0 || draft.categories.has("all")) {
        return <span className="zen-filters-facet-empty">{t(lang, "filtersAllValue")}</span>;
      }
      return selectedLabels.map((c) => (
        <span key={c.code} className="zen-filters-facet-chip">
          <span className="zen-filters-facet-chip-label">{c.label}</span>
          <button
            type="button"
            className="zen-filters-facet-chip-x"
            aria-label={t(lang, "close")}
            onClick={(e) => {
              e.stopPropagation();
              setDraft((d) => {
                const next = new Set(d.categories);
                next.delete(c.code);
                if (next.size === 0) next.add("all");
                return { ...d, categories: next };
              });
            }}
          >×</button>
        </span>
      ));
    })()}
  </span>
  <span className="zen-filters-facet-arrow" aria-hidden>▸</span>
</div>
{openSections.categories && (
  <div className="zen-filters-facet-expanded">
    <div className="zen-filters-chip-row-wrap">
      <div className="zen-filters-chip-row">
        {props.categoryTabs.map(({ code, label }) => {
          const isSelected = code === "all"
            ? draft.categories.has("all")
            : draft.categories.has(code);
          return (
            <button
              key={code}
              type="button"
              className={`zen-filters-chip ${isSelected ? "zen-filters-chip-active" : ""}`}
              onClick={() => {
                setDraft((d) => {
                  if (code === "all") {
                    return { ...d, categories: new Set(["all"]) };
                  }
                  const next = new Set(d.categories);
                  next.delete("all");
                  if (next.has(code)) next.delete(code);
                  else next.add(code);
                  if (next.size === 0) next.add("all");
                  return { ...d, categories: next };
                });
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Ручная проверка**

Run: `cd frontend && npm run dev`
Expected:
- Если в каталоге ≥ 2 брендов — секция «Бренд» видна. Выбор бренда из списка показывает пилюлю в строке фасеты. «×» на пилюле возвращает «все».
- Категории — multi-select, пилюли появляются по одной на каждую выбранную. «×» удаляет одну; если удалили все — возвращается «all».

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx
git commit -m "feat(catalog): add brand and categories facets to FiltersSheet"
```

---

## Task 8: Футер — кнопка «Показать N товаров» и «Сброс»

**Files:**
- Modify: `frontend/src/components/catalog/FiltersSheet.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Заменить debug-футер на финальный**

Заменить блок `<div className="zen-filters-panel-footer">...[DEBUG]...</div>` на:

```tsx
<div className="zen-filters-panel-footer">
  {hasAnyDraft && (
    <button
      type="button"
      className="zen-filters-footer-reset"
      onClick={() => {
        setDraft({
          priceMin: "",
          priceMax: "",
          priceSort: "none",
          brand: "all",
          categories: new Set(["all"]),
        });
      }}
    >
      {t(lang, "resetFilters")}
    </button>
  )}
  <button
    type="button"
    className={`zen-filters-footer-cta ${count === 0 ? "zen-filters-footer-cta--empty" : ""}`}
    onClick={commitAndClose}
  >
    {count === 0
      ? t(lang, "filtersNothingFound")
      : typeof t(lang, "filtersShowN") === "function"
        // @ts-expect-error плюрализация через функцию (см. Task 1)
        ? (t(lang, "filtersShowN") as (n: number) => string)(count)
        : (t(lang, "filtersShowN") as string).replace("{n}", String(count))}
  </button>
</div>
```

Перед этим блоком (в теле компонента, рядом с `count`) добавь:

```tsx
const hasAnyDraft =
  draft.priceMin.trim() !== "" ||
  draft.priceMax.trim() !== "" ||
  draft.priceSort !== "none" ||
  draft.brand !== "all" ||
  (!draft.categories.has("all") && draft.categories.size > 0);
```

**Важно про i18n:** если в Task 1 ты выбрал строковый вариант `filtersShowN`, то блок выше упростится — убери проверку `typeof ... === "function"` и всегда используй `.replace("{n}", String(count))`. Если выбрал функциональный — оставь только функцию. НЕ оставляй оба варианта — выбери один и удали другой.

- [ ] **Step 2: Добавить CSS футера**

В `frontend/src/index.css` найти существующий блок `.zen-filters-panel-footer` (около строки 1566). Заменить его тело и добавить новые классы:

```css
.zen-filters-panel-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px max(20px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
.zen-filters-footer-reset {
  flex: 0 0 auto;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.zen-filters-footer-reset:hover {
  color: var(--text);
}
.zen-filters-footer-cta {
  flex: 1;
  min-height: 48px;
  padding: 14px 20px;
  border: none;
  border-radius: 999px;
  background: var(--text);
  color: var(--surface);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.zen-filters-footer-cta:active {
  transform: scale(0.98);
}
.zen-filters-footer-cta--empty {
  opacity: 0.55;
}
```

- [ ] **Step 3: Удалить устаревшие CSS-классы**

В том же `index.css` удалить (полностью, включая `@keyframes`, к которым эти классы относятся, если они не используются где-то ещё — проверь `grep`):

- `.zen-filters-panel-summary`
- `.zen-filters-panel-summary-count`
- `.zen-filters-panel-summary-tags`
- `.zen-filters-panel-summary-tag`, `:hover`, `:active`
- `.zen-filters-panel-section`, `--accordion`, `:last-child`, head, title, count, chevron, content (все старые аккордеон-правила — строки 1219–1240 и 1466–1510)
- `.zen-filters-reset-btn`, `:hover`
- `.zen-filters-panel-collapse-wrap`
- `.zen-filters-panel-close-arrow`, `:hover`, `:active`, ` svg`

Перед удалением — `grep` по проекту на каждый класс, чтобы убедиться, что он не используется в других местах. Если используется — удалять нельзя, просто оставь как есть.

- [ ] **Step 4: Проверка типов и ручная проверка**

Run: `cd frontend && npx tsc --noEmit` → без ошибок.

Run: `cd frontend && npm run dev`
Expected:
- В пустом состоянии фильтров: видна только большая чёрная кнопка «Показать N товаров».
- После выбора любого фильтра: слева появляется текстовая кнопка «Сбросить всё».
- Клик «Сбросить всё» — draft очищается, шторка остаётся открытой, кнопка «Сбросить всё» снова исчезает.
- Если после всех фильтров N=0 — кнопка показывает «Ничего не найдено», полупрозрачная, но кликабельная; тап применит draft и закроет шторку.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx frontend/src/index.css
git commit -m "feat(catalog): add Show-N CTA and conditional reset button to FiltersSheet"
```

---

## Task 9: Drag-to-close шторки

**Files:**
- Modify: `frontend/src/components/catalog/FiltersSheet.tsx`

- [ ] **Step 1: Добавить state и ref для drag**

В начале `FiltersSheet`:

```tsx
const [panelDragY, setPanelDragY] = useState(0);
const panelDragYRef = useRef(0);
const touchStartYRef = useRef(0);
const touchStartTimeRef = useRef(0);
const dragHandleRef = useRef<HTMLDivElement>(null);
```

Синхронизация ref:

```tsx
useEffect(() => { panelDragYRef.current = panelDragY; }, [panelDragY]);
useEffect(() => { if (!open) setPanelDragY(0); }, [open]);
```

- [ ] **Step 2: Touch-обработчики drag-handle через useEffect**

```tsx
useEffect(() => {
  const handle = dragHandleRef.current;
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
    if (dy > 60 || velocity > 0.3) commitAndClose();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);
```

- [ ] **Step 3: Привязать ref к header**

В JSX заменить:

```tsx
<div className="zen-filters-panel-header">
```

на:

```tsx
<div
  ref={dragHandleRef}
  className="zen-filters-panel-header zen-filters-panel-drag-handle"
>
```

Также добавить `transform` и `style` к панели, чтобы учитывать drag (только пока не идёт анимация закрытия):

```tsx
<div
  className={`zen-filters-panel ${closing ? "zen-filters-panel--closing" : ""}`}
  role="dialog"
  aria-label={t(lang, "filters")}
  onAnimationEnd={onAnimationEnd}
  style={!closing && panelDragY > 0 ? { transform: `translateY(${-panelDragY}px)` } : undefined}
>
```

**Внимание:** в спеке ранее указано `translateY(${panelDragY}px)` — это работало для шторки сверху? Проверь логику: панель выезжает сверху (animation `filtersPanelSlideFromTop`), значит свайп ВНИЗ должен увеличивать видимость, а свайп ВВЕРХ — закрывать. В текущем коде (`Catalog.tsx:614`) используется `translateY(${panelDragY}px)` БЕЗ минуса. Посмотри, как вела себя старая шторка — свайп вверх её закрывает? Тогда `-panelDragY`. Сохраняй поведение старой версии. Если не уверен — замени на `translateY(${-Math.min(panelDragY, 200)}px)` и протестируй вручную: свайп вверх за header должен закрывать шторку.

- [ ] **Step 4: Ручная проверка**

Run: `cd frontend && npm run dev`
Expected: свайп по заголовку вверх закрывает шторку (применяет draft). Без тач-устройства — можно проверить в DevTools mobile emulator.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx
git commit -m "feat(catalog): add drag-to-close to FiltersSheet"
```

---

## Task 10: Финальная очистка Catalog.tsx и удаление мёртвых импортов

**Files:**
- Modify: `frontend/src/pages/Catalog.tsx`

- [ ] **Step 1: Удалить `resetAllFilters`**

Эта функция больше не вызывается (сброс теперь внутри шторки). Удалить.

- [ ] **Step 2: Проверить неиспользуемые импорты и useState**

Открой `Catalog.tsx` и просмотри импорты и первый блок с `useState`. Всё, что связано с старой шторкой (состояния `sectionOpen`, чего-либо ещё пропущенного из Task 4) — удалить.

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок и без warnings про неиспользуемые символы (если линт настроен).

Run: `cd frontend && npx eslint src/pages/Catalog.tsx` (если eslint настроен)
Expected: нет ошибок.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Catalog.tsx
git commit -m "refactor(catalog): drop dead filter-sheet code from Catalog"
```

---

## Task 11: Ручное тестирование по сценариям спека

Запусти `cd frontend && npm run dev`, открой каталог, и пройди все сценарии из раздела "Тестирование" спека:

- [ ] **1. Открытие шторки** — draft = applied, счётчик N корректный.
- [ ] **2. Изменение цены слайдером** — кнопка «Показать N» обновляется; каталог под шторкой НЕ меняется.
- [ ] **3. Тап «Показать N»** — шторка закрывается, каталог показывает N товаров.
- [ ] **4. Тап «✕»** — draft применяется. (Примечание: сейчас в шторке ✕ отсутствует, закрытие через overlay/Escape/свайп/кнопку CTA. Если пользователь просил конкретный ✕ — добавь крестик в заголовок шторки маленькой задачей 11b.)
- [ ] **5. Свайп вниз/вверх за drag-handle** — draft применяется.
- [ ] **6. Тап по фону** — draft применяется.
- [ ] **7. Escape** — draft применяется.
- [ ] **8. Тап «Сброс»** — все чипы сброшены, N = общему, «Сброс» исчезает, шторка не закрылась.
- [ ] **9. Тап «×» в активной пилюле фасета** — сбрасывается это значение, секция не раскрылась.
- [ ] **10. Тап в пустую область строки фасеты** — раскрылась секция.
- [ ] **11. Тап по уже раскрытой строке** — свернулась.
- [ ] **12. 0 товаров с brand** — секция «Бренд» не видна.
- [ ] **13. 1 бренд** — секция «Бренд» не видна. (Проверь через админку: создай/отредактируй товары так, чтобы у одного был brand, у остальных — нет; потом сделай ещё один другой brand — секция появится.)
- [ ] **14. 2+ бренда** — секция «Бренд» видна, выбор бренда фильтрует каталог.
- [ ] **15. N = 0** — кнопка «Ничего не найдено», полупрозрачная, но кликабельная.
- [ ] **16. RU/EN переключение** — все надписи локализованы.
- [ ] **17. Drag-handle** — свайп вверх закрывает (как раньше).

Если какой-то сценарий не работает — исправь и запиши коммит `fix(catalog): ...`.

---

## Task 12: Финальный коммит-чек + PR-description

- [ ] **Step 1: Проверка git-статуса**

Run: `git status`
Expected: clean working tree.

Run: `git log --oneline main...HEAD` (или `--since` с датой начала работы)
Expected: аккуратная цепочка коммитов: `feat(i18n): ...`, `feat(catalog): add FiltersSheet types`, `feat(catalog): scaffold ...`, `refactor(catalog): extract ...`, `feat(catalog): add collapsed facet rows ...`, `feat(catalog): expand price facet ...`, `feat(catalog): add brand and categories facets ...`, `feat(catalog): add Show-N CTA ...`, `feat(catalog): add drag-to-close ...`, `refactor(catalog): drop dead ...`, + возможно фиксы после ручного тестирования.

- [ ] **Step 2: Проверка, что старые классы CSS не всплывают нигде в JSX**

Run: `grep -rn "zen-filters-panel-summary\|zen-filters-panel-close-arrow\|zen-filters-panel-collapse-wrap\|zen-filters-panel-section-chevron\|zen-filters-panel-section--accordion\|zen-filters-reset-btn" frontend/src/`
Expected: никаких совпадений.

- [ ] **Step 3: Финальный sanity-build**

Run: `cd frontend && npm run build`
Expected: успешная сборка без ошибок и без новых warnings (допустимы те, что были до задачи).

---

## Self-Review

Проверил план против спека:

1. **Spec coverage:**
   - Inline-аккордеон (D1) → Task 6/7.
   - Inline пилюли в фасете (C) → Task 6/7.
   - Секция «Бренд» при 2+ брендах → Task 5 (рендер условен), Task 7 (наполнение).
   - F2 («Показать N» с commit) → Task 3 (draft + commitAndClose), Task 8 (кнопка).
   - X2 (любое закрытие = применить) → Task 3 (overlay, Escape), Task 9 (свайп).
   - Вынос в `FiltersSheet.tsx` → Task 2–4.
   - Локализация ключей → Task 1.
   - CSS: новые классы → Task 5, Task 8; удаление устаревших → Task 8.
   - Сохранение слайдера, чипов, сегментед-сорта → Task 6, Task 7 используют существующие классы.
   - Drag-to-close → Task 9.

2. **Placeholder scan:** Все шаги содержат конкретный код. Есть условная конструкция «если i18n словарь строковый — используй replace, если функциональный — функцию» — это не TBD, а явное разветвление на основе результата Task 1. Окей.

3. **Type consistency:**
   - `DraftFiltersValue` (Task 2) — используется в Task 3 (`useState<DraftFiltersValue>`), Task 4 (`handleApplyFilters(draft: DraftFiltersValue)`), Task 6/7/8 (setDraft).
   - `FiltersSheetProps` — импорт в Task 3, props передаются в Task 4.
   - `PriceSort` — используется в types и в `appliedPriceSort: PriceSort`.

Всё консистентно.

---

## Execution Handoff

План сохранён в `docs/superpowers/plans/2026-04-19-catalog-filters-redesign.md`. Два способа исполнения:

1. **Subagent-Driven (рекомендуется)** — на каждую задачу дёргаем свежего субагента, между задачами делаем code review, быстрая итерация.
2. **Inline Execution** — выполняю задачи сам в текущей сессии через `superpowers:executing-plans`, batch с чекпойнтами.

Какой подход?
