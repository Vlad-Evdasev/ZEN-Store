import { useState, useEffect } from "react";
import { getOrders, type Order } from "../api";
import { useSettings } from "../context/SettingsContext";

interface HistoryProps {
  userId: string;
  onBack: () => void;
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function History({ userId, onBack }: HistoryProps) {
  const { formatPrice } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders(userId).then(setOrders).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const pending = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status === "completed");

  if (loading) {
    return (
      <div style={styles.wrap}>
        <button onClick={onBack} style={styles.back}>← Назад</button>
        <p style={styles.loading}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>
      <h2 style={styles.title}>История заказов</h2>

      {pending.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Заказано ({pending.length})</h3>
          {pending.map((o) => (
            <OrderCard key={o.id} order={o} formatPrice={formatPrice} />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Куплено ({completed.length})</h3>
          {completed.map((o) => (
            <OrderCard key={o.id} order={o} formatPrice={formatPrice} />
          ))}
        </section>
      )}

      {orders.length === 0 && (
        <p style={styles.empty}>Пока нет заказов</p>
      )}
    </div>
  );
}

function OrderCard({ order, formatPrice }: { order: Order; formatPrice: (n: number) => string }) {
  let items: { name?: string; price?: number; quantity?: number }[] = [];
  try {
    items = JSON.parse(order.items);
  } catch {}

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span style={styles.orderId}>#{order.id}</span>
        <span style={styles.date}>{formatDate(order.created_at)}</span>
      </div>
      <div style={styles.items}>
        {items.map((i, idx) => (
          <p key={idx} style={styles.item}>
            {i.name || "Товар"} × {i.quantity || 1} — {formatPrice((i.price || 0) * (i.quantity || 1))}
          </p>
        ))}
      </div>
      <p style={styles.total}>Итого: {formatPrice(order.total)}</p>
      <p style={styles.status}>{order.status === "pending" ? "В обработке" : "Доставлено"}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
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
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 20,
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 14,
    color: "var(--muted)",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  card: {
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
    marginBottom: 12,
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderId: { fontWeight: 600 },
  date: { fontSize: 13, color: "var(--muted)" },
  items: { marginBottom: 8 },
  item: { fontSize: 14, marginBottom: 4 },
  total: { fontWeight: 600, color: "var(--accent)", marginBottom: 4 },
  status: { fontSize: 12, color: "var(--muted)" },
  empty: { textAlign: "center", color: "var(--muted)", padding: 48 },
  loading: { textAlign: "center", color: "var(--muted)", padding: 48 },
};
