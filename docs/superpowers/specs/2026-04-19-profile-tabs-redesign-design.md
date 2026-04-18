# Redesign: Profile / History / Settings / Reviews

**Date:** 2026-04-19
**Scope:** Frontend only (no backend API changes)
**Style direction:** Soft Card Stack — тёплый кремовый фон, белые карточки с радиусом 12–16 px, тонкие бордеры `var(--border)`, градиентный бордовый аватар, pill-кнопки.

## Цели

1. Обновить визуальный язык страниц **Профиль**, **История**, **Настройки**, **Отзывы** в современном стиле, сохраняя бренд приложения (тёплая палитра, бордовый accent `var(--accent)`, Proxima Nova + Unbounded).
2. Убрать кнопку «Вернуться в каталог» со всех 4 страниц.
3. Везде отображать существующий нижний бар `BottomNavBar` (каталог / custom-заказ / вдохновиться / «arrivals»).

## Общие правила (для всех 4 страниц)

- Удалить `<BackButton />` со страниц `Profile`, `History`, `Settings`, `Reviews`.
- Хедер приложения остаётся без изменений (бургер / монограмма `R` / вешалка / коробка).
- На этих 4 страницах всегда виден `BottomNavBar`. В роутинге App.tsx: для этих экранов рендерим bottom nav так же, как на `Catalog` / `CustomOrderPage` / `NewArrivalsPage`. Клик по «каталог» = переход в каталог (заменяет кнопку «Вернуться в каталог»).
- Обёртка страниц: `maxWidth: 420, margin: "0 auto", paddingTop: 8, paddingBottom: 80` (чтобы контент не залезал под nav).
- Общие токены (использовать существующие CSS-переменные):
  - `--bg`, `--surface`, `--surface-elevated`, `--border`, `--text`, `--muted`, `--accent`, `--accent-hover`, `--radius-md`, `--radius-lg`.
  - Градиент аватара: `linear-gradient(135deg, var(--accent), var(--accent-dim))`.
  - Тень карточки: `0 1px 3px rgba(0,0,0,0.04)`.

## 1. Профиль (`frontend/src/pages/Profile.tsx`)

**Вариант:** сконденсированный C (Activity Feed), без табов.

### Структура

1. **Hero-блок** (по центру, column, gap 6):
   - Аватар 64×64 в градиентной обводке 2.5 px (внешний круг — градиент, внутренний — `--bg` с инициалом).
   - `h2` — `firstName` (Unbounded / Proxima 600, 18 px).
   - Серый sub — `@{userName}` (12 px, `--muted`). Без числа заказов.
2. **Секция «Последние заказы»**
   - Лейбл-kicker (11 px, uppercase, `--muted`).
   - Список из последних 3 заказов (берём из `getOrders(userId)`): карточка-строка `flex`:
     - thumb 44×44 (превью первого товара из `order.items`).
     - Колонка: название товара (13 px, 600) + мета «Заказан · {относительная дата}» (11 px, `--muted`).
     - Справа сумма `order.total` (13 px, 700, `--accent`).
   - Клик по карточке → `setView("history")` (открыть полную историю).
   - Если заказов нет — секция скрыта.
3. **Секция «Избранное»**
   - Лейбл-kicker «Избранное».
   - Горизонтальный скролл из 3–5 thumbnail 56×56 из `favorites`. Клик → `setView("product", productId)`.
   - Пусто → текст «Лайкни что-нибудь, чтобы оно появилось здесь» (12 px, `--muted`, центр).
4. **Секция «Действия»**
   - Три карточки-строки в колонке, gap 10:
     - `📋 Условия доставки` → `onOpenDeliveryTerms`.
     - `💬 Поддержка` + badge `supportUnreadCount` (если > 0).
     - `⚙︎ Настройки` → `setView("settings")`.
   - Вид: белая карточка 14 px padding, радиус 14, тонкий бордер. Иконка 32×32 в «коробочке» `rgba(accent, 0.08)` со скруглением 10. Chevron `›` справа.

### Что меняется в коде

- Удалить `BackButton` + prop `onBack` (остаётся для обратной совместимости API компонента, но не рендерится; можно удалить).
- Добавить `recentOrders: Order[]` и `favorites: Product[]` props (либо получать внутри через те же хуки, как на Catalog/Favorites).
- Удалить блоки «О магазине» и «Поддержка» (текстовый блок) — они заменяются секцией «Действия».

## 2. История (`frontend/src/pages/History.tsx`)

**Вариант:** A (Stepper Timeline).

### Структура

1. Заголовок `h1` «История» (22 px, 700).
2. Pill-переключатель фильтров (replace текущий dropdown):
   - `Все · N` (активный по умолчанию), `В пути`, `Готово`.
   - Кнопка 10 px × 16 px padding, border-radius 999, шрифт 12 px. Активная: `background: var(--accent); color: #fff`. Неактивная: `background: var(--surface); border: 1px solid var(--border); color: var(--muted)`.
   - Фильтры маппятся на статусы как сейчас: `В пути` = `pending` + `in_transit`, `Готово` = `delivered` + `completed`.
3. Группы заказов (сохраняем текущую логику `processingOrders` + `inTransitOrders` → «В процессе», `deliveredOrders` → «Доставлено»):
   - Лейбл-kicker «В процессе» / «Доставлено».
4. **Timeline-карточка** (`.history-card`):
   - Grid `auto 1fr`, gap 12.
   - Левая колонка — stepper: круглая точка 12×12 с бордером 2 px `--accent`; если статус `delivered` — точка заливается `--accent`. Ниже — вертикальная линия `2px`, цвет `--border`, flex: 1 — чтобы линия тянулась до низа карточки и соединялась со следующей.
   - Правая колонка:
     - `header`: `#{order.id}` (12 px, 700) + дата (10 px, `--muted`).
     - `content`: thumb 44×44 (превью первого товара) + колонка «{имя} × {qty}» + «+ {N-1} товар(а)» (если > 1) + сумма `order.total` справа (13 px, 700, `--accent`).
     - `footer`: pill-бейдж статуса.
5. Клик по карточке → `onProductClick(firstItem.product_id)` (как сейчас).
6. Пусто → компонент `zen-empty-state` «Пока нет заказов» (как сейчас).

### Что меняется в коде

- Удалить `BackButton`.
- Заменить dropdown-фильтр на pill-переключатель (убрать весь `filterDropdownWrap` / `filterDropdownOpen` / рефы и обработчики outside-click).
- Добавить CSS классы stepper-точки и линии; для соединения использовать flex-колонку `.timeline-col { display:flex; flex-direction:column; align-items:center; gap:6px; }` + `.timeline-line { flex:1; width:2px; background: var(--border); min-height: 16px; }`.
- Pill-бейдж статуса: background `rgba(accent, 0.08)`, color `--accent`, 10 px, uppercase, letter-spacing 0.04em. Для `delivered` — приглушённый: `background: var(--surface-elevated); color: var(--muted)`.

## 3. Настройки (`frontend/src/pages/Settings.tsx`)

**Вариант:** C (Visual Theme Picker).

### Структура

1. Заголовок `h2` «Настройки» (22 px, 600).
2. **Секция «Тема оформления»** (kicker-лейбл):
   - Grid 1fr 1fr, gap 10.
   - Две карточки-превью тем: «Тёмная» и «Светлая».
   - Каждая карточка: `background: var(--surface); border: 2px solid var(--border); border-radius: 14; padding: 10; display: flex; flex-direction: column; gap: 6`.
   - Внутри — мини-превью 70 px: `background: #0f0e0e` (dark) или `#faf9f7` + `border: 1px solid var(--border)` (light). Сверху — «акцентная плашка» (8 px высотой, ширина 30%, background `rgba(accent, 0.8)`), ниже — «контент-плашка» (оставшаяся область, background `rgba(128,128,128,0.2)`).
   - Подпись по центру (12 px, 700).
   - Активная: `border-color: var(--accent)`, подпись `color: var(--accent)`.
   - Клик → `setTheme("dark" | "light")`.
3. **Секция «Язык и валюта»** (kicker-лейбл):
   - Одна белая карточка, 2 строки (`display:flex; justify-content:space-between; align-items:center; padding: 10px 12px; border-bottom: 1px solid var(--border)` на всех кроме последней).
   - «Язык» → справа pill-чипы `RU / EN`. Активный: `background: var(--accent); color: #fff`.
   - «Валюта» → справа pill-чипы `BYN / USD`.
   - Чип 5 × 11 px padding, 999 радиус, шрифт 11 px, 700.
4. **Секция «Дополнительно»** (kicker-лейбл):
   - Одна белая карточка с одной строкой: «О приложении» + справа `v 1.0 ›` (серый, 12 px).
   - Уведомления не добавляем.

### Что меняется в коде

- Удалить `BackButton`.
- Переработать разметку: три секции с kicker-лейблом сверху (11 px, uppercase, `--muted`, letterSpacing 0.08em).
- Тема: добавить новый компонент `ThemePreviewCard` (inline или в `components/`) с CSS-мокапом интерфейса.
- Язык и валюта: те же 4 кнопки, но оформлены как pill-чипы в строках карточки.

## 4. Отзывы (`frontend/src/pages/Reviews.tsx`)

**Вариант:** A (Rating Hero + FAB), с учётом того что summary **скрываем** (если нет отзывов — не показывать hero).

### Структура

1. Заголовок `h2` «Отзывы».
2. **Hero-баннер рейтинга** (отображается только если `reviews.length > 0`):
   - `background: linear-gradient(135deg, var(--accent), var(--accent-dim)); color: #fff; border-radius: 18; padding: 14; display: flex; gap: 12; align-items: center;`.
   - Левая часть: число `4,8` (Georgia / serif, 36 px, 800, line-height 1) + строка звёзд (14 px, letter-spacing 2px) + подпись «на основе {N} отзывов» (11 px, opacity 0.85).
   - Правая часть (flex: 1): 5 строк распределения по звёздам (1–5 сверху вниз или 5–1 сверху вниз — предпочтём 5→1), каждая: номер + трек `height: 4; background: rgba(255,255,255,0.2); border-radius: 2` + fill `background: #fff; width: {% отзывов этой оценки}`.
   - Все значения считаются клиентом: `average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length`, распределение — `counts[r.rating]`.
3. **Список отзывов** (без изменений в структуре данных):
   - Карточка отзыва: белый `var(--surface)`, радиус 16, padding 12, `display: flex; flex-direction: column; gap: 8`.
   - Header: аватар-кружок 32×32 с инициалом (`background: rgba(accent, 0.15); color: var(--accent)`), имя + дата (столбец), звёзды справа.
   - Текст отзыва (12 px, line-height 1.5).
   - Ответы магазина (`review.comments`): блок с левой бордовой полосой `border-left: 3px solid var(--accent); background: var(--bg); padding: 8px 10px; border-radius: 10`. Внутри — имя отвечающего `b` (10 px, 700) + текст. Модель «любой может ответить» остаётся, но визуальный акцент — как будто это ответ магазина.
   - Кнопка «Ответить» внизу (text-button, `--accent`, 11 px) — открывает inline-форму как сейчас.
4. **FAB** «+»:
   - `position: fixed; right: max(20px, env(safe-area-inset-right)); bottom: calc(64px + 20px + env(safe-area-inset-bottom))` (над `BottomNavBar`).
   - 52×52 круглый, `background: var(--accent); color: #fff; font-size: 24; box-shadow: 0 4px 12px rgba(165,42,42,0.4);`.
   - Клик → открывает модалку/bottom-sheet с формой: выбор звёзд, textarea, кнопка «Отправить», кнопка «Отмена».
5. **Модалка/Sheet для нового отзыва** (новый компонент `NewReviewSheet`):
   - Фон: полупрозрачный overlay `rgba(0,0,0,0.4)` + контент снизу на мобилках (`border-radius: 16px 16px 0 0; padding: 20px`).
   - Состояние формы берём из текущего Reviews.tsx (`newText`, `newRating`, `submitting`, `error`), переносим его внутрь sheet.
   - Успешный submit закрывает sheet и обновляет список.
6. Пусто → `reviews.length === 0` → показываем только подсказку «Пока нет отзывов. Будь первым!» с большой версией FAB под ней.

### Что меняется в коде

- Удалить `BackButton`.
- Вынести форму в `NewReviewSheet` (локальный компонент в том же файле ок).
- Добавить `<FabButton />` (или inline) с `position: fixed`.
- Подсчёт рейтинга + распределения на клиенте. Без бэкенд-изменений.
- Стиль ответов: добавить класс `.review-reply-box` с `border-left: 3px solid var(--accent)`.

## Навигация и роутинг

- В `App.tsx` в рендере `Profile / History / Settings / Reviews` всегда добавляем `<BottomNavBar activeTab={...} onCatalog={...} onCustomOrder={...} onArrivals={...} />` после контента страницы.
- `activeTab` для этих страниц → "catalog" не подсвечиваем; лучший UX — подсветка по контексту (если вошёл из каталога — «catalog»; иначе — ничего). Простейший вариант: оставить `activeTab="catalog"` (это тот экран, в который по клику вернёмся). Подходит для текущей логики.

## Что НЕ делаем

- Не меняем бэкенд, модели `Review` / `Order` / `Favorite`.
- Не добавляем уведомления в настройки.
- Не добавляем фото в отзывы (нет поля в API).
- Не меняем компонент `BottomNavBar` и хедер.
- Не трогаем `Favorites.tsx`, `Catalog.tsx`, `ProductPage.tsx` и т. д.

## Open questions

Нет — все уточнены во время brainstorming.

## Следующий шаг

Перейти к skill `writing-plans` и составить пошаговый план реализации (порядок файлов, тесты, инкрементальные коммиты).
