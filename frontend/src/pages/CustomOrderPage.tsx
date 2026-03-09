import { useState, useRef } from "react";
import { submitCustomOrder } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

interface CustomOrderPageProps {
  userId: string;
  userName: string | null;
  firstName: string;
  onBack: () => void;
}

export function CustomOrderPage({ userId, userName, firstName, onBack }: CustomOrderPageProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [customName, setCustomName] = useState("");
  const [addressRecipientName, setAddressRecipientName] = useState("");
  const [addressFull, setAddressFull] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [addressLocality, setAddressLocality] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addressLines = [
    addressRecipientName.trim(),
    addressFull.trim(),
    addressPostcode.trim(),
    addressLocality.trim(),
    addressRegion.trim(),
    addressPhone.trim(),
  ].filter(Boolean);
  const customAddress = addressLines.join("\n");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customAddress.trim() || !customDesc.trim()) return;
    setCustomSubmitting(true);
    setCustomSuccess(false);
    try {
      await submitCustomOrder(userId, {
        user_name: customName.trim() || undefined,
        user_username: userName ?? undefined,
        user_address: customAddress || undefined,
        description: customDesc.trim(),
        size: customSize.trim(),
        image_data: customPhoto || undefined,
      });
      setCustomSuccess(true);
      setCustomName("");
      setAddressRecipientName("");
      setAddressFull("");
      setAddressPostcode("");
      setAddressLocality("");
      setAddressRegion("");
      setAddressPhone("");
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
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 400);
  };

  if (customSuccess) {
    return (
      <div style={styles.wrap}>
        <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>← {t(lang, "backToMain")}</button>
        <div style={styles.card}>
          <h3 style={styles.title}>{t(lang, "customOrderTitle")}</h3>
          <p style={styles.success}>{t(lang, "customOrderSuccess")}</p>
          <button type="button" onClick={() => setCustomSuccess(false)} style={styles.newBtn}>
            <span style={styles.newBtnIcon} aria-hidden>↻</span>
            {t(lang, "customOrderNew")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>← {t(lang, "backToMain")}</button>
      <div style={styles.card}>
        <h3 style={styles.title}>{t(lang, "customOrderTitle")}</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label className="zen-label" style={styles.label}>{t(lang, "customOrderName")} *</label>
          <input
            type="text"
            className="zen-input"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={firstName || t(lang, "customOrderPlaceholderName")}
            style={styles.input}
            required
          />
          <label className="zen-label" style={styles.label}>{t(lang, "customOrderUsername")}</label>
          <input type="text" className="zen-input" value={userName ?? ""} readOnly onFocus={scrollFieldIntoView} style={{ ...styles.input, opacity: 0.9 }} />
          <label className="zen-label" style={styles.label}>{t(lang, "customOrderAddress")} *</label>
          <input
            type="text"
            className="zen-input"
            value={addressRecipientName}
            onChange={(e) => setAddressRecipientName(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderAddressRecipientName")}
            style={styles.input}
          />
          <input
            type="text"
            className="zen-input"
            value={addressFull}
            onChange={(e) => setAddressFull(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderAddressFull")}
            style={styles.input}
          />
          <input
            type="text"
            className="zen-input"
            value={addressPostcode}
            onChange={(e) => setAddressPostcode(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderAddressPostcode")}
            style={styles.input}
          />
          <input
            type="text"
            className="zen-input"
            value={addressLocality}
            onChange={(e) => setAddressLocality(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderAddressLocality")}
            style={styles.input}
          />
          <input
            type="text"
            className="zen-input"
            value={addressRegion}
            onChange={(e) => setAddressRegion(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderAddressRegion")}
            style={styles.input}
          />
          <input
            type="text"
            className="zen-input"
            value={addressPhone}
            onChange={(e) => setAddressPhone(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderAddressPhone")}
            style={styles.input}
          />
          <label className="zen-label" style={styles.label}>{t(lang, "customOrderPhoto")}</label>
          <div style={styles.photoBlock}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              style={styles.fileHidden}
              aria-hidden
            />
            {customPhoto ? (
              <div style={styles.photoWrap}>
                <img src={customPhoto} alt="" style={styles.photoPreview} />
                <button type="button" onClick={() => setCustomPhoto(null)} style={styles.photoRemove}>✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.photoBtn}>
                <span style={styles.photoBtnIcon} aria-hidden><PaperclipIcon /></span>
                <span>{t(lang, "customOrderPhotoAdd")}</span>
              </button>
            )}
          </div>
          <label className="zen-label" style={styles.label}>{t(lang, "customOrderDesc")} *</label>
          <textarea
            className="zen-textarea"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderPlaceholderDesc")}
            rows={3}
            style={styles.textarea}
            required
          />
          <label className="zen-label" style={styles.label}>{t(lang, "customOrderSize")}</label>
          <input
            type="text"
            className="zen-input"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onFocus={scrollFieldIntoView}
            placeholder={t(lang, "customOrderPlaceholderSize")}
            style={styles.input}
          />
          <button type="submit" disabled={customSubmitting} style={styles.submitBtn}>
            {customSubmitting ? "..." : t(lang, "customOrderSubmit")}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 20,
  },
  card: {
    padding: 20,
    paddingBottom: 24,
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
  },
  title: { fontSize: 18, fontWeight: 600, marginBottom: 16 },
  success: { color: "var(--accent)", fontSize: 14, marginBottom: 12 },
  newBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  newBtnIcon: { fontSize: 18, lineHeight: 1 },
  form: { display: "flex", flexDirection: "column", gap: 6 },
  label: { marginBottom: 2 },
  photoBlock: { marginBottom: 0 },
  fileHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },
  photoBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    width: "100%",
    background: "var(--bg)",
    border: "1px dashed var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--muted)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  photoBtnIcon: { fontSize: 18 },
  photoWrap: { position: "relative", display: "inline-block", alignSelf: "flex-start" },
  photoPreview: { width: 80, height: 80, objectFit: "cover", borderRadius: "var(--radius-md)" },
  photoRemove: {
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
  textarea: { minHeight: 80 },
  input: {},
  submitBtn: {
    width: "100%",
    padding: "14px 16px",
    marginTop: 8,
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
};
