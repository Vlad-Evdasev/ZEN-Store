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
  const DESC_BLOCK_MIN_HEIGHT = 64;
  const renderCard = (p: Product, wrapStyle: React.CSSProperties) => (
    <div key={p.id} style={wrapStyle}>
      <div style={styles.cardInner}>
        <ProductCard
        product={p}
        compact
        fillHeight
        descBlockMinHeight={DESC_BLOCK_MIN_HEIGHT}
        smallDescBlock
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
      <div className="zen-new-arrivals-header">
        <h2 className="zen-new-arrivals-title">{t(lang, "newArrivals")}</h2>
        <button type="button" className="zen-new-arrivals-view-all" onClick={onViewAll} aria-label={t(lang, "newArrivalsViewAll")}>
          {t(lang, "viewAll")} →
        </button>
      </div>
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
    maxWidth: "100%",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gridTemplateRows: "1fr",
    height: GRID_HEIGHT,
    minHeight: GRID_HEIGHT,
    gap: GRID_GAP,
    paddingLeft: 4,
    paddingRight: 4,
    alignItems: "stretch",
  },
  cardBig: {
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
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
    display: "flex",
    flexDirection: "column",
  },
  cardSmallBottom: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  cardInner: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
};
