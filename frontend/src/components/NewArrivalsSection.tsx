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
  /** Заполнять доступную высоту (каталог: от верха до карточек магазина) */
  fillAvailableSpace?: boolean;
}

export function NewArrivalsSection({
  products,
  onProductClick,
  onViewAll,
  wishlistIds,
  onToggleWishlist,
  reviewStats = {},
  fillAvailableSpace = false,
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
    <div style={fillAvailableSpace ? { ...styles.wrap, ...styles.wrapFill } : styles.wrap}>
      <div className="zen-new-arrivals-header">
        <h2 className="zen-new-arrivals-title">{t(lang, "newArrivals")}</h2>
        <button type="button" className="zen-new-arrivals-view-all" onClick={onViewAll} aria-label={t(lang, "newArrivalsViewAll")}>
          {t(lang, "viewAll")} →
        </button>
      </div>
      <div style={fillAvailableSpace ? { ...styles.grid, ...styles.gridFill } : styles.grid}>
        {first && renderCard(first, styles.cardBig)}
        <div style={styles.rightColumn}>
          {second && renderCard(second, styles.cardTopRight)}
          {third && renderCard(third, styles.cardBottomRight)}
        </div>
      </div>
    </div>
  );
}

const ROW_GAP = 16;
const COL_GAP = 16;
const GRID_HEIGHT = 400;

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    marginBottom: 24,
    minWidth: 0,
    maxWidth: "100%",
  },
  wrapFill: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    marginBottom: 0,
    paddingTop: 12,
  },
  /* Левая колонка шире правой; одна строка — высота левой = сумма правых. */
  grid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.6fr",
    gridTemplateRows: "1fr",
    gap: COL_GAP,
    height: GRID_HEIGHT,
    minHeight: GRID_HEIGHT,
    paddingLeft: 4,
    paddingRight: 4,
    alignItems: "stretch",
    alignContent: "stretch",
  },
  gridFill: {
    flex: 1,
    minHeight: 0,
    height: "100%",
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
    gap: ROW_GAP,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  },
  cardTopRight: {
    flex: "1.12 1 0",
    minHeight: 100,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  cardBottomRight: {
    flex: "0.88 1 0",
    minHeight: 100,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
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
