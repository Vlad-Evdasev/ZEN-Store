# Filters v2 — Morph-редизайн фильтров каталога

Дата: 2026-04-19
Область: `frontend/src/components/catalog/FiltersSheet.tsx`, `frontend/src/index.css`, `frontend/src/pages/Catalog.tsx`

## Проблема

Текущая панель фильтров (см. прошлый spec `2026-04-19-catalog-filters-redesign-design.md`) пользователю не нравится по двум причинам:

1. **Переход:** кнопка-иконка фильтра просто открывает bottom-sheet — механически, без визуальной связи с полем поиска. Хочется, чтобы «поле поиска красиво превращалось в фильтры».
2. **Внутренний вид:** аккордеонные строки «Цена все ▸ / Категории все ▸» выглядят как пункты меню, а не как современный фильтр. Функционал (инпуты от/до, шевроны) тоже перегружен.

Магазин — в zen-эстетике (минимализм, белый фон, чёрные акценты, мягкие скругления). Фильтры должны соответствовать.

## Решения (итоги брейншторма)

| # | Вопрос | Выбор |
|---|---|---|
| 1 | Как «превращается» поле поиска в фильтры | **Morph-трансформация** (поле → панель) |
| 2 | Геометрия панели | **Плавающая карточка с отступами** (все 4 угла скруглены, тень, не до края экрана) |
| 3 | Фон под панелью | **Backdrop blur** (размытие + лёгкая белая дымка) |
| 4 | Структура фильтров | **Всё сразу, без аккордеонов** |
| 5 | Фильтр «Цена» | **Range-slider + плавающие значения над thumb'ами + две круглые кнопки ↑/↓ для сортировки** (без инпутов) |
| 6 | Категории/бренды | **Wrap-чипы**: чёрный активный / белый с границей неактивный, scale-фидбек при тапе |
| 7 | Кнопки снизу | **B:** одна большая чёрная «Показать N» внизу; «Сбросить» — маленький текст в шапке |
| 8 | Шапка панели | **C:** без заголовка, только drag-bar + «Сбросить» в углу |

## Поведение и анимация

### Morph: поле поиска → панель

- **Триггер:** тап по круглой иконке фильтра справа в поисковой пилюле.
- **Иконка** плавно морфится в «×»: тот же круглый контейнер, содержимое — crossfade + rotate 180°, длительность 200ms, синхронно со стартом раскрытия панели.
- **Пилюля поиска остаётся на месте** как визуальный «якорь». Под ней «растёт» плавающая карточка:
  - Старт: `height: 0`, `opacity: 0`, `transform: scaleY(0.92)`, `transform-origin: top center`.
  - Финал: `height: auto` (ограничено `max-height: calc(100dvh - 160px)`), `opacity: 1`, `transform: scaleY(1)`.
  - Скругления: `border-radius: 28px` со всех четырёх сторон.
  - Тень: `0 20px 60px rgba(0, 0, 0, 0.12)`.
  - Фон: `#FFF`.
  - Отступы: горизонтальные как у поля поиска; нижний — `20px` от края экрана (или safe-area-bottom, что больше).
  - Длительность: **320ms**, easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo).
- **Backdrop (поверх каталога, под панелью):** `backdrop-filter: blur(12px)` + `background: rgba(255, 255, 255, 0.35)`. Fade-in/out параллельно с панелью. Fallback для WebView без поддержки `backdrop-filter`: плотный `rgba(255, 255, 255, 0.6)` без блюра.
- **Stagger содержимого:** каждый блок внутри панели (слайдер, сортировка, чипы) появляется с fade + translateY(8px → 0), задержка +40ms относительно предыдущего. Начинается через ~120ms после старта морфа (когда панель уже раскрылась ~60%).

### Закрытие

Три способа, все играют обратный morph-close (reverse от раскрытия, та же длительность и easing):

1. Тап по × (бывшая иконка фильтра).
2. Тап по размытому фону (backdrop).
3. Свайп вниз по drag-bar. Порог: смещение > 60px или velocity > 0.3. Во время drag'а панель следует за пальцем (`transform: translateY(${dy}px)`). Если порог не достигнут — возврат пружиной на место.

Все три способа **применяют текущий draft** через `onApply(draft)` перед закрытием (сохраняется существующее поведение `commitAndClose`). Отдельного «Отменить без применения» нет — это осознанное решение, т.к. фильтры применяются в едином shared state каталога и любое закрытие = коммит состояния. Единственный способ откатить — нажать «Сбросить».

Обратный морф: панель `scaleY(1 → 0.92)` + `opacity(1 → 0)`, backdrop fade-out, иконка × → FilterIcon (crossfade + rotate).

## Структура панели (сверху вниз)

```
┌─────────────────────────────────┐
│            ── drag-bar          │
│                       Сбросить  │  ← только если есть активные фильтры
│                                 │
│   ЦЕНА                          │
│   ₽1 200           ₽5 800       │  ← плавающие подписи над thumb'ами
│   ●━━━━━━━━━━━━━━━━━━━━━━━●     │  ← range slider
│                                 │
│            ↑     ↓              │  ← две круглые кнопки сортировки
│                                 │
│   ───────────────────────────   │  ← hairline divider
│                                 │
│   КАТЕГОРИИ                     │
│   [ Все ] [Свечи] [Мыло]        │  ← wrap-чипы
│   [Керамика] [Текстиль] …       │
│                                 │
│   ───────────────────────────   │
│                                 │
│   БРЕНД  (если uniqueBrands ≥ 2)│
│   [ Все ] [Brand A] [Brand B]   │
│                                 │
│   (scroll area, если не влезает)│
├─────────────────────────────────┤
│   [   Показать 23 товара   ]    │  ← sticky футер
└─────────────────────────────────┘
```

### Отступы и размеры

- Горизонтальный padding внутри панели: `20px`.
- Верхний padding (под drag-bar): `8px` до строки «Сбросить», далее `20px` до первой секции.
- Между секциями: `24px` сверху и снизу от `divider`.
- Между `label` секции и её контентом: `14px`.

### Типографика

- Секция-label (`ЦЕНА`, `КАТЕГОРИИ`, `БРЕНД`): `11px`, `font-weight: 600`, `letter-spacing: 0.12em`, `text-transform: uppercase`, `color: #8A8A8A`.
- Плавающие значения цены над thumb'ами: `13px`, `font-weight: 600`, `color: #111`.
- Текст в чипах: `14px`, `font-weight: 500`.
- Кнопка «Показать N»: `15px`, `font-weight: 600`.
- «Сбросить» в углу: `13px`, `color: #8A8A8A`, underline on active.

### Drag-bar

`36 × 4px`, `border-radius: 2px`, `background: rgba(0, 0, 0, 0.15)`, центрирована, `10px` сверху панели. Hit-area расширена невидимым padding'ом до `44px` высоты для удобного свайпа.

### «Сбросить» в углу

`13px`, `color: #8A8A8A`, позиция `position: absolute; top: 14px; right: 20px`. Появляется только если `hasActiveFilters === true` (fade-in 160ms). Тап сбрасывает draft к дефолту.

## Детали компонентов

### Range-slider цены

- Трек: высота `2px`, `background: #EEE`, `border-radius: 1px`.
- Активный сегмент (между thumb'ами): `background: #111`, та же высота.
- Thumb'ы: круглые `22px`, `background: #FFF`, `border: 1px solid #E4E4E4`, `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12)`.
- При нажатии thumb: `transform: scale(1.08)`, тень плотнее, вокруг появляется «haptic ring» — кольцо `24px`, `rgba(0, 0, 0, 0.06)`, без blur (визуальный feedback).
- Hit-area thumb'а: `44 × 44px` (невидимый padding), чтобы легко попадать пальцем.
- **Плавающие подписи** (`₽1 200` · `₽5 800`): позиционируются над thumb'ами, сдвигаются вместе с ними. Высота `22px`, фон нет (просто текст над треком). Когда расстояние между thumb'ами < 60px — подписи сливаются в одну «₽1 200 – ₽5 800», центрированную над активным сегментом (предотвращает наезд).

### Кнопки сортировки цены (↑ / ↓)

- Две круглые кнопки `36 × 36px`, расположены горизонтально по центру под слайдером, gap `12px`.
- Неактивные: `background: #FFF`, `border: 1px solid #E4E4E4`, стрелка чёрная.
- Активная: `background: #111`, стрелка белая, `border: 1px solid #111`.
- Взаимоисключающий выбор: можно выбрать только одну, повторный тап на активную — снимает (`priceSort: "none"`).
- Tap-анимация: `scale(0.92)` на 80ms, затем обратно к `1` со spring `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Подписей нет — направление стрелки + контекст секции «ЦЕНА» достаточны.

### Чипы (категории и бренды)

- Высота `34px`, `padding: 0 14px`, `border-radius: 999px`.
- Неактивный: `background: #FFF`, `border: 1px solid #E4E4E4`, `color: #111`.
- Активный: `background: #111`, `color: #FFF`, `border: 1px solid #111`.
- Gap в wrap-сетке: `8px` по обеим осям.
- Tap-анимация: `scale(0.96)` на 80ms, обратно к `1` со spring. Переход цветов: 180ms ease-out.
- Правила выбора (сохраняются из текущей логики):
  - Чип «Все» всегда первый.
  - Выбор «Все» снимает все остальные чипы группы (`Set(["all"])`).
  - Выбор конкретного чипа снимает «Все».
  - Снятие последнего конкретного чипа возвращает выбор к «Все».

### Footer с «Показать N»

- Sticky внизу панели, высота `68px` (с `padding: 16px 20px`).
- Сверху футера — hairline `1px #EEE`, появляется только если внутренний контент скроллится (иначе выглядит лишним).
- Кнопка: full-width (минус `20px` padding с боков), высота `52px`, `border-radius: 999px`, `background: #111`, `color: #FFF`, `font: 15px/600`.
- Текст: `Показать ${count} товаров` (через `countForDraft`, уже считается в live).
- Если `count === 0`: `background: #E4E4E4`, `color: #8A8A8A`, `disabled`, `cursor: not-allowed`, текст «Ничего не найдено».
- Tap: `scale(0.98)` на 120ms; затем `onApply(draft)` + `onClose()` → обратный morph.

### Иконка фильтра в поле поиска (морф в ×)

- До открытия: существующая `FilterIcon` в круглой кнопке.
- После открытия: crossfade + rotate 180° в SVG-крестик (`stroke-width: 1.5`, `color: #111`). Контейнер (`zen-filter-icon-btn`) не меняет размер/форму — ничего не прыгает.
- Состояние управляется классом `zen-filter-icon-btn--open` (добавляется когда `filtersOpen && !filtersClosing`).
- Длительность: 200ms.

## Архитектура кода

### Затронутые файлы

1. **`frontend/src/components/catalog/FiltersSheet.tsx`** — полная переработка внутренней разметки:
   - Удаляются: `sectionOpen` state, `zen-filters-facet*` структура, инпуты цены, шевроны, секционные тоглы.
   - Добавляются: секции (label + контент сразу), новый layout чипов, абсолютно спозиционированный «Сбросить» в углу, новый футер с одной кнопкой.
   - Сохраняется: drag-bar и свайп-вниз логика (`filtersDragHandleRef`, touch handlers), range-slider pointer-логика (`handlePriceSliderTrack`, `sliderActiveThumbRef`), keydown Esc, body `overflow: hidden`, `countForDraft` через мемо.
   - **Публичный API (`FiltersSheetProps`) не меняется** — совместимость с `Catalog.tsx` и `StoreCatalog.tsx`.

2. **`frontend/src/components/catalog/FiltersSheet.types.ts`** — без изменений.

3. **`frontend/src/pages/Catalog.tsx`** — минимальные правки:
   - Добавить класс `zen-filter-icon-btn--open` к кнопке фильтра, когда `filtersOpen && !filtersClosing`.
   - Добавить внутрь `zen-filter-icon-btn` SVG-крестик как второй элемент (наряду с `FilterIcon`); морф через opacity + rotate по классу состояния.
   - Всё остальное (пропсы, логика) — без изменений.
   - `StoreCatalog.tsx` использует тот же `FiltersSheet` и автоматически получит новый вид.

4. **`frontend/src/index.css`** — основной объём работы:
   - **Удалить:** `.zen-filters-facet`, `.zen-filters-facet--open`, `.zen-filters-facet-name`, `.zen-filters-facet-values`, `.zen-filters-facet-chip`, `.zen-filters-facet-chip-label`, `.zen-filters-facet-chip-x`, `.zen-filters-facet-empty`, `.zen-filters-facet-arrow`, `.zen-filters-facet-expanded`, `.zen-filters-panel-input`, `.zen-filters-panel-input-sep`, `.zen-filters-price-input`, `.zen-filters-price-label`, `.zen-filters-price-label-text`, `.zen-filters-price-range-row`, `.zen-filters-sort-segmented`, `.zen-filters-sort-btn`, `.zen-filters-sort-btn-active`, `.zen-filters-sort-icon`, `.zen-filters-sort-text`, `.zen-filters-panel-title`, `.zen-filters-reset-btn`, `.zen-filters-footer-cta`, `.zen-filters-panel-header`.
   - **Переработать:** `.zen-filters-overlay` (добавить `backdrop-filter: blur(12px)` + белая дымка, fallback без blur), `.zen-filters-panel` (новая геометрия: плавающая карточка с отступами, `border-radius: 28px` со всех сторон, тень, `transform-origin: top center`), `.zen-filters-panel-drag-handle` + `.zen-filters-panel-drag-bar`, `.zen-filters-price-slider*` (плавающие подписи вместо инпутов), `.zen-filters-chip*` (новые размеры/поведение), `.zen-filters-panel-body`, `.zen-filters-panel-footer`.
   - **Добавить:** `.zen-filters-reset-top`, `.zen-filters-section`, `.zen-filters-section-label`, `.zen-filters-divider`, `.zen-filters-price-bubbles`, `.zen-filters-price-bubble`, `.zen-filters-price-bubble--merged`, `.zen-filters-sort-round`, `.zen-filters-sort-round-btn`, `.zen-filters-sort-round-btn--active`, `.zen-filters-chip-wrap`, `.zen-filters-apply-btn`, `.zen-filters-apply-btn--disabled`, `.zen-filter-icon-btn--open`, `.zen-filter-icon-btn-x` (SVG-крестик внутри кнопки).
   - **Keyframe'ы:** `zenFiltersPanelOpen` / `zenFiltersPanelClose` (scaleY + opacity + translateY), `zenFiltersOverlayIn` / `zenFiltersOverlayOut` (opacity + backdrop-filter), `zenFiltersStagger` (fade + translateY для детей), `zenFilterIconMorph` (rotate + crossfade).

### Как morph-open работает технически

Ключевая идея — панель **не появляется снизу**, а **раскрывается сверху** от поисковой пилюли, создавая визуальное ощущение «поле → панель».

- `.zen-filters-panel` позиционируется `position: fixed`, `top: <высота поиска + отступ>`, `left/right: 16px` (те же бока что у пилюли поиска), `bottom: 20px`.
- При старте анимации: `transform-origin: top center`, `transform: scaleY(0.92)`, `opacity: 0`.
- При завершении: `transform: scaleY(1)`, `opacity: 1`.
- `max-height: calc(100dvh - <top> - 20px)`, `overflow-y: auto` внутри `zen-filters-panel-body`.
- Stagger-анимация детей запускается через CSS `animation-delay` по селекторам `.zen-filters-section:nth-child(n)`.

### Риски и fallback'и

- **`backdrop-filter` на Android WebView (Telegram):** может не поддерживаться. Fallback: проверка через `@supports (backdrop-filter: blur(0))` — при отсутствии поддержки `.zen-filters-overlay` получает более плотный `rgba(255, 255, 255, 0.6)` без блюра.
- **`dvh` vs `vh`:** на старых WebView `dvh` может не работать. Используем `dvh` с fallback на `vh` (`max-height: calc(100vh - 160px); max-height: calc(100dvh - 160px)`).
- **Morph-анимация высоты:** использовать `scaleY` + `opacity`, НЕ `height`, чтобы анимация была на GPU и не триггерила layout.
- **Stagger детей не должен аффектить layout:** строго `transform: translateY` + `opacity`, никаких изменений `height`/`margin`.
- **Pointer-events range-slider'а:** сохраняем существующую логику, но надо проверить что `touch-action: none` установлено на треке, чтобы страница не скроллилась при драге thumb.

## Тестирование

Ручное (компонент визуальный, завязан на touch/pointer events):

1. **Открытие панели:** тап на иконку фильтра → плавный morph, иконка → ×, backdrop блюр.
2. **Stagger:** секции появляются с каскадом (можно замедлить анимации в DevTools для проверки).
3. **Range-slider:** оба thumb'а двигаются, плавающие подписи следуют, при сближении — сливаются в один bubble.
4. **Сортировка:** тап по ↑ делает её активной; тап снова — снимает; выбор ↓ снимает ↑ и наоборот.
5. **Чипы категорий/брендов:** выбор/снятие, spring-scale, логика «Все» (взаимоисключение).
6. **Счётчик:** «Показать N» обновляется live при каждом изменении draft'а; при 0 — кнопка disabled «Ничего не найдено».
7. **Сброс:** «Сбросить» в углу появляется когда есть активные, тап — сбрасывает draft, «Сбросить» fade-out.
8. **Закрытие:**
   - Тап по × (бывшей иконке фильтра) → обратный morph + применение draft'а.
   - Тап по backdrop → то же.
   - Свайп вниз по drag-bar с порогом → то же.
9. **Применение:** тап по «Показать N» → применение draft'а, обратный morph, каталог перестраивается.
10. **Совместимость:**
    - `Catalog.tsx` (без бренда) — секция «Бренд» не отображается (`uniqueBrands.length >= 2` false).
    - `StoreCatalog.tsx` — панель работает так же, с теми же анимациями.
11. **Android WebView Telegram (если доступно):** проверить fallback без `backdrop-filter`.

## Вне scope'а

- Изменение логики `countForDraft` — сохраняется как есть.
- Изменение API `FiltersSheetProps` или `DraftFiltersValue` — сохраняется.
- Изменение поведения поиска (`search` state) — не трогаем.
- Добавление новых фильтров (цвет, размер и т.п.) — не в этом spec'е.
- Хранение фильтров в URL — не в этом spec'е.
