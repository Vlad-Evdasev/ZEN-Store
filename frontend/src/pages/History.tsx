import { useState, useEffect, useMemo } from "react";
import { getOrders, type Order, type Product } from "../api";
import { useSettings } from "../context/SettingsContext";
import type { Lang } from "../context/SettingsContext";
import { t } from "../i18n";
import { ProductCard } from "../components/ProductCard";

interface HistoryProps {
  userId: string;
  onBack: () => void;
  onProductClick?: (productId: number) => void;
  products?: Product[];
  wishlistIds?: Set<number>;
  onToggleWishlist?: (productId: number) => void;
  onOpenCatalog?: () => void;
}

function formatDate(s: string, lang: Lang) {
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  try {
    return new Date(s).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

type OrderItem = {
  product_id?: number;
  image_url?: string;
  name?: string;
  price?: number;
  quantity?: number;
};

type StepKey = "placed" | "processing" | "in_transit" | "delivered";

function getStepIndex(status: string): number {
  if (status === "delivered" || status === "completed") return 3;
  if (status === "in_transit") return 2;
  if (status === "pending") return 1;
  return 0;
}

export function History({
  userId,
  onBack: _onBack,
  onProductClick,
  products = [],
  wishlistIds,
  onToggleWishlist,
  onOpenCatalog,
}: HistoryProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders(userId)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const { activeOrders, deliveredOrders } = useMemo(() => {
    const active: Order[] = [];
    const delivered: Order[] = [];
    for (const o of orders) {
      if (o.status === "delivered" || o.status === "completed") delivered.push(o);
      else active.push(o);
    }
    active.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    delivered.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return { activeOrders: active, deliveredOrders: delivered };
  }, [orders]);

  const recommended = useMemo(() => {
    if (!products.length) return [];
    const sorted = [...products].sort((a, b) => {
      const ao = a.new_arrival_sort_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.new_arrival_sort_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return b.id - a.id;
    });
    return sorted.slice(0, 4);
  }, [products]);

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={styles.loading}>{t(lang, "loading")}</p>
      </div>
    );
  }

  const isEmpty = orders.length === 0;

  return (
    <div style={styles.wrap} className="zen-page-enter">
      <header style={styles.header}>
        <h1 className="zen-page-title" style={styles.title}>
          {t(lang, "historyTitle")}
        </h1>
      </header>

      {isEmpty ? (
        <EmptyState
          lang={lang}
          products={recommended}
          wishlistIds={wishlistIds}
          onProductClick={onProductClick}
          onToggleWishlist={onToggleWishlist}
          onOpenCatalog={onOpenCatalog}
        />
      ) : (
        <>
          {activeOrders.length > 0 && (
            <section style={styles.section}>
              <SectionHeader
                title={t(lang, "historySectionActive")}
                count={activeOrders.length}
              />
              <div style={styles.activeList}>
                {activeOrders.map((o) => (
                  <ActiveOrderCard
                    key={o.id}
                    order={o}
                    formatPrice={formatPrice}
                    lang={lang}
                    onProductClick={onProductClick}
                  />
                ))}
              </div>
            </section>
          )}

          {deliveredOrders.length > 0 && (
            <section style={styles.section}>
              <SectionHeader
                title={t(lang, "historySectionDelivered")}
                count={deliveredOrders.length}
              />
              <div style={styles.deliveredList}>
                {deliveredOrders.map((o) => (
                  <DeliveredOrderRow
                    key={o.id}
                    order={o}
                    formatPrice={formatPrice}
                    lang={lang}
                    onProductClick={onProductClick}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={styles.sectionHeader}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <span style={styles.sectionCount}>{count}</span>
    </div>
  );
}

function parseItems(raw: string): OrderItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ActiveOrderCard({
  order,
  formatPrice,
  lang,
  onProductClick,
}: {
  order: Order;
  formatPrice: (n: number) => string;
  lang: Lang;
  onProductClick?: (productId: number) => void;
}) {
  const items = parseItems(order.items);
  const totalCount = items.reduce((s, i) => s + (i.quantity || 1), 0);
  const previews = items.slice(0, 3);
  const extra = Math.max(items.length - previews.length, 0);
  const stepIndex = getStepIndex(order.status);

  const steps: { key: StepKey; labelKey: string }[] = [
    { key: "placed", labelKey: "historyStepPlaced" },
    { key: "processing", labelKey: "historyStepProcessing" },
    { key: "in_transit", labelKey: "historyStepInTransit" },
    { key: "delivered", labelKey: "historyStepDelivered" },
  ];

  const firstProductId = items[0]?.product_id;
  const isClickable = onProductClick && firstProductId != null;

  return (
    <article style={styles.activeCard}>
      <div style={styles.activeCardHeader}>
        <div>
          <span style={styles.activeOrderLabel}>
            {t(lang, "historyOrderLabel")} #{order.id}
          </span>
          <span style={styles.activeOrderDate}>
            {formatDate(order.created_at, lang)}
          </span>
        </div>
        <span style={styles.activeTotal}>{formatPrice(order.total)}</span>
      </div>

      <div
        style={{
          ...styles.activePreview,
          ...(isClickable ? styles.activePreviewClickable : {}),
        }}
        onClick={
          isClickable ? () => onProductClick!(firstProductId!) : undefined
        }
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onProductClick!(firstProductId!);
                }
              }
            : undefined
        }
      >
        <div style={styles.thumbStack}>
          {previews.map((it, idx) => (
            <div
              key={`${it.product_id ?? "i"}-${idx}`}
              style={{
                ...styles.thumb,
                ...(idx > 0 ? { marginLeft: -14 } : {}),
                zIndex: previews.length - idx,
              }}
            >
              {it.image_url ? (
                <img src={it.image_url} alt="" style={styles.thumbImg} />
              ) : (
                <div style={styles.thumbPlaceholder} />
              )}
            </div>
          ))}
          {extra > 0 && (
            <div style={{ ...styles.thumb, ...styles.thumbMore, marginLeft: -14 }}>
              +{extra}
            </div>
          )}
        </div>
        <div style={styles.activeItemsMeta}>
          <span style={styles.activeItemsTitle}>
            {items[0]?.name || "—"}
            {items.length > 1 && items[1]?.name ? `, ${items[1].name}` : ""}
          </span>
          <span style={styles.activeItemsCount}>
            {t(lang, "historyItemsCount").replace("{n}", String(totalCount))}
          </span>
        </div>
      </div>

      <div style={styles.timelineWrap} aria-label="order progress">
        {steps.map((step, idx) => {
          const done = idx <= stepIndex;
          const current = idx === stepIndex;
          const showConnector = idx < steps.length - 1;
          const nextDone = idx + 1 <= stepIndex;
          return (
            <div key={step.key} style={styles.timelineStep}>
              <div style={styles.timelineStepCore}>
                <span
                  style={{
                    ...styles.timelineNode,
                    ...(done ? styles.timelineNodeDone : {}),
                    ...(current ? styles.timelineNodeCurrent : {}),
                  }}
                  aria-current={current ? "step" : undefined}
                >
                  {done && !current ? <CheckIcon /> : null}
                  {current ? <span style={styles.timelinePulse} /> : null}
                </span>
                {showConnector && (
                  <span
                    style={{
                      ...styles.timelineConnector,
                      ...(nextDone ? styles.timelineConnectorDone : {}),
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  ...styles.timelineLabel,
                  ...(done ? styles.timelineLabelDone : {}),
                  ...(current ? styles.timelineLabelCurrent : {}),
                }}
              >
                {t(lang, step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function DeliveredOrderRow({
  order,
  formatPrice,
  lang,
  onProductClick,
}: {
  order: Order;
  formatPrice: (n: number) => string;
  lang: Lang;
  onProductClick?: (productId: number) => void;
}) {
  const items = parseItems(order.items);
  const first = items[0];
  const totalCount = items.reduce((s, i) => s + (i.quantity || 1), 0);
  const productId = first?.product_id;
  const isClickable = onProductClick && productId != null;

  return (
    <div
      style={{
        ...styles.deliveredRow,
        ...(isClickable ? styles.deliveredRowClickable : {}),
      }}
      onClick={isClickable ? () => onProductClick!(productId!) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onProductClick!(productId!);
              }
            }
          : undefined
      }
    >
      <div style={styles.deliveredThumb}>
        {first?.image_url ? (
          <img src={first.image_url} alt="" style={styles.thumbImg} />
        ) : (
          <div style={styles.thumbPlaceholder} />
        )}
      </div>
      <div style={styles.deliveredMeta}>
        <span style={styles.deliveredName}>
          {first?.name || `${t(lang, "historyOrderLabel")} #${order.id}`}
          {items.length > 1 && (
            <span style={styles.deliveredNameMore}> · +{items.length - 1}</span>
          )}
        </span>
        <span style={styles.deliveredSubline}>
          {formatDate(order.created_at, lang)} ·{" "}
          {t(lang, "historyItemsCount").replace("{n}", String(totalCount))}
        </span>
      </div>
      <div style={styles.deliveredRight}>
        <span style={styles.deliveredPrice}>{formatPrice(order.total)}</span>
        <span style={styles.deliveredTag}>
          <CheckIcon />
          {t(lang, "historyStatusDelivered")}
        </span>
      </div>
    </div>
  );
}

function EmptyState({
  lang,
  products,
  wishlistIds,
  onProductClick,
  onToggleWishlist,
  onOpenCatalog,
}: {
  lang: Lang;
  products: Product[];
  wishlistIds?: Set<number>;
  onProductClick?: (productId: number) => void;
  onToggleWishlist?: (productId: number) => void;
  onOpenCatalog?: () => void;
}) {
  return (
    <div style={styles.emptyWrap}>
      <div style={styles.emptyHero}>
        <div style={styles.emptyIconCircle}>
          <BagIcon />
        </div>
        <h2 style={styles.emptyHeadline}>{t(lang, "historyEmptyHeadline")}</h2>
        <p style={styles.emptySubline}>{t(lang, "historyEmptySubline")}</p>
        {onOpenCatalog && (
          <button
            type="button"
            onClick={onOpenCatalog}
            style={styles.emptyCta}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent)";
            }}
          >
            {t(lang, "historyEmptyCta")}
          </button>
        )}
      </div>

      {products.length > 0 && (
        <div style={styles.recommendBlock}>
          <div style={styles.recommendHeader}>
            <span style={styles.recommendKicker}>
              {t(lang, "historyRecommendTitle")}
            </span>
            <span style={styles.recommendRule} />
          </div>
          <div style={styles.recommendGrid}>
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={() => onProductClick?.(p.id)}
                inWishlist={wishlistIds?.has(p.id)}
                onWishlistClick={
                  onToggleWishlist
                    ? (e) => {
                        e.stopPropagation();
                        onToggleWishlist(p.id);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 8V6.5a3.5 3.5 0 1 1 7 0V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "8px 0 120px",
  },
  loading: { textAlign: "center", color: "var(--muted)", padding: 64 },

  header: { marginBottom: 28 },
  title: {
    fontSize: 26,
    fontWeight: 500,
    margin: 0,
    letterSpacing: "0.01em",
    lineHeight: 1.2,
  },

  section: { marginBottom: 36 },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "1px solid var(--border)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--text)",
    margin: 0,
  },
  sectionCount: {
    fontSize: 12,
    color: "var(--muted)",
    fontWeight: 500,
    letterSpacing: "0.04em",
  },

  activeList: { display: "flex", flexDirection: "column", gap: 14 },

  activeCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: "18px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  activeCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  activeOrderLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 4,
  },
  activeOrderDate: {
    display: "block",
    fontSize: 14,
    color: "var(--text)",
    fontWeight: 500,
  },
  activeTotal: {
    fontSize: 17,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  },

  activePreview: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "10px 12px",
    background: "var(--surface-elevated)",
    borderRadius: 12,
  },
  activePreviewClickable: { cursor: "pointer" },
  thumbStack: { display: "flex", alignItems: "center", flexShrink: 0 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    background: "var(--bg)",
    border: "2px solid var(--surface-elevated)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover" },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    background:
      "linear-gradient(135deg, var(--surface) 0%, var(--surface-elevated) 100%)",
  },
  thumbMore: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--muted)",
    background: "var(--surface)",
  },
  activeItemsMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  activeItemsTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  activeItemsCount: {
    fontSize: 12,
    color: "var(--muted)",
    letterSpacing: "0.02em",
  },

  timelineWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 0,
    marginTop: 4,
  },
  timelineStep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
  },
  timelineStepCore: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 20,
    marginBottom: 8,
  },
  timelineNode: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
    position: "relative",
    transition:
      "background-color var(--transition-normal), border-color var(--transition-normal), color var(--transition-normal)",
  },
  timelineNodeDone: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
  },
  timelineNodeCurrent: {
    background: "var(--surface)",
    borderColor: "var(--accent)",
    color: "var(--accent)",
  },
  timelinePulse: {
    position: "absolute",
    inset: 3,
    borderRadius: "50%",
    background: "var(--accent)",
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    background: "var(--border)",
    margin: "0 4px",
    borderRadius: 1,
    transition: "background-color var(--transition-normal)",
  },
  timelineConnectorDone: { background: "var(--accent)" },
  timelineLabel: {
    fontSize: 11,
    color: "var(--muted)",
    fontWeight: 500,
    letterSpacing: "0.02em",
    paddingRight: 4,
    lineHeight: 1.3,
  },
  timelineLabelDone: { color: "var(--text)" },
  timelineLabelCurrent: { color: "var(--accent)", fontWeight: 600 },

  deliveredList: {
    display: "flex",
    flexDirection: "column",
  },
  deliveredRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr auto",
    gap: 14,
    alignItems: "center",
    padding: "14px 4px",
    borderBottom: "1px solid var(--border)",
  },
  deliveredRowClickable: { cursor: "pointer" },
  deliveredThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--surface-elevated)",
    flexShrink: 0,
  },
  deliveredMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  deliveredName: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    letterSpacing: "0.01em",
  },
  deliveredNameMore: { color: "var(--muted)", fontWeight: 400 },
  deliveredSubline: {
    fontSize: 12,
    color: "var(--muted)",
    letterSpacing: "0.02em",
  },
  deliveredRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  deliveredPrice: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  },
  deliveredTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },

  emptyWrap: { display: "flex", flexDirection: "column", gap: 40 },
  emptyHero: {
    padding: "40px 24px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: "50%",
    background: "var(--surface-elevated)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent)",
    marginBottom: 20,
  },
  emptyHeadline: {
    fontSize: 20,
    fontWeight: 500,
    margin: 0,
    color: "var(--text)",
    letterSpacing: "0.01em",
    lineHeight: 1.3,
  },
  emptySubline: {
    fontSize: 14,
    color: "var(--muted)",
    margin: "8px 0 24px",
    lineHeight: 1.5,
    maxWidth: 280,
    letterSpacing: "0.02em",
  },
  emptyCta: {
    minHeight: 48,
    padding: "14px 28px",
    borderRadius: 999,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background-color 0.2s ease, transform 0.2s ease",
  },
  recommendBlock: { marginTop: 8 },
  recommendHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  recommendKicker: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--muted)",
    flexShrink: 0,
  },
  recommendRule: {
    flex: 1,
    height: 1,
    background: "var(--border)",
  },
  recommendGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
};
