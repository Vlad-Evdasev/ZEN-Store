import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewArrivalsPageProps {
  products: Product[];
  onBack: () => void;
  onProductClick: (id: number) => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
}

export function NewArrivalsPage({
  products,
  onBack,
  onProductClick,
  wishlistIds,
  onToggleWishlist,
}: NewArrivalsPageProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>
        ← {t(lang, "back")}
      </button>
      <h1 style={styles.title}>{t(lang, "newArrivals")}</h1>
      {products.length === 0 ? (
        <p style={styles.empty}>{t(lang, "nothingFound")}</p>
      ) : (
        <div style={styles.grid}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              compact
              onClick={() => onProductClick(p.id)}
              inWishlist={wishlistIds.has(p.id)}
              onWishlistClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(p.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { paddingBottom: 24 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text)",
    margin: "0 0 20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
  empty: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
