import { useState, useEffect, useId, useRef, type ReactNode } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const ADMIN_TG_HANDLE = "@krot_eno";
const ADMIN_TG_URL = "https://t.me/krot_eno";

export function Support() {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  return (
    <div className="zen-support" style={styles.wrap}>
      <header style={styles.header}>
        <h2 className="zen-page-title" style={styles.title}>
          {t(lang, "support")}
        </h2>
      </header>

      <AccordionCard
        icon={<IconClipboard />}
        title={t(lang, "deliveryTermsTitle")}
        open={deliveryOpen}
        onToggle={() => setDeliveryOpen((v) => !v)}
      >
        <p style={styles.p}>{t(lang, "deliveryTermsP1")}</p>
        <p style={styles.p}>{t(lang, "deliveryTermsP2")}</p>
        <p style={{ ...styles.p, marginBottom: 0 }}>{t(lang, "deliveryTermsP3")}</p>
      </AccordionCard>

      <AccordionCard
        icon={<IconContacts />}
        title={t(lang, "supportContactsTitle")}
        open={contactsOpen}
        onToggle={() => setContactsOpen((v) => !v)}
      >
        <a
          href={ADMIN_TG_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.contactRow}
        >
          <span style={styles.contactRole}>
            {t(lang, "supportContactAdmin")}
          </span>
          <span style={styles.contactHandle}>{ADMIN_TG_HANDLE}</span>
          <IconExternal />
        </a>
      </AccordionCard>
    </div>
  );
}

interface AccordionCardProps {
  icon: ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function AccordionCard({
  icon,
  title,
  open,
  onToggle,
  children,
}: AccordionCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | "none">(0);
  const bodyId = useId();

  // Two-phase animation so we can animate `max-height` without hardcoding a limit:
  // expand: 0 → scrollHeight px → "none" (so inner scrollables work)
  // collapse: "none" → scrollHeight px (next frame) → 0
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (open) {
      setMaxH(el.scrollHeight);
      const id = window.setTimeout(() => setMaxH("none"), 320);
      return () => window.clearTimeout(id);
    } else {
      if (maxH === "none") {
        setMaxH(el.scrollHeight);
        requestAnimationFrame(() => requestAnimationFrame(() => setMaxH(0)));
      } else {
        setMaxH(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div style={styles.card}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        style={styles.cardHeader}
      >
        <span style={styles.cardIcon}>{icon}</span>
        <span style={styles.cardTitle}>{title}</span>
        <span
          style={{
            ...styles.cardChevron,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div
        id={bodyId}
        ref={contentRef}
        role="region"
        style={{
          ...styles.cardBody,
          maxHeight: maxH === "none" ? "none" : `${maxH}px`,
          overflow: maxH === "none" ? "visible" : "hidden",
        }}
      >
        <div style={styles.cardBodyInner}>{children}</div>
      </div>
    </div>
  );
}

function IconClipboard() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="7" y="4" width="10" height="4" rx="1" />
      <path d="M7 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function IconContacts() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h16v16H4z" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 18a5 5 0 0 1 10 0" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, color: "var(--muted)" }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },

  header: { marginBottom: 16 },
  title: { margin: 0 },

  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: 16,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    color: "var(--text)",
  },
  cardIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "color-mix(in srgb, var(--accent) 8%, transparent)",
    color: "var(--accent)",
    flexShrink: 0,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: 600,
  },
  cardChevron: {
    color: "var(--muted)",
    display: "inline-flex",
    transition: "transform 300ms ease",
  },
  cardBody: {
    transition: "max-height 300ms ease",
  },
  cardBodyInner: {
    padding: "0 16px 16px",
  },

  p: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text)",
    margin: "0 0 12px",
  },

  contactRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--text)",
    textDecoration: "none",
    fontSize: 14,
  },
  contactRole: {
    fontWeight: 600,
    color: "var(--text)",
  },
  contactHandle: {
    flex: 1,
    color: "var(--accent)",
    fontWeight: 500,
    letterSpacing: "0.01em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
