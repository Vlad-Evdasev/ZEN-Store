import React, { useEffect } from "react";

// Родитель должен иметь `position: relative/absolute/fixed`: layer
// рендерится абсолютно от центра родителя (top: 50%, left: 50%).
// Каждый из onProfile/onHistory/onReviews/onSettings отвечает и за переход,
// и за закрытие меню — компонент сам onClose при выборе пункта не вызывает.
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
    ["--arc-x" as string]: `${x}px`,
    ["--arc-y" as string]: `${y}px`,
  };
});

export function HeaderArcMenu({
  open,
  onClose,
  onProfile,
  onHistory,
  onReviews,
  onSettings,
}: HeaderArcMenuProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Порядок совпадает с ANGLES_DEG — i-ый пункт получает positions[i].
  const items: Array<{ label: string; onClick: () => void; Icon: React.FC }> = [
    { label: "Профиль", onClick: onProfile, Icon: IconProfile },
    { label: "История", onClick: onHistory, Icon: IconHistory },
    { label: "Отзывы", onClick: onReviews, Icon: IconReviews },
    { label: "Настройки", onClick: onSettings, Icon: IconSettings },
  ];

  return (
    <>
      {open && (
        <div
          style={styles.overlay}
          onClick={onClose}
          aria-hidden
        />
      )}
      <div className="zen-arc-layer" style={styles.layer} aria-hidden={!open}>
        {items.map(({ label, onClick, Icon }, i) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            aria-label={label}
            tabIndex={open ? 0 : -1}
            className={open ? "zen-arc-item" : "zen-arc-item zen-arc-item--closed"}
            style={{ ...styles.item, ...positions[i], ...(open ? styles.itemOpen : styles.itemClosed) }}
          >
            <Icon />
          </button>
        ))}
      </div>
    </>
  );
}

// Иерархия z-index: BottomNavBar = 20. Overlay (18) под нижней навигацией,
// чтобы та оставалась кликабельной; кружки меню (22) — выше всего хедера.
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 18,
  },
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
};
