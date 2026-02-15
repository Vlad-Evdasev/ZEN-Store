import { useEffect, useState } from "react";
import { getCart, removeFromCart, type CartItem } from "../api";

interface CartProps {
  userId: string;
  onBack: () => void;
  onCheckout: () => void;
  onCartChange?: () => void;
}

export function Cart({ userId, onBack, onCheckout, onCartChange }: CartProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    getCart(userId)
      .then((data) => {
        setItems(data);
        onCartChange?.();
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const remove = async (id: number) => {
    try {
      await removeFromCart(userId, id);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={styles.empty}>
        <p>Корзина пуста</p>
        <button onClick={onBack} style={styles.back}>
          ← В каталог
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>

      <div style={styles.list}>
        {items.map((item) => (
          <div key={item.id} style={styles.item}>
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
              <p style={styles.itemPrice}>{item.price.toLocaleString("ru-RU")} ₽</p>
            </div>
            <button onClick={() => remove(item.id)} style={styles.remove}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span style={styles.total}>Итого: {total.toLocaleString("ru-RU")} ₽</span>
        <button onClick={onCheckout} style={styles.checkout}>
          Оформить заказ
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto" },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 20,
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
  thumb: { width: 64, height: 64, objectFit: "cover", borderRadius: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: 500, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: "var(--muted)", marginBottom: 4 },
  itemPrice: { fontSize: 14, color: "var(--accent)" },
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
