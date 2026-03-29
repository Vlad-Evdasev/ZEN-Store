import { useState, useMemo } from "react";
import type { Product } from "../api";
import { ProductCard } from "../components/ProductCard";
import { BackButton } from "../components/BackButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { getCategoryLabel } from "../utils/categories";

interface StoreCatalogProps {
  store: { id: number; name: string } | { category: string; name: string };
  products: Product[];
  categoryLabels?: Record<string, string>;
  onProductClick: (id: number) => void;
  onBack: () => void;
  wishlistIds: Set<number>;
  onToggleWishlist: (id: number) => void;
}

export function StoreCatalog({
  store,
  products,
  categoryLabels,
  onProductClick,
  onBack,
  wishlistIds,
  onToggleWishlist,
}: StoreCatalogProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [search, setSearch] = useState("");
  const isStoreById = "id" in store;
  const backLabel =
    (isStoreById ? store.name : getCategoryLabel(store.category, categoryLabels)).trim() ||
    t(lang, "back");

  const filtered = useMemo(() => {
    let list = products;
    if (isStoreById) {
      list = list.filter((p) => (p.store_id ?? 1) === store.id);
    } else {
      list = list.filter((p) => p.category === store.category);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, store, isStoreById, search]);

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={backLabel} />
      <div className="zen-catalog-search-row">
        <input
          type="search"
          className="zen-input zen-catalog-search-input"
          placeholder={t(lang, "search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t(lang, "search")}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="zen-empty-state" style={styles.empty}>
          <strong>{t(lang, "nothingFound")}</strong>
        </div>
      ) : (
        <div className="catalog-grid catalog-grid--masonry catalog-grid--concept" style={styles.grid}>
          {filtered.map((p, idx) => (
            <ProductCard
              key={p.id}
              product={p}
              compact
              sizeVariant={idx % 3 === 0 ? "tall" : "default"}
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
  grid: {},
  empty: {},
};
