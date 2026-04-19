import { useSettings } from "../context/SettingsContext";
import type { Currency } from "../context/SettingsContext";
import { t } from "../i18n";

const CURRENCY_OPTIONS: Currency[] = ["BYN", "USD"];

interface SettingsProps {
  onBack: () => void;
}

export function Settings(_props: SettingsProps) {
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const lang = settings.lang;

  return (
    <div style={styles.wrap}>
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "settings")}</h2>

      <p style={styles.kicker}>{t(lang, "settingsTheme")}</p>
      <div style={styles.themeRow}>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          style={{ ...styles.themeCard, ...(settings.theme === "dark" ? styles.themeCardActive : {}) }}
        >
          <span style={{ ...styles.themePreview, background: "#0f0e0e" }}>
            <span style={styles.themePreviewAccent} />
            <span style={styles.themePreviewBody} />
          </span>
          <span style={{ ...styles.themeName, ...(settings.theme === "dark" ? styles.themeNameActive : {}) }}>
            {t(lang, "settingsThemeDark")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          style={{ ...styles.themeCard, ...(settings.theme === "light" ? styles.themeCardActive : {}) }}
        >
          <span style={{ ...styles.themePreview, background: "#faf9f7", border: "1px solid var(--border)" }}>
            <span style={styles.themePreviewAccent} />
            <span style={styles.themePreviewBody} />
          </span>
          <span style={{ ...styles.themeName, ...(settings.theme === "light" ? styles.themeNameActive : {}) }}>
            {t(lang, "settingsThemeLight")}
          </span>
        </button>
      </div>

      <p style={styles.kicker}>{t(lang, "settingsLangAndCurrency")}</p>
      <div style={styles.groupCard}>
        <div style={styles.groupRow}>
          <span style={styles.groupLabel}>{t(lang, "language")}</span>
          <div style={styles.chipRow}>
            <button
              type="button"
              onClick={() => setLang("ru")}
              style={{ ...styles.chip, ...(settings.lang === "ru" ? styles.chipActive : {}) }}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              style={{ ...styles.chip, ...(settings.lang === "en" ? styles.chipActive : {}) }}
            >
              EN
            </button>
          </div>
        </div>
        <div style={{ ...styles.groupRow, borderBottom: "none" }}>
          <span style={styles.groupLabel}>{t(lang, "currency")}</span>
          <div style={styles.chipRow}>
            {CURRENCY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                style={{ ...styles.chip, ...(settings.currency === c ? styles.chipActive : {}) }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p style={styles.kicker}>{t(lang, "settingsMore")}</p>
      <div style={styles.groupCard}>
        <div style={{ ...styles.groupRow, borderBottom: "none" }}>
          <span style={styles.groupLabel}>{t(lang, "settingsAboutApp")}</span>
          <span style={styles.muted}>{t(lang, "settingsAppVersion")} ›</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  title: { marginBottom: 20 },
  kicker: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "18px 0 10px",
  },
  themeRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  themeCard: {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    borderRadius: 14,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  themeCardActive: { borderColor: "var(--accent)" },
  themePreview: {
    position: "relative",
    display: "block",
    height: 70,
    borderRadius: 10,
    overflow: "hidden",
  },
  themePreviewAccent: {
    position: "absolute",
    left: 10,
    top: 10,
    width: "30%",
    height: 8,
    borderRadius: 4,
    background: "rgba(165,42,42,0.8)",
  },
  themePreviewBody: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 26,
    bottom: 10,
    borderRadius: 4,
    background: "rgba(128,128,128,0.2)",
  },
  themeName: { fontSize: 12, fontWeight: 700, textAlign: "center", color: "var(--text)" },
  themeNameActive: { color: "var(--accent)" },
  groupCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    overflow: "hidden",
  },
  groupRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
  },
  groupLabel: { color: "var(--text)" },
  chipRow: { display: "flex", gap: 6 },
  chip: {
    padding: "5px 11px",
    borderRadius: 999,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chipActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
  },
  muted: { color: "var(--muted)", fontSize: 12 },
};
