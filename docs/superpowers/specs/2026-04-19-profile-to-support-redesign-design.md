# Замена вкладки «Профиль» на «Поддержка»

**Дата:** 2026-04-19
**Область:** Frontend only (бэкенд не меняем)
**Направление стиля:** zen / Soft Card Stack — тёплый кремовый фон, большие мягкие карточки с `border-radius: 16px`, тонкие бордеры `var(--border)`, спокойный акцент `var(--accent)` (бордовый). Unbounded для заголовков, Proxima Nova для основного текста.

## Контекст

Текущая вкладка **Профиль** (открывается из дугового меню под бургером, пункт «Профиль») содержит аватар, избранное, последние заказы и список действий (условия доставки / поддержка / настройки). Пользователь считает, что:

- функционал избыточен (избранное, последние заказы дублируются в других экранах);
- выглядит неаккуратно (разношёрстные карточки, эмодзи-иконки).

Решение: **полностью убрать страницу Profile** и на её место поставить красивую страницу **«Поддержка»**, которая объединяет:

- условия доставки (текст),
- чат с поддержкой (встроенный общий чат пользователя).

## Цели

1. Удалить `frontend/src/pages/Profile.tsx` и все связи с `page === "profile"`.
2. В дуговом меню (`HeaderArcMenu`) пункт «Профиль» → «Поддержка» с иконкой-пузырьком.
3. Новая страница `frontend/src/pages/Support.tsx` полностью заменяет старую: два аккордеон-блока — «Условия доставки» и «Чат с поддержкой».
4. Упростить UX чата: один поток вместо списка тикетов.

## Архитектура

### Страницы

- **`Support.tsx` (переписать с нуля)** — новая hub-страница в стиле zen.
- **`Profile.tsx` — удалить.**
- **`DeliveryTerms.tsx`** — **удаляем файл** и маршрут `page === "deliveryTerms"`. Содержимое (текст) переносится в аккордеон на странице Support; отдельный экран условий доставки больше не нужен.

### Роутинг (`App.tsx`)

`Page` type: убрать `"profile"` и `"deliveryTerms"`.

- Пункт меню `onProfile` в `HeaderArcMenu` переименовать в `onSupport` (или оставить имя callback, но заменить иконку/label/action). Клик открывает `page === "support"`.
- Блок `page === "profile"` и `page === "deliveryTerms"` удалить из `App.tsx`.
- Удалить всю подгрузку `recentOrders` и пропсы `favoriteProducts` / `recentOrders`, завязанные исключительно на профиль.
- `supportUnreadCount` продолжаем использовать: теперь он показывается как точка на пункте меню «Поддержка».
- Из `BottomNavBar`-условия убрать `"profile"` (осталось управлять только 6 страницами верхнего уровня).

### Меню (`HeaderArcMenu`)

- Было: Профиль / История / Отзывы / Настройки.
- Станет: Поддержка / История / Отзывы / Настройки.
- Пропсы: переименовать `onProfile` → `onSupport` в компоненте и в App.
- `IconProfile` заменить на `IconSupport` — контурный пузырь речи (аналогичный стиль линий: `strokeWidth 1.8`, `strokeLinecap round`).
- Label: `t(lang, "support")` (добавим перевод «Поддержка» / «Support», т.к. сейчас слово «support» отдельно в словаре отсутствует — есть `supportTitle`, `profileSupport`).
- Индикатор непрочитанных: если `supportUnreadCount > 0`, отображается маленькая точка-метка (6×6 px, `var(--accent)`) в правом-верхнем углу кнопки «Поддержка» в дуговом меню. Это дополнительная правка `HeaderArcMenu`: принимать optional `supportUnreadCount` и на пункте support показывать `<span>` с точкой.

### Страница `Support.tsx`

#### Структура

```
Support
├── Hero (заголовок + подзаголовок)
├── SectionCard "Условия доставки"  (аккордеон, closed by default)
│   └── Текст из i18n: deliveryTermsP1..P3
├── SectionCard "Чат с поддержкой"  (аккордеон, open by default если есть непрочитанные)
│   ├── (loading / empty state)
│   └── Thread + Input (один общий чат пользователя)
```

Контейнер:

```tsx
<div className="zen-support" style={{ maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" }}>
```

#### Hero

```tsx
<section style={styles.hero}>
  <h1 style={styles.title}>{t(lang, "supportTitle")}</h1>
  <p style={styles.subtitle}>{t(lang, "supportHeroSubtitle")}</p>
</section>
```

- `title`: Unbounded, 24px, fontWeight 600, margin 0.
- `subtitle`: Proxima Nova, 13px, `color: var(--muted)`, margin "6px 0 20px".
- Решение: **делаем** декоративную SVG-иконку-пузырёк (28×28, `stroke: var(--accent)`, strokeWidth 1.5) над заголовком, по центру, opacity 0.9, `margin-bottom: 12px`. Она задаёт «спокойный» тон страницы.

#### SectionCard — переиспользуемый компонент

Локальный компонент `AccordionCard` внутри файла `Support.tsx`:

```tsx
interface AccordionCardProps {
  icon: ReactNode;                // 20×20 SVG
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;                 // optional unread badge
  children: ReactNode;            // контент, рендерится всегда, но скрывается высотой
}
```

Визуал:

- Обёртка: `background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);`.
- Шапка (`<button>`): flex row, padding 16px, gap 12; иконка в квадратном фоне 36×36 `background: rgba(165,42,42,0.08); border-radius: 12px; color: var(--accent)`; заголовок 15px/600; опциональный бэдж (мин-ширина 22px, `background: var(--accent); color: #fff; fontSize 11/700`); chevron 18px, тускло-серый, поворот 180° когда `open`.
- Контент: `<div style={{ maxHeight: open ? 'none' : 0, overflow: 'hidden', transition: 'max-height 300ms ease' }}>`.
  - Поскольку `max-height: 'none'` не анимируется, используем двухфазную технику: при переходе expand — сперва ставим `el.scrollHeight + 'px'`, по окончании transition снимаем ограничение (`auto`), чтобы внутри чата можно было корректно прокручивать. При collapse — сначала задаём текущую высоту в пикселях, затем 0.
  - Внутренние отступы: padding 0 16px 16px.

#### Секция «Условия доставки»

- Иконка: контур документа (clipboard-like) — 20×20, `stroke: currentColor` (цвет задаёт родитель).
- Контент: три `<p>` с `t(lang, "deliveryTermsP1")`, `P2`, `P3`. `fontSize: 14; lineHeight: 1.6; color: var(--text); margin: 0 0 12px`. Последний `<p>` без нижнего отступа.
- state: управляется локально `const [deliveryOpen, setDeliveryOpen] = useState(false);`.

#### Секция «Чат с поддержкой»

- Иконка: контур пузырька речи (тонкий bubble) — 20×20.
- badge: `supportUnreadCount` (передаётся из App).
- state: `const [chatOpen, setChatOpen] = useState(() => supportUnreadCount > 0);` (авто-открытие, если есть непрочитанные).
- Контент: embedded chat view (см. ниже).

#### Embedded chat (в аккордеоне «Поддержка»)

Один общий чат пользователя:

- `getSupportChats(userId)` → берём **самый свежий** чат (первый в списке, т.к. `getSupportChats` возвращает массив в порядке `created_at DESC`; если это не так — сортируем по `created_at` desc на клиенте). Используем его `id` как «активный чат». Если массив пуст — автоматически вызываем `createSupportChat(userId, { user_name: firstName, user_username: userName })` и используем возвращённый `id`.
- Всё это инкапсулируется в новый хук или помощник внутри `Support.tsx`: `useActiveSupportChat(userId, firstName, userName) → { chatId, loading, refresh }`.
- Как только `chatId` известен:
  - `getSupportMessages(chatId, userId)` — первичная загрузка (с лоадером).
  - Polling раз в 5 сек.
  - `markSupportChatRead(chatId, userId)` вызываем при открытии аккордеона и после каждого `getSupportMessages`, если появились непрочитанные админские — после этого дергаем `onUnreadCountChange`.
- Отправка сообщения: `sendSupportMessage(chatId, userId, { text, image_url })`; оптимистическое обновление — как сейчас.
- Прикрепление фото: оставляем (paperclip + preview + send).
- Просмотр изображения в полноэкранном оверлее: оставляем.
- **Убираем**: список чатов, кнопку «Новый чат», переименование чата, удаление чата, редактирование своих сообщений (`updateSupportMessage`). Это упрощает UX и код. Эти функции станут недоступны пользователю; бэкенд продолжает их поддерживать, но UI их не вызывает.

Layout чата внутри аккордеона:

- `thread`: `max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px;`.
- `bubble`: как сейчас (`bubbleUser` / `bubbleAdmin`), но **без кнопки редактирования**.
- `inputRow` + `inputWrapper` + `textarea` + кнопка «Отправить»: оставляем в существующем виде, но интегрируем в карточку (без лишних рамок между ними).
- Пустое состояние: `<p style={styles.emptyState}>{t(lang, "supportStartConversation")}</p>` (новый перевод: «Напишите первое сообщение — мы ответим в течение 24 часов.»).

#### Props страницы

```ts
interface SupportProps {
  userId: string;
  userName: string | null;
  firstName: string;
  supportUnreadCount: number;
  onUnreadCountChange?: () => void;
}
```

- `onBack` — больше не нужен, т.к. нижний бар + меню обеспечивают навигацию.
- Страница отображается **с `BottomNavBar`** (добавляем `"support"` в whitelist в `App.tsx`), активная вкладка bottom nav при этом — `catalog` по умолчанию (nav просто показывается, но как на Settings/History — пользователь может из него вернуться в каталог). Т.е. запись в whitelist: `["catalog", "customOrder", "newArrivals", "support", "history", "settings", "reviews"]` (вместо `"profile"`).

### i18n

В `frontend/src/i18n.ts` добавить ключи (ru / en):

- `support`: "Поддержка" / "Support"
- `supportHeroSubtitle`: "Мы рядом — спросите что угодно" / "We're here — ask us anything"
- `supportDeliverySection`: "Условия доставки" / "Delivery conditions" (можно переиспользовать `deliveryTermsTitle` — чтобы не плодить ключи, переиспользуем `t(lang, "deliveryTermsTitle")`).
- `supportChatSection`: "Чат с поддержкой" / "Support chat"
- `supportStartConversation`: "Напишите первое сообщение — мы ответим в течение 24 часов." / "Send your first message — we'll reply within 24 hours."

Удалить неиспользуемые (после удаления Profile): `profileRecentOrders`, `profileFavorites`, `profileFavoritesEmpty`, `profileActions`, `profileDeliveryTerms`, `profileSupport`, `profileAboutTitle`, `profileAboutText`, `profileSupportText`. (Опционально — если где-то ещё используются, оставить; проверить grep'ом перед удалением.)

### Удалённые связи

После изменений **нигде в проекте** не должно остаться ссылок на:

- `import … Profile … from "./pages/Profile"`
- `import … DeliveryTerms … from "./pages/DeliveryTerms"`
- `page === "profile"` / `page === "deliveryTerms"`
- `openProfile` / `openDeliveryTerms` (в `App.tsx`)

## Поток данных

```
App.tsx
  ├─ supportUnreadCount (polled каждые 25s + on page change)
  │
  ├─ HeaderArcMenu (получает supportUnreadCount → показывает точку на пункте "Поддержка")
  │
  └─ Support page (получает userId, firstName, userName, supportUnreadCount, onUnreadCountChange)
        └─ при монтировании:
             1. getSupportChats → берём первый или createSupportChat
             2. getSupportMessages + markSupportChatRead
             3. polling 5s
        └─ onUnreadCountChange() — триггерит перезапрос supportUnreadCount в App
```

## Обработка ошибок

- Если `getSupportChats` падает (сеть/500) — показываем в секции чата placeholder `<p>{t(lang, "loading")}...</p>` + ретрай каждые 5 сек (polling уже делает это). Тосты не добавляем.
- Если `createSupportChat` падает — показываем `<p style={styles.emptyState}>{t(lang, "loading")}...</p>` и повторяем попытку автоматически через 5 секунд (тот же polling-цикл, что для сообщений). Никаких новых i18n-ключей для ошибок не добавляем.
- Ошибка отправки сообщения — оптимистическое сообщение откатывается из списка (как сейчас).

## Тестирование

**Ручное:**

1. Открываю бургер → в дуге теперь 4 пункта, первый — «Поддержка» с иконкой пузыря. Пункта «Профиль» нет.
2. Если есть непрочитанные — на пункте «Поддержка» видна точка.
3. Клик → открывается страница Support с hero «Поддержка». Внизу — `BottomNavBar`.
4. Видны две карточки: «Условия доставки» (свёрнута) и «Чат с поддержкой» (свёрнута или развёрнута, если unread > 0).
5. Клик по «Условия доставки» → плавно разворачивается текст, chevron поворачивается. Повторный клик — сворачивается.
6. Клик по «Чат с поддержкой» → плавно разворачивается, в первый раз показывается лоадер, затем появляется пустое состояние или история сообщений. `markSupportChatRead` вызывается, точка на меню исчезает.
7. Пишу сообщение → появляется пузырёк, через 5 сек polling подгружает ответ админа (если есть).
8. Прикрепляю фото → превью → отправка → появляется пузырёк с картинкой; клик по ней открывает оверлей.
9. Перезагрузка страницы → тот же чат, история сохраняется.
10. Админка (сервер-сайд) продолжает работать; все сообщения привязаны к одному и тому же `chat.id`.

**Кросс-страничное:**

- Переходы из bottom nav (каталог/custom/arrivals) работают с текущей страницы.
- Из дугового меню можно перейти в Историю/Отзывы/Настройки — всё как раньше, только без пункта «Профиль».
- Никаких console errors про отсутствующие маршруты «profile» / «deliveryTerms».

## Границы единиц

- **`Support.tsx`** — одна страница, самодостаточная. Зависимости: API support-чата, i18n, settings context.
- **`AccordionCard`** — локальный компонент внутри Support (не выносим отдельно, т.к. используется только здесь).
- **`HeaderArcMenu`** — получает новый опциональный проп `supportUnreadCount`, меняет пункт Profile на Support. Остальная логика меню не трогается.
- **`App.tsx`** — удаляем ветки `profile` / `deliveryTerms`, меняем callback `onProfile` → `onSupport`.

## Что НЕ делаем (явные YAGNI-отсечки)

- Не трогаем бэкенд (`support_chats`, `support_messages` остаются как есть — multi-chat в БД продолжает существовать).
- Не добавляем FAQ / контакты — пользователь отверг.
- Не переносим избранное, заказы, аватар — они доступны через History / Favorites / меню.
- Не добавляем tabs или новые навигации помимо аккордеона.
- Анимация аккордеона — чистый CSS transition, без framer-motion.
