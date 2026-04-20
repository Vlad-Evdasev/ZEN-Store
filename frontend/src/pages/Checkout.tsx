import { useState, useEffect } from "react";
import { getCart, createOrder, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface CheckoutProps {
  userId: string;
  userName: string | null;
  onBack: () => void;
  onDone: () => void;
  onOrderSuccess?: () => void;
  sellerLink?: string;
}

export function Checkout({ userId, userName, onBack, onDone, onOrderSuccess, sellerLink }: CheckoutProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState(userName ?? "");
  const [city, setCity] = useState("");
  const [cityFocused, setCityFocused] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    setUsername(userName ?? "");
  }, [userName]);

  useEffect(() => {
    getCart(userId).then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    setSubmitting(true);
    try {
      await createOrder(userId, {
        user_name: (userName || username || "").trim() || undefined,
        user_username: username.trim() || undefined,
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
      <div style={styles.wrap}>
        <h2 style={styles.title}>Заказ оформлен!</h2>
        <p style={styles.successText}>Продавец получил уведомление и свяжется с вами.</p>
        <div style={styles.choice}>
          <p style={styles.choiceLabel}>Как продолжить?</p>
          <button onClick={handleWriteSeller} style={styles.choiceBtn}>
            Написать продавцу сейчас
          </button>
          <button onClick={handleSellerWillContact} style={styles.choiceBtnAlt}>
            Продавец сам свяжется со мной
          </button>
        </div>
        <button type="button" onClick={onDone} className="zen-btn-secondary" style={styles.backBtn}>
          В каталог
        </button>
      </div>
    );
  }

  const canSubmit = city.trim().length > 0 && !submitting;
  const itemWord =
    lang === "ru"
      ? itemsCount === 1
        ? "товар"
        : itemsCount < 5
          ? "товара"
          : "товаров"
      : itemsCount === 1
        ? "item"
        : "items";

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={onBack}
        style={styles.ghostBack}
        aria-label={t(lang, "back")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{t(lang, "back")}</span>
      </button>

      <header style={styles.header}>
        <h1 style={styles.title}>Оформление заказа</h1>
        <p style={styles.subtitle}>
          {itemsCount > 0 ? `${itemsCount} ${itemWord}` : "Корзина пуста"}
          {itemsCount > 0 && <span style={styles.subtitleDot}>·</span>}
          {itemsCount > 0 && (
            <span style={styles.subtitleTotal}>{formatPrice(total)}</span>
          )}
        </p>
      </header>

      {items.length > 0 && (
        <section style={styles.itemsSection} aria-label="Состав заказа">
          <div className="hide-scrollbar" style={styles.itemsScroller}>
            {items.map((it) => (
              <article key={it.id} style={styles.miniCard}>
                <div style={styles.miniThumbWrap}>
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt=""
                      style={styles.miniThumb}
                      loading="lazy"
                    />
                  ) : (
                    <div style={styles.miniThumbFallback}>
                      <span>{(it.name || "?")[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  {it.quantity > 1 && (
                    <span style={styles.miniQty}>×{it.quantity}</span>
                  )}
                </div>
                <p style={styles.miniName}>{it.name}</p>
                <p style={styles.miniMeta}>
                  {it.size ? (
                    <>
                      <span style={styles.miniMetaLabel}>
                        {lang === "ru" ? "Размер" : "Size"}
                      </span>
                      <span style={styles.miniMetaValue}>{it.size}</span>
                    </>
                  ) : (
                    <span style={styles.miniMetaValue}>—</span>
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Username</span>
            <div style={styles.readonlyRow}>
              <span style={styles.readonlyValue}>{username || "—"}</span>
              <span style={styles.readonlyHint}>Telegram</span>
            </div>
            <div style={styles.fieldLine} />
          </div>

          <div style={styles.field}>
            <span style={styles.fieldLabel}>{lang === "ru" ? "Город" : "City"} *</span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onFocus={() => setCityFocused(true)}
              onBlur={() => setCityFocused(false)}
              placeholder={lang === "ru" ? "Москва" : "Moscow"}
              style={styles.cleanInput}
              autoComplete="address-level2"
              required
            />
            <div
              style={{
                ...styles.fieldLine,
                ...(cityFocused ? styles.fieldLineActive : null),
              }}
            />
          </div>
        </div>

        <div style={styles.summary}>
          <span style={styles.summaryLabel}>
            {lang === "ru" ? "Итого к оплате" : "Total"}
          </span>
          <span style={styles.summaryValue}>{formatPrice(total)}</span>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...styles.submit,
            ...(canSubmit ? null : styles.submitDisabled),
          }}
        >
          {submitting
            ? lang === "ru"
              ? "Отправка..."
              : "Sending..."
            : lang === "ru"
              ? "Подтвердить заказ"
              : "Confirm order"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 460,
    margin: "0 auto",
    paddingBottom: 40,
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },

  ghostBack: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
    padding: "6px 4px",
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.02em",
    cursor: "pointer",
    transition: "color 0.15s ease",
  },

  header: {
    marginBottom: 28,
  },
  title: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    color: "var(--text)",
    margin: 0,
  },
  subtitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 0,
    fontSize: 14,
    color: "var(--muted)",
    letterSpacing: "0.01em",
  },
  subtitleDot: {
    color: "var(--border)",
  },
  subtitleTotal: {
    color: "var(--text)",
    fontWeight: 600,
  },

  itemsSection: {
    margin: "0 -16px 28px",
  },
  itemsScroller: {
    display: "flex",
    gap: 12,
    padding: "4px 16px 8px",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
  } as React.CSSProperties,
  miniCard: {
    flex: "0 0 132px",
    width: 132,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    scrollSnapAlign: "start",
  },
  miniThumbWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "4 / 5",
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--surface-elevated)",
  },
  miniThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  miniThumbFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 28,
    fontWeight: 600,
    color: "var(--muted)",
  },
  miniQty: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: "3px 8px",
    background: "rgba(0, 0, 0, 0.72)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    borderRadius: 999,
    backdropFilter: "blur(8px)",
  },
  miniName: {
    margin: 0,
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
  },
  miniMeta: {
    margin: 0,
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.2,
  },
  miniMetaLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  miniMetaValue: {
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.02em",
  },

  form: { display: "flex", flexDirection: "column", gap: 24 },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    position: "relative",
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  readonlyRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 2,
    paddingBottom: 10,
  },
  readonlyValue: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 17,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    fontWeight: 600,
  },
  readonlyHint: {
    fontSize: 10,
    color: "var(--muted)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 600,
  },
  cleanInput: {
    width: "100%",
    minHeight: 0,
    padding: "6px 0 10px",
    background: "transparent",
    border: "none",
    outline: "none",
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 17,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    borderRadius: 0,
    boxShadow: "none",
  },
  fieldLine: {
    height: 1,
    width: "100%",
    background: "var(--border)",
    transition: "background 0.2s ease, height 0.2s ease",
  },
  fieldLineActive: {
    background: "var(--accent)",
    height: 2,
  },

  summary: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: "var(--muted)",
    letterSpacing: "0.01em",
  },
  summaryValue: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--text)",
  },

  submit: {
    width: "100%",
    minHeight: 54,
    padding: "14px 24px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 999,
    color: "#fff",
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.02em",
    cursor: "pointer",
    transition: "background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease",
    boxShadow: "0 8px 20px -10px rgba(165, 42, 42, 0.55)",
  },
  submitDisabled: {
    background: "var(--surface-elevated)",
    color: "var(--muted)",
    cursor: "not-allowed",
    boxShadow: "none",
  },

  backBtn: {
    marginTop: 24,
    padding: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  successText: {
    color: "var(--muted)",
    marginBottom: 24,
  },
  choice: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 16,
  },
  choiceLabel: {
    fontSize: 14,
    color: "var(--muted)",
    marginBottom: 4,
  },
  choiceBtn: {
    padding: 16,
    background: "var(--accent)",
    border: "none",
    borderRadius: 999,
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  choiceBtnAlt: {
    padding: 16,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
};
