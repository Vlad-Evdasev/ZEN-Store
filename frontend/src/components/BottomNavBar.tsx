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

/* Каталог — стопка карточек (deck): современная bento-метафора
   коллекции. Задняя карточка повёрнута и приглушена, передняя
   заливается в активе.                                              */
function CatalogIcon({ active }: IconProps) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transition: "transform 0.25s ease" }}
    >
      {/* задняя карточка — повёрнута на 10°, тонкая обводка */}
      <rect
        x="7"
        y="3"
        width="13"
        height="13.5"
        rx="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(10 13.5 9.75)"
        opacity="0.55"
      />
      {/* передняя карточка — только обводка; в активе цвет берётся
         из currentColor (accent), толщина чуть больше для веса.     */}
      <rect
        x="3.5"
        y="6.8"
        width="13.5"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Custom Order — бумажный самолётик: отправить запрос на товар,
   которого нет в каталоге. Геометричный дартс с хорошо читаемым
   изгибом «фальцовки».                                              */
function CustomOrderIcon({ active }: IconProps) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transition: "transform 0.25s ease" }}
    >
      {/* силуэт самолётика: длинная сторона — фюзеляж, V-образный
         вырез снизу обозначает крылья и хвост                      */}
      <path
        d="M3.2 11.4 L 20.5 3.5 L 14.2 20.4 L 11.2 13.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* линия фальцовки — от носа к V-вырезу */}
      <path
        d="M20.5 3.5 L 11.2 13.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* Новинки — 4-конечная «спарк-звезда» с акцентной малой искрой
   (метафора «just dropped», как в Apple Intelligence).             */
function ArrivalsIcon({ active }: IconProps) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transition: "transform 0.25s ease" }}
    >
      {/* большая искра с вогнутыми сторонами */}
      <path
        d="M11 3 C11.4 7.7 13.3 9.6 18 10 C13.3 10.4 11.4 12.3 11 17 C10.6 12.3 8.7 10.4 4 10 C8.7 9.6 10.6 7.7 11 3 Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.7}
        strokeLinejoin="round"
      />
      {/* малая акцентная искра */}
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

export function BottomNavBar({ activeTab, onCatalog, onCustomOrder, onArrivals }: BottomNavBarProps) {
  const isCatalog = activeTab === "catalog";
  const isCustom = activeTab === "custom";
  const isArrivals = activeTab === "arrivals";

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
    <nav style={styles.nav}>
      {renderItem(onCatalog, isCatalog, "Каталог", CatalogIcon)}
      {renderItem(onCustomOrder, isCustom, "Заказать не из каталога", CustomOrderIcon)}
      {renderItem(onArrivals, isArrivals, "Товары которые мы привезли", ArrivalsIcon)}
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
