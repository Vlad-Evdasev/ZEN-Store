import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";
import { BackButton } from "../components/BackButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface FavoritesProps {
  products: Product[];
  wishlistIds: Set<number>;
  onProductClick: (id: number) => void;
  onToggleWishlist: (id: number) => void;
  onBack: () => void;
}

export function Favorites({
  products,
  wishlistIds,
  onProductClick,
  onToggleWishlist,
  onBack,
}: FavoritesProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const favorites = products.filter((p) => wishlistIds.has(p.id));

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "favoritesTitle")}</h2>
      {favorites.length === 0 ? (
        <div className="zen-empty-state">
          <strong>{t(lang, "favoritesEmpty")}</strong>
          <span>{t(lang, "favoritesEmptyHint")}</span>
        </div>
      ) : (
        <div style={styles.grid}>
          {favorites.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => onProductClick(p.id)}
              inWishlist={true}
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
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  title: { marginBottom: 20 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
};
