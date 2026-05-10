import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { Currency } from "../context/SettingsContext";
import { t } from "../i18n";
import { getLoyaltyBalance, type LoyaltyBalance } from "../api";

const CURRENCY_OPTIONS: Currency[] = ["BYN", "USD"];

interface SettingsProps {
  onBack: () => void;
  userId?: string;
}

export function Settings({ userId }: SettingsProps) {
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const lang = settings.lang;
  const [loyalty, setLoyalty] = useState<LoyaltyBalance | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getLoyaltyBalance(userId).then(setLoyalty).catch(() => setLoyalty(null));
  }, [userId]);

  const botUsername = (import.meta.env.VITE_BOT_USERNAME as string | undefined) || "RAW_brand_bot";
  const referralLink = userId ? `https://t.me/${botUsername}?start=ref_${userId}` : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div style={styles.wrap}>
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "settings")}</h2>

      {userId && (
        <>
          <p style={styles.kicker}>{lang === "ru" ? "Бонусы" : "Points"}</p>
          <div style={styles.pointsCard}>
            <div style={styles.pointsValueWrap}>
              <span style={styles.pointsValue}>{loyalty?.balance ?? 0}</span>
              <span style={styles.pointsCurrency}>= {loyalty?.balance ?? 0} $</span>
            </div>
            <p style={styles.pointsHint}>
              {lang === "ru"
                ? "1 балл = 1 $ скидки. Применяется при оформлении."
                : "1 point = 1 $ off. Apply at checkout."}
            </p>
            {loyalty && (loyalty.lifetime_earned > 0 || loyalty.lifetime_spent > 0) && (
              <div style={styles.pointsMeta}>
                <span>{lang === "ru" ? "Заработано: " : "Earned: "}<strong>{loyalty.lifetime_earned}</strong></span>
                <span>{lang === "ru" ? "Потрачено: " : "Spent: "}<strong>{loyalty.lifetime_spent}</strong></span>
              </div>
            )}
          </div>

          <p style={styles.kicker}>{lang === "ru" ? "Пригласи друга" : "Invite a friend"}</p>
          <div style={styles.refCard}>
            <p style={styles.refDescription}>
              {lang === "ru"
                ? "Поделись ссылкой. Когда друг оформит первый заказ — оба получите по 10 баллов."
                : "Share your link. When a friend places their first order — you both get 10 points."}
            </p>
            <div style={styles.refLinkRow}>
              <span style={styles.refLink}>{referralLink}</span>
              <button type="button" onClick={handleCopy} style={styles.refCopyBtn}>
                {copied
                  ? (lang === "ru" ? "Скопировано" : "Copied")
                  : (lang === "ru" ? "Копировать" : "Copy")}
              </button>
            </div>
          </div>
        </>
      )}

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
  pointsCard: {
    background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
    border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border))",
    borderRadius: 16,
    padding: "16px 18px",
    marginBottom: 4,
  },
  pointsValueWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: "-0.024em",
    fontVariantNumeric: "tabular-nums",
    color: "var(--text)",
  },
  pointsCurrency: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--accent)",
    fontVariantNumeric: "tabular-nums",
  },
  pointsHint: {
    margin: "6px 0 0",
    fontSize: 12.5,
    color: "var(--muted)",
    lineHeight: 1.45,
  },
  pointsMeta: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px dashed color-mix(in srgb, var(--accent) 22%, var(--border))",
    display: "flex",
    gap: 16,
    fontSize: 12,
    color: "var(--muted)",
    fontVariantNumeric: "tabular-nums",
  },
  refCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "14px 16px 12px",
  },
  refDescription: {
    margin: 0,
    fontSize: 13,
    color: "var(--muted)",
    lineHeight: 1.5,
    marginBottom: 12,
  },
  refLinkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "8px 8px 8px 12px",
  },
  refLink: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  refCopyBtn: {
    height: 32,
    padding: "0 14px",
    background: "var(--text)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
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
