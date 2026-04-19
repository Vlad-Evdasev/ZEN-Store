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
      <path d="M4 12l8 4 8-4" opacity={active ? 1 : 0.75} />
      <path d="M4 16.5l8 4 8-4" opacity={active ? 1 : 0.55} />
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
      <path d="M15.2 4.6l4.2 4.2" />
      <path d="M17.4 2.4a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8L8.5 20.7 3 21l.3-5.5L17.4 2.4z" />
      <path d="M5 19l1.8-.3L6.3 17" opacity={active ? 1 : 0.75} />
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
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" opacity={active ? 1 : 0.75} />
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
    color: "color-mix(in srgb, var(--text) 75%, transparent)",
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
