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
    transition: "opacity 0.8s ease-out",
  };

  return (
    <div className="zen-landing" style={styles.wrap}>
      {/* Hero: полноэкранный блок как у Ralph Lauren, текст по центру */}
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
          <div style={styles.heroCtaWrap}>
            <button type="button" onClick={onGoToCatalog} style={styles.heroCta}>
              {catalogCta}
            </button>
          </div>
        </div>
      </section>

      {/* Два блока-тайла как Men's / Women's у Ralph Lauren */}
      <div className="landing-tiles" style={{ ...styles.tilesWrap, ...fadeStyle, transition: "opacity 0.8s ease-out 0.2s" }}>
        <button type="button" onClick={onGoToCatalog} className="landing-tile" style={styles.tile}>
          <span style={styles.tileLabel}>{catalogCta}</span>
          <span style={styles.tileSub}>В наличии в Минске</span>
        </button>
        <button type="button" onClick={onCustomOrder} className="landing-tile" style={styles.tile}>
          <span style={styles.tileLabel}>{customOrderCta}</span>
          <span style={styles.tileSub}>Под заказ из Китая</span>
        </button>
      </div>

      {/* Тонкая строка про оригиналы */}
      <div style={{ ...styles.aboutBlock, ...fadeStyle, transition: "opacity 0.8s ease-out 0.35s" }}>
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
    minHeight: "85vh",
    display: "flex",
    alignItems: "center",
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
    background: "rgba(0,0,0,0.25)",
  },
  heroPlaceholder: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(160deg, var(--surface-elevated) 0%, var(--surface) 100%)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    padding: "24px var(--content-padding, 16px)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
    fontWeight: 400,
    color: "#fff",
    margin: 0,
    marginBottom: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    textShadow: "0 2px 20px rgba(0,0,0,0.3)",
  },
  heroSubtitle: {
    fontSize: "clamp(14px, 2.2vw, 16px)",
    color: "rgba(255,255,255,0.95)",
    margin: 0,
    marginBottom: 28,
    maxWidth: 420,
    lineHeight: 1.6,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textShadow: "0 1px 8px rgba(0,0,0,0.25)",
  },
  heroCtaWrap: {
    marginTop: 8,
  },
  heroCta: {
    padding: "14px 32px",
    background: "transparent",
    border: "2px solid rgba(255,255,255,0.9)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  heroTitleNoImage: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
    fontWeight: 400,
    color: "var(--text)",
    margin: 0,
    marginBottom: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  heroSubtitleNoImage: {
    fontSize: "clamp(14px, 2.2vw, 16px)",
    color: "var(--muted)",
    margin: 0,
    marginBottom: 28,
    maxWidth: 420,
    lineHeight: 1.6,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  tilesWrap: {
    maxWidth: 900,
    margin: "0 auto 40px",
    padding: "0 var(--content-padding, 16px)",
  },
  tile: {
    minHeight: 220,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "var(--surface-elevated)",
    border: "none",
    cursor: "pointer",
    padding: 24,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "0.06em",
  },
  tileSub: {
    fontSize: 12,
    color: "var(--muted)",
    letterSpacing: "0.04em",
  },
  aboutBlock: {
    padding: "0 var(--content-padding, 16px)",
    maxWidth: 560,
    margin: "0 auto",
    textAlign: "center",
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 1.7,
    color: "var(--muted)",
    margin: 0,
    letterSpacing: "0.02em",
  },
};
