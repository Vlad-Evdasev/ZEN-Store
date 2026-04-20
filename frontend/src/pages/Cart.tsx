import { useEffect, useMemo, useState } from "react";
import { getCart, removeFromCart, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface CartProps {
  userId: string;
  onBack?: () => void;
  onCheckout: () => void;
  onCartChange?: () => void;
  onProductClick?: (productId: number) => void;
}

export function Cart({
  userId,
  onBack,
  onCheckout,
  onCartChange,
  onProductClick,
}: CartProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const refresh = (silent = false) => {
    if (!silent) setLoading(true);
    getCart(userId)
      .then((data) => {
        setItems(data);
        onCartChange?.();
      })
      .catch(console.error)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const remove = async (id: number) => {
    setRemovingId(id);
    const prev = items;
    setTimeout(() => {
      setItems((list) => list.filter((i) => i.id !== id));
      setRemovingId(null);
    }, 180);
    try {
      await removeFromCart(userId, id);
      refresh(true);
    } catch (e) {
      console.error(e);
      setItems(prev);
      setRemovingId(null);
      refresh();
    }
  };

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>{t(lang, "loading")}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="zen-bag-empty zen-page-enter">
        <h2 className="zen-bag-empty-title">{t(lang, "cartEmpty")}</h2>
        <p className="zen-bag-empty-hint">{t(lang, "cartEmptyHint")}</p>
        {onBack && (
          <button type="button" className="zen-bag-empty-cta" onClick={onBack}>
            {t(lang, "toCatalog")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="zen-bag-wrap zen-page-enter">
      <header className="zen-bag-header">
        <h1 className="zen-bag-title">{t(lang, "cartTitle")}</h1>
      </header>

      <ul style={styles.list}>
        {items.map((item) => {
          const isRemoving = removingId === item.id;
          const clickable = !!onProductClick;
          return (
            <li
              key={item.id}
              className={`zen-bag-item${clickable ? " zen-bag-item--clickable" : ""}`}
              style={{
                opacity: isRemoving ? 0 : 1,
                transform: isRemoving ? "translateX(12px)" : "translateX(0)",
              }}
              onClick={clickable ? () => onProductClick!(item.product_id) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onProductClick!(item.product_id);
                      }
                    }
                  : undefined
              }
            >
              <div className="zen-bag-thumb-wrap">
                <img
                  className="zen-bag-thumb"
                  src={item.image_url || "https://via.placeholder.com/200x250"}
                  alt=""
                  loading="lazy"
                />
              </div>
              <div className="zen-bag-item-body">
                <p className="zen-bag-item-name">{item.name}</p>
                {(item.size || item.quantity > 1) && (
                  <div className="zen-bag-item-meta">
                    {item.size && (
                      <span className="zen-bag-item-chip">{item.size}</span>
                    )}
                    {item.quantity > 1 && (
                      <span className="zen-bag-item-chip zen-bag-item-chip--qty">
                        ×{item.quantity}
                      </span>
                    )}
                  </div>
                )}
                <span className="zen-bag-item-price">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
              <button
                type="button"
                className="zen-bag-item-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(item.id);
                }}
                aria-label={t(lang, "cartRemove")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="zen-bag-summary">
        <div className="zen-bag-summary-bar" role="group" aria-label={t(lang, "total")}>
          <div className="zen-bag-summary-info">
            <span className="zen-bag-summary-info-label">{t(lang, "total")}</span>
            <span className="zen-bag-summary-info-value">
              {formatPrice(subtotal)}
            </span>
          </div>
          <button
            type="button"
            className="zen-bag-checkout-btn"
            onClick={onCheckout}
            aria-label={t(lang, "checkout")}
          >
            <span className="zen-bag-checkout-count" aria-hidden="true">
              {items.reduce((n, i) => n + i.quantity, 0)}
            </span>
            <span className="zen-bag-checkout-label">{t(lang, "checkout")}</span>
            <span className="zen-bag-checkout-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
