import React from "react";

interface BottomNavBarProps {
  activeTab: "catalog" | "custom" | "arrivals" | "none";
  onCatalog: () => void;
  onCustomOrder: () => void;
  onArrivals: () => void;
}

interface IconProps {
  active: boolean;
}

function CatalogIcon({ active }: IconProps) {
  const stroke = active ? 1.9 : 1.6;
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
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16.5l8 4 8-4" />
    </svg>
  );
}

function CustomOrderIcon({ active }: IconProps) {
  const stroke = active ? 1.9 : 1.6;
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
      <circle cx="11" cy="11" r="6.5" />
      <line x1="20.5" y1="20.5" x2="16.1" y2="16.1" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ArrivalsIcon({ active }: IconProps) {
  const stroke = active ? 1.9 : 1.6;
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
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
  );
}

export function BottomNavBar({ activeTab, onCatalog, onCustomOrder, onArrivals }: BottomNavBarProps) {
  const isCatalog = activeTab === "catalog";
  const isCustom = activeTab === "custom";
  const isArrivals = activeTab === "arrivals";

  return (
    <nav style={styles.nav}>
      <button
        type="button"
        onClick={onCatalog}
        style={{ ...styles.btn, ...(isCatalog ? styles.btnActive : {}) }}
        aria-label="Каталог"
        aria-current={isCatalog ? "page" : undefined}
      >
        <span style={styles.iconWrap}>
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
        <span style={styles.iconWrap}>
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
        <span style={styles.iconWrap}>
          <ArrivalsIcon active={isArrivals} />
        </span>
      </button>
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
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 64,
    borderTop: "1px solid var(--border)",
    background: "var(--bg)",
    zIndex: 20,
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
    color: "var(--text)",
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
  },
};
