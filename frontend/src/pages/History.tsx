import { useState, useEffect } from "react";
import { getOrders, type Order } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

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

type HistoryFilter = "all" | "in_progress" | "delivered";

export function History({ userId, onBack }: HistoryProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("all");

  useEffect(() => {
    getOrders(userId).then(setOrders).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const inProgressStatuses = ["pending", "in_transit"];
  const deliveredStatuses = ["delivered", "completed"];

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "in_progress") return inProgressStatuses.includes(o.status);
    return deliveredStatuses.includes(o.status);
  });

  const inProgressOrders = orders.filter((o) => inProgressStatuses.includes(o.status));
  const deliveredOrders = orders.filter((o) => deliveredStatuses.includes(o.status));

  if (loading) {
    return (
      <div style={styles.wrap}>
        <button onClick={onBack} style={styles.back}>← {t(lang, "back")}</button>
        <p style={styles.loading}>{t(lang, "loading")}</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {t(lang, "back")}
      </button>
      <h2 style={styles.title}>{t(lang, "historyTitle")}</h2>

      <div style={styles.filterWrap}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as HistoryFilter)}
          style={styles.filterSelect}
        >
          <option value="all">{t(lang, "historyFilterAll")}</option>
          <option value="in_progress">{t(lang, "historyFilterInProgress")}</option>
          <option value="delivered">{t(lang, "historyFilterDelivered")}</option>
        </select>
      </div>

      {filter === "all" && (
        <>
          {inProgressOrders.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>{t(lang, "historyOrdered")} ({inProgressOrders.length})</h3>
              {inProgressOrders.map((o) => (
                <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} />
              ))}
            </section>
          )}
          {deliveredOrders.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>{t(lang, "historyBought")} ({deliveredOrders.length})</h3>
              {deliveredOrders.map((o) => (
                <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} />
              ))}
            </section>
          )}
        </>
      )}
      {filter !== "all" && (
        <section style={styles.section}>
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} />
          ))}
        </section>
      )}

      {filtered.length === 0 && (
        <p style={styles.empty}>{t(lang, "historyEmpty")}</p>
      )}
    </div>
  );
}

function orderStatusLabel(status: string, lang: string, t: (l: string, k: string) => string): string {
  if (status === "pending") return t(lang, "historyStatusProcessing");
  if (status === "in_transit") return t(lang, "historyStatusInTransit");
  if (status === "delivered" || status === "completed") return t(lang, "historyStatusDelivered");
  return status;
}

function OrderCard({
  order,
  formatPrice,
  lang,
  t,
}: {
  order: Order;
  formatPrice: (n: number) => string;
  lang: string;
  t: (l: string, k: string) => string;
}) {
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
      <p style={styles.total}>{t(lang, "total")}: {formatPrice(order.total)}</p>
      <p style={styles.status}>{orderStatusLabel(order.status, lang, t)}</p>
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
  filterWrap: { marginBottom: 16 },
  filterSelect: {
    width: "100%",
    padding: "10px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
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
