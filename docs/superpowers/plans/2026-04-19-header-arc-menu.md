# Header Arc Menu — план реализации

**Goal:** Заменить боковую панель меню на arc-меню, где при клике на бургер четыре пункта (Профиль, История, Отзывы, Настройки) разлетаются glass-кружками по дуге вокруг кнопки.

**Architecture:** Выделяем новый компонент `HeaderArcMenu` в `frontend/src/components/HeaderArcMenu.tsx`. Он принимает `open` и четыре колбэка, рендерит прозрачный overlay-ловец кликов и четыре абсолютно-позиционированных кружка. Позиционирование делается относительно обёртки хедера (иконки позиционируются относительно точки бургера через CSS-координаты). `App.tsx` отдаёт управление этому компоненту и удаляет старую боковую панель.

**Tech Stack:** React 18, TypeScript, инлайн-стили (`React.CSSProperties`), CSS-переменные проекта (`--accent`, `--bg-rgb`, `--text`, `--border`). Анимации через CSS transitions. Тестов в проекте нет — проверяем вручную по чек-листу.

Спек: `docs/superpowers/specs/2026-04-19-header-arc-menu-design.md`.

---

## File Structure

- **Создать:** `frontend/src/components/HeaderArcMenu.tsx` — компонент arc-меню (overlay + 4 кружка + их иконки).
- **Изменить:** `frontend/src/App.tsx` — удалить старую боковую панель, удалить 4 компонента `MenuIcon*` (переезжают в новый файл), вставить `<HeaderArcMenu />`, добавить вращение/цвет бургера и `Escape`-хэндлер, удалить неиспользуемые стили.

Каждая задача ниже — самостоятельный коммит. Между задачами собираем и смотрим вручную, чтобы ничего не сломалось по пути.

---

## Task 1: Каркас компонента `HeaderArcMenu`

Создаём новый компонент с props, переносим в него 4 SVG-иконки из `App.tsx`. На этой задаче ничего не рендерим в приложении — только готовим строительный блок.

**Files:**
- Create: `frontend/src/components/HeaderArcMenu.tsx`

- [ ] **Step 1: Создать файл с компонентом**

```tsx
import React, { useEffect } from "react";

export interface HeaderArcMenuProps {
  open: boolean;
  onClose: () => void;
  onProfile: () => void;
  onHistory: () => void;
  onReviews: () => void;
  onSettings: () => void;
}

const iconSize = 20;
const iconStyle: React.CSSProperties = {
  width: iconSize,
  height: iconSize,
  flexShrink: 0,
  color: "currentColor",
};

function IconProfile() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle}
      aria-hidden
    >
      <circle cx="12" cy="8" r="2.5" />
      <path d="M5 20v-2a5 5 0 0 1 10 0v2" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle}
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconReviews() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle}
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5.64 5.64l1.41 1.41m11.32 11.32l1.41 1.41M5.64 18.36l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  );
}

export function HeaderArcMenu({
  open,
  onClose,
  onProfile,
  onHistory,
  onReviews,
  onSettings,
}: HeaderArcMenuProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return null;
}
```

- [ ] **Step 2: Убедиться, что TypeScript компилируется**

Run: `cd frontend && npm run build`
Expected: сборка проходит без ошибок. Компонент пока ничего не рендерит (`return null`), но типы и импорты валидны.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/HeaderArcMenu.tsx
git commit -m "feat(header): каркас компонента HeaderArcMenu с иконками и Escape-хэндлером"
```

---

## Task 2: Overlay-ловец кликов и кнопки-кружки (без анимации)

Реализуем видимую часть: прозрачный overlay, четыре glass-кружка в финальных позициях по дуге. Пока без анимации появления — просто условный рендер по `open`. Кружки уже расставлены по правильным координатам, чтобы сразу видеть геометрию.

**Files:**
- Modify: `frontend/src/components/HeaderArcMenu.tsx`

- [ ] **Step 1: Добавить стили и структуру рендера**

Заменить последний `return null;` в функции `HeaderArcMenu` на рендер оверлея и кружков. Полный итоговый `return`:

```tsx
  return (
    <>
      {open && (
        <div
          style={styles.overlay}
          onClick={onClose}
          aria-hidden
        />
      )}
      <div style={styles.layer} aria-hidden={!open}>
        <button
          type="button"
          onClick={onProfile}
          aria-label="Профиль"
          tabIndex={open ? 0 : -1}
          style={{ ...styles.item, ...positions[0], ...(open ? styles.itemOpen : styles.itemClosed) }}
        >
          <IconProfile />
        </button>
        <button
          type="button"
          onClick={onHistory}
          aria-label="История"
          tabIndex={open ? 0 : -1}
          style={{ ...styles.item, ...positions[1], ...(open ? styles.itemOpen : styles.itemClosed) }}
        >
          <IconHistory />
        </button>
        <button
          type="button"
          onClick={onReviews}
          aria-label="Отзывы"
          tabIndex={open ? 0 : -1}
          style={{ ...styles.item, ...positions[2], ...(open ? styles.itemOpen : styles.itemClosed) }}
        >
          <IconReviews />
        </button>
        <button
          type="button"
          onClick={onSettings}
          aria-label="Настройки"
          tabIndex={open ? 0 : -1}
          style={{ ...styles.item, ...positions[3], ...(open ? styles.itemOpen : styles.itemClosed) }}
        >
          <IconSettings />
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Добавить объект стилей и позиции после компонента**

В конце файла, после `export function HeaderArcMenu`:

```tsx
// Позиции кружков по дуге радиуса 90px от центра бургера.
// Углы считаются от вертикали вниз (0°) по часовой к горизонтали (90°).
// Порядок: Профиль (83°, ближе к горизонтали) → ... → Настройки (17°, ближе к вертикали).
const RADIUS = 90;
const ANGLES_DEG = [83, 61, 39, 17];

const positions: React.CSSProperties[] = ANGLES_DEG.map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const x = Math.sin(rad) * RADIUS;
  const y = Math.cos(rad) * RADIUS;
  return {
    // `translate` внутри общего transform. Мы не можем смешать с translate(-50%,-50%),
    // поэтому центрируем сам анкер через top/left и задаём итоговый offset здесь через CSS var.
    ["--arc-x" as string]: `${x}px`,
    ["--arc-y" as string]: `${y}px`,
  };
});

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 18,
  },
  // Слой-анкер, совпадающий по координатам с центром бургера.
  // В App.tsx кнопка бургера получит position: relative, а этот <div/> будет её
  // дочерним элементом, абсолютно позиционированным по центру.
  layer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    pointerEvents: "none",
    zIndex: 22,
  },
  item: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: "50%",
    background: "rgba(var(--bg-rgb), 0.75)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid var(--border)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text)",
    padding: 0,
    cursor: "pointer",
    transform:
      "translate(var(--arc-x, 0px), var(--arc-y, 0px)) scale(1)",
    opacity: 1,
    transition:
      "transform 500ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
    pointerEvents: "auto",
  },
  itemOpen: {
    transform:
      "translate(var(--arc-x, 0px), var(--arc-y, 0px)) scale(1)",
    opacity: 1,
  },
  itemClosed: {
    transform: "translate(0px, 0px) scale(0.6)",
    opacity: 0,
    pointerEvents: "none",
  },
};
```

- [ ] **Step 3: Проверить компиляцию**

Run: `cd frontend && npm run build`
Expected: сборка проходит. Компонент рендерится, но в `App.tsx` пока не вставлен — визуально ничего не меняется.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HeaderArcMenu.tsx
git commit -m "feat(header): рендер arc-меню с 4 glass-кружками по дуге 90px"
```

---

## Task 3: Подключить `HeaderArcMenu` в `App.tsx` и убрать старую панель

Вставляем компонент в приложение, удаляем старую боковую панель и её стили, удаляем компоненты `MenuIcon*` (они переехали).

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Добавить импорт `HeaderArcMenu`**

В начало `App.tsx` рядом с другими импортами компонентов добавить:

```tsx
import { HeaderArcMenu } from "./components/HeaderArcMenu";
```

- [ ] **Step 2: Удалить компоненты `MenuIconProfile`, `MenuIconHistory`, `MenuIconReviews`, `MenuIconSettings`**

В `frontend/src/App.tsx` удалить 4 функции `MenuIcon*` (сейчас строки примерно 32–62). Они больше не используются после следующего шага.

- [ ] **Step 3: Удалить блок старой боковой панели**

Найти в `App.tsx` блок, начинающийся с `{menuOpen && (` после `<div style={styles.headerSpacer} aria-hidden />` — это старый overlay и боковая панель со списком пунктов (около строк 332–366). Удалить весь этот блок целиком.

- [ ] **Step 4: Заменить кнопку бургера на версию с вложенным `HeaderArcMenu`**

Найти существующую кнопку бургера:

```tsx
<button
  type="button"
  onClick={() => setMenuOpen(!menuOpen)}
  className="zen-header-hamburger"
  style={styles.hamburger}
  aria-label="Меню"
>
  <HeaderIconHamburger />
</button>
```

И заменить её на:

```tsx
<button
  type="button"
  onClick={() => setMenuOpen(!menuOpen)}
  className="zen-header-hamburger"
  style={{
    ...styles.hamburger,
    position: "relative",
    color: menuOpen ? "var(--accent)" : "var(--text)",
    transform: menuOpen ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), color 350ms ease",
    ["--arc-counter-rotate" as string]: menuOpen ? "-90deg" : "0deg",
  }}
  aria-label="Меню"
  aria-expanded={menuOpen}
>
  <HeaderIconHamburger />
  <HeaderArcMenu
    open={menuOpen}
    onClose={() => setMenuOpen(false)}
    onProfile={openProfile}
    onHistory={openHistory}
    onReviews={openReviews}
    onSettings={openSettings}
  />
</button>
```

Причина такой вложенности: бургеру нужен `position: relative` и визуальный центр — точка отсчёта для кружков arc-меню. Кружки абсолютно позиционируются относительно бургера и «вылетают» за его границы.

**Нюанс с поворотом:** кнопка бургера получает `transform: rotate(90deg)` при открытии. Без компенсации кружки повернулись бы вместе с ней. Поэтому мы передаём CSS-переменную `--arc-counter-rotate`, которая на открытом состоянии равна `-90deg`. Компонент `HeaderArcMenu` применяет этот поворот к своему слою-анкеру в обратную сторону (настроено в Step 5). В итоге кружки остаются в правильной мировой геометрии независимо от поворота бургера.

- [ ] **Step 5: Обновить `styles.layer` в `HeaderArcMenu.tsx` для компенсации поворота**

В `frontend/src/components/HeaderArcMenu.tsx` заменить `styles.layer` на версию с компенсирующим поворотом (`--arc-counter-rotate` передаётся с кнопки бургера, которую мы настроили в Step 4):

```tsx
  layer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    pointerEvents: "none",
    zIndex: 22,
    transform: "rotate(var(--arc-counter-rotate, 0deg))",
    transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
```

Так при повороте бургера на +90° слой arc-меню получит компенсирующие `-90deg` и кружки останутся в правильной мировой геометрии.

Так при повороте бургера на +90° слой arc-меню получит компенсирующие -90° и останется в мировой системе координат.

- [ ] **Step 6: Удалить неиспользуемые стили**

Из объекта `styles` в `App.tsx` удалить: `menuOverlay`, `menu`, `menuItem`, `menuItemContent`. Убедиться, что они больше нигде не используются (поиск по `App.tsx` по этим именам).

- [ ] **Step 7: Собрать и запустить фронт, проверить вручную**

Run:
```bash
cd frontend && npm run build
npm run dev
```

Открыть приложение в браузере. Проверить по чек-листу:

1. Клик на бургер — 4 кружка плавно разлетаются по дуге вниз-вправо.
2. Порядок сверху (от горизонтали) вниз (к вертикали): Профиль → История → Отзывы → Настройки.
3. Клик на бургер ещё раз — кружки плавно «сворачиваются» обратно.
4. Клик по любому кружку — происходит переход на страницу и меню закрывается.
5. Клик вне кружков (по каталогу) — меню закрывается.
6. Нажатие `Escape` — меню закрывается.
7. Бургер поворачивается на 90° и меняется цвет на акцентный при открытии.
8. Кружки не поворачиваются вместе с бургером (остаются в правильной геометрии).
9. Старая боковая панель не появляется.
10. В тёмной теме (если переключается) обводка и фон кружков читаются.

Ожидаемый результат: все 10 пунктов выполняются.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/HeaderArcMenu.tsx
git commit -m "feat(header): заменить боковую панель на arc-меню с glass-кружками"
```

---

## Task 4: Поддержка `prefers-reduced-motion` и fallback без backdrop-filter

Добавить две вещи для устойчивости: если пользователь предпочитает уменьшенную анимацию — отключаем переходы; если браузер не поддерживает `backdrop-filter` — кружки становятся непрозрачными.

**Files:**
- Modify: `frontend/src/components/HeaderArcMenu.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Добавить CSS-правила в `index.css`**

В конец `frontend/src/index.css` добавить:

```css
/* Arc-menu в хедере */

/* Fallback для браузеров без backdrop-filter */
@supports not (backdrop-filter: blur(10px)) {
  .zen-arc-item {
    background: var(--bg) !important;
  }
}

/* Уважаем prefers-reduced-motion: отключаем движение, оставляем только fade */
@media (prefers-reduced-motion: reduce) {
  .zen-arc-item,
  .zen-arc-layer {
    transition: opacity 150ms ease !important;
    transform: translate(var(--arc-x, 0px), var(--arc-y, 0px)) !important;
  }
  .zen-arc-item.zen-arc-item--closed {
    transform: translate(var(--arc-x, 0px), var(--arc-y, 0px)) !important;
    opacity: 0 !important;
  }
}
```

- [ ] **Step 2: Проставить className на элементы `HeaderArcMenu`**

В `HeaderArcMenu.tsx` добавить классы:
- На контейнер `styles.layer` — `className="zen-arc-layer"`.
- На каждую кнопку-кружок — `className={open ? "zen-arc-item" : "zen-arc-item zen-arc-item--closed"}`.

Конкретно, заменить каждую из 4 кнопок (`onProfile`, `onHistory`, `onReviews`, `onSettings`) так, чтобы у них был `className`, например для Профиля:

```tsx
<button
  type="button"
  onClick={onProfile}
  aria-label="Профиль"
  tabIndex={open ? 0 : -1}
  className={open ? "zen-arc-item" : "zen-arc-item zen-arc-item--closed"}
  style={{ ...styles.item, ...positions[0], ...(open ? styles.itemOpen : styles.itemClosed) }}
>
  <IconProfile />
</button>
```

И контейнер:

```tsx
<div className="zen-arc-layer" style={styles.layer} aria-hidden={!open}>
```

- [ ] **Step 3: Проверить вручную**

Run:
```bash
cd frontend && npm run build
npm run dev
```

1. Открыть DevTools → Rendering → включить `prefers-reduced-motion: reduce`. Открыть/закрыть меню — кружки должны появляться/исчезать быстро (fade), без плавного движения по дуге.
2. Вернуть motion: full — движение по дуге восстанавливается.
3. (Опционально) Проверить в Safari / старых браузерах, что fallback-фон работает — но так как современные браузеры все поддерживают `backdrop-filter`, этот пункт не блокирующий.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HeaderArcMenu.tsx frontend/src/index.css
git commit -m "feat(header): поддержка prefers-reduced-motion и fallback без backdrop-filter в arc-меню"
```

---

## Self-Review Checklist

После завершения всех задач пробежаться по спеке и убедиться, что всё покрыто:

1. ✅ Геометрия: радиус 90px, углы 17°/39°/61°/83° — в Task 2, `RADIUS` и `ANGLES_DEG`.
2. ✅ Порядок Профиль → Настройки — в Task 2, `ANGLES_DEG` идут от 83° (Профиль) до 17° (Настройки).
3. ✅ Анимация: одновременный ease-out, cubic-bezier, 500ms/350ms — в Task 2, `transition` в `styles.item`.
4. ✅ Glass-кружки с blur и обводкой — в Task 2, `styles.item`.
5. ✅ Прозрачный overlay-ловец — в Task 2, `styles.overlay`.
6. ✅ Поворот бургера на 90° + смена цвета — в Task 3 Step 4.
7. ✅ Закрытие по Escape — в Task 1.
8. ✅ Закрытие по клику вне — в Task 2 (onClick на overlay).
9. ✅ Закрытие по выбору пункта — это поведение внутри `openProfile` и т.д., они уже делают `setMenuOpen(false)` (не трогаем).
10. ✅ prefers-reduced-motion — в Task 4.
11. ✅ Fallback без backdrop-filter — в Task 4.
12. ✅ Удаление старой панели и стилей `menu`/`menuOverlay`/`menuItem` — в Task 3 Step 6.
13. ✅ Перенос иконок `MenuIcon*` в новый файл — в Task 1 (как `IconProfile` и т.д.) + удаление из App.tsx в Task 3 Step 2.

**Out-of-scope (не делаем):** bottom-nav, иконки в правой части хедера, индикатор рейтинга отзывов в arc-меню.
