import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { getSupportEntries, type SupportEntry } from "../api";

export function Support() {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [entries, setEntries] = useState<SupportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupportEntries()
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="zen-support" style={styles.wrap}>
      <header style={styles.header}>
        <h2 className="zen-page-title" style={styles.title}>
          {t(lang, "support")}
        </h2>
      </header>

      <div style={styles.thread}>
        {loading && entries.length === 0 ? (
          <p style={styles.loading}>{t(lang, "loading")}</p>
        ) : entries.length === 0 ? (
          <p style={styles.loading}>—</p>
        ) : (
          entries.map((e) => (
            <SupportPair key={e.id} question={e.question} answer={e.answer} />
          ))
        )}
      </div>
    </div>
  );
}

function SupportPair({ question, answer }: { question: string; answer: string }) {
  const paragraphs = answer.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      <QuestionBubble text={question} />
      <AnswerBubble>
        {paragraphs.map((p, idx) => (
          <p
            key={idx}
            style={{
              ...styles.p,
              marginBottom: idx === paragraphs.length - 1 ? 0 : 10,
            }}
          >
            {renderInlineMarkdown(p)}
          </p>
        ))}
      </AnswerBubble>
    </>
  );
}

/* Простой парсер inline-разметки: только [текст](url) → ссылка.
   Всё остальное оставляем как есть.                                  */
function renderInlineMarkdown(text: string): ReactNode {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|@[A-Za-z0-9_]+|tg:\/\/[^\s)]+)\)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const label = m[1];
    const target = m[2];
    const href = target.startsWith("@")
      ? `https://t.me/${target.slice(1)}`
      : target;
    out.push(
      <a
        key={`l-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.contactLink}
      >
        {label}
        <IconExternal />
      </a>
    );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
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

  loading: {
    color: "var(--muted)",
    fontSize: 13,
    textAlign: "center",
    padding: "32px 0",
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
