import type { Product } from "../api";
import { ProductCard } from "./ProductCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewArrivalsSectionProps {
  products: Product[];
  onProductClick: (id: number) => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
  reviewStats?: Record<number, { count: number; avg: number }>;
}

export function NewArrivalsSection({
  products,
  onProductClick,
  wishlistIds,
  onToggleWishlist,
  reviewStats = {},
}: NewArrivalsSectionProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  if (products.length === 0) return null;

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>{t(lang, "newArrivals")}</h2>
      <div style={styles.row} className="hide-scrollbar">
        {products.map((p) => (
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
    display: "flex",
    gap: 12,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 12,
    paddingLeft: 4,
    paddingRight: 4,
    WebkitOverflowScrolling: "touch",
  },
  cardWrap: {
    flexShrink: 0,
    width: 160,
  },
};
