import { useState, useEffect } from "react";
import { getCart, createOrder, type CartItem } from "../api";

interface CheckoutProps {
  userId: string;
  onBack: () => void;
  onDone: () => void;
}

export function Checkout({ userId, onBack, onDone }: CheckoutProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    getCart(userId).then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSubmitting(true);
    try {
      await createOrder(userId, {
        user_name: name.trim() || undefined,
        user_phone: phone.trim(),
        user_address: address.trim() || undefined,
        items,
        total,
      });
      onDone();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>

      <h2 style={styles.title}>Оформление заказа</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Имя
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Телефон *
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
            style={styles.input}
            required
          />
        </label>
        <label style={styles.label}>
          Адрес доставки
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Город, улица, дом, квартира"
            style={styles.input}
          />
        </label>

        <div style={styles.total}>
          К оплате: <strong>{total.toLocaleString("ru-RU")} ₽</strong>
        </div>

        <button type="submit" disabled={submitting} style={styles.submit}>
          {submitting ? "Отправка..." : "Подтвердить заказ"}
        </button>
      </form>
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
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    marginBottom: 24,
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    color: "var(--muted)",
  },
  input: {
    padding: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
  },
  total: {
    fontSize: 16,
    marginTop: 8,
  },
  submit: {
    padding: 14,
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "var(--bg)",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
