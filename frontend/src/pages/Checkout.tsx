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
  const firstItem = items[0];

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
        <section style={styles.itemRow} aria-label="Состав заказа">
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
            {itemsCount > 1 && (
              <span style={styles.itemQty}>×{itemsCount}</span>
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
        </section>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <div style={styles.pillField}>
            <span style={styles.pillLabel}>Username</span>
            <div style={styles.pillRow}>
              <span style={styles.pillValue}>{username || "—"}</span>
              <span style={styles.pillHint}>Telegram</span>
            </div>
          </div>

          <div
            style={{
              ...styles.pillField,
              ...(cityFocused ? styles.pillFieldActive : null),
            }}
          >
            <span style={styles.pillLabel}>
              {lang === "ru" ? "Город" : "City"} *
            </span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onFocus={() => setCityFocused(true)}
              onBlur={() => setCityFocused(false)}
              placeholder={lang === "ru" ? "Минск" : "Minsk"}
              style={styles.pillInput}
              autoComplete="address-level2"
              required
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
    paddingBottom: 16,
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
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    color: "var(--text)",
    margin: 0,
  },

  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    padding: 12,
    background: "var(--surface-elevated)",
    borderRadius: 18,
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
  pillField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "10px 18px 12px",
    background: "var(--surface-elevated)",
    borderRadius: 18,
    border: "1px solid transparent",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  pillFieldActive: {
    borderColor: "var(--accent)",
    boxShadow: "0 2px 10px -4px rgba(165, 42, 42, 0.25)",
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  pillRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  pillValue: {
    fontFamily: '"Proxima Nova", -apple-system, system-ui, sans-serif',
    fontSize: 16,
    color: "var(--text)",
    letterSpacing: "-0.01em",
    fontWeight: 600,
  },
  pillHint: {
    fontSize: 10,
    color: "var(--muted)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 600,
  },
  pillInput: {
    width: "100%",
    padding: 0,
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

  summary: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
    paddingLeft: 4,
    paddingRight: 4,
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
    minHeight: 52,
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
