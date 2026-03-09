import { useSettings } from "../context/SettingsContext";
import type { Currency } from "../context/SettingsContext";
import { t } from "../i18n";

const CURRENCY_OPTIONS: Currency[] = ["BYN", "USD"];

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const lang = settings.lang;

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={onBack} className="zen-back-link" style={styles.back}>
        ← {t(lang, "backToCatalog")}
      </button>
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "settings")}</h2>

      <div style={styles.section}>
        <p style={styles.label}>{t(lang, "language")}</p>
        <div style={styles.row}>
          <button
            type="button"
            className="settings-opt-btn"
            onClick={() => setLang("ru")}
            style={{ ...styles.optBtn, ...(settings.lang === "ru" ? styles.optActive : {}) }}
          >
            {t(lang, "ru")}
          </button>
          <button
            type="button"
            className="settings-opt-btn"
            onClick={() => setLang("en")}
            style={{ ...styles.optBtn, ...(settings.lang === "en" ? styles.optActive : {}) }}
          >
            {t(lang, "en")}
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.label}>{t(lang, "theme")}</p>
        <div style={styles.row}>
          <button
            type="button"
            className="settings-opt-btn"
            onClick={() => setTheme("dark")}
            style={{ ...styles.optBtn, ...(settings.theme === "dark" ? styles.optActive : {}) }}
          >
            {t(lang, "dark")}
          </button>
          <button
            type="button"
            className="settings-opt-btn"
            onClick={() => setTheme("light")}
            style={{ ...styles.optBtn, ...(settings.theme === "light" ? styles.optActive : {}) }}
          >
            {t(lang, "light")}
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.label}>{t(lang, "currency")}</p>
        <div style={styles.row}>
          {(CURRENCY_OPTIONS as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              className="settings-opt-btn"
              onClick={() => setCurrency(c)}
              style={{ ...styles.optBtn, ...(settings.currency === c ? styles.optActive : {}) }}
            >
              {c}
            </button>
          ))}
        </div>
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
  title: { marginBottom: 24 },
  section: { marginBottom: 24 },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  optBtn: {
    padding: "12px 20px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
  },
  optActive: {
    background: "var(--accent)",
    border: "1px solid var(--accent)",
    color: "#fff",
  },
};
