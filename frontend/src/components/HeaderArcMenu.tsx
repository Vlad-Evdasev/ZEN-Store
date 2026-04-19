import React, { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "../context/SettingsContext";
import { t } from "../i18n";

// Меню рендерится через React portal в document.body, поэтому не зависит
// от stacking context хедера и гарантированно отображается поверх всего контента.
// `anchorRef` указывает на элемент-триггер (кнопку бургера): позиции кружков
// вычисляются от его центра в viewport-координатах.
// Каждый из onSupport/onHistory/onReviews/onSettings отвечает и за переход,
// и за закрытие меню — компонент сам onClose при выборе пункта не вызывает.
export interface HeaderArcMenuProps {
  open: boolean;
  lang: Lang;
  anchorRef: React.RefObject<HTMLElement>;
  supportUnreadCount?: number;
  onClose: () => void;
  onSupport: () => void;
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

function IconSupport() {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
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

// Позиции кружков по дуге радиуса RADIUS от центра бургера.
// Углы отсчитываются от вертикали вниз (0°) по часовой к горизонтали (90°).
// При RADIUS=85 и диаметре 40px шаг 30° даёт ~4px зазор (без перекрытий).
// Диапазон 0°..90° держит все кружки в пределах экрана (Настройки не уходят за левый край).
// Порядок: Поддержка (90°, справа на уровне бургера) → История → Отзывы → Настройки (0°, строго под бургером).
const RADIUS = 85;
const ANGLES_DEG = [90, 60, 30, 0];

const positions: React.CSSProperties[] = ANGLES_DEG.map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const x = Math.sin(rad) * RADIUS;
  const y = Math.cos(rad) * RADIUS;
  return {
    ["--arc-x" as string]: `${x}px`,
    ["--arc-y" as string]: `${y}px`,
  };
});

export function HeaderArcMenu({
  open,
  lang,
  anchorRef,
  supportUnreadCount = 0,
  onClose,
  onSupport,
  onHistory,
  onReviews,
  onSettings,
}: HeaderArcMenuProps) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  // Позицию anchor пересчитываем при открытии и на resize/scroll, пока open.
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchor({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Порядок совпадает с ANGLES_DEG — i-ый пункт получает positions[i].
  const items: Array<{ key: string; label: string; onClick: () => void; Icon: React.FC; badge?: boolean }> = [
    { key: "support", label: t(lang, "support"), onClick: onSupport, Icon: IconSupport, badge: supportUnreadCount > 0 },
    { key: "history", label: t(lang, "history"), onClick: onHistory, Icon: IconHistory },
    { key: "reviews", label: t(lang, "reviews"), onClick: onReviews, Icon: IconReviews },
    { key: "settings", label: t(lang, "settings"), onClick: onSettings, Icon: IconSettings },
  ];

  // Если меню закрыто и anchor ещё не измерялся — не рендерим вообще.
  // В открытом состоянии ждём первого замера (редкий edge-case: пока SSR/первая раскладка).
  if (!open && !anchor) return null;

  const layerStyle: React.CSSProperties = {
    ...styles.layer,
    left: anchor?.x ?? 0,
    top: anchor?.y ?? 0,
  };

  // Оверлей рендерится всегда (когда вообще есть anchor), чтобы работал fade-out
  // при закрытии. Видимость/pointer-events переключаются через open.
  const overlayStyle: React.CSSProperties = {
    ...styles.overlay,
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
  };

  return createPortal(
    <>
      <div
        className="zen-arc-overlay"
        style={overlayStyle}
        onClick={onClose}
        aria-hidden
      />
      <div className="zen-arc-layer" style={layerStyle} aria-hidden={!open}>
        {items.map(({ key, label, onClick, Icon, badge }, i) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            aria-label={label}
            tabIndex={open ? 0 : -1}
            className={open ? "zen-arc-item" : "zen-arc-item zen-arc-item--closed"}
            style={{ ...styles.item, ...positions[i], ...(open ? styles.itemOpen : styles.itemClosed) }}
          >
            <Icon />
            {badge && <span style={styles.itemDot} aria-hidden />}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}

// Иерархия z-index: хедер = 10 (auto, пока меню открыто — см. App.tsx),
// BottomNavBar = 20, search-row = 13, модалка фильтров = 100+.
// Overlay (1000) и layer арки (1001) портал-рендерятся в document.body и
// сравниваются глобально. Кнопка-триггер в хедере при menuOpen получает
// position: relative + z-index: 1002, чтобы быть над оверлеем, — это
// возможно только потому, что хедер временно без собственного z-index и
// не создаёт stacking-context.
const styles: Record<string, React.CSSProperties> = {
  // Затемнение + блюр заднего фона при раскрытом меню.
  // Анимируем opacity, чтобы при закрытии был плавный fade-out (а не мгновенный unmount).
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.45)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)",
    zIndex: 1000,
  },
  layer: {
    position: "fixed",
    width: 0,
    height: 0,
    pointerEvents: "none",
    zIndex: 1001,
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
    transition:
      "transform 500ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  itemOpen: {
    transform:
      "translate(var(--arc-x, 0px), var(--arc-y, 0px)) scale(1)",
    opacity: 1,
    pointerEvents: "auto",
  },
  itemClosed: {
    transform: "translate(0px, 0px) scale(0.6)",
    opacity: 0,
    pointerEvents: "none",
  },
  // Чуть крупнее и с бордером (в отличие от styles.headerDot в App.tsx),
  // т.к. дот сидит поверх полупрозрачного blurred-фона арк-кружка
  // и должен оставаться читаемым на разных подложках.
  itemDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    border: "1.5px solid var(--bg)",
    pointerEvents: "none",
  },
};
