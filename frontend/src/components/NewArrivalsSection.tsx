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
      <div style={styles.cardInner}>
        <ProductCard
        product={p}
        compact
        fillHeight
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
    </div>
  );

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onViewAll} style={styles.titleBtn} aria-label={t(lang, "newArrivalsViewAll")}>
        {t(lang, "newArrivals")} →
      </button>
      <div style={styles.grid}>
        {first && renderCard(first, styles.cardBig)}
        <div style={styles.rightColumn}>
          {second && renderCard(second, styles.cardSmall)}
          {third && renderCard(third, styles.cardSmallBottom)}
        </div>
      </div>
    </div>
  );
}

const GRID_GAP = 8;
const GRID_HEIGHT = 320;

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    marginBottom: 24,
    minWidth: 0,
    maxWidth: 480,
    marginLeft: "auto",
    marginRight: "auto",
  },
  titleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "0 4px 12px",
    background: "none",
    border: "none",
    fontFamily: "inherit",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    textAlign: "left",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gridTemplateRows: "1fr",
    gap: GRID_GAP,
    height: GRID_HEIGHT,
    paddingLeft: 4,
    paddingRight: 4,
  },
  cardBig: {
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: GRID_GAP,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
  },
  cardSmall: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  cardSmallBottom: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  cardInner: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
};
