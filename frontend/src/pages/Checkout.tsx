import { useState, useEffect } from "react";
import { getCart, createOrder, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";

interface CheckoutProps {
  userId: string;
  onBack: () => void;
  onDone: () => void;
  onOrderSuccess?: () => void;
  sellerLink?: string;
}

export function Checkout({ userId, onBack, onDone, onOrderSuccess, sellerLink }: CheckoutProps) {
  const { formatPrice } = useSettings();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const isBelarusPhone = (s: string): boolean => {
    const digits = s.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("375")) return /^375(29|33|44|25)\d{7}$/.test(digits);
    if (digits.length === 11 && digits.startsWith("80")) return /^80(29|33|44|25)\d{7}$/.test(digits);
    if (digits.length === 9) return /^(29|33|44|25)\d{7}$/.test(digits);
    return false;
  };

  useEffect(() => {
    getCart(userId).then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    if (!phone.trim()) {
      setPhoneError("Укажите номер телефона");
      return;
    }
    if (!isBelarusPhone(phone.trim())) {
      setPhoneError("Только белорусский номер: +375 (29/33/44/25) XXX-XX-XX");
      return;
    }
    setSubmitting(true);
    try {
      await createOrder(userId, {
        user_name: name.trim() || undefined,
        user_phone: phone.trim(),
        user_address: address.trim() || undefined,
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
    window.open(sellerLink || "https://t.me/ZenStoreBot", "_blank");
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
        <button onClick={onDone} style={styles.backBtn}>
          В каталог
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>

      <h2 style={styles.title}>Оформление заказа</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Имя
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Телефон * (только Беларусь)
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
            placeholder="+375 29 123-45-67"
            style={styles.input}
            required
          />
          {phoneError && <span style={styles.error}>{phoneError}</span>}
        </label>
        <label style={styles.label}>
          Адрес доставки
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Город, улица, дом, квартира"
            style={styles.input}
          />
        </label>

        <div style={styles.total}>
          К оплате: <strong>{formatPrice(total)}</strong>
        </div>

        <button type="submit" disabled={submitting} style={styles.submit}>
          {submitting ? "Отправка..." : "Подтвердить заказ"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto" },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 20,
  },
  backBtn: {
    marginTop: 24,
    padding: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    marginBottom: 24,
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
    borderRadius: 10,
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
    borderRadius: 10,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    color: "var(--muted)",
  },
  input: {
    padding: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 15,
  },
  total: {
    fontSize: 16,
    marginTop: 8,
  },
  error: {
    fontSize: 12,
    color: "var(--accent)",
    marginTop: 4,
  },
  submit: {
    padding: 16,
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
