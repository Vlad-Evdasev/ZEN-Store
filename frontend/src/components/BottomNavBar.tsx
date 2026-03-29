import React from "react";

interface BottomNavBarProps {
  activeTab: "catalog" | "custom" | "arrivals";
  onCatalog: () => void;
  onCustomOrder: () => void;
  onArrivals: () => void;
}

function CatalogIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FormIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  );
}

function BoxIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function BottomNavBar({ activeTab, onCatalog, onCustomOrder, onArrivals }: BottomNavBarProps) {
  return (
    <nav style={styles.nav}>
      <button
        type="button"
        onClick={onCatalog}
        style={{ ...styles.btn, ...(activeTab === "catalog" ? styles.btnActive : {}) }}
        aria-label="Каталог"
      >
        <CatalogIcon active={activeTab === "catalog"} />
      </button>
      <button
        type="button"
        onClick={onCustomOrder}
        style={{ ...styles.btn, ...(activeTab === "custom" ? styles.btnActive : {}) }}
        aria-label="Заказать не из каталога"
      >
        <FormIcon active={activeTab === "custom"} />
      </button>
      <button
        type="button"
        onClick={onArrivals}
        style={{ ...styles.btn, ...(activeTab === "arrivals" ? styles.btnActive : {}) }}
        aria-label="Товары которые мы привезли"
      >
        <BoxIcon active={activeTab === "arrivals"} />
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
    justifyContent: "space-around",
    alignItems: "center",
    height: 60,
    borderTop: "1px solid var(--border)",
    background: "var(--bg)",
    zIndex: 20,
    paddingBottom: "env(safe-area-inset-bottom)",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    transition: "color 0.2s ease",
  },
  btnActive: {
    color: "var(--accent)",
  },
};
