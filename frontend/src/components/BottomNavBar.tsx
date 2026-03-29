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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function FormIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function BoxIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5H17" />
      <path d="M7 12.5H3.5a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5H7" />
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
    background: "rgba(var(--bg-rgb), 0.92)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
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
