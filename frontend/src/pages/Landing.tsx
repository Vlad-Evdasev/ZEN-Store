import { useState, useEffect, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { getSiteContent } from "../api";

const DEFAULT_HERO_IMG = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200";
const DEFAULT_CATALOG_IMG = "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800";
const DEFAULT_CUSTOM_IMG = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800";
const DEFAULT_ARRIVED_IMG = "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800";

interface LandingProps {
  onGoToCatalog: () => void;
  onCustomOrder: () => void;
  onGoToArrived: () => void;
}

export function Landing({ onGoToCatalog, onCustomOrder, onGoToArrived }: LandingProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [content, setContent] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const tilesRef = useRef<HTMLDivElement>(null);

  const scrollToTiles = () => {
    tilesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    getSiteContent().then(setContent).catch(() => {});
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const heroTitle = (content.hero_title ?? "").trim() || "RAW";
  const heroSubtitle = (content.hero_subtitle ?? "").trim() || "Оригинальная одежда из брендовых магазинов";
  const heroImageUrl = (content.hero_image_url ?? "").trim() || DEFAULT_HERO_IMG;
  const aboutText = (content.about_text ?? "").trim() || t(lang, "profileAboutText");
  const catalogCta = (content.catalog_cta ?? "").trim() || t(lang, "storeWelcomeToCatalog");
  const customOrderCta = (content.custom_order_cta ?? "").trim() || t(lang, "storeWelcomeCustomOrder");
  const arrivedTitle = (content.arrived_title ?? "").trim() || "Уже привезли";
  const arrivedSubtitle = (content.arrived_subtitle ?? "").trim() || "Вещи в наличии после заказов клиентов";
  const catalogImageUrl = (content.catalog_image_url ?? "").trim() || DEFAULT_CATALOG_IMG;
  const customOrderImageUrl = (content.custom_order_image_url ?? "").trim() || DEFAULT_CUSTOM_IMG;
  const arrivedImageUrl = (content.arrived_image_url ?? "").trim() || DEFAULT_ARRIVED_IMG;

  const fadeStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transition: "opacity 0.8s ease-out",
  };

  return (
    <div className="zen-landing" style={styles.wrap}>
      {/* Hero: как у Ralph Lauren — полноэкранное фото, текст по центру */}
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
          <button
            type="button"
            onClick={scrollToTiles}
            className="landing-hero-scroll"
            style={{ ...styles.heroScrollBtn, ...(heroImageUrl ? {} : styles.heroScrollBtnNoImage) }}
            aria-label="К карточкам ниже"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.heroScrollIcon} aria-hidden>
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Два блока рядом: Каталог и Заказать не из каталога */}
      <div ref={tilesRef} className="landing-tiles landing-tiles-two" style={{ ...styles.tilesWrap, ...styles.sectionGap, ...fadeStyle, transition: "opacity 0.8s ease-out 0.2s" }}>
        <button type="button" onClick={onGoToCatalog} className="landing-tile" style={tileStyle(catalogImageUrl)}>
          <span className="landing-tile-overlay" />
          <span style={styles.tileInner}>
            <span style={styles.tileLabel}>{catalogCta}</span>
            <span style={styles.tileSub}>В наличии в Минске</span>
            <span style={styles.tileLink}>Смотреть</span>
          </span>
        </button>
        <button type="button" onClick={onCustomOrder} className="landing-tile" style={tileStyle(customOrderImageUrl)}>
          <span className="landing-tile-overlay" />
          <span style={styles.tileInner}>
            <span style={styles.tileLabel}>{customOrderCta}</span>
            <span style={styles.tileSub}>Под заказ из Китая</span>
            <span style={styles.tileLink}>Смотреть</span>
          </span>
        </button>
      </div>

      {/* Один блок на всю ширину: Уже привезли */}
      <div className="landing-tiles landing-tile-full-wrap" style={{ ...styles.tilesWrap, ...styles.sectionGap, ...fadeStyle, transition: "opacity 0.8s ease-out 0.25s" }}>
        <button type="button" onClick={onGoToArrived} className="landing-tile landing-tile-full" style={tileStyle(arrivedImageUrl)}>
          <span className="landing-tile-overlay" />
          <span style={styles.tileInner}>
            <span style={styles.tileLabel}>{arrivedTitle}</span>
            <span style={styles.tileSub}>{arrivedSubtitle}</span>
            <span style={styles.tileLink}>Смотреть</span>
          </span>
        </button>
      </div>

      <div style={{ ...styles.aboutBlock, ...fadeStyle, transition: "opacity 0.8s ease-out 0.35s" }}>
        <p style={styles.aboutText}>{aboutText}</p>
      </div>
    </div>
  );
}

function tileStyle(backgroundImageUrl: string): React.CSSProperties {
  return {
    position: "relative",
    minHeight: 320,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "pointer",
    padding: 24,
    overflow: "hidden",
    background: "var(--surface-elevated)",
    backgroundImage: `url(${backgroundImageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100%",
    paddingBottom: 48,
  },
  heroWrap: {
    position: "relative",
    width: "100%",
    marginTop: 0,
    marginBottom: 12,
    minHeight: "calc(100vh - 28px)",
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
    background: "rgba(0,0,0,0.28)",
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
    textShadow: "0 2px 24px rgba(0,0,0,0.4)",
  },
  heroSubtitle: {
    fontSize: "clamp(14px, 2.2vw, 16px)",
    color: "rgba(255,255,255,0.95)",
    margin: 0,
    marginBottom: 28,
    maxWidth: 440,
    lineHeight: 1.6,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textShadow: "0 1px 12px rgba(0,0,0,0.35)",
  },
  heroCtaWrap: { marginTop: 8 },
  heroCta: {
    padding: "14px 36px",
    background: "transparent",
    border: "2px solid rgba(255,255,255,0.95)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  heroScrollBtn: {
    marginTop: 24,
    padding: 12,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.6)",
    borderRadius: "50%",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroScrollIcon: {
    display: "block",
  },
  heroScrollBtnNoImage: {
    borderColor: "var(--border)",
    color: "var(--text)",
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
    maxWidth: 440,
    lineHeight: 1.6,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  sectionGap: { marginTop: 16 },
  tilesWrap: {
    margin: "0 auto",
    padding: "0 var(--content-padding, 16px)",
    maxWidth: 1200,
  },
  tileInner: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    textAlign: "center",
  },
  tileLabel: {
    fontSize: "clamp(15px, 2vw, 18px)",
    fontWeight: 600,
    color: "#fff",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    textShadow: "0 2px 16px rgba(0,0,0,0.5)",
  },
  tileSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: "0.06em",
    textShadow: "0 1px 8px rgba(0,0,0,0.4)",
  },
  tileLink: {
    fontSize: 11,
    fontWeight: 600,
    color: "#fff",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    marginTop: 4,
    textDecoration: "underline",
    textUnderlineOffset: 4,
    textShadow: "0 1px 6px rgba(0,0,0,0.4)",
  },
  aboutBlock: {
    padding: "32px var(--content-padding, 16px) 48px",
    maxWidth: 600,
    margin: "0 auto",
    textAlign: "center",
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 1.75,
    color: "var(--muted)",
    margin: 0,
    letterSpacing: "0.02em",
  },
};
