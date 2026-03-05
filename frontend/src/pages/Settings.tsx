import { useSettings } from "../context/SettingsContext";
import type { Currency } from "../context/SettingsContext";
import { t } from "../i18n";

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const lang = settings.lang;

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {t(lang, "back")}
      </button>
      <h2 style={styles.title}>{t(lang, "settings")}</h2>

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
          {(["BYN", "USD"] as Currency[]).map((c) => (
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
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
  label: {
    fontSize: 12,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 10,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  optBtn: {
    padding: "12px 18px",
    background: "var(--surface)",
    border: "1px solid var(--surface)",
    borderRadius: 10,
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
