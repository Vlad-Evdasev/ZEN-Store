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
        <div className="zen-bag-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
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
                <span className="zen-bag-item-meta">
                  {item.size} · {item.quantity} {lang === "ru" ? "шт" : "pcs"}
                </span>
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
        <div className="zen-bag-summary-total">
          <span className="zen-bag-summary-total-label">{t(lang, "total")}</span>
          <span className="zen-bag-summary-total-value">{formatPrice(subtotal)}</span>
        </div>
        <button
          type="button"
          className="zen-bag-checkout-btn"
          onClick={onCheckout}
        >
          {t(lang, "checkout")}
        </button>
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
