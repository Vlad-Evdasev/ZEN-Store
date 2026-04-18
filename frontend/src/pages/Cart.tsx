import { useEffect, useState } from "react";
import { getCart, removeFromCart, type CartItem } from "../api";
import { BackButton } from "../components/BackButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface CartProps {
  userId: string;
  onBack: () => void;
  onCheckout: () => void;
  onCartChange?: () => void;
  onProductClick?: (productId: number) => void;
}

export function Cart({ userId, onBack, onCheckout, onCartChange, onProductClick }: CartProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = (silent = false) => {
    if (!silent) setLoading(true);
    getCart(userId)
      .then((data) => {
        setItems(data);
        onCartChange?.();
      })
      .catch(console.error)
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const remove = async (id: number) => {
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      await removeFromCart(userId, id);
      refresh(true);
    } catch (e) {
      console.error(e);
      setItems(prev);
      refresh();
    }
  };

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>{t(lang, "loading")}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={styles.wrap}>
        <BackButton onClick={onBack} label={t(lang, "back")} />
        <div className="zen-empty-state">
          <strong>{t(lang, "cartEmpty")}</strong>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />

      <div style={styles.titleRow}>
        <h1 className="zen-page-title" style={styles.title}>{t(lang, "cart")}</h1>
        {totalCount > 0 && <span style={styles.count}>{totalCount}</span>}
      </div>

      <div style={styles.list}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{ ...styles.item, ...(onProductClick ? styles.itemClickable : {}) }}
            onClick={onProductClick ? () => onProductClick(item.product_id) : undefined}
            role={onProductClick ? "button" : undefined}
            tabIndex={onProductClick ? 0 : undefined}
            onKeyDown={onProductClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProductClick(item.product_id); } } : undefined}
          >
            <img
              src={item.image_url || "https://via.placeholder.com/80"}
              alt=""
              style={styles.thumb}
            />
            <div style={styles.itemInfo}>
              <p style={styles.itemName}>{item.name}</p>
              <p style={styles.itemMeta}>
                {item.size} × {item.quantity}
              </p>
              <p style={styles.itemPrice}>{formatPrice(item.price * item.quantity)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(item.id); }}
              style={styles.remove}
              aria-label="Удалить"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span style={styles.total}>{t(lang, "total")}: {formatPrice(total)}</span>
        <button onClick={onCheckout} style={styles.checkout}>
          {t(lang, "checkout")}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto" },
  titleRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 16,
    padding: "0 4px",
  },
  title: {
    marginBottom: 0,
  },
  count: {
    fontSize: 13,
    color: "var(--muted)",
    letterSpacing: "0.04em",
    fontVariantNumeric: "tabular-nums",
  },
  list: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  itemClickable: {
    cursor: "pointer",
  },
  thumb: { width: 64, height: 64, objectFit: "cover", borderRadius: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: 500, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: "var(--muted)", marginBottom: 4 },
  itemPrice: { fontSize: 14, color: "var(--text)" },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 14,
  },
  footer: {
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  total: {
    display: "block",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  checkout: {
    width: "100%",
    padding: 16,
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  empty: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
