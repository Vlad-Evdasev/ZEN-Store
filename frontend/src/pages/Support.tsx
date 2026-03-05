import { useState, useEffect, useCallback } from "react";
import {
  getSupportChats,
  createSupportChat,
  updateSupportChat,
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
  const [renameChatId, setRenameChatId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

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
    if ((!text && !photoDataUrl) || selectedChatId == null || sending) return;
    setSending(true);
    const payload = { text: text || undefined, image_url: photoDataUrl || undefined };
    setInput("");
    setPhotoDataUrl(null);
    const tempId = -Date.now();
    const optimistic: SupportMessage = {
      id: tempId,
      chat_id: selectedChatId,
      sender_type: "user",
      text: text || "",
      image_url: photoDataUrl || null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    sendSupportMessage(selectedChatId, userId, payload)
      .then((msg) => {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      })
      .catch(() => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      })
      .finally(() => setSending(false));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRenameSubmit = () => {
    if (renameChatId == null) return;
    const val = renameValue.trim();
    updateSupportChat(renameChatId, userId, { title: val || null })
      .then((updated) => {
        setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setRenameChatId(null);
        setRenameValue("");
      })
      .catch(console.error);
  };

  const selectedChat = selectedChatId != null ? chats.find((c) => c.id === selectedChatId) : null;
  const displayTitle = selectedChat ? (selectedChat.title && selectedChat.title.trim() ? selectedChat.title.trim() : `${t(lang, "supportChat")} #${selectedChat.id}`) : "";

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
          <button onClick={() => { setSelectedChatId(null); setPhotoDataUrl(null); }} style={styles.back}>
            ← {t(lang, "back")}
          </button>
          <button onClick={handleDeleteChat} style={styles.deleteBtn} aria-label={t(lang, "supportDeleteChat")}>
            {t(lang, "supportDeleteChat")}
          </button>
        </div>
        <div style={styles.chatHeaderRow}>
          <button
            onClick={() => { setRenameChatId(selectedChatId); setRenameValue(selectedChat?.title ?? ""); }}
            style={styles.titleButton}
          >
            <h2 style={styles.title}>{displayTitle}</h2>
            <span style={styles.editHint}> ✎</span>
          </button>
        </div>
        <div style={styles.thread}>
          {messagesLoading && messages.length === 0 ? (
            <p style={styles.muted}>{t(lang, "loading")}...</p>
          ) : messages.length === 0 ? (
            <p style={styles.emptyState}>{t(lang, "supportNoMessages")}</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  ...styles.bubble,
                  ...(m.sender_type === "admin" ? styles.bubbleAdmin : styles.bubbleUser),
                }}
              >
                {m.image_url && <img src={m.image_url} alt="" style={styles.bubbleImg} />}
                {m.text ? <span style={styles.bubbleText}>{m.text}</span> : null}
                <span style={styles.bubbleTime}>{formatDate(m.created_at)}</span>
              </div>
            ))
          )}
        </div>
        {photoDataUrl && (
          <div style={styles.previewRow}>
            <img src={photoDataUrl} alt="" style={styles.previewImg} />
            <button type="button" onClick={() => setPhotoDataUrl(null)} style={styles.previewRemove}>×</button>
          </div>
        )}
        <div style={styles.inputRow}>
          <label style={styles.attachLabel}>
            <input type="file" accept="image/*" onChange={handlePhotoSelect} style={styles.hiddenInput} />
            <span style={styles.attachBtn} aria-hidden>📷</span>
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={t(lang, "supportMessagePlaceholder")}
            style={styles.input}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            style={styles.sendBtn}
            disabled={sending || (!input.trim() && !photoDataUrl)}
          >
            {t(lang, "send")}
          </button>
        </div>
        {renameChatId === selectedChatId && (
          <div style={styles.modalOverlay} onClick={() => setRenameChatId(null)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <p style={styles.modalTitle}>{t(lang, "supportRenameChat")}</p>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={t(lang, "supportChatTitlePlaceholder")}
                style={styles.input}
              />
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setRenameChatId(null)} style={styles.cancelBtn}>{t(lang, "reviewsCancel")}</button>
                <button type="button" onClick={handleRenameSubmit} style={styles.submitBtn}>{t(lang, "send")}</button>
              </div>
            </div>
          </div>
        )}
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
              {renameChatId === c.id ? (
                <div style={styles.renameInline}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={t(lang, "supportChatTitlePlaceholder")}
                    style={styles.renameInput}
                  />
                  <button type="button" onClick={handleRenameSubmit} style={styles.smallBtn}>{t(lang, "send")}</button>
                  <button type="button" onClick={() => { setRenameChatId(null); setRenameValue(""); }} style={styles.smallBtn}>{t(lang, "reviewsCancel")}</button>
                </div>
              ) : (
                <div style={styles.chatItemCard}>
                  <button
                    style={styles.chatItemBtn}
                    onClick={() => setSelectedChatId(c.id)}
                  >
                    <span style={styles.chatItemTitle}>
                      {c.title && c.title.trim() ? c.title.trim() : `${t(lang, "supportChat")} #${c.id}`}
                    </span>
                    <span style={styles.chatItemDate}>{formatDate(c.created_at)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRenameChatId(c.id); setRenameValue(c.title ?? ""); }}
                    style={styles.chatItemRename}
                    aria-label={t(lang, "supportRenameChat")}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteSupportChat(c.id, userId).then(loadChats).catch(console.error); }}
                    style={styles.chatItemDelete}
                    aria-label={t(lang, "supportDeleteChat")}
                  >
                    🗑
                  </button>
                </div>
              )}
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
  chatHeaderRow: { marginBottom: 12 },
  titleButton: { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" },
  editHint: { fontSize: 14, color: "var(--muted)", fontWeight: 400 },
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
  chatItemCard: { display: "flex", alignItems: "center", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" },
  chatItemBtn: {
    flex: 1,
    padding: "14px 16px",
    textAlign: "left",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chatItemTitle: { display: "block", fontSize: 15, fontWeight: 500, color: "var(--text)" },
  chatItemDate: { display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 },
  chatItemDelete: { padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 16 },
  chatItemRename: { padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--muted)" },
  renameInline: { display: "flex", gap: 8, alignItems: "center", padding: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 },
  renameInput: { flex: 1, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 14 },
  smallBtn: { padding: "8px 12px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, cursor: "pointer" },
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
  bubbleImg: { display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginBottom: 4 },
  emptyState: { fontSize: 14, color: "var(--muted)", textAlign: "center", padding: 24 },
  previewRow: { display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  previewImg: { maxWidth: 80, maxHeight: 80, borderRadius: 8, objectFit: "cover" },
  previewRemove: { padding: "4px 10px", background: "var(--border)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 18 },
  attachLabel: { flexShrink: 0, cursor: "pointer" },
  hiddenInput: { display: "none" },
  attachBtn: { display: "inline-block", padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 18, cursor: "pointer" },
  inputRow: { display: "flex", gap: 8, alignItems: "center" },
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
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "var(--surface)", borderRadius: 16, padding: 20, maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalTitle: { margin: "0 0 12px", fontSize: 16, fontWeight: 600 },
  modalActions: { display: "flex", gap: 8, marginTop: 16 },
  cancelBtn: { padding: "10px 16px", background: "var(--border)", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, cursor: "pointer" },
  submitBtn: { padding: "10px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, cursor: "pointer" },
};
