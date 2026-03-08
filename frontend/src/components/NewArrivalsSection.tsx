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
      <button type="button" onClick={onViewAll} style={styles.titleBtn} aria-label={t(lang, "newArrivalsViewAll")}>
        <span>{t(lang, "newArrivals")}</span>
        <span style={styles.titleArrow} aria-hidden>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
            <circle cx="16" cy="16" r="12" />
            <path d="M14 11l6 5-6 5" />
          </svg>
        </span>
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
  titleArrow: {
    color: "var(--accent)",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
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
