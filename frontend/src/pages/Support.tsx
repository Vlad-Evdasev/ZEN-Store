import { useState, useEffect, useCallback, useId, useRef, type ReactNode } from "react";
import {
  getSupportChats,
  createSupportChat,
  getSupportMessages,
  markSupportChatRead,
  sendSupportMessage,
  type SupportMessage,
} from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface SupportProps {
  userId: string;
  userName: string | null;
  firstName: string;
  supportUnreadCount: number;
  onUnreadCountChange?: () => void;
}

export function Support({
  userId,
  userName,
  firstName,
  supportUnreadCount,
  onUnreadCountChange,
}: SupportProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(supportUnreadCount > 0);

  const [chatId, setChatId] = useState<number | null>(null);
  const resolvingRef = useRef(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const INPUT_MIN_HEIGHT = 40;
  const INPUT_MAX_HEIGHT = 120;

  // Resolve the user's active support chat — the most recent one,
  // or create a new one if none exists. Runs only when the chat accordion
  // actually opens, so we don't create empty chats on every page visit.
  // Uses a ref (not state) for the in-flight guard so the callback keeps
  // a stable identity and doesn't retrigger the gating effect below.
  const resolveChatId = useCallback(() => {
    if (!userId || resolvingRef.current) return;
    resolvingRef.current = true;
    getSupportChats(userId)
      .then((chats) => {
        if (chats.length === 0) {
          return createSupportChat(userId, {
            user_name: firstName,
            user_username: userName ?? undefined,
          }).then((c) => c.id);
        }
        const ts = (s: string) => {
          const n = new Date(s).getTime();
          return Number.isFinite(n) ? n : 0;
        };
        const sorted = [...chats].sort((a, b) => ts(b.created_at) - ts(a.created_at));
        return sorted[0].id;
      })
      .then((id) => { if (id != null) setChatId(id); })
      .catch(console.error)
      .finally(() => { resolvingRef.current = false; });
  }, [userId, firstName, userName]);

  useEffect(() => {
    if (chatOpen && chatId == null) {
      resolveChatId();
    }
  }, [chatOpen, chatId, resolveChatId]);

  const loadMessages = useCallback((isPolling?: boolean) => {
    if (chatId == null) return;
    if (!isPolling) setMessagesLoading(true);
    getSupportMessages(chatId, userId)
      .then((fetched) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id < 0)) return prev;
          return fetched;
        });
        markSupportChatRead(chatId, userId)
          .then(() => onUnreadCountChange?.())
          .catch(() => {});
      })
      .catch(console.error)
      .finally(() => { if (!isPolling) setMessagesLoading(false); });
  }, [chatId, userId, onUnreadCountChange]);

  useEffect(() => {
    if (chatId == null || !chatOpen) return;
    loadMessages();
    const t = setInterval(() => loadMessages(true), 5000);
    return () => clearInterval(t);
  }, [chatId, chatOpen, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages.length, messages[messages.length - 1]?.id]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const contentH = el.scrollHeight;
    el.style.height = Math.max(INPUT_MIN_HEIGHT, Math.min(contentH, INPUT_MAX_HEIGHT)) + "px";
  }, [input]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && !photoDataUrl) || chatId == null || sending) return;
    setSending(true);
    const imageToSend = photoDataUrl;
    const payload = { text: text || undefined, image_url: imageToSend || undefined };
    setInput("");
    setPhotoDataUrl(null);
    const tempId = -Date.now();
    const optimistic: SupportMessage = {
      id: tempId,
      chat_id: chatId,
      sender_type: "user",
      text: text || "",
      image_url: imageToSend || null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    sendSupportMessage(chatId, userId, payload)
      .then((msg) => {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      })
      .catch(() => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      })
      .finally(() => setSending(false));
  };

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  return (
    <div className="zen-support" style={styles.wrap}>
      <section style={styles.hero}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={styles.heroIcon}
          aria-hidden
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <h1 style={styles.title}>{t(lang, "support")}</h1>
        <p style={styles.subtitle}>{t(lang, "supportHeroSubtitle")}</p>
      </section>

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
        icon={<IconBubble />}
        title={t(lang, "supportChatSection")}
        open={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        badge={supportUnreadCount}
        badgeLabel={t(lang, "unread")}
      >
        {chatId == null ? (
          <p style={styles.emptyState}>{t(lang, "loading")}...</p>
        ) : (
          <>
            <div ref={threadRef} style={styles.thread}>
              {messagesLoading && messages.length === 0 ? (
                <p style={styles.emptyState}>{t(lang, "loading")}...</p>
              ) : messages.length === 0 ? (
                <p style={styles.emptyState}>{t(lang, "supportStartConversation")}</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={styles.bubbleWrap}>
                    <div
                      style={{
                        ...styles.bubble,
                        ...(m.sender_type === "admin" ? styles.bubbleAdmin : styles.bubbleUser),
                      }}
                    >
                      {m.image_url && (
                        <button
                          type="button"
                          onClick={() => setExpandedImageUrl(m.image_url)}
                          aria-label={t(lang, "supportViewImage")}
                          style={styles.bubbleImgBtn}
                        >
                          <img src={m.image_url} alt="" style={styles.bubbleImg} />
                        </button>
                      )}
                      {m.text ? <span style={styles.bubbleText}>{m.text}</span> : null}
                      <span style={styles.bubbleTime}>{formatDate(m.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {photoDataUrl && (
              <div style={styles.previewRow}>
                <img src={photoDataUrl} alt="" style={styles.previewImg} />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  style={styles.previewRemove}
                >
                  ×
                </button>
              </div>
            )}

            <div style={styles.inputRow}>
              <div style={styles.inputWrapper}>
                <label style={styles.attachLabel}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={styles.hiddenInput}
                  />
                  <span style={styles.attachBtn} aria-hidden>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: "block" }}
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </span>
                </label>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t(lang, "supportMessagePlaceholder")}
                  style={styles.inputTextarea}
                  rows={1}
                  disabled={sending}
                />
              </div>
              <button
                onClick={handleSend}
                style={styles.sendBtn}
                disabled={sending || (!input.trim() && !photoDataUrl)}
              >
                {t(lang, "send")}
              </button>
            </div>
          </>
        )}
      </AccordionCard>

      {expandedImageUrl && (
        <div
          style={styles.imageOverlay}
          onClick={() => setExpandedImageUrl(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedImageUrl(null);
            }}
            style={styles.imageOverlayClose}
            aria-label={t(lang, "close")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <img
            src={expandedImageUrl}
            alt=""
            style={styles.imageExpanded}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

interface AccordionCardProps {
  icon: ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
  badgeLabel?: string;
  children: ReactNode;
}

function AccordionCard({
  icon,
  title,
  open,
  onToggle,
  badge = 0,
  badgeLabel,
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
        {badge > 0 && (
          <span style={styles.cardBadge} aria-label={badgeLabel}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
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

function IconBubble() {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 0 24px",
  },
  heroIcon: { marginBottom: 12, opacity: 0.9 },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
    color: "var(--text)",
  },
  subtitle: {
    fontSize: 13,
    color: "var(--muted)",
    margin: "6px 0 0",
    textAlign: "center",
  },

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
    background: "rgba(165,42,42,0.08)",
    color: "var(--accent)",
    flexShrink: 0,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: 600,
  },
  cardBadge: {
    minWidth: 22,
    height: 22,
    padding: "0 7px",
    borderRadius: 11,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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

  thread: {
    maxHeight: 360,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 8,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    marginBottom: 12,
  },
  bubbleWrap: { display: "flex", flexDirection: "column", alignItems: "stretch" },
  bubble: {
    position: "relative",
    maxWidth: "85%",
    minWidth: 0,
    padding: "10px 14px",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  bubbleUser: {
    background: "var(--accent)",
    color: "#fff",
    alignSelf: "flex-end",
  },
  bubbleAdmin: {
    background: "var(--border)",
    color: "var(--text)",
  },
  bubbleText: {
    display: "block",
    fontSize: 15,
    lineHeight: 1.4,
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  },
  bubbleTime: { display: "block", fontSize: 11, opacity: 0.8, marginTop: 4 },
  bubbleImgBtn: {
    display: "block",
    padding: 0,
    margin: "0 0 4px",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  bubbleImg: { display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8 },

  previewRow: { display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  previewImg: { maxWidth: 80, maxHeight: 80, borderRadius: 8, objectFit: "cover" },
  previewRemove: {
    padding: "4px 10px",
    background: "var(--border)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 18,
  },

  inputRow: { display: "flex", alignItems: "flex-end", gap: 6, minWidth: 0 },
  inputWrapper: {
    display: "flex",
    alignItems: "flex-end",
    flex: 1,
    minWidth: 0,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    overflow: "hidden",
  },
  attachLabel: { flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center" },
  hiddenInput: { display: "none" },
  attachBtn: {
    padding: "10px 12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent)",
  },
  inputTextarea: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px 10px 0",
    border: "none",
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.35,
    background: "transparent",
    color: "var(--text)",
    caretColor: "var(--accent)",
    resize: "none",
    boxSizing: "border-box",
    minHeight: 0,
    maxHeight: 120,
    overflowY: "auto",
  },
  sendBtn: {
    flexShrink: 0,
    padding: "10px 16px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 20,
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },

  emptyState: {
    fontSize: 13,
    color: "var(--muted)",
    textAlign: "center",
    padding: 24,
    margin: 0,
  },

  imageOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    zIndex: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  imageOverlayClose: {
    position: "fixed",
    top: "max(12px, env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    width: 48,
    height: 48,
    borderRadius: 24,
    border: "none",
    background: "rgba(255,255,255,0.12)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 41,
  },
  imageExpanded: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
};
