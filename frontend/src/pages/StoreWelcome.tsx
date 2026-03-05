import { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { getCategoryLabel } from "../utils/categories";

interface StoreWelcomeProps {
  store: { id: number; name: string } | { category: string; name: string };
  onBack: () => void;
  onGoToCatalog: () => void;
  onCustomOrder: () => void;
}

export function StoreWelcome({ store, onBack, onGoToCatalog, onCustomOrder }: StoreWelcomeProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [visible, setVisible] = useState(false);
  const storeName = "name" in store ? store.name : getCategoryLabel((store as { category: string }).category);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {t(lang, "back")}
      </button>
      <h1
        style={{
          ...styles.title,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
        }}
      >
        {t(lang, "storeWelcomeTitle")}
      </h1>
      <p
        style={{
          ...styles.subtitle,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.6s ease-out 0.15s",
        }}
      >
        {storeName}
      </p>
      <div style={styles.buttons}>
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
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 32,
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "var(--muted)",
    textAlign: "center",
    marginBottom: 40,
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
