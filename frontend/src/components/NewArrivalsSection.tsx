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

  const preview = products.slice(0, PREVIEW_COUNT);

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>{t(lang, "newArrivals")}</h2>
      <div style={styles.row}>
        {preview.map((p) => (
          <div key={p.id} style={styles.cardWrap}>
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
        ))}
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
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    paddingLeft: 4,
    paddingRight: 4,
  },
  cardWrap: {
    minWidth: 0,
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
