# Profile / History / Settings / Reviews redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переработать 4 вкладки (Profile, History, Settings, Reviews) в стиле Soft Card Stack, убрать со всех четырёх страниц кнопку «Вернуться в каталог» и всегда показывать нижний бар с тремя иконками (каталог / custom / вдохновиться).

**Architecture:** Только фронтенд (React + Vite, inline-стили + `index.css` переменные). Изменения в `App.tsx` (рендер `BottomNavBar` на 4 новых экранах), 4 page-файлах (`Profile.tsx`, `History.tsx`, `Settings.tsx`, `Reviews.tsx`), возможный новый компонент `NewReviewSheet.tsx`. Данные берём из уже существующих API (`getOrders`, `getReviews`, `favorites`, `supportUnreadCount`) — без изменений бэка.

**Tech Stack:** React 18, TypeScript, Vite, inline CSS-in-JS (`React.CSSProperties`), CSS-переменные из `frontend/src/index.css`.

**Spec:** `docs/superpowers/specs/2026-04-19-profile-tabs-redesign-design.md`

---

## File Structure

Изменения по файлам:

- **Modify** `frontend/src/App.tsx` — вокруг `BottomNavBar` добавить ещё 4 ветки (`profile`, `history`, `settings`, `reviews`), передать recentOrders и favorites в `Profile`.
- **Modify** `frontend/src/pages/Profile.tsx` — новая структура (hero + 3 секции), удалить `BackButton`, принять `recentOrders` / `favorites` / `onProductClick` / `onOpenHistory`.
- **Modify** `frontend/src/pages/History.tsx` — удалить `BackButton`, заменить dropdown-фильтр на pill-переключатель, карточки со stepper-timeline.
- **Modify** `frontend/src/pages/Settings.tsx` — удалить `BackButton`, добавить визуальный theme-picker, секции с pill-чипами.
- **Modify** `frontend/src/pages/Reviews.tsx` — удалить `BackButton`, добавить hero-баннер рейтинга с распределением, вынести форму в sheet, добавить FAB.
- **Create** `frontend/src/components/NewReviewSheet.tsx` — модалка/bottom-sheet с формой нового отзыва.
- **Modify** `frontend/src/i18n.ts` — добавить ключи `profileRecentOrders`, `profileFavorites`, `profileActions`, `profileFavoritesEmpty`, `historyEmptyHint`, `settingsTheme`, `settingsLangAndCurrency`, `settingsMore`, `settingsAboutApp`, `settingsAppVersion`, `reviewsRatingBasedOn`, `reviewsFabNew`, `reviewsEmptyFirst`.

Каждый файл — одна-две связанные задачи. Между задачами делаем визуальную проверку (`npm run dev` / `npm run build`), в конце — коммит.

---

## Task 1: Вынести `BottomNavBar` в общий слот (чтобы показывался на всех 4 вкладках)

**Files:**
- Modify: `frontend/src/App.tsx` (строки ~420–443)

- [ ] **Step 1: Расширить список страниц с bottom-nav**

Заменить блок с тремя `{page === "..."}` условиями на единый ариф-список:

```tsx
{(["catalog", "customOrder", "newArrivals", "profile", "history", "settings", "reviews"] as Page[]).includes(page) && (
  <BottomNavBar
    activeTab={page === "customOrder" ? "custom" : page === "newArrivals" ? "arrivals" : "catalog"}
    onCatalog={() => setPage("catalog")}
    onCustomOrder={() => setPage("customOrder")}
    onArrivals={() => setPage("newArrivals")}
  />
)}
```

Удалить три отдельных блока `{page === "catalog" && ...}`, `{page === "customOrder" && ...}`, `{page === "newArrivals" && ...}` со строк ~420–443.

- [ ] **Step 2: Проверить сборку**

Run:

```bash
cd frontend && npm run build
```

Expected: build успешен, ошибок TypeScript нет.

- [ ] **Step 3: Проверить визуально**

Run:

```bash
cd frontend && npm run dev
```

Открыть каждую из вкладок (каталог, custom, arrivals, профиль, история, настройки, отзывы) и убедиться, что bottom-nav виден на всех 7. На профиле/истории/настройках/отзывах он пока дублируется со старой `BackButton` — это ок, чиним в следующих задачах.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(nav): показывать BottomNavBar на профиле, истории, настройках и отзывах"
```

---

## Task 2: i18n ключи

**Files:**
- Modify: `frontend/src/i18n.ts`

- [ ] **Step 1: Добавить ключи в русскую секцию**

Внутри `ru: { ... }` добавить (рядом с уже существующими `profileQuickActions`):

```ts
profileRecentOrders: "Последние заказы",
profileFavorites: "Избранное",
profileActions: "Действия",
profileFavoritesEmpty: "Лайкни что-нибудь, чтобы оно появилось здесь",
historyEmptyHint: "Пока нет заказов",
settingsTheme: "Тема оформления",
settingsThemeDark: "Тёмная",
settingsThemeLight: "Светлая",
settingsLangAndCurrency: "Язык и валюта",
settingsMore: "Дополнительно",
settingsAboutApp: "О приложении",
settingsAppVersion: "v 1.0",
reviewsRatingBasedOn: "на основе {n} отзывов",
reviewsFabNew: "Новый отзыв",
reviewsEmptyFirst: "Пока нет отзывов. Будь первым!",
```

- [ ] **Step 2: Добавить те же ключи в английскую секцию**

Внутри `en: { ... }`:

```ts
profileRecentOrders: "Recent orders",
profileFavorites: "Favorites",
profileActions: "Actions",
profileFavoritesEmpty: "Like something to see it here",
historyEmptyHint: "No orders yet",
settingsTheme: "Theme",
settingsThemeDark: "Dark",
settingsThemeLight: "Light",
settingsLangAndCurrency: "Language & currency",
settingsMore: "More",
settingsAboutApp: "About the app",
settingsAppVersion: "v 1.0",
reviewsRatingBasedOn: "based on {n} reviews",
reviewsFabNew: "New review",
reviewsEmptyFirst: "No reviews yet. Be the first!",
```

- [ ] **Step 3: Проверить сборку**

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n.ts
git commit -m "feat(i18n): добавить ключи для редизайна профиля/истории/настроек/отзывов"
```

---

## Task 3: Settings — visual theme picker

**Files:**
- Modify: `frontend/src/pages/Settings.tsx` (полностью переписать тело компонента и стили, интерфейс props не меняется)

- [ ] **Step 1: Заменить содержимое `Settings.tsx`**

```tsx
import { useSettings } from "../context/SettingsContext";
import type { Currency } from "../context/SettingsContext";
import { t } from "../i18n";

const CURRENCY_OPTIONS: Currency[] = ["BYN", "USD"];

interface SettingsProps {
  onBack: () => void;
}

export function Settings(_props: SettingsProps) {
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const lang = settings.lang;

  return (
    <div style={styles.wrap}>
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "settings")}</h2>

      <p style={styles.kicker}>{t(lang, "settingsTheme")}</p>
      <div style={styles.themeRow}>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          style={{ ...styles.themeCard, ...(settings.theme === "dark" ? styles.themeCardActive : {}) }}
        >
          <span style={{ ...styles.themePreview, background: "#0f0e0e" }}>
            <span style={styles.themePreviewAccent} />
            <span style={styles.themePreviewBody} />
          </span>
          <span style={{ ...styles.themeName, ...(settings.theme === "dark" ? styles.themeNameActive : {}) }}>
            {t(lang, "settingsThemeDark")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          style={{ ...styles.themeCard, ...(settings.theme === "light" ? styles.themeCardActive : {}) }}
        >
          <span style={{ ...styles.themePreview, background: "#faf9f7", border: "1px solid var(--border)" }}>
            <span style={styles.themePreviewAccent} />
            <span style={styles.themePreviewBody} />
          </span>
          <span style={{ ...styles.themeName, ...(settings.theme === "light" ? styles.themeNameActive : {}) }}>
            {t(lang, "settingsThemeLight")}
          </span>
        </button>
      </div>

      <p style={styles.kicker}>{t(lang, "settingsLangAndCurrency")}</p>
      <div style={styles.groupCard}>
        <div style={styles.groupRow}>
          <span style={styles.groupLabel}>{t(lang, "language")}</span>
          <div style={styles.chipRow}>
            <button
              type="button"
              onClick={() => setLang("ru")}
              style={{ ...styles.chip, ...(settings.lang === "ru" ? styles.chipActive : {}) }}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              style={{ ...styles.chip, ...(settings.lang === "en" ? styles.chipActive : {}) }}
            >
              EN
            </button>
          </div>
        </div>
        <div style={{ ...styles.groupRow, borderBottom: "none" }}>
          <span style={styles.groupLabel}>{t(lang, "currency")}</span>
          <div style={styles.chipRow}>
            {CURRENCY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                style={{ ...styles.chip, ...(settings.currency === c ? styles.chipActive : {}) }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p style={styles.kicker}>{t(lang, "settingsMore")}</p>
      <div style={styles.groupCard}>
        <div style={{ ...styles.groupRow, borderBottom: "none" }}>
          <span style={styles.groupLabel}>{t(lang, "settingsAboutApp")}</span>
          <span style={styles.muted}>{t(lang, "settingsAppVersion")} ›</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  title: { marginBottom: 20 },
  kicker: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "18px 0 10px",
  },
  themeRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  themeCard: {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    borderRadius: 14,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  themeCardActive: { borderColor: "var(--accent)" },
  themePreview: {
    position: "relative",
    display: "block",
    height: 70,
    borderRadius: 10,
    overflow: "hidden",
  },
  themePreviewAccent: {
    position: "absolute",
    left: 10,
    top: 10,
    width: "30%",
    height: 8,
    borderRadius: 4,
    background: "rgba(165,42,42,0.8)",
  },
  themePreviewBody: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 26,
    bottom: 10,
    borderRadius: 4,
    background: "rgba(128,128,128,0.2)",
  },
  themeName: { fontSize: 12, fontWeight: 700, textAlign: "center", color: "var(--text)" },
  themeNameActive: { color: "var(--accent)" },
  groupCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    overflow: "hidden",
  },
  groupRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
  },
  groupLabel: { color: "var(--text)" },
  chipRow: { display: "flex", gap: 6 },
  chip: {
    padding: "5px 11px",
    borderRadius: 999,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chipActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
  },
  muted: { color: "var(--muted)", fontSize: 12 },
};
```

- [ ] **Step 2: Проверить сборку и визуал**

```bash
cd frontend && npm run build
```

Expected: PASS.

Затем `npm run dev`, открыть «Настройки»:
- Кнопка «Вернуться в каталог» отсутствует.
- Видны секции «Тема оформления», «Язык и валюта», «Дополнительно».
- Переключение темы мгновенно меняет подсветку активной превью-карточки.
- Снизу виден `BottomNavBar`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): визуальный theme picker и pill-чипы для языка/валюты"
```

---

## Task 4: History — pill-фильтры и stepper-timeline

**Files:**
- Modify: `frontend/src/pages/History.tsx`

- [ ] **Step 1: Заменить header и фильтр**

В файле `frontend/src/pages/History.tsx`:

1. Удалить импорт `BackButton` и все использования (`<BackButton .../>`).
2. Удалить state и refs связанные с dropdown: `filterDropdownOpen`, `setFilterDropdownOpen`, `filterDropdownRef`, `useEffect` для outside-click.
3. Заменить блок `<header>` на:

```tsx
<header style={styles.header}>
  <h1 className="zen-page-title" style={styles.title}>{t(lang, "historyTitle")}</h1>
  <div style={styles.filterRow} role="tablist" aria-label={t(lang, "historyTitle")}>
    {filterOptions.map((opt) => {
      const count =
        opt.value === "all" ? orders.length :
        opt.value === "processing" ? processingOrders.length :
        opt.value === "in_progress" ? inTransitOrders.length :
        deliveredOrders.length;
      const active = filter === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => setFilter(opt.value)}
          style={{ ...styles.filterPill, ...(active ? styles.filterPillActive : {}) }}
        >
          {t(lang, opt.labelKey)}{opt.value === "all" ? ` · ${count}` : ""}
        </button>
      );
    })}
  </div>
</header>
```

4. В `styles` (Record) удалить старые ключи `filterDropdown*`, `filterTab`, `filterTabActive`, `titleAndFilterWrap`. Добавить:

```tsx
filterRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 },
filterPill: {
  padding: "8px 14px",
  borderRadius: 999,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
},
filterPillActive: {
  background: "var(--accent)",
  borderColor: "var(--accent)",
  color: "#fff",
},
```

5. Для loading-ветки удалить `<BackButton />`.

- [ ] **Step 2: Перестроить `OrderCard` под stepper-layout**

Внутри того же файла заменить реализацию `OrderCard` на:

```tsx
function OrderCard({
  order,
  formatPrice,
  lang,
  t,
  onProductClick,
}: {
  order: Order;
  formatPrice: (n: number) => string;
  lang: Lang;
  t: (l: Lang, k: string) => string;
  onProductClick?: (productId: number) => void;
}) {
  let items: { product_id?: number; image_url?: string; name?: string; price?: number; quantity?: number }[] = [];
  try { items = JSON.parse(order.items); } catch {}
  const firstItem = items[0];
  const productId = firstItem?.product_id;
  const imageUrl = firstItem?.image_url;
  const isClickable = onProductClick && productId != null;

  const isDelivered = order.status === "delivered" || order.status === "completed";
  const statusLabel = orderStatusLabel(order.status, lang, t);

  return (
    <div
      style={{ ...styles.card, ...(isClickable ? styles.cardClickable : {}) }}
      onClick={isClickable ? () => onProductClick(productId) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onProductClick!(productId); } : undefined}
    >
      <div style={styles.timelineCol} aria-hidden>
        <span style={{ ...styles.timelineDot, ...(isDelivered ? styles.timelineDotDone : {}) }} />
        <span style={styles.timelineLine} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.cardHead}>
          <span style={styles.orderId}>#{order.id}</span>
          <span style={styles.date}>{formatDate(order.created_at)}</span>
        </div>
        <div style={styles.cardBody}>
          {imageUrl && <img src={imageUrl} alt="" style={styles.cardThumb} />}
          <div style={styles.cardContent}>
            {firstItem && (
              <p style={styles.itemName}>
                {firstItem.name || "Товар"} × {firstItem.quantity || 1}
                {items.length > 1 && <span style={styles.itemMore}> · + {items.length - 1}</span>}
              </p>
            )}
            <p style={styles.total}>{formatPrice(order.total)}</p>
          </div>
        </div>
        <span style={{ ...styles.statusPill, ...(isDelivered ? styles.statusPillMuted : {}) }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
```

И в `styles` заменить/добавить:

```tsx
card: {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 12,
  padding: 14,
  background: "var(--surface)",
  borderRadius: 14,
  border: "1px solid var(--border)",
  marginBottom: 10,
},
cardClickable: { cursor: "pointer" },
timelineCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 4 },
timelineDot: {
  width: 12, height: 12, borderRadius: "50%",
  border: "2px solid var(--accent)",
  background: "var(--surface)",
  flexShrink: 0,
},
timelineDotDone: { background: "var(--accent)" },
timelineLine: { width: 2, flex: 1, minHeight: 16, background: "var(--border)" },
cardHead: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
orderId: { fontWeight: 700, fontSize: 13 },
date: { fontSize: 11, color: "var(--muted)" },
cardBody: { display: "flex", gap: 12, alignItems: "center" },
cardThumb: { width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
cardContent: { flex: 1, minWidth: 0 },
itemName: { fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 4 },
itemMore: { color: "var(--muted)", fontWeight: 400, fontSize: 12 },
total: { fontSize: 14, fontWeight: 700, color: "var(--accent)", margin: 0 },
statusPill: {
  display: "inline-block",
  marginTop: 8,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(165,42,42,0.08)",
  color: "var(--accent)",
},
statusPillMuted: { background: "var(--surface-elevated)", color: "var(--muted)" },
```

Обновить `wrap`:

```tsx
wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
```

- [ ] **Step 3: Проверить сборку и визуал**

```bash
cd frontend && npm run build
```

Expected: PASS.

`npm run dev` → открыть «Историю»:
- Нет «Вернуться в каталог».
- Pill-фильтры (Все · N / В обработке / В пути / Доставлено), активный бордовый.
- Карточки с точкой-stepper слева и линией, статус-пилл снизу.
- Клик по карточке открывает товар (как раньше).
- Внизу — `BottomNavBar`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/History.tsx
git commit -m "feat(history): pill-фильтры и stepper-timeline карточки заказов"
```

---

## Task 5: Profile — hero + 3 секции

**Files:**
- Modify: `frontend/src/App.tsx` (передать `recentOrders`, `favorites`, `onOpenHistory`, `onProductClick` в `Profile`)
- Modify: `frontend/src/pages/Profile.tsx`

- [ ] **Step 1: В `App.tsx` добавить загрузку последних заказов**

Около других `useState` добавить:

```tsx
const [recentOrders, setRecentOrders] = useState<import("./api").Order[]>([]);
```

В `useEffect`, который грузит `getSupportUnreadCount`, добавить параллельно:

```tsx
if (userId) {
  import("./api").then((m) => m.getOrders(userId))
    .then((orders) => setRecentOrders(orders.slice(0, 3)))
    .catch(() => {});
}
```

(Либо простой `getOrders(userId).then(...)` с импортом сверху файла.)

- [ ] **Step 2: В `App.tsx` передать новые props в `<Profile />`**

Заменить рендер `<Profile ... />` на:

```tsx
{page === "profile" && (
  <Profile
    userName={userName}
    firstName={firstName}
    onBack={openCatalog}
    onOpenDeliveryTerms={openDeliveryTerms}
    onOpenSupport={openSupport}
    supportUnreadCount={supportUnreadCount}
    recentOrders={recentOrders}
    favoriteProducts={products.filter((p) => wishlistIds.includes(p.id)).slice(0, 5)}
    onOpenHistory={() => setPage("history")}
    onOpenSettings={() => setPage("settings")}
    onProductClick={(id) => openProduct(id, "profile")}
  />
)}
```

- [ ] **Step 3: Переписать `Profile.tsx`**

Заменить файл `frontend/src/pages/Profile.tsx` целиком:

```tsx
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import type { Order, Product } from "../api";

interface ProfileProps {
  userName: string | null;
  firstName: string;
  onBack: () => void;
  onOpenDeliveryTerms?: () => void;
  onOpenSupport?: () => void;
  supportUnreadCount?: number;
  recentOrders?: Order[];
  favoriteProducts?: Product[];
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onProductClick?: (id: number) => void;
}

function formatShortDate(s: string, lang: string) {
  try {
    return new Date(s).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" });
  } catch { return s; }
}

export function Profile({
  userName,
  firstName,
  onOpenDeliveryTerms,
  onOpenSupport,
  supportUnreadCount = 0,
  recentOrders = [],
  favoriteProducts = [],
  onOpenHistory,
  onOpenSettings,
  onProductClick,
}: ProfileProps) {
  const { settings, formatPrice } = useSettings();
  const lang = settings.lang;
  const initial = (firstName?.[0] || "?").toUpperCase();

  return (
    <div style={styles.wrap}>
      <div style={styles.hero}>
        <div style={styles.avatarWrap}><div style={styles.avatar}>{initial}</div></div>
        <h2 style={styles.name}>{firstName}</h2>
        {userName && <p style={styles.username}>{userName}</p>}
      </div>

      {recentOrders.length > 0 && (
        <>
          <p style={styles.kicker}>{t(lang, "profileRecentOrders")}</p>
          <div style={styles.sectionList} onClick={onOpenHistory} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onOpenHistory?.(); }}
            style={{ ...styles.sectionList, cursor: onOpenHistory ? "pointer" : "default" }}
          >
            {recentOrders.map((o) => {
              let items: { name?: string; image_url?: string; quantity?: number }[] = [];
              try { items = JSON.parse(o.items); } catch {}
              const first = items[0];
              return (
                <div key={o.id} style={styles.orderRow}>
                  {first?.image_url
                    ? <img src={first.image_url} alt="" style={styles.thumb} />
                    : <div style={{ ...styles.thumb, background: "var(--surface-elevated)" }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={styles.orderName}>{first?.name || "Товар"} × {first?.quantity || 1}</p>
                    <p style={styles.orderMeta}>{formatShortDate(o.created_at, lang)} · #{o.id}</p>
                  </div>
                  <span style={styles.orderTotal}>{formatPrice(o.total)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p style={styles.kicker}>{t(lang, "profileFavorites")}</p>
      {favoriteProducts.length > 0 ? (
        <div style={styles.favRow}>
          {favoriteProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProductClick?.(p.id)}
              style={styles.favBtn}
              aria-label={p.name}
            >
              <img src={p.image_url} alt="" style={styles.favThumb} />
            </button>
          ))}
        </div>
      ) : (
        <p style={styles.emptyHint}>{t(lang, "profileFavoritesEmpty")}</p>
      )}

      <p style={styles.kicker}>{t(lang, "profileActions")}</p>
      <div style={styles.actions}>
        {onOpenDeliveryTerms && (
          <ActionRow icon="📋" label={t(lang, "profileDeliveryTerms")} onClick={onOpenDeliveryTerms} />
        )}
        {onOpenSupport && (
          <ActionRow icon="💬" label={t(lang, "profileSupport")} onClick={onOpenSupport} badge={supportUnreadCount} />
        )}
        {onOpenSettings && (
          <ActionRow icon="⚙︎" label={t(lang, "settings")} onClick={onOpenSettings} />
        )}
      </div>
    </div>
  );
}

function ActionRow({ icon, label, onClick, badge = 0 }: { icon: string; label: string; onClick: () => void; badge?: number }) {
  return (
    <button type="button" onClick={onClick} style={styles.actionBtn}>
      <span style={styles.actionIco}>{icon}</span>
      <span style={styles.actionLabel}>{label}</span>
      {badge > 0 && <span style={styles.badge}>{badge > 99 ? "99+" : badge}</span>}
      <span style={styles.chev} aria-hidden>›</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  hero: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0 4px" },
  avatarWrap: {
    width: 64, height: 64, borderRadius: "50%",
    background: "linear-gradient(135deg, var(--accent), var(--accent-dim))",
    padding: 2.5,
  },
  avatar: {
    width: "100%", height: "100%", borderRadius: "50%",
    background: "var(--bg)",
    color: "var(--accent)",
    fontSize: 26, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: 700, margin: 0 },
  username: { fontSize: 12, color: "var(--muted)", margin: 0 },
  kicker: {
    fontSize: 11, fontWeight: 600, color: "var(--muted)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    margin: "22px 0 10px",
  },
  sectionList: {
    display: "flex", flexDirection: "column", gap: 8,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: 8,
  },
  orderRow: { display: "flex", alignItems: "center", gap: 10, padding: 4 },
  thumb: { width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  orderName: { fontSize: 13, fontWeight: 600, margin: 0 },
  orderMeta: { fontSize: 11, color: "var(--muted)", margin: 0, marginTop: 2 },
  orderTotal: { fontSize: 13, fontWeight: 700, color: "var(--accent)" },
  favRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 },
  favBtn: {
    width: 56, height: 56, borderRadius: 12,
    border: "1px solid var(--border)", padding: 0, overflow: "hidden",
    background: "var(--surface)", cursor: "pointer", flexShrink: 0,
  },
  favThumb: { width: "100%", height: "100%", objectFit: "cover" },
  emptyHint: { textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "14px 8px", margin: 0 },
  actions: { display: "flex", flexDirection: "column", gap: 10 },
  actionBtn: {
    display: "flex", alignItems: "center", gap: 10,
    padding: 14, background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 14,
    color: "var(--text)", fontSize: 14, fontFamily: "inherit",
    cursor: "pointer", textAlign: "left", position: "relative",
  },
  actionIco: {
    width: 32, height: 32, borderRadius: 10,
    background: "rgba(165,42,42,0.08)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
    flexShrink: 0,
  },
  actionLabel: { flex: 1, fontSize: 13 },
  badge: {
    minWidth: 20, height: 20, padding: "0 6px",
    borderRadius: 10, background: "var(--accent)", color: "#fff",
    fontSize: 11, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  chev: { color: "var(--muted)", fontSize: 16 },
};
```

- [ ] **Step 4: Проверить сборку и визуал**

```bash
cd frontend && npm run build
```

Expected: PASS.

`npm run dev` → «Профиль»:
- Нет `BackButton`.
- Аватар в градиентной обводке, имя и `@username`.
- Если есть заказы — секция «Последние заказы» (до 3), клик ведёт в Историю.
- Секция «Избранное» (превью-квадратики) или подсказка «Лайкни что-нибудь…».
- Секция «Действия»: «Условия доставки», «Поддержка» (с бейджем если есть непрочитанные), «Настройки».
- Внизу `BottomNavBar`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/Profile.tsx
git commit -m "feat(profile): hero с аватаром и три секции (заказы/избранное/действия)"
```

---

## Task 6: Reviews — hero с рейтингом и FAB + sheet

**Files:**
- Create: `frontend/src/components/NewReviewSheet.tsx`
- Modify: `frontend/src/pages/Reviews.tsx`

- [ ] **Step 1: Создать `NewReviewSheet.tsx`**

`frontend/src/components/NewReviewSheet.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewReviewSheetProps {
  open: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
}

export function NewReviewSheet({ open, submitting, error, onClose, onSubmit }: NewReviewSheetProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) {
      setRating(5);
      setText("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!text.trim() || submitting) return;
    onSubmit(rating, text.trim());
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.handle} aria-hidden />
        <h3 style={styles.title}>{t(lang, "reviewsFabNew")}</h3>

        <div style={styles.row}>
          <span style={styles.label}>{t(lang, "reviewsRatingLabel")}</span>
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              aria-label={`${r}`}
              style={{ ...styles.star, color: r <= rating ? "var(--accent)" : "var(--muted)" }}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className="zen-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(lang, "reviewsPlaceholder")}
          rows={4}
          style={styles.textarea}
        />
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.cancel}>{t(lang, "reviewsCancel")}</button>
          <button
            type="button"
            disabled={submitting || !text.trim()}
            onClick={handleSubmit}
            style={{ ...styles.submit, opacity: submitting || !text.trim() ? 0.5 : 1 }}
          >
            {submitting ? "..." : t(lang, "reviewsSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 100,
  },
  sheet: {
    width: "100%", maxWidth: 480,
    background: "var(--bg)",
    borderRadius: "16px 16px 0 0",
    padding: "12px 20px 24px",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    background: "var(--border)", margin: "0 auto 14px",
  },
  title: { margin: "0 0 14px", fontSize: 16, fontWeight: 700 },
  row: { display: "flex", alignItems: "center", gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: "var(--muted)", marginRight: 4 },
  star: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 0 },
  textarea: {
    width: "100%", padding: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)",
    fontSize: 14, fontFamily: "inherit",
    resize: "vertical", marginBottom: 10, boxSizing: "border-box",
  },
  error: { color: "var(--accent)", fontSize: 13, margin: "0 0 10px" },
  actions: { display: "flex", gap: 8 },
  cancel: {
    flex: 1, padding: 12,
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--muted)",
    fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  },
  submit: {
    flex: 1, padding: 12,
    background: "var(--accent)", border: "none",
    borderRadius: 10, color: "#fff",
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
};
```

- [ ] **Step 2: Переписать `Reviews.tsx`**

`frontend/src/pages/Reviews.tsx` — полностью заменить:

```tsx
import { useState, useEffect, useMemo } from "react";
import {
  getReviews,
  addReview,
  addReviewComment,
  type Review,
  type ReviewComment,
} from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { NewReviewSheet } from "../components/NewReviewSheet";

interface ReviewsProps {
  userId: string;
  firstName: string;
  onBack: () => void;
}

function formatDate(s: string, lang: string) {
  try {
    return new Date(s).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return s; }
}

export function Reviews({ userId, firstName }: ReviewsProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");

  const refresh = () => {
    setLoading(true);
    getReviews().then(setReviews).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const { average, distribution } = useMemo(() => {
    if (reviews.length === 0) return { average: 0, distribution: [0, 0, 0, 0, 0] };
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    reviews.forEach((r) => {
      const clamped = Math.min(5, Math.max(1, r.rating));
      dist[clamped - 1] += 1;
      sum += clamped;
    });
    return { average: sum / reviews.length, distribution: dist };
  }, [reviews]);

  const handleAddReview = async (rating: number, text: string) => {
    setSubmitting(true);
    setError("");
    try {
      await addReview(userId, { user_name: firstName, rating, text });
      setSheetOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "reviewsAddError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (reviewId: number) => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await addReviewComment(reviewId, userId, { user_name: firstName, text: commentText.trim() });
      setCommentText("");
      setCommentFor(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "reviewsCommentError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={styles.wrap}><p style={styles.loading}>{t(lang, "loading")}</p></div>;
  }

  const maxCount = Math.max(1, ...distribution);

  return (
    <div style={styles.wrap}>
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "reviewsTitle")}</h2>

      {reviews.length > 0 ? (
        <div style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.big}>{average.toFixed(1).replace(".", ",")}</div>
            <div style={styles.heroStars} aria-hidden>★★★★★</div>
            <div style={styles.heroCount}>
              {t(lang, "reviewsRatingBasedOn").replace("{n}", String(reviews.length))}
            </div>
          </div>
          <div style={styles.heroBars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const c = distribution[star - 1];
              const w = Math.round((c / maxCount) * 100);
              return (
                <div key={star} style={styles.barRow}>
                  <span style={styles.barN}>{star}</span>
                  <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${w}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={styles.emptyWrap}>
          <p style={styles.empty}>{t(lang, "reviewsEmptyFirst")}</p>
        </div>
      )}

      <div style={styles.list}>
        {reviews.map((r) => (
          <article key={r.id} style={styles.card}>
            <header style={styles.cardHead}>
              <div style={styles.av}>{(r.user_name?.[0] || "?").toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.reviewName}>{r.user_name || t(lang, "guest")}</div>
                <div style={styles.reviewDate}>{formatDate(r.created_at, lang)}</div>
              </div>
              <div style={styles.starsRight} aria-label={`${r.rating} / 5`}>
                {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
              </div>
            </header>
            <p style={styles.text}>{r.text}</p>

            {r.comments?.map((c: ReviewComment) => (
              <div key={c.id} style={styles.reply}>
                <b style={styles.replyName}>{c.user_name || t(lang, "guest")}</b>
                <span style={styles.replyDate}>{formatDate(c.created_at, lang)}</span>
                <p style={styles.replyText}>{c.text}</p>
              </div>
            ))}

            {commentFor === r.id ? (
              <div style={styles.commentForm}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t(lang, "reviewsCommentPlaceholder")}
                  rows={2}
                  style={styles.commentInput}
                />
                <div style={styles.commentActions}>
                  <button type="button" onClick={() => handleAddComment(r.id)} disabled={submitting} style={styles.commentSubmit}>
                    {t(lang, "reviewsSend")}
                  </button>
                  <button type="button" onClick={() => { setCommentFor(null); setCommentText(""); }} style={styles.commentCancel}>
                    {t(lang, "reviewsCancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCommentFor(r.id)} style={styles.replyBtn}>
                {t(lang, "reviewsReply")}
              </button>
            )}
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        style={styles.fab}
        aria-label={t(lang, "reviewsFabNew")}
      >
        +
      </button>

      <NewReviewSheet
        open={sheetOpen}
        submitting={submitting}
        error={error}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleAddReview}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px", position: "relative" },
  title: { marginBottom: 16 },
  hero: {
    background: "linear-gradient(135deg, var(--accent), var(--accent-dim))",
    color: "#fff",
    borderRadius: 18, padding: 14,
    display: "flex", gap: 12, alignItems: "center",
    marginBottom: 16,
  },
  heroLeft: { flexShrink: 0 },
  big: { fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 800, lineHeight: 1 },
  heroStars: { fontSize: 14, letterSpacing: 2, marginTop: 4 },
  heroCount: { fontSize: 11, opacity: 0.85, marginTop: 2 },
  heroBars: { flex: 1, display: "flex", flexDirection: "column", gap: 3 },
  barRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 10 },
  barN: { width: 8, opacity: 0.9 },
  barTrack: { flex: 1, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", background: "#fff" },
  emptyWrap: { padding: "48px 24px", textAlign: "center" },
  empty: { color: "var(--muted)", fontSize: 14, margin: 0 },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: 12,
    display: "flex", flexDirection: "column", gap: 8,
  },
  cardHead: { display: "flex", alignItems: "center", gap: 8 },
  av: {
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(165,42,42,0.15)", color: "var(--accent)",
    fontWeight: 700, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  reviewName: { fontSize: 13, fontWeight: 700, margin: 0 },
  reviewDate: { fontSize: 11, color: "var(--muted)" },
  starsRight: { color: "var(--accent)", fontSize: 12, letterSpacing: 1 },
  text: { fontSize: 13, lineHeight: 1.5, margin: 0, color: "var(--text)" },
  reply: {
    background: "var(--bg)", borderLeft: "3px solid var(--accent)",
    padding: "8px 10px", borderRadius: 10,
  },
  replyName: { fontSize: 11, fontWeight: 700 },
  replyDate: { fontSize: 10, color: "var(--muted)", marginLeft: 8 },
  replyText: { fontSize: 12, margin: "4px 0 0" },
  commentForm: { marginTop: 4 },
  commentInput: {
    width: "100%", padding: 10,
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)",
    fontSize: 13, fontFamily: "inherit",
    marginBottom: 8, resize: "vertical", boxSizing: "border-box",
  },
  commentActions: { display: "flex", gap: 8 },
  commentSubmit: {
    padding: "8px 14px", background: "var(--accent)",
    border: "none", borderRadius: 10, color: "#fff",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  commentCancel: {
    padding: "8px 14px", background: "transparent",
    border: "1px solid var(--border)", borderRadius: 10,
    color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  replyBtn: {
    alignSelf: "flex-start", background: "none", border: "none",
    color: "var(--accent)", fontSize: 12, cursor: "pointer",
    padding: 0, fontFamily: "inherit",
  },
  fab: {
    position: "fixed",
    right: "max(20px, env(safe-area-inset-right))",
    bottom: "calc(64px + 20px + env(safe-area-inset-bottom))",
    width: 52, height: 52, borderRadius: "50%",
    background: "var(--accent)", color: "#fff",
    fontSize: 28, fontWeight: 400, lineHeight: 1,
    border: "none", cursor: "pointer",
    boxShadow: "0 4px 12px rgba(165,42,42,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 30,
  },
  loading: { textAlign: "center", padding: 48, color: "var(--muted)" },
};
```

- [ ] **Step 3: Проверить сборку и визуал**

```bash
cd frontend && npm run build
```

Expected: PASS.

`npm run dev` → «Отзывы»:
- Нет `BackButton`.
- Если отзывы есть — hero-баннер с рейтингом и распределением.
- Карточки отзывов с аватаром-инициалом и звёздами справа, ответы магазина/комментарии — с левой бордовой полосой.
- Кнопка «Ответить» открывает inline-форму.
- FAB «+» справа внизу над `BottomNavBar` открывает sheet с формой нового отзыва. Клик вне sheet или «Отмена» закрывает, «Отправить» добавляет и обновляет список.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NewReviewSheet.tsx frontend/src/pages/Reviews.tsx
git commit -m "feat(reviews): hero с рейтингом, FAB и sheet для нового отзыва"
```

---

## Task 7: Финальная проверка и пуш

- [ ] **Step 1: Полная сборка + типы**

```bash
cd frontend && npm run build
```

Expected: build успешен.

- [ ] **Step 2: Ручная проверка смоук-тестом**

`npm run dev`, пройти сценарий:

1. Каталог → нижний бар виден.
2. Открыть профиль через хедер → нет «Вернуться в каталог», есть hero + секции, нижний бар виден.
3. Клик по «Последние заказы» → история. Фильтры работают, карточки со stepper'ом, клик по карточке → продукт.
4. Вернуться на профиль, клик «Настройки» → новый theme picker, язык и валюта переключаются.
5. Открыть «Отзывы» → hero, FAB, sheet работает, новый отзыв добавляется.
6. На всех 4 страницах клик по «каталог» в нижнем баре возвращает в каталог.

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: пуш прошёл.

---

## Self-Review

Пробегусь по спеку против задач:

- Общие правила (удалить `BackButton`, добавить `BottomNavBar`, обёртка `maxWidth: 420 / padding-bottom: 96`) → Task 1 + Tasks 3–6.
- Профиль: hero, 3 секции (последние заказы / избранное / действия) → Task 5.
- История: pill-фильтры и stepper-timeline → Task 4.
- Настройки: visual theme picker, pill-чипы, секция «О приложении» → Task 3.
- Отзывы: hero с рейтингом и распределением, FAB, sheet, ответы магазина с акцентной полосой → Task 6.
- Что НЕ делаем (бэкенд, уведомления, фото в отзывах) → не добавлено в задачи ✅.

Placeholder-скан: нет «TBD»/«TODO» в коде задач. Все стили и импорты заданы явно.

Type-consistency: `Order`, `Product`, `Review`, `ReviewComment` используются консистентно, совпадают с `frontend/src/api.ts`. `NewReviewSheet` принимает `onSubmit(rating, text)` — ровно это и вызывается из `Reviews.tsx`. Типы `Lang` в `History` не менял, только структуру.

Всё сходится.
