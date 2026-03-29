import { useState, useRef, useEffect } from "react";
import { submitCustomOrder } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

function CameraIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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
  const [customDesc, setCustomDesc] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);
  const [submitHover, setSubmitHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customDesc.trim()) return;
    setCustomSubmitting(true);
    setCustomSuccess(false);
    try {
      await submitCustomOrder(userId, {
        user_name: customName.trim() || undefined,
        user_username: userName ?? undefined,
        description: customDesc.trim(),
        size: customSize.trim(),
        image_data: customPhoto || undefined,
      });
      setCustomSuccess(true);
      setCustomName("");
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
        <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>
          ← {t(lang, "backToCatalog")}
        </button>
        <div style={styles.successCard}>
          <CheckCircleIcon />
          <h3 style={styles.successTitle}>{t(lang, "customOrderSuccess")}</h3>
          <p style={styles.successHint}>{t(lang, "customOrderSubtitle")}</p>
          <button
            type="button"
            onClick={() => setCustomSuccess(false)}
            style={styles.newBtn}
          >
            <span style={styles.newBtnIcon} aria-hidden>↻</span>
            {t(lang, "customOrderNew")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>
        ← {t(lang, "backToCatalog")}
      </button>

      <div style={styles.heroSection}>
        <h2 style={styles.heroTitle}>{t(lang, "customOrderTitle")}</h2>
        <p style={styles.heroSubtitle}>{t(lang, "customOrderSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.section}>
          <span style={styles.sectionLabel}>{t(lang, "customOrderName")} *</span>
          <div style={styles.fieldGroup}>
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
            <input
              type="text"
              className="zen-input"
              value={userName ?? ""}
              readOnly
              onFocus={scrollFieldIntoView}
              style={{ ...styles.input, opacity: 0.7, cursor: "default" }}
            />
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <span style={styles.sectionLabel}>{t(lang, "customOrderDesc")} *</span>
          <div style={styles.fieldGroup}>
            <textarea
              className="zen-textarea"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder={t(lang, "customOrderPlaceholderDesc")}
              rows={5}
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
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <span style={styles.sectionLabel}>{t(lang, "customOrderPhoto")}</span>
          <div style={styles.fieldGroup}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              style={styles.fileHidden}
              aria-hidden
            />
            {customPhoto ? (
              <div style={styles.photoPreviewWrap}>
                <img src={customPhoto} alt="" style={styles.photoPreview} />
                <button type="button" onClick={() => setCustomPhoto(null)} style={styles.photoRemove} aria-label={t(lang, "close")}>
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={styles.uploadZone}
              >
                <span style={styles.uploadIcon}><CameraIcon /></span>
                <span style={styles.uploadText}>{t(lang, "customOrderPhotoAdd")}</span>
                <span style={styles.uploadHint}>PNG, JPG · max 2 MB</span>
              </button>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={customSubmitting}
          style={{
            ...styles.submitBtn,
            ...(submitHover && !customSubmitting ? styles.submitBtnHover : {}),
            ...(customSubmitting ? styles.submitBtnDisabled : {}),
          }}
          onMouseEnter={() => setSubmitHover(true)}
          onMouseLeave={() => setSubmitHover(false)}
        >
          {customSubmitting ? "..." : t(lang, "customOrderSubmit")}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 420,
    margin: "0 auto",
    paddingBottom: 32,
  },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 16,
    padding: 0,
  },

  heroSection: {
    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)",
    borderRadius: "var(--radius-lg)",
    padding: "28px 24px 24px",
    marginBottom: 20,
    textAlign: "center",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    marginBottom: 6,
    letterSpacing: "-0.01em",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    margin: 0,
    fontWeight: 400,
    lineHeight: 1.4,
  },

  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  },
  section: {
    padding: "4px 0",
  },
  sectionLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--muted)",
    marginBottom: 10,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  divider: {
    height: 1,
    background: "var(--border)",
    margin: "14px 0",
    opacity: 0.6,
  },
  label: {
    marginBottom: 0,
    fontSize: 12,
    fontWeight: 500,
  },
  input: {},
  textarea: {
    minHeight: 120,
    resize: "vertical" as const,
  },

  uploadZone: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "28px 16px",
    width: "100%",
    minHeight: 120,
    background: "var(--bg)",
    border: "2px dashed var(--border)",
    borderRadius: "var(--radius-lg)",
    color: "var(--muted)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
  },
  uploadIcon: {
    opacity: 0.5,
    marginBottom: 2,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  uploadHint: {
    fontSize: 11,
    color: "var(--muted)",
    fontWeight: 400,
  },

  photoPreviewWrap: {
    position: "relative" as const,
    display: "inline-block",
    alignSelf: "center",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  photoPreview: {
    width: 140,
    height: 140,
    objectFit: "cover" as const,
    display: "block",
    borderRadius: "var(--radius-lg)",
  },
  photoRemove: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
  },
  fileHidden: {
    position: "absolute" as const,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },

  submitBtn: {
    width: "100%",
    padding: "16px 16px",
    marginTop: 20,
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
    letterSpacing: "0.01em",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    transform: "scale(1)",
  },
  submitBtnHover: {
    transform: "scale(1.02)",
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    transform: "scale(1)",
  },

  successCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 12,
    padding: "40px 24px",
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
    textAlign: "center" as const,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: "var(--text)",
  },
  successHint: {
    fontSize: 13,
    color: "var(--muted)",
    margin: 0,
    lineHeight: 1.4,
  },
  newBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "12px 20px",
    marginTop: 8,
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "transform 0.15s ease",
  },
  newBtnIcon: { fontSize: 18, lineHeight: 1 },
};
