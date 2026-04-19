import { useState, useRef, useEffect } from "react";
import { submitCustomOrder } from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

function SendArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

const SELLER_TG_URL = "https://t.me/krot_eno";
const SELLER_HANDLE = "@krot_eno";

function CheckCircleIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

interface CustomOrderPageProps {
  userId: string;
  userName: string | null;
  firstName: string;
  onBack?: () => void;
}

export function CustomOrderPage({ userId, userName, firstName }: CustomOrderPageProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const customName = firstName || "";
  const [customDesc, setCustomDesc] = useState("");
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [customDesc]);

  const canSend = customDesc.trim().length > 0 && !customSubmitting;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSend) return;
    setCustomSubmitting(true);
    try {
      await submitCustomOrder(userId, {
        user_name: customName.trim() || undefined,
        user_username: userName ?? undefined,
        description: customDesc.trim(),
        size: "",
        image_data: customPhoto || undefined,
      });
      setCustomSuccess(true);
      setCustomDesc("");
      setCustomPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
    } finally {
      setCustomSubmitting(false);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setCustomPhoto((reader.result as string) || null);
    reader.readAsDataURL(file);
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (customSuccess) {
    return (
      <div style={styles.wrap}>
        <div style={styles.threadCentered}>
          <BotBubble>
            <div style={styles.successInner}>
              <CheckCircleIcon />
              <h3 style={styles.successTitle}>{t(lang, "customOrderSuccess")}</h3>
              <p style={styles.successHint}>{t(lang, "customOrderSubtitle")}</p>
              <button
                type="button"
                onClick={() => setCustomSuccess(false)}
                style={styles.newBtn}
              >
                <span style={styles.newBtnIcon} aria-hidden>↻</span>
                {t(lang, "customOrderNew")}
              </button>
            </div>
          </BotBubble>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Chat thread */}
        <div style={styles.thread}>
          <BotBubble>
            <div style={styles.botBubbleTitle}>{t(lang, "customOrderSubtitle")}</div>
            <div style={styles.botBubbleSubtitle}>{t(lang, "customOrderSubtitleHint")}</div>
          </BotBubble>

          {/* Photo preview bubble (if attached) */}
          {customPhoto && (
            <div style={styles.userBubbleRow}>
              <div style={styles.photoBubble}>
                <img src={customPhoto} alt="" style={styles.photoBubbleImg} />
                <button
                  type="button"
                  onClick={() => setCustomPhoto(null)}
                  style={styles.photoBubbleRemove}
                  aria-label={t(lang, "close")}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.spacer} />

        {/* Composer */}
        <div style={styles.composerWrap}>
          <div style={styles.composer}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              style={styles.fileHidden}
              aria-hidden
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={styles.composerIconBtn}
              aria-label={t(lang, "customOrderPhotoAdd")}
            >
              <PaperclipIcon />
            </button>

            <textarea
              ref={textareaRef}
              className="zen-textarea"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t(lang, "customOrderPlaceholderDesc")}
              rows={1}
              style={styles.composerTextarea}
              required
            />

            <button
              type="submit"
              disabled={!canSend}
              style={{
                ...styles.composerSendBtn,
                ...(canSend ? {} : styles.composerSendBtnDisabled),
              }}
              aria-label={t(lang, "customOrderSubmit")}
            >
              <SendArrowIcon />
            </button>
          </div>

          <div style={styles.replyHintRow}>
            {t(lang, "customOrderReplyFrom")}{" "}
            <a
              href={SELLER_TG_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.replyHintLink}
            >
              {SELLER_HANDLE}
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.botBubbleRow}>
      <div style={styles.botAvatar}>R</div>
      <div style={styles.botBubble}>{children}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    top: 62,
    bottom: 64,
    left: 0,
    right: 0,
    maxWidth: 460,
    width: "100%",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "16px max(16px, env(safe-area-inset-left)) 0 max(16px, env(safe-area-inset-right))",
    background: "var(--bg)",
    zIndex: 5,
  },
  headerBlock: {
    padding: "0 4px 6px",
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
    minHeight: 0,
  },
  threadCentered: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
    color: "var(--text)",
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  subtitle: {
    fontSize: 12,
    color: "var(--muted)",
    margin: "4px 0 0",
    lineHeight: 1.4,
  },

  form: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 0,
  },
  thread: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "8px 0 2px",
    flexShrink: 0,
  },
  replyHint: {
    fontSize: 11,
    color: "var(--muted)",
    paddingLeft: 36,
    letterSpacing: "0.04em",
  },

  /* Bot bubble */
  botBubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  botAvatar: {
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
    marginBottom: 0,
  },
  botBubble: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 13px",
    fontSize: 13.5,
    lineHeight: 1.45,
    color: "var(--text)",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  botBubbleTitle: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  botBubbleSubtitle: {
    fontSize: 12.5,
    color: "var(--muted)",
    marginTop: 4,
    lineHeight: 1.4,
  },
  /* Author row */
  authorRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 0 0 36px",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  authorTextCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  authorNameInput: {
    minHeight: 32,
    padding: "4px 10px",
    fontSize: 13,
    fontWeight: 600,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "var(--radius-md)",
  },
  authorUsername: {
    fontSize: 11,
    color: "var(--muted)",
    paddingLeft: 10,
    letterSpacing: "0.02em",
  },

  /* User-side attachments */
  userBubbleRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  photoBubble: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid var(--border)",
    maxWidth: "70%",
  },
  photoBubbleImg: {
    display: "block",
    width: "100%",
    maxHeight: 220,
    objectFit: "cover",
  },
  photoBubbleRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
  },

  /* Composer */
  composerWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 6,
    paddingBottom: 10,
    flexShrink: 0,
  },
  composer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 2,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 22,
    padding: "4px 6px 4px 4px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
  },
  composerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
  },
  composerTextarea: {
    flex: 1,
    minHeight: 36,
    maxHeight: 180,
    padding: "8px 4px",
    fontSize: 14,
    lineHeight: 1.45,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 0,
    resize: "none",
    outline: "none",
  },
  composerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s, transform 0.15s",
  },
  composerSendBtnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  replyHintRow: {
    paddingLeft: 14,
    paddingRight: 14,
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.4,
    letterSpacing: "0.01em",
  },
  replyHintLink: {
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
  },

  fileHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },

  /* Success */
  successInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "6px 4px",
    textAlign: "center",
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "var(--text)",
  },
  successHint: {
    fontSize: 13,
    color: "var(--muted)",
    margin: 0,
    lineHeight: 1.4,
  },
  newBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    marginTop: 6,
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  newBtnIcon: { fontSize: 16, lineHeight: 1 },
};
