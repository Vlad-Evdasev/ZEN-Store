import { useState, useEffect, useMemo } from "react";
import { getOrders, getMyCustomOrders, cancelTonPayment, type Order, type MyCustomOrder, type Product } from "../api";
import { useSettings } from "../context/SettingsContext";
import type { Lang } from "../context/SettingsContext";
import { t } from "../i18n";

interface HistoryProps {
  userId: string;
  onBack: () => void;
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
  size?: string;
};

type StepKey = "placed" | "processing" | "in_transit" | "delivered";

function getStepIndex(status: string): number {
  if (status === "delivered" || status === "completed") return 3;
  if (status === "in_transit") return 2;
  if (status === "pending") return 1;
  return 0;
}

type HistoryEntry =
  | { kind: "catalog-item"; key: string; createdAt: string; order: Order; item: OrderItem }
  | { kind: "custom"; key: string; createdAt: string; order: MyCustomOrder };

export function History({
  userId,
  onOpenCatalog,
}: HistoryProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<MyCustomOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getOrders(userId), getMyCustomOrders(userId)])
      .then(([catalog, custom]) => {
        if (cancelled) return;
        if (catalog.status === "fulfilled") setOrders(catalog.value);
        if (custom.status === "fulfilled") setCustomOrders(custom.value);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const activeEntries = useMemo<HistoryEntry[]>(() => {
    // Скрываем completed и cancelled. Оставляем delivered (юзеру важно видеть)
    // и pending_payment (TON-ордер ждёт оплату — нужны действия Cancel/Retry).
    const isActive = (status: string) => status !== "completed" && status !== "cancelled";
    const list: HistoryEntry[] = [];
    for (const o of orders) {
      if (!isActive(o.status)) continue;
      // Каждый item каталог-заказа становится отдельной карточкой — у каждой
      // позиции свой размер/название/фото, а статус-таймлайн разделяется на
      // уровне родительского заказа (status один на все позиции).
      const items = parseItems(o.items);
      if (items.length === 0) continue;
      items.forEach((item, idx) => {
        list.push({
          kind: "catalog-item",
          key: `c-${o.id}-${idx}`,
          createdAt: o.created_at,
          order: o,
          item,
        });
      });
    }
    for (const o of customOrders) {
      if (!isActive(o.status)) continue;
      list.push({ kind: "custom", key: `x-${o.id}`, createdAt: o.created_at, order: o });
    }
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return list;
  }, [orders, customOrders]);

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={styles.loading}>{t(lang, "loading")}</p>
      </div>
    );
  }

  const isEmpty = activeEntries.length === 0;

  // Юзер отменяет неоплаченный TON-ордер. Бэк переводит ордер в cancelled.
  // Перезагружаем список.
  const handleCancelPending = async (orderId: number) => {
    if (!window.confirm(lang === "ru" ? "Отменить заказ?" : "Cancel order?")) return;
    try {
      await cancelTonPayment(orderId);
      const fresh = await getOrders(userId);
      setOrders(fresh);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={styles.wrap} className="zen-page-enter">
      <header style={styles.header}>
        <h2 className="zen-page-title" style={styles.title}>
          {t(lang, "historyTitle")}
        </h2>
      </header>

      {isEmpty ? (
        <EmptyState lang={lang} onOpenCatalog={onOpenCatalog} />
      ) : (
        <section style={styles.section}>
          <div style={styles.activeList}>
            {activeEntries.map((entry) => entry.kind === "catalog-item" ? (
              <CatalogItemCard
                key={entry.key}
                onCancelPending={handleCancelPending}
                order={entry.order}
                item={entry.item}
                formatPrice={formatPrice}
                lang={lang}
              />
            ) : (
              <CustomOrderCard
                key={entry.key}
                order={entry.order}
                lang={lang}
              />
            ))}
          </div>
        </section>
      )}
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

function CatalogItemCard({
  order,
  item,
  formatPrice,
  lang,
  onCancelPending,
}: {
  order: Order;
  item: OrderItem;
  formatPrice: (n: number) => string;
  lang: Lang;
  onCancelPending?: (orderId: number) => void;
}) {
  const isPendingPayment = order.status === "pending_payment";
  const stepIndex = getStepIndex(order.status);

  const steps: { key: StepKey; labelKey: string }[] = [
    { key: "placed", labelKey: "historyStepPlaced" },
    { key: "processing", labelKey: "historyStepProcessing" },
    { key: "in_transit", labelKey: "historyStepInTransit" },
    { key: "delivered", labelKey: "historyStepDelivered" },
  ];

  const price = typeof item.price === "number" ? item.price : 0;

  return (
    <article style={styles.activeCard}>
      {isPendingPayment && (
        <div style={styles.pendingPaymentBanner}>
          <div style={styles.pendingPaymentText}>
            <span style={styles.pendingPaymentTitle}>
              {lang === "ru" ? "Ожидает оплату" : "Awaiting payment"}
            </span>
            <span style={styles.pendingPaymentHint}>
              {lang === "ru"
                ? "Оплата ещё не подтверждена. Если ты передумал — отмени."
                : "Payment not confirmed yet. Cancel if you've changed your mind."}
            </span>
          </div>
          {onCancelPending && (
            <button
              type="button"
              onClick={() => onCancelPending(order.id)}
              style={styles.pendingPaymentCancel}
            >
              {lang === "ru" ? "Отменить" : "Cancel"}
            </button>
          )}
        </div>
      )}
      <div style={styles.activeCardHeader}>
        <div>
          <span style={styles.activeOrderDate}>
            {formatDate(order.created_at, lang)}
          </span>
        </div>
        <span style={styles.activeTotal}>{formatPrice(price)}</span>
      </div>

      <div style={styles.activePreview}>
        <div style={styles.thumbStack}>
          <div style={styles.thumb}>
            {item.image_url ? (
              <img src={item.image_url} alt="" style={styles.thumbImg} />
            ) : (
              <div style={styles.thumbPlaceholder} />
            )}
          </div>
        </div>
        <div style={styles.activeItemsMeta}>
          <span style={styles.activeItemsTitle}>{item.name || "—"}</span>
          {item.size && (
            <span style={styles.activeItemsCount}>
              {t(lang, "historyCustomSize")}: {item.size}
            </span>
          )}
        </div>
      </div>

      <div style={styles.timelineWrap} aria-label="order progress">
        <div style={styles.timelineTrack}>
          {steps.map((step, idx) => {
            const done = idx <= stepIndex;
            const current = idx === stepIndex;
            const showConnector = idx < steps.length - 1;
            const nextDone = idx + 1 <= stepIndex;
            return (
              <div
                key={step.key}
                style={{
                  ...styles.timelineNodeWrap,
                  ...(showConnector ? styles.timelineNodeWrapGrow : {}),
                }}
              >
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
            );
          })}
        </div>
        <div style={styles.timelineLabels}>
          {steps.map((step, idx) => {
            const done = idx <= stepIndex;
            const current = idx === stepIndex;
            const isFirst = idx === 0;
            const isLast = idx === steps.length - 1;
            const align: React.CSSProperties = isFirst
              ? { justifyContent: "flex-start" }
              : isLast
                ? { justifyContent: "flex-end" }
                : { justifyContent: "center" };
            return (
              <div
                key={step.key}
                style={{
                  ...styles.timelineLabelSlot,
                  ...align,
                  ...(isFirst || isLast
                    ? styles.timelineLabelSlotEdge
                    : styles.timelineLabelSlotMid),
                }}
              >
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
      </div>
    </article>
  );
}

function CustomOrderCard({
  order,
  lang,
}: {
  order: MyCustomOrder;
  lang: Lang;
}) {
  const stepIndex = getStepIndex(order.status);

  const steps: { key: StepKey; labelKey: string }[] = [
    { key: "placed", labelKey: "historyStepPlaced" },
    { key: "processing", labelKey: "historyStepProcessing" },
    { key: "in_transit", labelKey: "historyStepInTransit" },
    { key: "delivered", labelKey: "historyStepDelivered" },
  ];

  const description = order.description?.trim();
  const size = order.size?.trim();

  return (
    <article style={styles.activeCard}>
      <div style={styles.activeCardHeader}>
        <div>
          <span style={styles.customBadge}>{t(lang, "historyCustomBadge")}</span>
          <span style={{ ...styles.activeOrderDate, marginTop: 4, display: "block" }}>
            {formatDate(order.created_at, lang)}
          </span>
        </div>
      </div>

      <div style={styles.activePreview}>
        <div style={styles.thumbStack}>
          <div style={styles.thumb}>
            {order.image_data ? (
              <img src={order.image_data} alt="" style={styles.thumbImg} />
            ) : (
              <div style={styles.thumbPlaceholder} />
            )}
          </div>
        </div>
        <div style={styles.activeItemsMeta}>
          <span style={styles.activeItemsTitle}>
            {description || t(lang, "historyCustomNoDesc")}
          </span>
          {size && (
            <span style={styles.activeItemsCount}>
              {t(lang, "historyCustomSize")}: {size}
            </span>
          )}
        </div>
      </div>

      <div style={styles.timelineWrap} aria-label="custom order progress">
        <div style={styles.timelineTrack}>
          {steps.map((step, idx) => {
            const done = idx <= stepIndex;
            const current = idx === stepIndex;
            const showConnector = idx < steps.length - 1;
            const nextDone = idx + 1 <= stepIndex;
            return (
              <div
                key={step.key}
                style={{
                  ...styles.timelineNodeWrap,
                  ...(showConnector ? styles.timelineNodeWrapGrow : {}),
                }}
              >
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
            );
          })}
        </div>
        <div style={styles.timelineLabels}>
          {steps.map((step, idx) => {
            const done = idx <= stepIndex;
            const current = idx === stepIndex;
            const isFirst = idx === 0;
            const isLast = idx === steps.length - 1;
            const align: React.CSSProperties = isFirst
              ? { justifyContent: "flex-start" }
              : isLast
                ? { justifyContent: "flex-end" }
                : { justifyContent: "center" };
            return (
              <div
                key={step.key}
                style={{
                  ...styles.timelineLabelSlot,
                  ...align,
                  ...(isFirst || isLast
                    ? styles.timelineLabelSlotEdge
                    : styles.timelineLabelSlotMid),
                }}
              >
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
      </div>
    </article>
  );
}

function EmptyState({
  lang,
  onOpenCatalog,
}: {
  lang: Lang;
  onOpenCatalog?: () => void;
}) {
  return (
    <div style={styles.emptyBubbleRow}>
      <div style={styles.emptyBubble}>
        <div style={styles.emptyBubbleTitle}>
          {t(lang, "historyEmptyHeadline")}
        </div>
        <div style={styles.emptyBubbleSubtitle}>
          {t(lang, "historyEmptySubline")}
        </div>
        {onOpenCatalog && (
          <button
            type="button"
            onClick={onOpenCatalog}
            style={styles.emptyBubbleCta}
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

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "8px 0 120px",
  },
  loading: { textAlign: "center", color: "var(--muted)", padding: 64 },

  header: { marginBottom: 28 },
  title: { margin: 0 },

  section: { marginBottom: 36 },

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
  pendingPaymentBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    margin: "-2px -2px 12px",
    background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
    border: "1px solid color-mix(in srgb, var(--accent) 24%, var(--border))",
    borderRadius: 12,
  },
  pendingPaymentText: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  pendingPaymentTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.005em",
  },
  pendingPaymentHint: {
    fontSize: 11.5,
    color: "var(--muted)",
    lineHeight: 1.4,
  },
  pendingPaymentCancel: {
    padding: "6px 12px",
    background: "transparent",
    border: "1px solid var(--accent)",
    borderRadius: 8,
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  activeCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
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

  customBadge: {
    display: "inline-block",
    padding: "3px 10px",
    background: "var(--accent-soft, rgba(198,40,40,0.12))",
    color: "var(--accent)",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  customBody: {
    padding: "12px 14px",
    background: "var(--surface-elevated)",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  customDescription: {
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.5,
    color: "var(--text)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  customSize: {
    fontSize: 12,
    color: "var(--muted)",
    letterSpacing: "0.02em",
  },
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
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 4,
  },
  timelineTrack: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 20,
  },
  timelineNodeWrap: {
    display: "flex",
    alignItems: "center",
    flex: "0 0 auto",
  },
  timelineNodeWrapGrow: {
    flex: "1 1 auto",
    minWidth: 0,
  },
  timelineLabels: {
    display: "flex",
    width: "100%",
  },
  timelineLabelSlot: {
    display: "flex",
    alignItems: "flex-start",
  },
  timelineLabelSlotEdge: {
    flex: "0 0 auto",
  },
  timelineLabelSlotMid: {
    flex: "1 1 0",
    minWidth: 0,
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
    lineHeight: 1.3,
    whiteSpace: "nowrap",
  },
  timelineLabelDone: { color: "var(--text)" },
  timelineLabelCurrent: { color: "var(--accent)", fontWeight: 600 },

  emptyBubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 32,
  },
  emptyAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    flexShrink: 0,
  },
  emptyBubble: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "12px 14px",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  emptyBubbleTitle: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  emptyBubbleSubtitle: {
    fontSize: 12.5,
    color: "var(--muted)",
    lineHeight: 1.4,
  },
  emptyBubbleCta: {
    alignSelf: "flex-start",
    marginTop: 10,
    minHeight: 40,
    padding: "10px 20px",
    borderRadius: 999,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background-color 0.2s ease, transform 0.2s ease",
  },
};
