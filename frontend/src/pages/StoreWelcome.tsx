import { useState, useEffect } from "react";
import { BackButton } from "../components/BackButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface StoreWelcomeProps {
  store: { id: number; name: string } | { category: string; name: string };
  categoryLabels?: Record<string, string>;
  showBack?: boolean;
  onBack: () => void;
  onGoToCatalog: () => void;
  onCustomOrder: () => void;
}

export function StoreWelcome({ store: _store, categoryLabels: _categoryLabels, showBack = true, onBack, onGoToCatalog, onCustomOrder }: StoreWelcomeProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const fadeStyle = {
    opacity: visible ? 1 : 0,
    transition: "opacity 0.6s ease-out",
  };

  return (
    <div style={{ ...styles.wrap, ...(showBack ? {} : styles.wrapNoHeader) }}>
      {showBack && (
        <BackButton onClick={onBack} label={t(lang, "back")} />
      )}
      <h1
        style={{
          ...styles.title,
          ...fadeStyle,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
        }}
      >
        {t(lang, "storeWelcomeTitle")}
      </h1>
      <div style={{ ...styles.textBlock, ...fadeStyle, transition: "opacity 0.6s ease-out 0.1s" }}>
        <p style={styles.paragraph}>{t(lang, "storeWelcomeIntro")}</p>
        <p style={styles.paragraph}>{t(lang, "storeWelcomeCatalog")}</p>
        <p style={styles.paragraph}>{t(lang, "storeWelcomeCustom")}</p>
      </div>
      <div style={{ ...styles.buttons, ...fadeStyle, transition: "opacity 0.6s ease-out 0.2s" }}>
        <button type="button" onClick={onGoToCatalog} style={styles.btn}>
          {t(lang, "storeWelcomeToCatalog")}
        </button>
        <button type="button" onClick={onCustomOrder} style={styles.btn}>
          {t(lang, "storeWelcomeCustomOrder")}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  wrapNoHeader: { paddingTop: 48 },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 24,
    textAlign: "center",
  },
  textBlock: {
    marginBottom: 32,
    maxWidth: 360,
    marginLeft: "auto",
    marginRight: "auto",
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 1.65,
    color: "var(--text)",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: "0.01em",
  },
  buttons: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  btn: {
    flex: "1 1 0",
    minWidth: 140,
    padding: "14px 20px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
};
