import { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { getSiteContent } from "../api";

interface LandingProps {
  onGoToCatalog: () => void;
  onCustomOrder: () => void;
}

export function Landing({ onGoToCatalog, onCustomOrder }: LandingProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [content, setContent] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getSiteContent().then(setContent).catch(() => {});
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const heroTitle = (content.hero_title ?? "").trim() || t(lang, "storeWelcomeTitle");
  const heroSubtitle = (content.hero_subtitle ?? "").trim() || t(lang, "storeWelcomeIntro");
  const heroImageUrl = (content.hero_image_url ?? "").trim();
  const aboutText = (content.about_text ?? "").trim() || t(lang, "profileAboutText");
  const catalogCta = (content.catalog_cta ?? "").trim() || t(lang, "storeWelcomeToCatalog");
  const customOrderCta = (content.custom_order_cta ?? "").trim() || t(lang, "storeWelcomeCustomOrder");

  const fadeStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transition: "opacity 0.7s ease-out",
  };

  return (
    <div className="zen-landing" style={styles.wrap}>
      <section style={styles.heroWrap}>
        {heroImageUrl ? (
          <div style={styles.heroImageWrap}>
            <img src={heroImageUrl} alt="" style={styles.heroImage} />
            <div style={styles.heroOverlay} />
          </div>
        ) : (
          <div style={styles.heroPlaceholder} />
        )}
        <div style={{ ...styles.heroContent, ...fadeStyle }}>
          <h1 style={heroImageUrl ? styles.heroTitle : styles.heroTitleNoImage}>{heroTitle}</h1>
          <p style={heroImageUrl ? styles.heroSubtitle : styles.heroSubtitleNoImage}>{heroSubtitle}</p>
        </div>
      </section>

      <div style={{ ...styles.ctaBlock, ...fadeStyle, transition: "opacity 0.7s ease-out 0.15s" }}>
        <button type="button" onClick={onGoToCatalog} style={styles.ctaPrimary}>
          {catalogCta}
        </button>
        <button type="button" onClick={onCustomOrder} style={styles.ctaSecondary}>
          {customOrderCta}
        </button>
      </div>

      <div style={{ ...styles.aboutBlock, ...fadeStyle, transition: "opacity 0.7s ease-out 0.25s" }}>
        <p style={styles.aboutText}>{aboutText}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100%",
    paddingBottom: 48,
  },
  heroWrap: {
    position: "relative",
    width: "100%",
    minHeight: "50vh",
    maxHeight: 420,
    marginBottom: 32,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroImageWrap: {
    position: "absolute",
    inset: 0,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
  },
  heroPlaceholder: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(145deg, var(--surface-elevated, #2a2a2a) 0%, var(--surface, #1a1a1a) 100%)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    padding: "32px var(--content-padding, 16px) 28px",
    textAlign: "center",
  },
  heroTitle: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: "clamp(22px, 5vw, 32px)",
    fontWeight: 600,
    color: "#fff",
    margin: 0,
    marginBottom: 10,
    letterSpacing: "0.02em",
    textShadow: "0 1px 4px rgba(0,0,0,0.4)",
  },
  heroSubtitle: {
    fontSize: "clamp(14px, 2.5vw, 16px)",
    color: "rgba(255,255,255,0.92)",
    margin: 0,
    maxWidth: 420,
    marginLeft: "auto",
    marginRight: "auto",
    lineHeight: 1.5,
    textShadow: "0 1px 2px rgba(0,0,0,0.3)",
  },
  heroTitleNoImage: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: "clamp(22px, 5vw, 32px)",
    fontWeight: 600,
    color: "var(--text)",
    margin: 0,
    marginBottom: 10,
    letterSpacing: "0.02em",
  },
  heroSubtitleNoImage: {
    fontSize: "clamp(14px, 2.5vw, 16px)",
    color: "var(--muted)",
    margin: 0,
    maxWidth: 420,
    marginLeft: "auto",
    marginRight: "auto",
    lineHeight: 1.5,
  },
  ctaBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "0 var(--content-padding, 16px)",
    maxWidth: 400,
    margin: "0 auto 32px",
  },
  ctaPrimary: {
    width: "100%",
    padding: "16px 24px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.02em",
  },
  ctaSecondary: {
    width: "100%",
    padding: "14px 24px",
    background: "transparent",
    border: "2px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  aboutBlock: {
    padding: "0 var(--content-padding, 16px)",
    maxWidth: 420,
    margin: "0 auto",
    textAlign: "center",
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--muted)",
    margin: 0,
  },
};
