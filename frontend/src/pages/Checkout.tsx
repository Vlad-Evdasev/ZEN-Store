import { useState, useEffect } from "react";
import { getCart, createOrder, removeFromCart, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

function pluralize(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

interface CheckoutProps {
  userId: string;
  userName: string | null;
  onBack: () => void;
  onDone: () => void;
  onOrderSuccess?: () => void;
  onCartChange?: () => void;
  sellerLink?: string;
}

export function Checkout({ userId, userName, onBack, onDone, onOrderSuccess, onCartChange, sellerLink }: CheckoutProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [city, setCity] = useState("");
  const [cityFocused, setCityFocused] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    getCart(userId).then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const firstItem = items[0];
  const hasMultiple = items.length > 1;

  const handleRemoveItem = async (id: number) => {
    if (removingId !== null) return;
    setRemovingId(id);
    const prev = items;
    setTimeout(() => {
      setItems((list) => {
        const next = list.filter((i) => i.id !== id);
        if (next.length <= 1) setItemsExpanded(false);
        return next;
      });
      setRemovingId(null);
    }, 180);
    try {
      await removeFromCart(userId, id);
      onCartChange?.();
    } catch (e) {
      console.error(e);
      setItems(prev);
      setRemovingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      await createOrder(userId, {
        user_name: (userName || "").trim() || undefined,
        user_username: (userName || "").trim() || undefined,
        user_address: city.trim(),
        items,
        total,
      });
      onOrderSuccess?.();
      setOrderSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWriteSeller = () => {
    const base = sellerLink || "https://t.me/ZenStoreBot";
    const parts = items.map((i) => {
      const line = [i.name].concat(i.size ? [`размер ${i.size}`] : []).join(", ");
      const img = i.image_url || "";
      return img ? `${line}\n${img}` : line;
    });
    const text = parts.join("\n\n");
    const sep = base.includes("?") ? "&" : "?";
    const url = text ? `${base}${sep}text=${encodeURIComponent(text)}` : base;
    window.open(url, "_blank");
    onDone();
  };

  const handleSellerWillContact = () => {
    onDone();
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div style={styles.successWrap}>
        <div style={styles.successInner}>
          <div style={styles.bubbleRow}>
            <div style={styles.avatar}>
              <span style={styles.avatarLetter}>R</span>
              <span style={styles.avatarCheck} aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5l4.2 4.2L19 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div style={styles.bubbleMain}>
              <div style={styles.bubbleTitle}>
                {lang === "ru" ? "Заказ оформлен" : "Order placed"}
              </div>
              <div style={styles.bubbleSubtitle}>
                {lang === "ru"
                  ? "Продавец получил уведомление и свяжется с вами."
                  : "The seller has been notified and will contact you."}
              </div>
            </div>
          </div>

          <div style={styles.successActions}>
            <p style={styles.actionsLabel}>
              {lang === "ru" ? "Что дальше?" : "What's next?"}
            </p>

            <button
              type="button"
              onClick={handleWriteSeller}
              style={styles.actionPrimary}
            >
              <span style={styles.actionIconPrimary} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 12a9 9 0 1 1-3.6-7.2L21 3l-1.2 4.2A9 9 0 0 1 21 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 12h.01M12 12h.01M16 12h.01"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span style={styles.actionText}>
                <span style={styles.actionTitle}>
                  {lang === "ru" ? "Написать продавцу" : "Message the seller"}
                </span>
                <span style={styles.actionHintPrimary}>
                  {lang === "ru" ? "Открыть чат в Telegram" : "Open chat in Telegram"}
                </span>
              </span>
              <span style={styles.actionArrowPrimary} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>

            <button
              type="button"
              onClick={handleSellerWillContact}
              style={styles.actionSecondary}
            >
              <span style={styles.actionIconSecondary} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M12 7v5l3 2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span style={styles.actionText}>
                <span style={styles.actionTitle}>
                  {lang === "ru" ? "Продавец свяжется сам" : "Seller will reach out"}
                </span>
                <span style={styles.actionHintSecondary}>
                  {lang === "ru" ? "Подождать уведомления" : "Wait for a notification"}
                </span>
              </span>
              <span style={styles.actionArrowSecondary} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDone}
          style={styles.catalogLink}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{lang === "ru" ? "В каталог" : "Back to catalog"}</span>
        </button>
      </div>
    );
  }

  const canSubmit = city.trim().length > 0 && !submitting && items.length > 0;

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={onBack}
        style={styles.closeBtn}
        aria-label={t(lang, "back")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <header style={styles.header}>
        <h1 style={styles.title}>
          {lang === "ru" ? "Оформление заказа" : "Checkout"}
        </h1>
      </header>

      {firstItem && (
        <section style={styles.itemsSection} aria-label={lang === "ru" ? "Состав заказа" : "Order items"}>
          {hasMultiple ? (
            <button
              type="button"
              onClick={() => setItemsExpanded((v) => !v)}
              style={styles.itemsSummary}
              aria-expanded={itemsExpanded}
              aria-controls="checkout-items-list"
            >
              {(() => {
                const THUMB = 52;
                const OFFSET = 24;
                const previewItems = items.slice(0, 3);
                const hiddenCount = items.length - previewItems.length;
                const stackWidth = THUMB + (previewItems.length - 1) * OFFSET;
                return (
                  <div
                    style={{ ...styles.itemsStack, width: stackWidth, height: THUMB }}
                    aria-hidden="true"
                  >
                    {previewItems.map((it, idx) => (
                      <div
                        key={it.id}
                        style={{
                          ...styles.itemsStackThumb,
                          zIndex: previewItems.length - idx,
                          left: idx * OFFSET,
                        }}
                      >
                        {it.image_url ? (
                          <img src={it.image_url} alt="" style={styles.itemThumb} loading="lazy" />
                        ) : (
                          <div style={styles.itemThumbFallback}>
                            <span>{(it.name || "?")[0]?.toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <span style={styles.itemsStackMoreBadge}>
                        +{hiddenCount}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div style={styles.itemsSummaryText}>
                <span style={styles.itemsSummaryTitle}>
                  {lang === "ru"
                    ? `${items.length} ${pluralize(items.length, ["товар", "товара", "товаров"])}`
                    : `${items.length} ${items.length === 1 ? "item" : "items"}`}
                </span>
                <span style={styles.itemsSummaryHint}>
                  {itemsExpanded
                    ? lang === "ru"
                      ? "Свернуть"
                      : "Collapse"
                    : lang === "ru"
                      ? "Нажмите, чтобы раскрыть"
                      : "Tap to expand"}
                </span>
              </div>
              <span
                style={{
                  ...styles.itemsChevron,
                  transform: itemsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          ) : (
            <div style={styles.itemRow}>
              <div style={styles.itemThumbWrap}>
                {firstItem.image_url ? (
                  <img
                    src={firstItem.image_url}
                    alt=""
                    style={styles.itemThumb}
                    loading="lazy"
                  />
                ) : (
                  <div style={styles.itemThumbFallback}>
                    <span>{(firstItem.name || "?")[0]?.toUpperCase()}</span>
                  </div>
                )}
                {firstItem.quantity > 1 && (
                  <span style={styles.itemQty}>×{firstItem.quantity}</span>
                )}
              </div>
              <div style={styles.itemInfo}>
                <p style={styles.itemName}>{firstItem.name}</p>
                {firstItem.size && (
                  <p style={styles.itemMeta}>
                    <span style={styles.itemMetaLabel}>
                      {lang === "ru" ? "Размер" : "Size"}
                    </span>
                    <span style={styles.itemMetaValue}>{firstItem.size}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {hasMultiple && (
            <div
              id="checkout-items-list"
              style={{
                ...styles.itemsList,
                maxHeight: itemsExpanded ? items.length * 96 + 16 : 0,
                opacity: itemsExpanded ? 1 : 0,
                marginTop: itemsExpanded ? 8 : 0,
                pointerEvents: itemsExpanded ? "auto" : "none",
              }}
              aria-hidden={!itemsExpanded}
            >
              {items.map((it) => {
                const isRemoving = removingId === it.id;
                return (
                  <div
                    key={it.id}
                    style={{
                      ...styles.itemListRow,
                      opacity: isRemoving ? 0 : 1,
                      transform: isRemoving ? "translateX(12px)" : "translateX(0)",
                    }}
                  >
                    <div style={styles.itemListThumb}>
                      {it.image_url ? (
                        <img src={it.image_url} alt="" style={styles.itemThumb} loading="lazy" />
                      ) : (
                        <div style={styles.itemThumbFallback}>
                          <span>{(it.name || "?")[0]?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div style={styles.itemListBody}>
                      <span style={styles.itemListName}>{it.name}</span>
                      <span style={styles.itemListMeta}>
                        {it.size ? `${it.size} · ` : ""}
                        {it.quantity} {lang === "ru" ? "шт" : "pcs"}
                      </span>
                      <span style={styles.itemListPrice}>
                        {formatPrice(it.price * it.quantity)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      style={styles.itemListRemove}
                      aria-label={t(lang, "cartRemove")}
                      disabled={isRemoving}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                        <path
                          d="M6 6l12 12M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <form id="checkout-form" onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          {(() => {
            const hasValue = city.length > 0;
            const floated = cityFocused || hasValue;
            return (
              <label
                style={{
                  ...styles.lineField,
                  ...(cityFocused ? styles.lineFieldActive : null),
                }}
              >
                <span
                  style={{
                    ...styles.lineFieldIcon,
                    color: floated ? "var(--accent)" : "var(--muted)",
                  }}
                  aria-hidden="true"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>

                <span style={styles.lineFieldBody}>
                  <span
                    style={{
                      ...styles.lineFieldLabel,
                      ...(floated ? styles.lineFieldLabelFloated : null),
                      color: cityFocused ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {lang === "ru" ? "Город" : "City"}
                    <span style={styles.lineFieldRequired} aria-hidden="true">*</span>
                  </span>

                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onFocus={() => setCityFocused(true)}
                    onBlur={() => setCityFocused(false)}
                    placeholder={floated ? (lang === "ru" ? "Минск" : "Minsk") : ""}
                    style={styles.lineFieldInput}
                    autoComplete="address-level2"
                    required
                  />
                </span>

                <span
                  style={{
                    ...styles.lineFieldUnderline,
                    ...(cityFocused ? styles.lineFieldUnderlineActive : null),
                  }}
                  aria-hidden="true"
                />
              </label>
            );
          })()}
        </div>
      </form>

      <div className="zen-bag-summary zen-bag-summary--bottom">
        <div
          className="zen-bag-summary-bar"
          role="group"
          aria-label={lang === "ru" ? "Итого к оплате" : "Total"}
        >
          <div className="zen-bag-summary-info">
            <span className="zen-bag-summary-info-label">
              {lang === "ru" ? "Итого" : "Total"}
            </span>
            <span className="zen-bag-summary-info-value">
              {formatPrice(total)}
            </span>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={!canSubmit}
            className={`zen-bag-checkout-btn${canSubmit ? "" : " zen-bag-checkout-btn--disabled"}`}
            aria-label={
              submitting
                ? lang === "ru"
                  ? "Отправка"
                  : "Sending"
                : lang === "ru"
                  ? "Подтвердить заказ"
                  : "Confirm order"
            }
          >
            {itemsCount > 0 && (
              <span className="zen-bag-checkout-count" aria-hidden="true">
                {itemsCount}
              </span>
            )}
            <span className="zen-bag-checkout-label">
              {submitting
                ? lang === "ru"
                  ? "Отправка..."
                  : "Sending..."
                : lang === "ru"
                  ? "Подтвердить"
                  : "Confirm"}
            </span>
            <span className="zen-bag-checkout-arrow" aria-hidden="true">
              {submitting ? (
                <svg viewBox="0 0 24 24" className="zen-bag-checkout-spinner">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 460,
    margin: "0 auto",
    paddingBottom: 120,
    position: "relative",
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },

  closeBtn: {
    position: "absolute",
    top: -4,
    right: 0,
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface-elevated)",
    border: "none",
    borderRadius: 999,
    color: "var(--text)",
    cursor: "pointer",
    transition: "background 0.15s ease, transform 0.15s ease",
    zIndex: 2,
  },

  header: {
    marginBottom: 18,
    paddingRight: 44,
  },
  title: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 22,
    fontWeight: 400,
    letterSpacing: "0.02em",
    lineHeight: 1.15,
    color: "var(--text)",
    margin: 0,
  },

  itemsSection: {
    marginBottom: 20,
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 12,
    background: "var(--surface-elevated)",
    borderRadius: 18,
  },
  itemsSummary: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 14px 12px 12px",
    background: "var(--surface-elevated)",
    border: "none",
    borderRadius: 18,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    transition: "background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
  },
  itemsStack: {
    position: "relative",
    flex: "0 0 auto",
  },
  itemsStackThumb: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--surface)",
    boxShadow: "0 0 0 2px var(--surface-elevated)",
  },
  itemsStackMoreBadge: {
    position: "absolute",
    right: -8,
    bottom: -6,
    zIndex: 10,
    minWidth: 26,
    height: 22,
    padding: "0 7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent)",
    color: "#fff",
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.02em",
    borderRadius: 999,
    boxShadow: "0 0 0 2px var(--surface-elevated), 0 2px 6px rgba(165, 42, 42, 0.35)",
  },
  itemsSummaryText: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  itemsSummaryTitle: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  },
  itemsSummaryHint: {
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.3,
  },
  itemsChevron: {
    flex: "0 0 24px",
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted)",
    transition: "transform 0.25s ease",
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    overflow: "hidden",
    transition: "max-height 0.3s ease, opacity 0.25s ease, margin-top 0.25s ease",
  },
  itemListRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    transition: "opacity 0.18s ease, transform 0.18s ease",
  },
  itemListThumb: {
    position: "relative",
    flex: "0 0 52px",
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--surface-elevated)",
  },
  itemListBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  itemListName: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemListMeta: {
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.3,
  },
  itemListPrice: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    marginTop: 2,
  },
  itemListRemove: {
    flex: "0 0 28px",
    width: 28,
    height: 28,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: 999,
    color: "var(--muted)",
    cursor: "pointer",
    transition: "background 0.18s ease, color 0.18s ease",
    WebkitTapHighlightColor: "transparent",
  },
  itemThumbWrap: {
    position: "relative",
    flex: "0 0 64px",
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--surface)",
  },
  itemThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  itemThumbFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 22,
    fontWeight: 600,
    color: "var(--muted)",
  },
  itemQty: {
    position: "absolute",
    top: 4,
    right: 4,
    padding: "2px 6px",
    background: "rgba(0, 0, 0, 0.72)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 999,
  },
  itemInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    flex: 1,
  },
  itemName: {
    margin: 0,
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemMeta: {
    margin: 0,
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    fontSize: 12,
    lineHeight: 1.2,
  },
  itemMetaLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  itemMetaValue: {
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.02em",
  },

  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  lineField: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "18px 4px 10px",
    cursor: "text",
    transition: "background 0.2s ease",
  },
  lineFieldActive: {},
  lineFieldIcon: {
    flex: "0 0 20px",
    width: 20,
    height: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s ease",
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  lineFieldBody: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  lineFieldLabel: {
    position: "absolute",
    left: 0,
    top: 10,
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: "-0.005em",
    color: "var(--muted)",
    pointerEvents: "none",
    transformOrigin: "left center",
    transition:
      "transform 0.2s ease, color 0.2s ease, font-weight 0.2s ease, letter-spacing 0.2s ease",
  },
  lineFieldLabelFloated: {
    transform: "translateY(-18px) scale(0.72)",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  lineFieldRequired: {
    marginLeft: 3,
    color: "var(--accent)",
  },
  lineFieldInput: {
    width: "100%",
    padding: "10px 0 6px",
    background: "transparent",
    border: "none",
    outline: "none",
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 16,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    borderRadius: 0,
    boxShadow: "none",
  },
  lineFieldUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    background: "var(--border)",
    transition: "background 0.2s ease, height 0.2s ease",
  },
  lineFieldUnderlineActive: {
    background: "var(--accent)",
    height: 2,
  },

  successWrap: {
    minHeight: "calc(100dvh - 120px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 24,
    paddingBottom: 16,
    maxWidth: 460,
    margin: "0 auto",
  },
  successInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 22,
  },
  bubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    animation: "zen-success-pop 0.35s ease-out both",
  },
  avatar: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 0,
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "0.06em",
    lineHeight: 1,
  },
  avatarCheck: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#fff",
    color: "var(--accent)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
  },
  bubbleMain: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "18px 18px 18px 4px",
    padding: "12px 16px 14px",
    maxWidth: "86%",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  },
  bubbleTitle: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  bubbleSubtitle: {
    fontSize: 13,
    color: "var(--muted)",
    marginTop: 4,
    lineHeight: 1.45,
  },
  successActions: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "14px 10px 10px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  },
  actionsLabel: {
    margin: 0,
    padding: "0 8px 4px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  actionPrimary: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 14,
    color: "#fff",
    fontFamily: "inherit",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 8px 20px -10px rgba(165, 42, 42, 0.55)",
    transition: "transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
  },
  actionSecondary: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    color: "var(--text)",
    fontFamily: "inherit",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
    WebkitTapHighlightColor: "transparent",
  },
  actionIconPrimary: {
    flex: "0 0 36px",
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "rgba(255, 255, 255, 0.16)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  },
  actionIconSecondary: {
    flex: "0 0 36px",
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent)",
  },
  actionText: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  actionTitle: {
    fontSize: 14.5,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  },
  actionHintPrimary: {
    fontSize: 11.5,
    lineHeight: 1.3,
    color: "rgba(255, 255, 255, 0.78)",
  },
  actionHintSecondary: {
    fontSize: 11.5,
    lineHeight: 1.3,
    color: "var(--muted)",
  },
  actionArrowPrimary: {
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.85)",
  },
  actionArrowSecondary: {
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted)",
  },
  catalogLink: {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.01em",
    cursor: "pointer",
    transition: "color 0.2s ease",
  },
};
