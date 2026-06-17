import React from "react";

interface BottomNavBarProps {
  activeTab: "feed" | "create" | "orders" | "none";
  onFeed: () => void;
  onCreate: () => void;
  onOrders: () => void;
}

interface IconProps {
  active: boolean;
}

/* Лента «Вдохновиться» — 4-конечная спарк-звезда с малой искрой
   (метафора «смотри, что заказывают»). */
function FeedIcon({ active }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transition: "transform 0.25s ease" }}>
      <path
        d="M11 3 C11.4 7.7 13.3 9.6 18 10 C13.3 10.4 11.4 12.3 11 17 C10.6 12.3 8.7 10.4 4 10 C8.7 9.6 10.6 7.7 11 3 Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.7}
        strokeLinejoin="round"
      />
      <path
        d="M18 16 C18.2 18.1 19 18.9 21 19 C19 19.1 18.2 19.9 18 22 C17.8 19.9 17 19.1 15 19 C17 18.9 17.8 18.1 18 16 Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Заказать — звено цепи (ссылка) в круге: «вставь ссылку — закажем». */
function CreateIcon({ active }: IconProps) {
  const sw = active ? 2 : 1.7;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transition: "transform 0.25s ease" }}>
      <circle cx="12" cy="12" r="9.2" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : sw} />
      <g stroke={active ? "var(--bg)" : "currentColor"} strokeWidth="1.7" strokeLinecap="round">
        <path d="M10.6 13.4l2.8-2.8" />
        <path d="M9.4 11.4l-.7.7a1.9 1.9 0 002.7 2.7l.7-.7" />
        <path d="M14.6 12.6l.7-.7a1.9 1.9 0 00-2.7-2.7l-.7.7" />
      </g>
    </svg>
  );
}

/* Заказы — посылка/коробка карго: верхняя грань + диагональ шва. */
function OrdersIcon({ active }: IconProps) {
  const sw = active ? 2 : 1.7;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transition: "transform 0.25s ease" }}>
      <path d="M12 2.6l8 4.2v9.4l-8 4.2-8-4.2V6.8z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M4 6.9l8 4.2 8-4.2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
      <line x1="12" y1="11.1" x2="12" y2="20.4" stroke="currentColor" strokeWidth={sw} />
    </svg>
  );
}

export function BottomNavBar({ activeTab, onFeed, onCreate, onOrders }: BottomNavBarProps) {
  const renderItem = (
    onClick: () => void,
    isActive: boolean,
    label: string,
    Icon: React.ComponentType<IconProps>
  ) => (
    <button
      type="button"
      onClick={onClick}
      style={styles.btn}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
    >
      <span
        style={{
          ...styles.iconWrap,
          color: isActive ? "var(--accent)" : "var(--text)",
          transform: isActive ? "translateY(-1px) scale(1.04)" : "translateY(0) scale(1)",
          opacity: isActive ? 1 : 0.78,
        }}
      >
        <Icon active={isActive} />
      </span>
      <span
        aria-hidden
        style={{
          ...styles.dot,
          background: isActive ? "var(--accent)" : "transparent",
          transform: isActive ? "scale(1)" : "scale(0)",
        }}
      />
    </button>
  );

  return (
    <nav className="zen-bottom-nav" style={styles.nav}>
      {renderItem(onFeed, activeTab === "feed", "Вдохновиться", FeedIcon)}
      {renderItem(onCreate, activeTab === "create", "Заказать", CreateIcon)}
      {renderItem(onOrders, activeTab === "orders", "Мои заказы", OrdersIcon)}
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
    zIndex: 1250,
  },
  btn: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.22s ease, transform 0.22s ease, opacity 0.22s ease",
  },
  dot: {
    position: "absolute",
    bottom: 9,
    width: 4,
    height: 4,
    borderRadius: "50%",
    transition: "transform 0.22s ease, background 0.22s ease",
  },
};
