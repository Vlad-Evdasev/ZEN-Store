import { useState, useEffect } from "react";
import { getOrders, type Order } from "../api";
import { useSettings } from "../context/SettingsContext";
import type { Lang } from "../context/SettingsContext";
import { t } from "../i18n";

interface HistoryProps {
  userId: string;
  onBack: () => void;
  onProductClick?: (productId: number) => void;
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

type HistoryFilter = "all" | "processing" | "in_progress" | "delivered";

export function History({ userId, onBack: _onBack, onProductClick }: HistoryProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filterOptions: { value: HistoryFilter; labelKey: string }[] = [
    { value: "all", labelKey: "historyFilterAll" },
    { value: "processing", labelKey: "historyFilterProcessing" },
    { value: "in_progress", labelKey: "historyFilterInProgress" },
    { value: "delivered", labelKey: "historyFilterDelivered" },
  ];

  useEffect(() => {
    getOrders(userId).then(setOrders).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const processingStatuses = ["pending"];
  const inTransitStatuses = ["in_transit"];
  const deliveredStatuses = ["delivered", "completed"];

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "processing") return processingStatuses.includes(o.status);
    if (filter === "in_progress") return inTransitStatuses.includes(o.status);
    return deliveredStatuses.includes(o.status);
  });

  const processingOrders = orders.filter((o) => processingStatuses.includes(o.status));
  const inTransitOrders = orders.filter((o) => inTransitStatuses.includes(o.status));
  const deliveredOrders = orders.filter((o) => deliveredStatuses.includes(o.status));

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={styles.loading}>{t(lang, "loading")}</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <h1 className="zen-page-title" style={styles.title}>{t(lang, "historyTitle")}</h1>
        <div style={styles.filterRow} role="tablist" aria-label={t(lang, "historyTitle")}>
          {filterOptions.map((opt) => {
            const count =
              opt.value === "all" ? orders.length :
              opt.value === "processing" ? processingOrders.length :
              opt.value === "in_progress" ? inTransitOrders.length :
              deliveredOrders.length;
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(opt.value)}
                style={{ ...styles.filterPill, ...(active ? styles.filterPillActive : {}) }}
              >
                {t(lang, opt.labelKey)}{opt.value === "all" ? ` · ${count}` : ""}
              </button>
            );
          })}
        </div>
      </header>

      {filter === "all" && (
        <>
          {(processingOrders.length > 0 || inTransitOrders.length > 0) && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>
                {t(lang, "historyOrdered")} ({processingOrders.length + inTransitOrders.length})
              </h3>
              {processingOrders.map((o) => (
                <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} onProductClick={onProductClick} />
              ))}
              {inTransitOrders.map((o) => (
                <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} onProductClick={onProductClick} />
              ))}
            </section>
          )}
          {deliveredOrders.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>{t(lang, "historyBought")} ({deliveredOrders.length})</h3>
              {deliveredOrders.map((o) => (
                <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} onProductClick={onProductClick} />
              ))}
            </section>
          )}
        </>
      )}
      {filter !== "all" && (
        <section style={styles.section}>
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} formatPrice={formatPrice} lang={lang} t={t} onProductClick={onProductClick} />
          ))}
        </section>
      )}

      {filtered.length === 0 && (
        <div className="zen-empty-state" style={styles.emptyWrap}>
          <strong>{t(lang, "historyEmpty")}</strong>
        </div>
      )}
    </div>
  );
}

function orderStatusLabel(status: string, lang: Lang, t: (l: Lang, k: string) => string): string {
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
  onProductClick,
}: {
  order: Order;
  formatPrice: (n: number) => string;
  lang: Lang;
  t: (l: Lang, k: string) => string;
  onProductClick?: (productId: number) => void;
}) {
  let items: { product_id?: number; image_url?: string; name?: string; price?: number; quantity?: number }[] = [];
  try { items = JSON.parse(order.items); } catch {}
  const firstItem = items[0];
  const productId = firstItem?.product_id;
  const imageUrl = firstItem?.image_url;
  const isClickable = onProductClick && productId != null;

  const isDelivered = order.status === "delivered" || order.status === "completed";
  const statusLabel = orderStatusLabel(order.status, lang, t);

  return (
    <div
      style={{ ...styles.card, ...(isClickable ? styles.cardClickable : {}) }}
      onClick={isClickable ? () => onProductClick(productId) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onProductClick!(productId); } : undefined}
    >
      <div style={styles.timelineCol} aria-hidden>
        <span style={{ ...styles.timelineDot, ...(isDelivered ? styles.timelineDotDone : {}) }} />
        <span style={styles.timelineLine} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.cardHead}>
          <span style={styles.orderId}>#{order.id}</span>
          <span style={styles.date}>{formatDate(order.created_at)}</span>
        </div>
        <div style={styles.cardBody}>
          {imageUrl && <img src={imageUrl} alt="" style={styles.cardThumb} />}
          <div style={styles.cardContent}>
            {firstItem && (
              <p style={styles.itemName}>
                {firstItem.name || "Товар"} × {firstItem.quantity || 1}
                {items.length > 1 && <span style={styles.itemMore}> · + {items.length - 1}</span>}
              </p>
            )}
            <p style={styles.total}>{formatPrice(order.total)}</p>
          </div>
        </div>
        <span style={{ ...styles.statusPill, ...(isDelivered ? styles.statusPillMuted : {}) }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 400,
    margin: "0 0 16px 0",
    lineHeight: 1.25,
  },
  filterRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  filterPill: {
    padding: "8px 14px",
    borderRadius: 999,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filterPillActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
  },
  emptyWrap: {
    padding: "48px 24px",
    textAlign: "center",
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 14,
    color: "var(--muted)",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  card: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 12,
    padding: 14,
    background: "var(--surface)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    marginBottom: 10,
  },
  cardClickable: { cursor: "pointer" },
  timelineCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 4 },
  timelineDot: {
    width: 12, height: 12, borderRadius: "50%",
    border: "2px solid var(--accent)",
    background: "var(--surface)",
    flexShrink: 0,
  },
  timelineDotDone: { background: "var(--accent)" },
  timelineLine: { width: 2, flex: 1, minHeight: 16, background: "var(--border)" },
  cardHead: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  orderId: { fontWeight: 700, fontSize: 13 },
  date: { fontSize: 11, color: "var(--muted)" },
  cardBody: { display: "flex", gap: 12, alignItems: "center" },
  cardThumb: { width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  cardContent: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 4 },
  itemMore: { color: "var(--muted)", fontWeight: 400, fontSize: 12 },
  total: { fontSize: 14, fontWeight: 700, color: "var(--accent)", margin: 0 },
  statusPill: {
    display: "inline-block",
    marginTop: 8,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "3px 10px",
    borderRadius: 999,
    background: "rgba(165,42,42,0.08)",
    color: "var(--accent)",
  },
  statusPillMuted: { background: "var(--surface-elevated)", color: "var(--muted)" },
  loading: { textAlign: "center", color: "var(--muted)", padding: 48 },
};
