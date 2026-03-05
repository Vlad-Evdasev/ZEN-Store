import { useState, useEffect, useCallback } from "react";
import {
  getSupportChats,
  createSupportChat,
  getSupportMessages,
  sendSupportMessage,
  deleteSupportChat,
  type SupportChat,
  type SupportMessage,
} from "../api";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";

interface SupportProps {
  userId: string;
  userName: string | null;
  firstName: string;
  onBack: () => void;
}

export function Support({ userId, userName, firstName, onBack }: SupportProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadChats = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getSupportChats(userId)
      .then(setChats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const loadMessages = useCallback(() => {
    if (selectedChatId == null) return;
    setMessagesLoading(true);
    getSupportMessages(selectedChatId, userId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setMessagesLoading(false));
  }, [selectedChatId, userId]);

  useEffect(() => {
    loadMessages();
    const interval = selectedChatId ? setInterval(loadMessages, 5000) : undefined;
    return () => clearInterval(interval);
  }, [loadMessages, selectedChatId]);

  const handleCreateChat = () => {
    if (!userId || creating) return;
    setCreating(true);
    createSupportChat(userId, { user_name: firstName, user_username: userName ?? undefined })
      .then((chat) => {
        loadChats();
        setSelectedChatId(chat.id);
      })
      .catch(console.error)
      .finally(() => setCreating(false));
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || selectedChatId == null || sending) return;
    setSending(true);
    sendSupportMessage(selectedChatId, userId, text)
      .then((msg) => {
        setMessages((prev) => [...prev, msg]);
        setInput("");
      })
      .catch(console.error)
      .finally(() => setSending(false));
  };

  const handleDeleteChat = () => {
    if (selectedChatId == null) return;
    deleteSupportChat(selectedChatId, userId)
      .then(() => {
        setSelectedChatId(null);
        loadChats();
      })
      .catch(console.error);
  };

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  if (selectedChatId != null) {
    return (
      <div style={styles.wrap}>
        <div style={styles.topRow}>
          <button onClick={() => setSelectedChatId(null)} style={styles.back}>
            ← {t(lang, "back")}
          </button>
          <button onClick={handleDeleteChat} style={styles.deleteBtn} aria-label={t(lang, "supportDeleteChat")}>
            {t(lang, "supportDeleteChat")}
          </button>
        </div>
        <h2 style={styles.title}>{t(lang, "supportChat")}</h2>
        <div style={styles.thread}>
          {messagesLoading && messages.length === 0 ? (
            <p style={styles.muted}>{t(lang, "loading")}...</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  ...styles.bubble,
                  ...(m.sender_type === "admin" ? styles.bubbleAdmin : styles.bubbleUser),
                }}
              >
                <span style={styles.bubbleText}>{m.text}</span>
                <span style={styles.bubbleTime}>{formatDate(m.created_at)}</span>
              </div>
            ))
          )}
        </div>
        <div style={styles.inputRow}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t(lang, "supportMessagePlaceholder")}
            style={styles.input}
            disabled={sending}
          />
          <button onClick={handleSend} style={styles.sendBtn} disabled={sending || !input.trim()}>
            {t(lang, "send")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {t(lang, "back")}
      </button>
      <h2 style={styles.title}>{t(lang, "supportTitle")}</h2>
      <button onClick={handleCreateChat} style={styles.newChatBtn} disabled={creating}>
        {creating ? "..." : t(lang, "supportNewChat")}
      </button>
      {loading ? (
        <p style={styles.muted}>{t(lang, "loading")}...</p>
      ) : chats.length === 0 ? (
        <p style={styles.muted}>{t(lang, "supportNoChats")}</p>
      ) : (
        <ul style={styles.chatList}>
          {chats.map((c) => (
            <li key={c.id} style={styles.chatItem}>
              <button
                style={styles.chatItemBtn}
                onClick={() => setSelectedChatId(c.id)}
              >
                <span style={styles.chatItemTitle}>
                  {t(lang, "supportChat")} #{c.id}
                </span>
                <span style={styles.chatItemDate}>{formatDate(c.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 20,
  },
  newChatBtn: {
    width: "100%",
    padding: "12px 16px",
    marginBottom: 24,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 500,
    cursor: "pointer",
  },
  chatList: { listStyle: "none", padding: 0, margin: 0 },
  chatItem: { marginBottom: 8 },
  chatItemBtn: {
    width: "100%",
    padding: "14px 16px",
    textAlign: "left",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chatItemTitle: { display: "block", fontSize: 15, fontWeight: 500, color: "var(--text)" },
  chatItemDate: { display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 },
  thread: {
    minHeight: 200,
    maxHeight: 360,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
    padding: 8,
    background: "var(--surface)",
    borderRadius: 12,
  },
  bubble: {
    maxWidth: "85%",
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
  bubbleText: { display: "block", fontSize: 14, lineHeight: 1.4 },
  bubbleTime: { display: "block", fontSize: 11, opacity: 0.8, marginTop: 4 },
  inputRow: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    padding: "12px 14px",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontFamily: "inherit",
    fontSize: 14,
    background: "var(--bg)",
    color: "var(--text)",
  },
  sendBtn: {
    padding: "12px 18px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  muted: { fontSize: 14, color: "var(--muted)", marginTop: 8 },
};
