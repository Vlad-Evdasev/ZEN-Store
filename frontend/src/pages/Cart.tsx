import { useEffect, useState, useRef } from "react";
import { getCart, removeFromCart, submitCustomOrder, type CartItem } from "../api";
import { useSettings } from "../context/SettingsContext";
import type { Lang } from "../context/SettingsContext";
import { t } from "../i18n";

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

interface CartProps {
  userId: string;
  userName: string | null;
  firstName: string;
  onBack: () => void;
  onCheckout: () => void;
  onCartChange?: () => void;
  onProductClick?: (productId: number) => void;
  onFormFieldFocus?: () => void;
}

export function Cart({ userId, userName, firstName, onBack, onCheckout, onCartChange, onProductClick, onFormFieldFocus }: CartProps) {
  const { formatPrice, settings } = useSettings();
  const lang = settings.lang;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState("");
  const [customAddress, setCustomAddress] = useState("");
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
    if (!customName.trim() || !customAddress.trim() || !customDesc.trim()) return;
    setCustomSubmitting(true);
    setCustomSuccess(false);
    try {
      await submitCustomOrder(userId, {
        user_name: customName.trim() || undefined,
        user_username: userName ?? undefined,
        user_address: customAddress.trim() || undefined,
        description: customDesc.trim(),
        size: customSize.trim(),
        image_data: customPhoto || undefined,
      });
      setCustomSuccess(true);
      setCustomName("");
      setCustomAddress("");
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

  const scrollFieldIntoView = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onFormFieldFocus?.();
    const el = e.target;
    setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 400);
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
          lang={lang}
          userName={userName}
          firstName={firstName}
          customName={customName}
          setCustomName={setCustomName}
          customAddress={customAddress}
          setCustomAddress={setCustomAddress}
          customDesc={customDesc}
          setCustomDesc={setCustomDesc}
          customSize={customSize}
          setCustomSize={setCustomSize}
          customPhoto={customPhoto}
          setCustomPhoto={setCustomPhoto}
          customSubmitting={customSubmitting}
          customSuccess={customSuccess}
          setCustomSuccess={setCustomSuccess}
          handleCustomOrderSubmit={handleCustomOrderSubmit}
          onPhotoChange={onPhotoChange}
          fileInputRef={fileInputRef}
          onFieldFocus={scrollFieldIntoView}
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
          <div
            key={item.id}
            style={{ ...styles.item, ...(onProductClick ? styles.itemClickable : {}) }}
            onClick={onProductClick ? () => onProductClick(item.product_id) : undefined}
            role={onProductClick ? "button" : undefined}
            tabIndex={onProductClick ? 0 : undefined}
            onKeyDown={onProductClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProductClick(item.product_id); } } : undefined}
          >
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
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(item.id); }}
              style={styles.remove}
              aria-label="Удалить"
            >
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
        lang={lang}
        userName={userName}
        firstName={firstName}
        customName={customName}
        setCustomName={setCustomName}
        customAddress={customAddress}
        setCustomAddress={setCustomAddress}
        customDesc={customDesc}
        setCustomDesc={setCustomDesc}
        customSize={customSize}
        setCustomSize={setCustomSize}
        customPhoto={customPhoto}
        setCustomPhoto={setCustomPhoto}
        customSubmitting={customSubmitting}
        customSuccess={customSuccess}
        setCustomSuccess={setCustomSuccess}
        handleCustomOrderSubmit={handleCustomOrderSubmit}
        onPhotoChange={onPhotoChange}
        fileInputRef={fileInputRef}
        onFieldFocus={scrollFieldIntoView}
        t={t}
      />
    </div>
  );
}

function CustomOrderForm({
  lang,
  userName,
  firstName,
  customName,
  setCustomName,
  customAddress,
  setCustomAddress,
  customDesc,
  setCustomDesc,
  customSize,
  setCustomSize,
  customPhoto,
  setCustomPhoto,
  customSubmitting,
  customSuccess,
  setCustomSuccess,
  handleCustomOrderSubmit,
  onPhotoChange,
  fileInputRef,
  onFieldFocus,
  t,
}: {
  lang: Lang;
  userName: string | null;
  firstName: string;
  customName: string;
  setCustomName: (s: string) => void;
  customAddress: string;
  setCustomAddress: (s: string) => void;
  customDesc: string;
  setCustomDesc: (s: string) => void;
  customSize: string;
  setCustomSize: (s: string) => void;
  customPhoto: string | null;
  setCustomPhoto: (s: string | null) => void;
  customSubmitting: boolean;
  customSuccess: boolean;
  setCustomSuccess: (v: boolean) => void;
  handleCustomOrderSubmit: (e: React.FormEvent) => void;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFieldFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  t: (lang: Lang, key: string) => string;
}) {
  if (customSuccess) {
    return (
      <div style={styles.customOrderWrap}>
        <h3 style={styles.customOrderTitle}>{t(lang, "customOrderTitle")}</h3>
        <p style={styles.customOrderSuccess}>{t(lang, "customOrderSuccess")}</p>
        <button
          type="button"
          onClick={() => setCustomSuccess(false)}
          style={styles.customOrderNewBtn}
        >
          <span style={styles.customOrderNewBtnIcon} aria-hidden>↻</span>
          {t(lang, "customOrderNew")}
        </button>
      </div>
    );
  }
  return (
    <div style={styles.customOrderWrap}>
      <h3 style={styles.customOrderTitle}>{t(lang, "customOrderTitle")}</h3>
      <form onSubmit={handleCustomOrderSubmit} style={styles.customOrderForm}>
        <label style={styles.customOrderLabel}>{t(lang, "customOrderName")} *</label>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onFocus={onFieldFocus}
          placeholder={firstName || t(lang, "customOrderPlaceholderName")}
          style={styles.customOrderInput}
          required
        />
        <label style={styles.customOrderLabel}>{t(lang, "customOrderUsername")}</label>
        <input
          type="text"
          value={userName ?? ""}
          readOnly
          onFocus={onFieldFocus}
          style={{ ...styles.customOrderInput, opacity: 0.9 }}
        />
        <label style={styles.customOrderLabel}>{t(lang, "customOrderAddress")} *</label>
        <input
          type="text"
          value={customAddress}
          onChange={(e) => setCustomAddress(e.target.value)}
          onFocus={onFieldFocus}
          placeholder={t(lang, "customOrderPlaceholderAddress")}
          style={styles.customOrderInput}
          required
        />
        <label style={styles.customOrderLabel}>{t(lang, "customOrderPhoto")}</label>
        <div style={styles.customOrderPhotoBlock}>
          <input
            ref={fileInputRef as React.Ref<HTMLInputElement>}
            type="file"
            accept="image/*"
            onChange={onPhotoChange}
            style={styles.customOrderFileHidden}
            aria-hidden
          />
          {customPhoto ? (
            <div style={styles.customOrderPhotoWrap}>
              <img src={customPhoto} alt="" style={styles.customOrderPhotoPreview} />
              <button type="button" onClick={() => setCustomPhoto(null)} style={styles.customOrderPhotoRemove}>✕</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={styles.customOrderPhotoBtn}
            >
              <span style={styles.customOrderPhotoBtnIcon} aria-hidden>
                <PaperclipIcon />
              </span>
              <span>{t(lang, "customOrderPhotoAdd")}</span>
            </button>
          )}
        </div>
        <label style={styles.customOrderLabel}>{t(lang, "customOrderDesc")} *</label>
        <textarea
          value={customDesc}
          onChange={(e) => setCustomDesc(e.target.value)}
          onFocus={onFieldFocus}
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
          onFocus={onFieldFocus}
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
  itemClickable: {
    cursor: "pointer",
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
    paddingBottom: 260,
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
    marginBottom: 16,
  },
  customOrderNewBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 20px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  customOrderNewBtnIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  customOrderForm: { display: "flex", flexDirection: "column", gap: 10 },
  customOrderLabel: {
    fontSize: 13,
    color: "var(--muted)",
  },
  customOrderPhotoBlock: {
    marginBottom: 4,
  },
  customOrderFileHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },
  customOrderPhotoBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px",
    width: "100%",
    background: "var(--bg)",
    border: "1px dashed var(--border)",
    borderRadius: 10,
    color: "var(--muted)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  customOrderPhotoBtnIcon: {
    fontSize: 18,
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
