import { BackButton } from "../components/BackButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface ProfileProps {
  userName: string | null;
  firstName: string;
  onBack: () => void;
  onOpenDeliveryTerms?: () => void;
  onOpenSupport?: () => void;
  supportUnreadCount?: number;
}

export function Profile({ userName, firstName, onBack, onOpenDeliveryTerms, onOpenSupport, supportUnreadCount = 0 }: ProfileProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "backToCatalog")} />

      <div style={styles.avatar}>{firstName[0]?.toUpperCase() || "?"}</div>
      <h2 style={styles.name}>{firstName}</h2>
      {userName && <p style={styles.username}>{userName}</p>}

      <div style={styles.sections}>
        <div style={styles.section}>
          <p style={styles.sectionTitle}>{t(lang, "profileQuickActions")}</p>
          <div style={styles.actions}>
            {onOpenDeliveryTerms && (
              <button onClick={onOpenDeliveryTerms} style={styles.actionBtn}>
                <span style={styles.actionBtnIcon}>📋</span>
                {t(lang, "profileDeliveryTerms")}
              </button>
            )}
            {onOpenSupport && (
              <button onClick={onOpenSupport} style={{ ...styles.actionBtn, position: "relative" }}>
                <span style={styles.actionBtnIcon}>💬</span>
                {t(lang, "profileSupport")}
                {supportUnreadCount > 0 && (
                  <span style={styles.supportBadge} aria-label="Непрочитанные">{supportUnreadCount > 99 ? "99+" : supportUnreadCount}</span>
                )}
              </button>
            )}
          </div>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionTitle}>{t(lang, "profileAboutTitle")}</p>
          <p style={styles.text}>{t(lang, "profileAboutText")}</p>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionTitle}>{t(lang, "profileSupport")}</p>
          <p style={styles.text}>{t(lang, "profileSupportText")}</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  name: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 22,
    fontWeight: 400,
    marginBottom: 4,
    letterSpacing: "0.02em",
  },
  username: {
    color: "var(--muted)",
    fontSize: 14,
    marginBottom: 32,
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  section: {
    padding: 20,
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  supportBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 14,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  actionBtnIcon: {
    opacity: 0.6,
    fontSize: 16,
  },
  text: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text)",
  },
};
