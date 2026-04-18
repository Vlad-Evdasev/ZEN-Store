import React from "react";

interface BottomNavBarProps {
  activeTab: "catalog" | "custom" | "arrivals";
  onCatalog: () => void;
  onCustomOrder: () => void;
  onArrivals: () => void;
}

interface IconProps {
  active: boolean;
}

function CatalogIcon({ active }: IconProps) {
  const stroke = active ? 2.25 : 1.75;
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "stroke-width 0.25s ease" }}
    >
      <path d="M4 7.5l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4" opacity={active ? 1 : 0.55} />
      <path d="M4 16.5l8 4 8-4" opacity={active ? 1 : 0.35} />
    </svg>
  );
}

function CustomOrderIcon({ active }: IconProps) {
  const stroke = active ? 2.25 : 1.75;
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "stroke-width 0.25s ease" }}
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function ArrivalsIcon({ active }: IconProps) {
  const stroke = active ? 2.25 : 1.75;
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "stroke-width 0.25s ease" }}
    >
      <path d="M12 3l2.2 4.6L19 9l-3.5 3.3.9 4.9L12 14.9 7.6 17.2l.9-4.9L5 9l4.8-1.4L12 3z" />
      <path d="M5 20h14" opacity={active ? 1 : 0.5} strokeDasharray={active ? "0" : "2 3"} />
    </svg>
  );
}

export function BottomNavBar({ activeTab, onCatalog, onCustomOrder, onArrivals }: BottomNavBarProps) {
  const isCatalog = activeTab === "catalog";
  const isCustom = activeTab === "custom";
  const isArrivals = activeTab === "arrivals";

  return (
    <nav style={styles.nav}>
      {/* Ряд кнопок фиксированной высоты — не зависит от safe-area */}
      <div style={styles.row}>
        <button
          type="button"
          onClick={onCatalog}
          style={{ ...styles.btn, ...(isCatalog ? styles.btnActive : {}) }}
          aria-label="Каталог"
          aria-current={isCatalog ? "page" : undefined}
        >
          <span style={{ ...styles.iconWrap, ...(isCatalog ? styles.iconWrapActive : {}) }}>
            <CatalogIcon active={isCatalog} />
          </span>
        </button>
        <button
          type="button"
          onClick={onCustomOrder}
          style={{ ...styles.btn, ...(isCustom ? styles.btnActive : {}) }}
          aria-label="Заказать не из каталога"
          aria-current={isCustom ? "page" : undefined}
        >
          <span style={{ ...styles.iconWrap, ...(isCustom ? styles.iconWrapActive : {}) }}>
            <CustomOrderIcon active={isCustom} />
          </span>
        </button>
        <button
          type="button"
          onClick={onArrivals}
          style={{ ...styles.btn, ...(isArrivals ? styles.btnActive : {}) }}
          aria-label="Товары которые мы привезли"
          aria-current={isArrivals ? "page" : undefined}
        >
          <span style={{ ...styles.iconWrap, ...(isArrivals ? styles.iconWrapActive : {}) }}>
            <ArrivalsIcon active={isArrivals} />
          </span>
        </button>
      </div>
      {/* Safe-area заглушка — только пространство, без контента */}
      <div style={styles.safeArea} />
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    borderTop: "1px solid var(--border)",
    background: "rgba(var(--bg-rgb), 0.92)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 20,
  },
  row: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    height: 64,
  },
  safeArea: {
    height: "env(safe-area-inset-bottom)",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    background: "transparent",
    border: "none",
    padding: 0,
    color: "var(--muted)",
    cursor: "pointer",
    transition: "color 0.25s ease",
  },
  btnActive: {
    color: "var(--accent)",
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1.5px solid transparent",
    transition: "border-color 0.25s ease, background-color 0.25s ease",
  },
  iconWrapActive: {
    borderColor: "var(--accent)",
    background: "transparent",
  },
};
