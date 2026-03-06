import type { Product } from "../api";
import { ProductCard } from "./ProductCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const PREVIEW_COUNT = 3;

interface NewArrivalsSectionProps {
  products: Product[];
  onProductClick: (id: number) => void;
  onViewAll: () => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
  reviewStats?: Record<number, { count: number; avg: number }>;
}

export function NewArrivalsSection({
  products,
  onProductClick,
  onViewAll,
  wishlistIds,
  onToggleWishlist,
  reviewStats = {},
}: NewArrivalsSectionProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  if (products.length === 0) return null;

  const [first, second, third] = products.slice(0, PREVIEW_COUNT);
  const renderCard = (p: Product, wrapStyle: React.CSSProperties) => (
    <div key={p.id} style={wrapStyle}>
      <ProductCard
        product={p}
        compact
        onClick={() => onProductClick(p.id)}
        inWishlist={wishlistIds.has(p.id)}
        onWishlistClick={(e) => {
          e.stopPropagation();
          onToggleWishlist(p.id);
        }}
        reviewCount={reviewStats[p.id]?.count}
        reviewAvg={reviewStats[p.id]?.avg}
      />
    </div>
  );

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>{t(lang, "newArrivals")}</h2>
      <div style={styles.grid}>
        {first && renderCard(first, styles.cardBig)}
        {second && renderCard(second, styles.cardSmall)}
        {third && renderCard(third, styles.cardSmallBottom)}
      </div>
      <button type="button" onClick={onViewAll} style={styles.viewAllBtn} aria-label={t(lang, "newArrivalsViewAll")}>
        {t(lang, "newArrivalsViewAll")} →
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: 24, minWidth: 0 },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    margin: "0 0 12px",
    paddingLeft: 4,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: 8,
    height: 320,
    paddingLeft: 4,
    paddingRight: 4,
  },
  cardBig: {
    gridColumn: 1,
    gridRow: "1 / -1",
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
  },
  cardSmall: {
    gridColumn: 2,
    gridRow: 1,
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
  },
  cardSmallBottom: {
    gridColumn: 2,
    gridRow: 2,
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
  },
  viewAllBtn: {
    marginTop: 12,
    marginLeft: 4,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
};
