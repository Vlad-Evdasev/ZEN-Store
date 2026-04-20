import type { ReactNode } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

const ADMIN_TG_HANDLE = "@krot_eno";
const ADMIN_TG_URL = "https://t.me/krot_eno";

export function Support() {
  const { settings } = useSettings();
  const lang = settings.lang;

  return (
    <div className="zen-support" style={styles.wrap}>
      <header style={styles.header}>
        <h2 className="zen-page-title" style={styles.title}>
          {t(lang, "support")}
        </h2>
      </header>

      <div style={styles.thread}>
        <QuestionBubble text={t(lang, "deliveryTermsTitle")} />
        <AnswerBubble>
          <p style={styles.p}>{t(lang, "deliveryTermsP1")}</p>
          <p style={{ ...styles.p, marginBottom: 0 }}>
            {t(lang, "deliveryTermsP2")}
          </p>
        </AnswerBubble>

        <QuestionBubble text={t(lang, "supportContactsTitle")} />
        <AnswerBubble>
          <p style={{ ...styles.p, marginBottom: 0 }}>
            {t(lang, "supportContactAdmin")}{" "}
            <a
              href={ADMIN_TG_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.contactLink}
            >
              {ADMIN_TG_HANDLE}
              <IconExternal />
            </a>
          </p>
        </AnswerBubble>
      </div>
    </div>
  );
}

function QuestionBubble({ text }: { text: string }) {
  return (
    <div style={styles.questionRow}>
      <div style={styles.questionBubble}>{text}</div>
    </div>
  );
}

function AnswerBubble({ children }: { children: ReactNode }) {
  return (
    <div style={styles.answerRow}>
      <div style={styles.avatar}>R</div>
      <div style={styles.answerBubble}>{children}</div>
    </div>
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
      style={{ flexShrink: 0, color: "currentColor" }}
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

  thread: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  questionRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  questionBubble: {
    background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
    color: "var(--text)",
    border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--border))",
    borderRadius: "16px 16px 4px 16px",
    padding: "10px 14px",
    maxWidth: "86%",
    fontSize: 14.5,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },

  answerRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    flexShrink: 0,
  },
  answerBubble: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "12px 14px",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },

  p: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "var(--text)",
    margin: "0 0 10px",
  },

  contactLink: {
    color: "var(--accent)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  },
};
