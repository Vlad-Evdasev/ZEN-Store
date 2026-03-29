import { BackButton } from "../components/BackButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface DeliveryTermsProps {
  onBack: () => void;
}

export function DeliveryTerms({ onBack }: DeliveryTermsProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />
      <h2 style={styles.title}>{t(lang, "deliveryTermsTitle")}</h2>
      <div style={styles.content}>
        <p style={styles.p}>{t(lang, "deliveryTermsP1")}</p>
        <p style={styles.p}>{t(lang, "deliveryTermsP2")}</p>
        <p style={styles.p}>{t(lang, "deliveryTermsP3")}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 20,
  },
  content: { display: "flex", flexDirection: "column", gap: 16 },
  p: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text)",
  },
};
