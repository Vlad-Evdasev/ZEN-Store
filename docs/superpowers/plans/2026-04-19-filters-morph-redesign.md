# Filters v2 — Morph-редизайн фильтров каталога. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить текущий bottom-sheet фильтров на плавающую карточку, раскрывающуюся из-под поля поиска с morph-анимацией, с полностью переработанным внутренним содержимым (без аккордеонов, range-slider с плавающими подписями, wrap-чипы, одна sticky-кнопка «Показать N», «Сбросить» в углу).

**Architecture:** Компонент `FiltersSheet.tsx` полностью переписывается внутри, но его публичный API (`FiltersSheetProps`, `DraftFiltersValue`) не меняется — это сохраняет совместимость с `Catalog.tsx` и `StoreCatalog.tsx`. Стили в `index.css` частично удаляются (аккордеон-строки, инпуты цены, segmented-сортировка), частично переделываются (панель, оверлей, слайдер, чипы), частично добавляются (новые секции, плавающие подписи, круглые кнопки сортировки, морф иконки фильтра). Анимации — через CSS keyframes на `transform` + `opacity`, без изменения `height`, чтобы работало на GPU и не дёргало layout.

**Tech Stack:** React 18 + TypeScript (существующий стек проекта), чистый CSS (`index.css`), никаких новых зависимостей. Vite + React dev-server (`npm run dev` в `frontend/`).

**Spec:** `docs/superpowers/specs/2026-04-19-filters-morph-redesign-design.md`

---

## Общие правила для исполнителя

- **Никаких новых зависимостей.** Анимации на CSS keyframes, pointer/touch — vanilla React.
- **Публичный API `FiltersSheet` не трогаем.** Пропсы в `FiltersSheet.types.ts` остаются как есть. Только реализация внутри `FiltersSheet.tsx` меняется.
- **Совместимость:** после каждого шага и `Catalog.tsx`, и `StoreCatalog.tsx` должны продолжать работать (оба рендерят тот же `FiltersSheet`).
- **Никаких автоматических тестов в этом репо нет** для этих компонентов. Верификация — визуальная: `npm run dev` и проверка в браузере (см. задачу 11).
- **Коммиты маленькие и часто.** Каждая задача — один коммит.
- **Никаких `sed`/`awk`.** Только targeted правки через IDE-инструменты.

---

## File Structure

Затронутые файлы:

- **Modify:** `frontend/src/components/catalog/FiltersSheet.tsx` — полная переработка render-части, сохранение логики (drag-bar, pointer-слайдер, Esc, body-scroll-lock, countForDraft-мемо).
- **Modify:** `frontend/src/pages/Catalog.tsx` — только пара точечных изменений: передать состояние `open` в кнопку-иконку и добавить SVG-крестик внутрь неё.
- **Modify:** `frontend/src/index.css` — удалить старые `.zen-filters-facet*`, `.zen-filters-price-range-row`, `.zen-filters-price-label*`, `.zen-filters-price-input`, `.zen-filters-panel-input*`, `.zen-filters-sort-segmented/btn*`, `.zen-filters-chip-row*`, `.zen-filters-panel-header`, `.zen-filters-panel-title`, `.zen-filters-footer-cta`, `.zen-filters-reset-btn`. Переработать `.zen-filters-overlay`, `.zen-filters-panel`, `.zen-filters-panel-body`, `.zen-filters-panel-footer`, `.zen-filters-price-slider*`, `.zen-filters-chip(-active)`, `.zen-filters-panel-drag-handle/bar`, keyframes. Добавить `.zen-filters-reset-top`, `.zen-filters-section`, `.zen-filters-section-label`, `.zen-filters-divider`, `.zen-filters-price-bubbles`, `.zen-filters-price-bubble(--merged)`, `.zen-filters-sort-round`, `.zen-filters-sort-round-btn(--active)`, `.zen-filters-chip-wrap`, `.zen-filters-apply-btn(--disabled)`, `.zen-filter-icon-btn--open`, `.zen-filter-icon-btn-x`. Новые keyframes `zenFiltersPanelOpen/Close`, `zenFiltersOverlayIn/Out`, `zenFiltersStagger`, `zenFilterIconMorph`.
- **No changes:** `frontend/src/components/catalog/FiltersSheet.types.ts`, `frontend/src/pages/StoreCatalog.tsx` (автоматически получит новый вид).

---

## Task 1: Backup — зафиксировать текущее состояние чистым коммитом

**Files:**
- Modify: none (просто чекпоинт)

- [ ] **Step 1: Убедиться что рабочая копия чистая**

Run:
```bash
git status
```

Expected: `nothing to commit, working tree clean`.

Если не чистая — остановиться и спросить пользователя, что делать с незакоммиченными изменениями. Не продолжать.

- [ ] **Step 2: Создать ветку для работы**

Run:
```bash
git checkout -b filters-morph-redesign
```

Expected: `Switched to a new branch 'filters-morph-redesign'`.

- [ ] **Step 3: Убедиться что dev-сервер запускается**

Run (в отдельном терминале):
```bash
cd frontend && npm run dev
```

Expected: Vite печатает `Local: http://localhost:5173/` (или другой порт) без ошибок сборки.

Открыть в браузере, открыть каталог, убедиться что текущие фильтры открываются. Это baseline — чтобы потом сравнивать.

Оставить dev-сервер работающим на протяжении всего плана.

---

## Task 2: CSS — удалить устаревшие классы панели фильтров

Перед тем как добавлять новые стили, уберём то, что больше не нужно. Это облегчает навигацию в файле и предотвращает конфликты.

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Найти блок стилей фильтров**

В `frontend/src/index.css` найти строку с `.zen-filters-overlay {` (примерно строка 1181). От этой строки и примерно до `.zen-filters-chip-active:active` (~1654) идёт весь текущий CSS фильтров, плюс keyframes внутри этого блока.

- [ ] **Step 2: Удалить следующие CSS-селекторы целиком (вместе с их `{…}` блоками)**

Удалить из `frontend/src/index.css` все правила для этих селекторов (включая hover/active/focus/disabled варианты и комментарии к ним). Остальные селекторы фильтров остаются — их мы переработаем в следующих задачах.

Удалить:

- `.zen-filters-price-block`
- `.zen-filters-price-range-row`
- `.zen-filters-price-label`
- `.zen-filters-price-label-text`
- `.zen-filters-price-input` (и `:focus` вариант)
- `.zen-filters-price-sort-row`
- `.zen-filters-sort-segmented`
- `.zen-filters-sort-btn` (и `:hover`, `-active`, `-active:hover`)
- `.zen-filters-sort-icon`
- `.zen-filters-sort-text`
- `.zen-filters-panel-input` (и `::placeholder`, `:focus`)
- `.zen-filters-panel-input-sep`
- `.zen-filters-facet` (и `:last-child`, `--open`)
- `.zen-filters-facet-name`
- `.zen-filters-facet-values`
- `.zen-filters-facet-empty`
- `.zen-filters-facet-chip` (и `-label`, `-x`, `-x:hover`)
- `.zen-filters-facet-arrow` (и `.zen-filters-facet--open .zen-filters-facet-arrow`)
- `.zen-filters-facet-expanded`
- `.zen-filters-panel-header`
- `.zen-filters-panel-title` (включая `.zen-app .zen-filters-panel-title`)
- `.zen-filters-price-slider-labels`
- `.zen-filters-footer-cta` (и `:active`, `:disabled`, `[aria-disabled="true"]`)
- `.zen-filters-reset-btn` (и `:hover`)
- `.zen-filters-chip-row-wrap` (и `::after`)
- `.zen-filters-chip-row` (и `::-webkit-scrollbar`)

- [ ] **Step 3: Удалить устаревшие keyframes внутри блока фильтров**

Удалить keyframes:
- `@keyframes filtersOverlayFade`
- `@keyframes filtersOverlayFadeOut`
- `@keyframes filtersPanelSlideFromTop`
- `@keyframes filtersPanelSlideUp`

(Все четыре keyframes расположены в блоке между строками ~1349 и ~1591, вперемешку с селекторами. Ищи по имени.)

- [ ] **Step 4: Проверить что dev-сервер не упал**

Dev-сервер должен пересобраться. Откроется страница каталога — скорее всего сейчас панель фильтров уже сломана (нет стилей), это нормально для этого промежуточного шага. Главное — **нет синтаксических ошибок CSS** в консоли Vite и браузера.

Открыть DevTools → Console. Expected: нет ошибок парсинга CSS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "refactor(filters): remove obsolete CSS for old filters panel"
```

---

## Task 3: CSS — новая геометрия панели (плавающая карточка + backdrop blur)

Теперь переделываем оставшиеся классы — `.zen-filters-overlay`, `.zen-filters-panel`, `.zen-filters-panel-body`, `.zen-filters-panel-footer`, `.zen-filters-panel-drag-handle`, `.zen-filters-panel-drag-bar` — и добавляем новые keyframes `zenFiltersOverlayIn/Out`, `zenFiltersPanelOpen/Close`.

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Заменить `.zen-filters-overlay`**

Найти оставшееся правило `.zen-filters-overlay { … }` и заменить его блок целиком на:

```css
.zen-filters-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 100;
  opacity: 0;
  animation: zenFiltersOverlayIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@supports not ((backdrop-filter: blur(0)) or (-webkit-backdrop-filter: blur(0))) {
  .zen-filters-overlay {
    background: rgba(255, 255, 255, 0.6);
  }
}
.zen-filters-overlay--closing {
  animation: zenFiltersOverlayOut 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

Убрать старое `.zen-filters-overlay--closing` правило если оно осталось отдельно — оно заменено выше.

- [ ] **Step 2: Заменить `.zen-filters-panel` и `.zen-filters-panel--closing`**

Найти `.zen-filters-panel { … }` и `.zen-filters-panel--closing { … }`. Заменить их блоки целиком на:

```css
.zen-filters-panel {
  position: fixed;
  left: 16px;
  right: 16px;
  top: calc(max(16px, env(safe-area-inset-top)) + 56px + 8px);
  bottom: max(20px, env(safe-area-inset-bottom));
  background: var(--surface);
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  z-index: 101;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform-origin: top center;
  transform: scaleY(0.92);
  opacity: 0;
  animation: zenFiltersPanelOpen 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  touch-action: pan-y;
  transition: transform 0.15s ease-out;
  max-height: calc(100vh - calc(max(16px, env(safe-area-inset-top)) + 56px + 8px) - max(20px, env(safe-area-inset-bottom)));
  max-height: calc(100dvh - calc(max(16px, env(safe-area-inset-top)) + 56px + 8px) - max(20px, env(safe-area-inset-bottom)));
}
.zen-filters-panel--closing {
  animation: zenFiltersPanelClose 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

Замечание: `56px` — высота поисковой пилюли `.zen-catalog-search-row`. Как проверить: в DevTools выбрать этот элемент, в `Computed` посмотреть `height`. В текущем CSS (файл `index.css`, правило `.zen-app .zen-catalog-search-row`) заложена высота через `padding` и высоту input. Если окажется другое число — просто обнови `56px` здесь на актуальное. На больших экранах (tablet / portrait) высота может отличаться; если да — дополни правило media-query в Task 10.

- [ ] **Step 3: Заменить `.zen-filters-panel-body`**

```css
.zen-filters-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 8px 20px 20px;
  position: relative;
}
```

- [ ] **Step 4: Заменить `.zen-filters-panel-footer`**

```css
.zen-filters-panel-footer {
  flex: 0 0 auto;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid transparent;
  transition: border-color 0.18s ease;
}
.zen-filters-panel-body.is-scrolled ~ .zen-filters-panel-footer,
.zen-filters-panel--scrollable .zen-filters-panel-footer {
  border-top-color: #EEE;
}
```

(Условный hairline над футером — проще всего через модификатор `.zen-filters-panel--scrollable`, который мы будем устанавливать из React-компонента в Task 6 при необходимости. Если это окажется сложно — можно оставить hairline всегда, это не страшно.)

- [ ] **Step 5: Заменить `.zen-filters-panel-drag-handle` и `.zen-filters-panel-drag-bar`**

```css
.zen-filters-panel-drag-handle {
  flex: 0 0 auto;
  width: 100%;
  padding: 10px 0 12px;
  display: flex;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  position: relative;
}
.zen-filters-panel-drag-handle:active {
  cursor: grabbing;
}
.zen-filters-panel-drag-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.15);
}
```

- [ ] **Step 6: Добавить новые keyframes (в конец блока фильтров)**

Сразу после последнего правила фильтров, до следующего тематического блока CSS, добавить:

```css
@keyframes zenFiltersOverlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes zenFiltersOverlayOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes zenFiltersPanelOpen {
  from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
  to { opacity: 1; transform: scaleY(1) translateY(0); }
}
@keyframes zenFiltersPanelClose {
  from { opacity: 1; transform: scaleY(1) translateY(0); }
  to { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
}
```

- [ ] **Step 7: Проверить сборку и визуал**

В браузере:
- Открыть каталог.
- Нажать на иконку фильтра.
- Панель должна открыться как **плавающая карточка** под поисковым полем, с отступами от краёв экрана, скруглениями со всех 4 сторон, лёгкой тенью, размытым фоном позади. Анимация раскрытия сверху вниз.
- Внутри панели сейчас — старая разметка из `FiltersSheet.tsx`, будет выглядеть неряшливо (аккордеонные строки без стилей). Это ожидаемо, починим в задачах 5–8.

Главное — новая геометрия и анимация работают.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(filters): new floating panel geometry with backdrop blur"
```

---

## Task 4: CSS — иконка фильтра морфится в ×

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Добавить стили для морфа иконки**

Найти в CSS правило `.zen-app .zen-catalog-search-row .zen-filter-icon-btn svg` (~строка 1127). Сразу после блока правил для `.zen-filter-icon-btn` (включая `-dot` и fallback в конце) добавить:

```css
.zen-app .zen-catalog-search-row .zen-filter-icon-btn {
  position: relative;
}
.zen-app .zen-catalog-search-row .zen-filter-icon-btn svg,
.zen-app .zen-catalog-search-row .zen-filter-icon-btn .zen-filter-icon-btn-x {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.zen-app .zen-catalog-search-row .zen-filter-icon-btn .zen-filter-icon-btn-x {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%) rotate(-180deg);
  opacity: 0;
  pointer-events: none;
  color: #111;
  stroke: currentColor;
  stroke-width: 1.5;
  fill: none;
}
.zen-app .zen-catalog-search-row .zen-filter-icon-btn--open svg.zen-filter-icon-main {
  opacity: 0;
  transform: rotate(180deg);
}
.zen-app .zen-catalog-search-row .zen-filter-icon-btn--open .zen-filter-icon-btn-x {
  opacity: 1;
  transform: translate(-50%, -50%) rotate(0deg);
}
```

Замечание: существующая `<FilterIcon />` рендерит `<svg>`. Чтобы её можно было target'ить через селектор `svg.zen-filter-icon-main`, мы обернём её в SVG с классом в Task 5.

- [ ] **Step 2: Проверить**

Пока что в браузере ничего не должно поменяться — мы добавили стили, но React ещё не рендерит крестик и не ставит класс `--open`. Проверяем только что dev-сервер не упал и нет ошибок CSS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(filters): add CSS for filter icon morph to cross"
```

---

## Task 5: React — кнопка фильтра в поиске рендерит крестик и получает класс --open

**Files:**
- Modify: `frontend/src/pages/Catalog.tsx`

- [ ] **Step 1: Открыть `Catalog.tsx` и найти кнопку фильтра**

Файл: `frontend/src/pages/Catalog.tsx`, секция JSX примерно со строки 380:

```tsx
{showPriceFilter && (
  <button
    ref={filterButtonRef}
    type="button"
    className={`zen-filter-icon-btn ${hasActiveFilters ? "zen-filter-icon-btn--active" : ""}`}
    onClick={() => setFiltersOpen(true)}
    aria-label={t(lang, "filters")}
    title={t(lang, "filters")}
  >
    <FilterIcon />
    {hasActiveFilters && (
      <span className="zen-filter-icon-btn-dot" aria-hidden />
    )}
  </button>
)}
```

- [ ] **Step 2: Заменить содержимое кнопки на версию с морфом**

Заменить этот `<button>` целиком на:

```tsx
{showPriceFilter && (
  <button
    ref={filterButtonRef}
    type="button"
    className={`zen-filter-icon-btn ${hasActiveFilters ? "zen-filter-icon-btn--active" : ""} ${(filtersOpen && !filtersClosing) ? "zen-filter-icon-btn--open" : ""}`}
    onClick={() => {
      if (filtersOpen && !filtersClosing) {
        closeFilters();
      } else {
        setFiltersOpen(true);
      }
    }}
    aria-label={t(lang, "filters")}
    aria-expanded={filtersOpen && !filtersClosing}
    title={t(lang, "filters")}
  >
    <span className="zen-filter-icon-main" aria-hidden>
      <FilterIcon />
    </span>
    <svg
      className="zen-filter-icon-btn-x"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <path d="M4 4 L12 12 M12 4 L4 12" strokeLinecap="round" />
    </svg>
    {hasActiveFilters && (
      <span className="zen-filter-icon-btn-dot" aria-hidden />
    )}
  </button>
)}
```

Замечание: обёртка `<span className="zen-filter-icon-main">` позволяет стилям из Task 4 таргетиться на `svg.zen-filter-icon-main` — но теперь у нас `span.zen-filter-icon-main`, это нужно подправить в CSS. См. Step 3.

- [ ] **Step 3: Поправить CSS-селектор иконки в `frontend/src/index.css`**

Ранее в Task 4 мы писали `svg.zen-filter-icon-main`, но оборачиваем в `<span>`, т.к. `<FilterIcon />` сам по себе `<svg>` — проще ставить класс на обёртку, чем на сам SVG. Заменить селекторы:

Было:
```css
.zen-app .zen-catalog-search-row .zen-filter-icon-btn--open svg.zen-filter-icon-main {
```

Стало:
```css
.zen-app .zen-catalog-search-row .zen-filter-icon-btn--open .zen-filter-icon-main {
```

Также добавить поддержку transition/transform на `.zen-filter-icon-main`:

Было:
```css
.zen-app .zen-catalog-search-row .zen-filter-icon-btn svg,
.zen-app .zen-catalog-search-row .zen-filter-icon-btn .zen-filter-icon-btn-x {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

Стало:
```css
.zen-app .zen-catalog-search-row .zen-filter-icon-btn .zen-filter-icon-main,
.zen-app .zen-catalog-search-row .zen-filter-icon-btn .zen-filter-icon-btn-x {
  transition: opacity 0.2s ease, transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 4: Проверить в браузере**

- Открыть каталог.
- Тап на иконку фильтра: иконка фильтра должна плавно исчезнуть и повернуться, вместо неё появится × (тоже с вращением). Длительность ~200ms.
- Тап на × должен закрывать панель (обратный морф). Сейчас это вызывает `closeFilters()`, который запускает existing close-анимацию (с нашими новыми keyframes она тоже будет играть).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Catalog.tsx frontend/src/index.css
git commit -m "feat(filters): morph filter icon to cross when panel is open"
```

---

## Task 6: React — новая внутренняя структура FiltersSheet (без аккордеонов)

Это самая большая задача. Переписываем render-часть `FiltersSheet.tsx`. Логика (pointer-слайдер, drag-bar, Esc, body-scroll, `countForDraft`) — сохраняется, меняется только JSX.

**Files:**
- Modify: `frontend/src/components/catalog/FiltersSheet.tsx`

- [ ] **Step 1: Удалить `sectionOpen` state и всё что с ним связано**

В `FiltersSheet.tsx` найти и удалить:

```tsx
const [sectionOpen, setSectionOpen] = useState({ price: false, brand: false, categories: false });
```

Также внутри `useEffect` (который сбрасывает draft при `open`) удалить строку:
```tsx
setSectionOpen({ price: false, brand: false, categories: false });
```

- [ ] **Step 2: Заменить весь JSX `return (…)` блок**

Найти `return (` в конце компонента и заменить всё от `<>` до финальной `</>` на следующее:

```tsx
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
              min={catalogPriceMin}
              max={catalogPriceMax}
              draftMin={draft.priceMin}
              draftMax={draft.priceMax}
              onChangeMin={(v) => setDraft((d) => ({ ...d, priceMin: v }))}
              onChangeMax={(v) => setDraft((d) => ({ ...d, priceMax: v }))}
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
```

- [ ] **Step 3: Добавить вычисление `hasAnyActiveDraft` рядом с другими вычислениями**

Найти в `FiltersSheet.tsx` секцию где вычисляются `priceHasActive`, `brandHasActive`, `categoriesHasActive` (примерно строки 89-125). Под ними добавить:

```tsx
const hasAnyActiveDraft = priceHasActive || brandHasActive || categoriesHasActive;
```

- [ ] **Step 4: Вынести `PriceSlider` в отдельный компонент в том же файле**

В начале файла `FiltersSheet.tsx`, после импортов и до `export function FiltersSheet`, добавить:

```tsx
import type { MutableRefObject, RefObject } from "react";

interface PriceSliderProps {
  min: number;
  max: number;
  draftMin: string;
  draftMax: string;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
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
            style={{ left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${(p.priceMinPercent + p.priceMaxPercent) / 200})` }}
          >
            {currencyFormat(p.priceMinNum)} – {currencyFormat(p.priceMaxNum)}
          </span>
        ) : (
          <>
            <span
              className="zen-filters-price-bubble"
              style={{ left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMinPercent / 100})` }}
            >
              {currencyFormat(p.priceMinNum)}
            </span>
            <span
              className="zen-filters-price-bubble"
              style={{ left: `calc(${p.SLIDER_PAD}px + (100% - ${p.SLIDER_PAD * 2}px) * ${p.priceMaxPercent / 100})` }}
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
```

Замечание: `activeThumbRef` в исходном коде — `useRef<"min" | "max" | null>(null)`, его тип — `MutableRefObject<"min" | "max" | null>`. `.current` можно присваивать напрямую. `trackRef` же — `RefObject<HTMLDivElement>` (readonly `.current`), его мы только читаем — всё ок.

- [ ] **Step 5: Убедиться что все ранее использовавшиеся computed-значения, которые я выносил в PriceSlider (priceMinPercent, priceMaxPercent, priceRangePercent, priceMinNum, priceMaxNum, SLIDER_PAD), остаются в теле `FiltersSheet`**

Они уже там (см. строки 36–58 оригинала). Ничего дополнительно делать не нужно — просто передаём их в `<PriceSlider>` как пропсы.

- [ ] **Step 6: Проверить TypeScript**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

Если ошибка с типом `RefObject<… | null>` — заменить `RefObject<"min" | "max" | null>` на `React.MutableRefObject<"min" | "max" | null>` в интерфейсе `PriceSliderProps` (и соответственно импорт).

- [ ] **Step 7: Проверить в браузере**

- Открыть каталог → тап на иконку фильтра.
- Панель открывается плавающей карточкой.
- Внутри: секция «Цена» со слайдером и двумя круглыми кнопками под ним; затем «Категории» с чипами; затем «Бренд» (если есть). Никаких аккордеонов, всё видно сразу.
- В углу справа — «Сбросить» (появляется только если есть активные фильтры — пока что их нет; чтобы проверить, выбери категорию → «Сбросить» появится).
- Внизу — одна большая чёрная кнопка «Показать N товаров».
- Кнопка × работает, drag-bar работает, backdrop-тап работает.

Визуал может быть ещё не идеальным — чипы и слайдер стилизуются старыми CSS-правилами. Поправим в Task 7.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/catalog/FiltersSheet.tsx
git commit -m "feat(filters): rewrite FiltersSheet internal structure (no accordions)"
```

---

## Task 7: CSS — стили новых секций, чипов, слайдера с плавающими подписями, круглых кнопок

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Заменить `.zen-filters-price-slider`, `-track`, `-range`, `-thumb` на новые версии**

Найти текущие правила и заменить блоки:

```css
.zen-filters-price-slider {
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  margin: 0 -14px;
  touch-action: none;
  user-select: none;
}
.zen-filters-price-slider-track {
  position: absolute;
  left: 14px;
  right: 14px;
  height: 2px;
  background: #EEE;
  border-radius: 1px;
}
.zen-filters-price-slider-range {
  position: absolute;
  height: 2px;
  background: #111;
  border-radius: 1px;
  pointer-events: none;
}
.zen-filters-price-slider-thumb {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #FFF;
  border: 1px solid #E4E4E4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transform: translateX(-50%);
  cursor: grab;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}
/* Невидимая hit-area вокруг thumb'а для удобного тапа (44×44 итого). */
.zen-filters-price-slider-thumb::before {
  content: "";
  position: absolute;
  inset: -11px;
  border-radius: 50%;
}
/* Haptic-ring при нажатии thumb'а. */
.zen-filters-price-slider-thumb::after {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  opacity: 0;
  transition: opacity 0.14s ease;
  pointer-events: none;
}
.zen-filters-price-slider-thumb:active {
  transform: translateX(-50%) scale(1.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  cursor: grabbing;
}
.zen-filters-price-slider-thumb:active::after {
  opacity: 1;
}
```

- [ ] **Step 2: Добавить стили для плавающих подписей цены**

В том же блоке фильтров добавить:

```css
.zen-filters-price-bubbles {
  position: relative;
  height: 22px;
  margin-bottom: 4px;
}
.zen-filters-price-bubble {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 600;
  color: #111;
  white-space: nowrap;
  line-height: 22px;
  transition: left 0.08s linear;
}
.zen-filters-price-bubble--merged {
  font-size: 13px;
}
```

- [ ] **Step 3: Добавить стили секций и divider**

```css
.zen-filters-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 0;
  opacity: 0;
  transform: translateY(8px);
  animation: zenFiltersStagger 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.zen-filters-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8A8A8A;
}
.zen-filters-divider {
  height: 1px;
  background: #EEE;
  margin: 0;
}
@keyframes zenFiltersStagger {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: Добавить стили круглых кнопок сортировки**

```css
.zen-filters-sort-round {
  display: flex;
  justify-content: center;
  gap: 12px;
}
.zen-filters-sort-round-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #E4E4E4;
  background: #FFF;
  color: #111;
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
  padding: 0;
}
.zen-filters-sort-round-btn:active {
  transform: scale(0.92);
}
.zen-filters-sort-round-btn--active {
  background: #111;
  color: #FFF;
  border-color: #111;
}
```

- [ ] **Step 5: Переработать `.zen-filters-chip` и `-active` + добавить `.zen-filters-chip-wrap`**

Заменить существующие `.zen-filters-chip`, `.zen-filters-chip:hover`, `.zen-filters-chip:active`, `.zen-filters-chip-active`, `.zen-filters-chip-active:hover`, `.zen-filters-chip-active:active` на:

```css
.zen-filters-chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.zen-filters-chip {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #E4E4E4;
  background: #FFF;
  color: #111;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.08s cubic-bezier(0.34, 1.56, 0.64, 1);
  white-space: nowrap;
}
.zen-filters-chip:active {
  transform: scale(0.96);
}
.zen-filters-chip-active {
  background: #111;
  color: #FFF;
  border-color: #111;
}
```

- [ ] **Step 6: Добавить стили «Сбросить» в углу**

```css
.zen-filters-reset-top {
  position: absolute;
  top: 12px;
  right: 20px;
  background: transparent;
  border: none;
  padding: 4px 6px;
  font-size: 13px;
  color: #8A8A8A;
  cursor: pointer;
  z-index: 2;
  animation: zenFiltersStagger 0.16s ease forwards;
}
.zen-filters-reset-top:active {
  color: #111;
  text-decoration: underline;
}
```

Замечание: `.zen-filters-reset-top` позиционируется абсолютно в `.zen-filters-panel` (который сам `overflow: hidden`). Чтобы он перекрывал drag-handle, ставим `z-index: 2`. drag-handle займёт центр, reset — правый угол.

- [ ] **Step 7: Добавить стили кнопки «Показать N»**

```css
.zen-filters-apply-btn {
  width: 100%;
  height: 52px;
  border-radius: 999px;
  border: none;
  background: #111;
  color: #FFF;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.12s ease, background-color 0.18s ease, color 0.18s ease;
}
.zen-filters-apply-btn:active {
  transform: scale(0.98);
}
.zen-filters-apply-btn--disabled,
.zen-filters-apply-btn:disabled {
  background: #E4E4E4;
  color: #8A8A8A;
  cursor: not-allowed;
  transform: none;
}
```

- [ ] **Step 8: Добавить также стили для `.zen-filters-price-block`**

(Нужно потому что мы удалили этот класс в Task 2 Step 2, но используем его в Task 6 Step 4 как обёртку в PriceSlider.)

```css
.zen-filters-price-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
```

- [ ] **Step 9: Визуальная проверка**

- Открыть каталог → фильтры.
- Секция «Цена»:
  - Над слайдером две подписи с ценами в ₽, двигаются вместе с thumb'ами.
  - Когда thumb'ы сближаются — подписи превращаются в одну «от – до».
  - Под слайдером две круглые кнопки ↑ / ↓ по центру.
- Секция «Категории»: wrap-чипы, чёрный активный, белый с границей неактивный. Нажатие чипа — лёгкий scale и переключение цвета.
- Секция «Бренд» (если есть): аналогично.
- Разделители между секциями.
- «Сбросить» в правом верхнем углу, появляется при выборе чего-либо.
- «Показать N товаров» — большая чёрная pill-кнопка внизу.
- Нет горизонтального скролла внутри панели.
- Stagger: при открытии секции появляются с небольшим каскадом.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(filters): style new sections, chips, slider bubbles, round sort buttons"
```

---

## Task 8: React — добавить класс `is-scrolled` / `zen-filters-panel--scrollable` для hairline футера (опционально)

В Task 3 Step 4 мы завели CSS, который показывает hairline над футером только когда контент скроллится. Сейчас класс нигде не ставится — значит hairline не появится. Это не критично для MVP, но правильно решить сразу. Самый простой путь — просто оставить hairline всегда (он едва заметный), удалив условный селектор.

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Упростить CSS футера**

В правиле `.zen-filters-panel-footer` (из Task 3 Step 4) заменить `border-top: 1px solid transparent;` на `border-top: 1px solid #EEE;` и удалить условный селектор ниже:

Было:
```css
.zen-filters-panel-footer {
  flex: 0 0 auto;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid transparent;
  transition: border-color 0.18s ease;
}
.zen-filters-panel-body.is-scrolled ~ .zen-filters-panel-footer,
.zen-filters-panel--scrollable .zen-filters-panel-footer {
  border-top-color: #EEE;
}
```

Стало:
```css
.zen-filters-panel-footer {
  flex: 0 0 auto;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #EEE;
}
```

- [ ] **Step 2: Проверка**

Визуально: над кнопкой «Показать N» появилась тонкая линия-разделитель `#EEE`. Это ожидаемо.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "style(filters): always show hairline above apply button"
```

---

## Task 9: Проверка совместимости — StoreCatalog.tsx

`StoreCatalog.tsx` рендерит тот же `FiltersSheet` компонент. Нужно просто убедиться что там всё работает.

**Files:**
- No changes (только верификация)

- [ ] **Step 1: Открыть Store-каталог в приложении**

Навигация: главная → карточка магазина (карточка в StoresCarousel или Landing) → список товаров магазина. Тап на иконку фильтра.

- [ ] **Step 2: Проверить**

- Панель открывается так же — плавающая карточка с backdrop blur.
- Все секции работают, счётчик «Показать N» обновляется.
- Закрытие тремя способами работает.

- [ ] **Step 3: Если есть проблема с позицией панели (top несовпадает с поисковым полем)**

В `.zen-filters-panel` (из Task 3 Step 2) значение `top: calc(max(16px, env(safe-area-inset-top)) + 56px + 8px)` подбиралось на глаз. В Store-каталоге может быть другой отступ сверху (заголовок магазина, back-button). Проверить в DevTools → Inspect на элементе `.zen-catalog-search-row`: посмотреть его `offsetTop + offsetHeight + 8px`. Если не совпадает с тем что заложено — обновить `top` в CSS, либо сделать его переменной и задавать inline-стилем из компонента.

Если совпадает — ничего не делаем.

- [ ] **Step 4: Commit (только если был fix top)**

```bash
git add frontend/src/index.css
git commit -m "fix(filters): correct panel top offset for StoreCatalog"
```

Если правок не было — задача закрыта без коммита.

---

## Task 10: Проверка на разных устройствах и mobile-WebView fallback

**Files:**
- Modify: `frontend/src/index.css` (возможно, если fallback не играет)

- [ ] **Step 1: Mobile viewport в DevTools**

В Chrome DevTools переключиться на эмуляцию iPhone 12 / Pixel 5. Открыть каталог, нажать фильтр.

Expected: панель помещается в экран, скролл внутри `zen-filters-panel-body` работает пальцем (тач-эмуляция).

- [ ] **Step 2: Проверить fallback без backdrop-filter**

В DevTools DOM-инспекторе: найти `.zen-filters-overlay`, через `Rendering` отключить `backdrop-filter` (или в `Styles` добавить временно `backdrop-filter: none !important`). Фон должен стать более плотно-белым (`rgba(255, 255, 255, 0.6)`), панель всё равно читается.

Если не стал белее — значит `@supports not (…)` не сработал. Вариант fallback: вместо `@supports not`, просто выставить `rgba(255, 255, 255, 0.35)` как основу и `backdrop-filter` как улучшение. Перепроверить синтаксис `@supports` в Task 3 Step 1.

- [ ] **Step 3: Проверить touch-events: драг слайдера и свайп панели**

В эмуляторе мобильного:
- Драг thumb'а слайдера — страница не должна скроллиться вместе с ним.
- Свайп вниз по drag-bar — панель закрывается.
- Свайп внутри `.zen-filters-panel-body` по чипам — скроллит контент панели, не закрывает её.

Если что-то не так — проверить `touch-action: none` на `.zen-filters-price-slider` и `.zen-filters-panel-drag-handle`, `touch-action: pan-y` на `.zen-filters-panel`. Они уже заданы, но на всякий случай.

- [ ] **Step 4: Commit (только если были fix'ы)**

```bash
git add frontend/src/index.css
git commit -m "fix(filters): mobile touch and backdrop fallback"
```

---

## Task 11: Финальная визуальная верификация (чеклист из spec'а)

**Files:**
- No changes

- [ ] **Шаг 1: Пройтись по чеклисту тестирования из spec'а**

Из `docs/superpowers/specs/2026-04-19-filters-morph-redesign-design.md`, раздел «Тестирование»:

1. **Открытие панели:** тап на иконку фильтра → плавный morph, иконка → ×, backdrop блюр. ✓
2. **Stagger:** секции появляются с каскадом (замедлить анимации в DevTools `Ctrl+Shift+P` → `Animations: 10x slower` для проверки). ✓
3. **Range-slider:** оба thumb'а двигаются, плавающие подписи следуют, при сближении — сливаются. ✓
4. **Сортировка:** тап по ↑ делает её активной; тап снова — снимает; выбор ↓ снимает ↑ и наоборот. ✓
5. **Чипы:** выбор/снятие, spring-scale, логика «Все» (взаимоисключение). ✓
6. **Счётчик:** «Показать N» обновляется live; при 0 — кнопка disabled «Ничего не найдено». ✓
7. **Сброс:** «Сбросить» в углу появляется когда есть активные, тап — сбрасывает. ✓
8. **Закрытие тремя способами:** × / тап по backdrop / свайп вниз по drag-bar → все работают, draft применяется. ✓
9. **Применение:** тап по «Показать N» → каталог перестраивается. ✓
10. **Совместимость:** Catalog без бренда (нет секции «Бренд»), StoreCatalog (новый вид). ✓

- [ ] **Шаг 2: Просмотр финального diff**

Run:
```bash
git diff main..HEAD --stat
```

Expected: изменения только в `frontend/src/components/catalog/FiltersSheet.tsx`, `frontend/src/pages/Catalog.tsx`, `frontend/src/index.css`.

Run:
```bash
git diff main..HEAD -- frontend/src/components/catalog/FiltersSheet.types.ts frontend/src/pages/StoreCatalog.tsx
```

Expected: пустой diff (мы не трогали эти файлы).

- [ ] **Шаг 3: TypeScript и lint**

Run:
```bash
cd frontend && npx tsc --noEmit && npm run lint 2>/dev/null || npx tsc --noEmit
```

Expected: no errors. Если `npm run lint` не настроен, просто `tsc --noEmit` ок.

- [ ] **Шаг 4: Final commit (если были мелкие правки)**

Если в процессе верификации пришлось что-то поменять — закоммитить:
```bash
git add -A && git commit -m "fix(filters): final polish after visual verification"
```

Если ничего не менялось — пропустить.

---

## Self-Review (уже выполнен автором плана)

**1. Spec coverage:**
- Morph анимация поле → панель → Task 3 (CSS), Task 5 (React для иконки), Task 6 (контент). ✓
- Плавающая карточка с отступами + скругление 28px + тень → Task 3. ✓
- Backdrop blur + fallback → Task 3, Task 10. ✓
- Stagger детей → Task 7 Step 3 (keyframes), Task 6 (inline animationDelay на секциях). ✓
- Закрытие тремя способами → уже реализовано в существующем коде (drag-bar, overlay click, Esc) + новое: тап на × через onClick handler кнопки. ✓
- Drag-bar + «Сбросить» в углу, без заголовка → Task 6 Step 2. ✓
- Range-slider с плавающими подписями + слияние при сближении → Task 6 Step 4 (PriceSlider), Task 7 Step 2. ✓
- Круглые кнопки сортировки ↑/↓ → Task 6 Step 2, Task 7 Step 4. ✓
- Wrap-чипы категорий/брендов → Task 6 Step 2, Task 7 Step 5. ✓
- Sticky кнопка «Показать N» + disabled state → Task 6 Step 2, Task 7 Step 7. ✓
- Иконка фильтра морфится в × → Task 4, Task 5. ✓

**2. Placeholder scan:** Нет TBD/TODO/"implement later". Все code-блоки содержат конкретный код. ✓

**3. Type consistency:** `DraftFiltersValue`, `PriceSort`, `FiltersSheetProps` — не меняем. Новый `PriceSliderProps` определён в Task 6 Step 4 и использует те же типы, что есть в компоненте. ✓

---

## Execution Handoff

План готов. Сохранён в `docs/superpowers/plans/2026-04-19-filters-morph-redesign.md`.

Два варианта исполнения:

1. **Subagent-Driven (рекомендуется)** — я диспатчу свежего субагента на каждую задачу, между задачами делаю ревью, быстрая итерация.
2. **Inline Execution** — выполнить задачи в этой же сессии через `executing-plans`, батч-исполнение с чекпоинтами.

Какой подход выбираешь?
