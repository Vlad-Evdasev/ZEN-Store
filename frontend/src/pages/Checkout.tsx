import { useState, useEffect } from "react";
import { getCart, createOrder, type CartItem } from "../api";
import { BackButton } from "../components/BackButton";
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

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />

      <div style={styles.header}>
        <span style={styles.eyebrow}>Checkout</span>
        <h2 style={styles.title}>Оформление заказа</h2>
        <p style={styles.subtitle}>
          {itemsCount > 0
            ? `${itemsCount} ${itemsCount === 1 ? "товар" : itemsCount < 5 ? "товара" : "товаров"} в заказе`
            : "Корзина пуста"}
        </p>
      </div>

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
            <span style={styles.fieldLabel}>Город *</span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onFocus={() => setCityFocused(true)}
              onBlur={() => setCityFocused(false)}
              placeholder="Москва"
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
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Итого</span>
            <span style={styles.summaryValue}>{formatPrice(total)}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...styles.submit,
            ...(canSubmit ? null : styles.submitDisabled),
          }}
        >
          <span>{submitting ? "Отправка..." : "Подтвердить заказ"}</span>
          {!submitting && <span style={styles.submitArrow} aria-hidden>→</span>}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 440, margin: "0 auto", paddingBottom: 32 },
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
  header: {
    marginTop: 8,
    marginBottom: 32,
  },
  eyebrow: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 10,
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 26,
    lineHeight: 1.15,
    letterSpacing: "-0.01em",
    margin: 0,
    color: "var(--text)",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 13,
    color: "var(--muted)",
    letterSpacing: "0.02em",
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
    borderRadius: "var(--radius-md)",
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
    borderRadius: "var(--radius-md)",
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  form: { display: "flex", flexDirection: "column", gap: 28 },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
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
    fontSize: 17,
    color: "var(--text)",
    letterSpacing: "0.01em",
    fontWeight: 500,
  },
  readonlyHint: {
    fontSize: 11,
    color: "var(--muted)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  cleanInput: {
    width: "100%",
    minHeight: 0,
    padding: "6px 0 10px",
    background: "transparent",
    border: "none",
    outline: "none",
    fontFamily: "inherit",
    fontSize: 17,
    color: "var(--text)",
    letterSpacing: "0.01em",
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
    flexDirection: "column",
    gap: 10,
    padding: "18px 20px",
    background: "var(--surface-elevated)",
    borderRadius: "var(--radius-lg)",
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  summaryValue: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  submit: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 56,
    padding: "16px 24px",
    background: "var(--text)",
    border: "none",
    borderRadius: 999,
    color: "var(--surface)",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "transform 0.2s ease, opacity 0.2s ease",
  },
  submitDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  submitArrow: {
    fontSize: 18,
    lineHeight: 1,
    transform: "translateY(-1px)",
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
