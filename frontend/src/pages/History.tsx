import { useState, useEffect, useRef } from "react";
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

export function History({ userId, onBack, onProductClick }: HistoryProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const filterOptions: { value: HistoryFilter; labelKey: string }[] = [
    { value: "all", labelKey: "historyFilterAll" },
    { value: "processing", labelKey: "historyFilterProcessing" },
    { value: "in_progress", labelKey: "historyFilterInProgress" },
    { value: "delivered", labelKey: "historyFilterDelivered" },
  ];

  const currentFilterLabel = filterOptions.find((o) => o.value === filter)?.labelKey ?? "historyFilterAll";

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };
    if (filterDropdownOpen) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [filterDropdownOpen]);

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
        <button onClick={onBack} style={styles.back} type="button">← {t(lang, "back")}</button>
        <p style={styles.loading}>{t(lang, "loading")}</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.back} type="button">
          ← {t(lang, "back")}
        </button>
        <h1 style={styles.title}>{t(lang, "historyTitle")}</h1>
        <div style={styles.filterDropdownWrap} ref={filterDropdownRef} role="group" aria-label={t(lang, "historyTitle")}>
          <button
            type="button"
            className="settings-opt-btn"
            onClick={() => setFilterDropdownOpen((v) => !v)}
            style={{ ...styles.filterDropdownTrigger, ...(filterDropdownOpen ? styles.filterTabActive : {}) }}
            aria-expanded={filterDropdownOpen}
            aria-haspopup="listbox"
          >
            {t(lang, currentFilterLabel)}
            <span style={styles.filterDropdownChevron}>{filterDropdownOpen ? "▲" : "▼"}</span>
          </button>
          {filterDropdownOpen && (
            <ul style={styles.filterDropdownList} role="listbox">
              {filterOptions.map((opt) => (
                <li key={opt.value} role="option" aria-selected={filter === opt.value}>
                  <button
                    type="button"
                    className="settings-opt-btn"
                    style={{
                      ...styles.filterDropdownItem,
                      ...(filter === opt.value ? styles.filterTabActive : {}),
                    }}
                    onClick={() => {
                      setFilter(opt.value);
                      setFilterDropdownOpen(false);
                    }}
                  >
                    {t(lang, opt.labelKey)}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
        <div style={styles.emptyWrap}>
          <p style={styles.empty}>{t(lang, "historyEmpty")}</p>
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
  try {
    items = JSON.parse(order.items);
  } catch {}
  const firstItem = items[0];
  const productId = firstItem?.product_id;
  const imageUrl = firstItem?.image_url;
  const isClickable = onProductClick && productId != null;

  return (
    <div
      style={{ ...styles.card, ...(isClickable ? styles.cardClickable : {}) }}
      onClick={isClickable ? () => onProductClick(productId) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onProductClick!(productId); } : undefined}
    >
      <div style={styles.cardHead}>
        <span style={styles.orderId}>#{order.id}</span>
        <span style={styles.date}>{formatDate(order.created_at)}</span>
      </div>
      <div style={styles.cardBody}>
        {imageUrl && (
          <img src={imageUrl} alt="" style={styles.cardThumb} />
        )}
        <div style={styles.cardContent}>
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
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 32 },
  header: {
    marginBottom: 24,
  },
  back: {
    display: "block",
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 16,
    padding: "4px 0",
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    margin: "0 0 16px 0",
    lineHeight: 1.25,
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  filterDropdownWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 280,
  },
  filterDropdownTrigger: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 16px",
    background: "var(--surface)",
    border: "1px solid var(--surface)",
    borderRadius: 20,
    color: "var(--muted)",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "none",
    outline: "none",
  },
  filterDropdownChevron: {
    marginLeft: 8,
    fontSize: 10,
    opacity: 0.8,
  },
  filterDropdownList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    margin: 0,
    marginTop: 6,
    padding: 6,
    listStyle: "none",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    zIndex: 10,
  },
  filterDropdownItem: {
    display: "block",
    width: "100%",
    padding: "10px 14px",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: "var(--muted)",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "none",
    outline: "none",
    textAlign: "left",
  },
  filterTab: {
    padding: "10px 16px",
    background: "var(--surface)",
    border: "1px solid var(--surface)",
    borderRadius: 20,
    color: "var(--muted)",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "none",
    outline: "none",
  },
  filterTabActive: {
    background: "var(--accent)",
    border: "1px solid var(--accent)",
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
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
    marginBottom: 12,
  },
  cardClickable: {
    cursor: "pointer",
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderId: { fontWeight: 600 },
  date: { fontSize: 13, color: "var(--muted)" },
  cardBody: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  cardThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
  },
  cardContent: { flex: 1, minWidth: 0 },
  items: { marginBottom: 8 },
  item: { fontSize: 14, marginBottom: 4 },
  total: { fontWeight: 600, color: "var(--accent)", marginBottom: 4 },
  status: { fontSize: 12, color: "var(--muted)" },
  empty: { margin: 0, color: "var(--muted)", fontSize: 15, lineHeight: 1.5 },
  loading: { textAlign: "center", color: "var(--muted)", padding: 48 },
};
