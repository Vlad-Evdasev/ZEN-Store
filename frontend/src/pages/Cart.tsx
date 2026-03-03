import { useEffect, useState, useRef } from "react";
import { getCart, removeFromCart, submitCustomOrder, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface CartProps {
  userId: string;
  onBack: () => void;
  onCheckout: () => void;
  onCartChange?: () => void;
  sellerLink?: string;
}

export function Cart({ userId, onBack, onCheckout, onCartChange, sellerLink }: CartProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDesc, setCustomDesc] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setLoading(true);
    getCart(userId)
      .then((data) => {
        setItems(data);
        onCartChange?.();
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const remove = async (id: number) => {
    try {
      await removeFromCart(userId, id);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCustomOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDesc.trim()) return;
    setCustomSubmitting(true);
    setCustomSuccess(false);
    try {
      await submitCustomOrder(userId, {
        description: customDesc.trim(),
        size: customSize.trim(),
        image_data: customPhoto || undefined,
      });
      setCustomSuccess(true);
      setCustomDesc("");
      setCustomSize("");
      setCustomPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
    } finally {
      setCustomSubmitting(false);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setCustomPhoto((reader.result as string) || null);
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>{t(lang, "loading")}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={styles.wrap}>
        <button onClick={onBack} style={styles.back}>
          ← {t(lang, "toCatalog")}
        </button>
        <p style={styles.empty}>{t(lang, "cartEmpty")}</p>
        <CustomOrderForm
          userId={userId}
          lang={lang}
          customDesc={customDesc}
          setCustomDesc={setCustomDesc}
          customSize={customSize}
          setCustomSize={setCustomSize}
          customPhoto={customPhoto}
          setCustomPhoto={setCustomPhoto}
          customSubmitting={customSubmitting}
          customSuccess={customSuccess}
          handleCustomOrderSubmit={handleCustomOrderSubmit}
          onPhotoChange={onPhotoChange}
          fileInputRef={fileInputRef}
          t={t}
        />
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {t(lang, "back")}
      </button>

      <div style={styles.list}>
        {items.map((item) => (
          <div key={item.id} style={styles.item}>
            <img
              src={item.image_url || "https://via.placeholder.com/80"}
              alt=""
              style={styles.thumb}
            />
            <div style={styles.itemInfo}>
              <p style={styles.itemName}>{item.name}</p>
              <p style={styles.itemMeta}>
                {item.size} × {item.quantity}
              </p>
              <p style={styles.itemPrice}>{formatPrice(item.price * item.quantity)}</p>
            </div>
            <button onClick={() => remove(item.id)} style={styles.remove}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span style={styles.total}>{t(lang, "total")}: {formatPrice(total)}</span>
        <button onClick={onCheckout} style={styles.checkout}>
          {t(lang, "checkout")}
        </button>
      </div>

      <CustomOrderForm
        userId={userId}
        lang={lang}
        customDesc={customDesc}
        setCustomDesc={setCustomDesc}
        customSize={customSize}
        setCustomSize={setCustomSize}
        customPhoto={customPhoto}
        setCustomPhoto={setCustomPhoto}
        customSubmitting={customSubmitting}
        customSuccess={customSuccess}
        handleCustomOrderSubmit={handleCustomOrderSubmit}
        onPhotoChange={onPhotoChange}
        fileInputRef={fileInputRef}
        t={t}
      />
    </div>
  );
}

function CustomOrderForm({
  userId,
  lang,
  customDesc,
  setCustomDesc,
  customSize,
  setCustomSize,
  customPhoto,
  setCustomPhoto,
  customSubmitting,
  customSuccess,
  handleCustomOrderSubmit,
  onPhotoChange,
  fileInputRef,
  t,
}: {
  userId: string;
  lang: string;
  customDesc: string;
  setCustomDesc: (s: string) => void;
  customSize: string;
  setCustomSize: (s: string) => void;
  customPhoto: string | null;
  setCustomPhoto: (s: string | null) => void;
  customSubmitting: boolean;
  customSuccess: boolean;
  handleCustomOrderSubmit: (e: React.FormEvent) => void;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  t: (lang: string, key: string) => string;
}) {
  return (
    <div style={styles.customOrderWrap}>
      <h3 style={styles.customOrderTitle}>{t(lang, "customOrderTitle")}</h3>
      {customSuccess && <p style={styles.customOrderSuccess}>{t(lang, "customOrderSuccess")}</p>}
      <form onSubmit={handleCustomOrderSubmit} style={styles.customOrderForm}>
        <label style={styles.customOrderLabel}>{t(lang, "customOrderPhoto")}</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPhotoChange}
          style={styles.customOrderFile}
        />
        {customPhoto && (
          <div style={styles.customOrderPhotoWrap}>
            <img src={customPhoto} alt="" style={styles.customOrderPhotoPreview} />
            <button type="button" onClick={() => setCustomPhoto(null)} style={styles.customOrderPhotoRemove}>✕</button>
          </div>
        )}
        <label style={styles.customOrderLabel}>{t(lang, "customOrderDesc")} *</label>
        <textarea
          value={customDesc}
          onChange={(e) => setCustomDesc(e.target.value)}
          placeholder={t(lang, "customOrderPlaceholderDesc")}
          rows={3}
          style={styles.customOrderTextarea}
          required
        />
        <label style={styles.customOrderLabel}>{t(lang, "customOrderSize")}</label>
        <input
          type="text"
          value={customSize}
          onChange={(e) => setCustomSize(e.target.value)}
          placeholder={t(lang, "customOrderPlaceholderSize")}
          style={styles.customOrderInput}
        />
        <button type="submit" disabled={customSubmitting} style={styles.customOrderSubmit}>
          {customSubmitting ? "..." : t(lang, "customOrderSubmit")}
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
  list: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  thumb: { width: 64, height: 64, objectFit: "cover", borderRadius: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: 500, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: "var(--muted)", marginBottom: 4 },
  itemPrice: { fontSize: 14, color: "var(--accent)" },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 14,
  },
  footer: {
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  total: {
    display: "block",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  checkout: {
    width: "100%",
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
  customOrderWrap: {
    marginTop: 24,
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  customOrderTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  customOrderSuccess: {
    color: "var(--accent)",
    fontSize: 14,
    marginBottom: 12,
  },
  customOrderForm: { display: "flex", flexDirection: "column", gap: 10 },
  customOrderLabel: {
    fontSize: 12,
    color: "var(--muted)",
    textTransform: "uppercase",
  },
  customOrderFile: {
    fontSize: 13,
    padding: 8,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  },
  customOrderPhotoWrap: {
    position: "relative",
    display: "inline-block",
    alignSelf: "flex-start",
  },
  customOrderPhotoPreview: {
    width: 80,
    height: 80,
    objectFit: "cover",
    borderRadius: 8,
  },
  customOrderPhotoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
  },
  customOrderTextarea: {
    padding: 10,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical",
  },
  customOrderInput: {
    padding: 10,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
  },
  customOrderSubmit: {
    padding: 12,
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
};
