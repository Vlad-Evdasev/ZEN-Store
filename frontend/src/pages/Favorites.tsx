import { useMemo } from "react";
import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface FavoritesProps {
  products: Product[];
  productsLoading?: boolean;
  wishlistIds: Set<number>;
  onProductClick: (id: number) => void;
  onToggleWishlist: (id: number) => void;
  onBack?: () => void;
}

export function Favorites({
  products,
  productsLoading = false,
  wishlistIds,
  onProductClick,
  onToggleWishlist,
  onBack,
}: FavoritesProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const favorites = useMemo(
    () => products.filter((p) => wishlistIds.has(p.id)),
    [products, wishlistIds]
  );

  if (favorites.length === 0) {
    // Пока товары грузятся в первый раз и в wishlist что-то лежит — не пугаем
    // юзера «избранное пусто», просто рисуем скелетоны. После загрузки, если
    // реально ничего нет, покажем корректный empty-state.
    if (productsLoading && products.length === 0 && wishlistIds.size > 0) {
      return (
        <div className="zen-wishlist-wrap zen-page-enter">
          <div className="catalog-grid catalog-grid--tight zen-wishlist-grid" aria-busy="true" aria-label="Загружаем избранное">
            {Array.from({ length: Math.min(wishlistIds.size, 4) }).map((_, i) => (
              <div key={i} className="zen-product-skeleton" aria-hidden />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="zen-wishlist-empty zen-page-enter">
        <h2 className="zen-wishlist-empty-title">{t(lang, "favoritesEmpty")}</h2>
        <p className="zen-wishlist-empty-hint">{t(lang, "favoritesEmptyHint")}</p>
        {onBack && (
          <button type="button" className="zen-wishlist-empty-cta" onClick={onBack}>
            {t(lang, "toCatalog")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="zen-wishlist-wrap zen-page-enter">
      <header className="zen-wishlist-header">
        <h1 className="zen-wishlist-title">{t(lang, "favoritesTitle")}</h1>
      </header>

      <div className="catalog-grid catalog-grid--tight zen-wishlist-grid">
        {favorites.map((p, idx) => (
          <div
            key={p.id}
            className="zen-wishlist-card"
            style={{ animationDelay: `${Math.min(idx * 40, 320)}ms` }}
          >
            <button
              type="button"
              className="zen-wishlist-remove"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(p.id);
              }}
              aria-label={t(lang, "favoritesRemoveFromWishlist")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
            <ProductCard
              product={p}
              compact
              sizeVariant="default"
              onClick={() => onProductClick(p.id)}
              inWishlist={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
