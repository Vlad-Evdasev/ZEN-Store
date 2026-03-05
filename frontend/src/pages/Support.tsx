import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSupportChats,
  createSupportChat,
  updateSupportChat,
  getSupportMessages,
  sendSupportMessage,
  updateSupportMessage,
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
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const INPUT_MAX_HEIGHT = 120;

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

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(() => {
      getSupportChats(userId).then(setChats).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [userId]);

  const loadMessages = useCallback((isPolling?: boolean) => {
    if (selectedChatId == null) return;
    if (!isPolling) setMessagesLoading(true);
    getSupportMessages(selectedChatId, userId)
      .then((fetched) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id < 0)) return prev;
          return fetched;
        });
        if (!isPolling) loadChats();
      })
      .catch(console.error)
      .finally(() => { if (!isPolling) setMessagesLoading(false); });
  }, [selectedChatId, userId]);

  useEffect(() => {
    loadMessages();
    const t = selectedChatId ? setInterval(() => loadMessages(true), 5000) : undefined;
    return () => clearInterval(t);
  }, [loadMessages, selectedChatId]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages.length, messages[messages.length - 1]?.id]);

  const INPUT_MIN_HEIGHT = 40; // одна строка (padding + lineHeight)

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const contentH = el.scrollHeight;
    el.style.height = Math.max(INPUT_MIN_HEIGHT, Math.min(contentH, INPUT_MAX_HEIGHT)) + "px";
  }, [input]);

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
    const imageToSend = photoDataUrl;
    const payload = { text: text || undefined, image_url: imageToSend || undefined };
    setInput("");
    setPhotoDataUrl(null);
    const tempId = -Date.now();
    const optimistic: SupportMessage = {
      id: tempId,
      chat_id: selectedChatId,
      sender_type: "user",
      text: text || "",
      image_url: imageToSend || null,
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
        setChats((prev) => prev.map((c) => (c.id === updated.id ? { ...c, title: updated.title ?? null } : c)));
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
      <div className="zen-support" style={styles.wrap}>
        <div style={styles.topRow}>
          <button onClick={() => { setSelectedChatId(null); setPhotoDataUrl(null); }} style={styles.back}>
            ← {t(lang, "back")}
          </button>
          <button onClick={handleDeleteChat} style={styles.deleteBtn}>
            {t(lang, "supportDeleteChat")}
          </button>
        </div>
        <div style={styles.chatHeaderRow}>
          {renameChatId === selectedChatId ? (
            <div style={styles.renameInline}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={t(lang, "supportChatTitlePlaceholder")}
                style={styles.renameInput}
              />
              <button type="button" onClick={handleRenameSubmit} style={styles.renameSaveBtn}>{t(lang, "save")}</button>
              <button type="button" onClick={() => { setRenameChatId(null); setRenameValue(""); }} style={styles.renameCancelBtn}>{t(lang, "reviewsCancel")}</button>
            </div>
          ) : (
            <button
              onClick={() => { setRenameChatId(selectedChatId); setRenameValue(selectedChat?.title ?? ""); }}
              style={styles.titleButton}
              className="zen-support-title-edit"
            >
              <h2 style={styles.title}>{displayTitle}</h2>
              <span style={styles.editIcon}>✎</span>
            </button>
          )}
        </div>
        <div ref={threadRef} style={styles.thread}>
          {messagesLoading && messages.length === 0 ? (
            <p style={styles.muted}>{t(lang, "loading")}...</p>
          ) : messages.length === 0 ? (
            <p style={styles.emptyState}>{t(lang, "supportNoMessages")}</p>
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
                    <button type="button" onClick={() => setExpandedImageUrl(m.image_url)} style={styles.bubbleImgBtn}>
                      <img src={m.image_url} alt="" style={styles.bubbleImg} />
                    </button>
                  )}
                  {editingMessageId === m.id ? (
                    <div style={styles.messageEditRow}>
                      <input
                        value={editingMessageText}
                        onChange={(e) => setEditingMessageText(e.target.value)}
                        style={styles.messageEditInput}
                        autoFocus
                      />
                      <button type="button" onClick={() => { setEditingMessageId(null); setEditingMessageText(""); }} style={styles.messageEditCancel}>{t(lang, "reviewsCancel")}</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedChatId == null) return;
                          const text = editingMessageText.trim();
                          if (!text) return;
                          updateSupportMessage(selectedChatId, m.id, userId, { text })
                            .then((updated) => {
                              setMessages((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
                              setEditingMessageId(null);
                              setEditingMessageText("");
                            })
                            .catch(console.error);
                        }}
                        style={styles.messageEditSave}
                      >
                        {t(lang, "save")}
                      </button>
                    </div>
                  ) : (
                    <>
                      {m.sender_type === "user" && (
                        <div style={styles.messageEditBtnWrap}>
                          <button type="button" onClick={() => { setEditingMessageId(m.id); setEditingMessageText(m.text || ""); }} style={styles.messageEditBtn} aria-label={t(lang, "supportEditMessage")}>✎</button>
                        </div>
                      )}
                      <div style={styles.bubbleContent}>
                        {m.text ? <span style={styles.bubbleText}>{m.text}</span> : null}
                        <span style={styles.bubbleTime}>{formatDate(m.created_at)}</span>
                      </div>
                    </>
                  )}
                </div>
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
          <div style={styles.inputWrapper}>
            <label style={styles.attachLabel}>
              <input type="file" accept="image/*" onChange={handlePhotoSelect} style={styles.hiddenInput} />
              <span style={styles.attachBtn} aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
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
        {expandedImageUrl && (
          <div style={styles.imageOverlay} onClick={() => setExpandedImageUrl(null)}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpandedImageUrl(null); }}
              style={styles.imageOverlayClose}
              aria-label={t(lang, "close")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <img src={expandedImageUrl} alt="" style={styles.imageExpanded} onClick={(e) => e.stopPropagation()} />
          </div>
        )}
        </div>
    );
  }

  return (
    <div className="zen-support" style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← {t(lang, "back")}
      </button>
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
                  <button type="button" onClick={handleRenameSubmit} style={styles.renameSaveBtn}>{t(lang, "save")}</button>
                  <button type="button" onClick={() => { setRenameChatId(null); setRenameValue(""); }} style={styles.renameCancelBtn}>{t(lang, "reviewsCancel")}</button>
                </div>
              ) : (
                <div style={styles.chatItemCard}>
                  <button
                    style={styles.chatItemBtn}
                    onClick={() => setSelectedChatId(c.id)}
                  >
                    <span style={styles.chatItemTitle}>
                      {c.title && c.title.trim() ? c.title.trim() : `${t(lang, "supportChat")} #${c.id}`}
                      {Number(c.unread_count ?? 0) > 0 && (
                        <span style={styles.chatUnreadBadge} aria-label="Непрочитанные">{Number(c.unread_count)}</span>
                      )}
                    </span>
                    <span style={styles.chatItemDate}>{formatDate(c.created_at)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRenameChatId(c.id); setRenameValue(c.title ?? ""); }}
                    style={styles.chatItemRename}
                    aria-label={t(lang, "supportRenameChat")}
                    data-touch-area="chat-rename"
                  >
                    <span style={styles.listEditIcon}>✎</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteSupportChat(c.id, userId).then(loadChats).catch(console.error); }}
                    style={styles.chatItemDelete}
                    aria-label={t(lang, "supportDeleteChat")}
                    data-touch-area="chat-delete"
                  >
                    <span style={styles.listDeleteIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </span>
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
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 0 },
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
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
    color: "var(--accent)",
  },
  chatHeaderRow: { marginBottom: 12 },
  titleButton: { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 },
  editIcon: { fontSize: 22, color: "var(--accent)", fontWeight: 600 },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 0,
    color: "var(--text)",
  },
  newChatBtn: {
    width: "100%",
    padding: "12px 16px",
    marginTop: 8,
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
  chatUnreadBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    marginLeft: 8,
    borderRadius: 10,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
  },
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
  chatItemDelete: { padding: "12px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--accent)" },
  chatItemRename: { padding: "12px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--accent)" },
  listEditIcon: { fontSize: 22 },
  listDeleteIcon: { display: "flex", alignItems: "center" },
  renameInline: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, minWidth: 0 },
  renameInput: { flex: "1 1 120px", minWidth: 0, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 14, caretColor: "var(--accent)" },
  renameSaveBtn: { flexShrink: 0, padding: "8px 12px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, cursor: "pointer" },
  renameCancelBtn: { flexShrink: 0, padding: "8px 12px", background: "var(--border)", color: "var(--text)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, cursor: "pointer" },
  smallBtn: { padding: "8px 12px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, cursor: "pointer" },
  thread: {
    height: 320,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
    padding: 8,
    background: "var(--surface)",
    borderRadius: 12,
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
  messageEditBtnWrap: { position: "absolute", top: -4, right: 6 },
  messageEditBtn: { padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "#fff", opacity: 0.95 },
  bubbleContent: { paddingRight: 38, minWidth: 0 },
  bubbleText: { display: "block", fontSize: 16, lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" },
  bubbleTime: { display: "block", fontSize: 12, opacity: 0.8, marginTop: 4 },
  messageEditRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
  messageEditInput: { flex: "1 1 120px", minWidth: 0, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 8, background: "rgba(0,0,0,0.15)", color: "#fff", fontSize: 14, fontFamily: "inherit" },
  messageEditCancel: { padding: "6px 10px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" },
  messageEditSave: { padding: "6px 12px", background: "rgba(255,255,255,0.95)", color: "var(--accent)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  bubbleImgBtn: { display: "block", padding: 0, margin: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", marginBottom: 4 },
  bubbleImg: { display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8, verticalAlign: "top" },
  imageOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
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
    transition: "background 0.2s ease",
  },
  imageExpanded: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  emptyState: { fontSize: 14, color: "var(--muted)", textAlign: "center", padding: 24 },
  previewRow: { display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  previewImg: { maxWidth: 80, maxHeight: 80, borderRadius: 8, objectFit: "cover" },
  previewRemove: { padding: "4px 10px", background: "var(--border)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 18 },
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
  input: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px 10px 0",
    border: "none",
    fontFamily: "inherit",
    fontSize: 14,
    background: "transparent",
    color: "var(--text)",
    caretColor: "var(--accent)",
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
  muted: { fontSize: 14, color: "var(--muted)", marginTop: 8 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "var(--surface)", borderRadius: 16, padding: 20, maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalTitle: { margin: "0 0 12px", fontSize: 16, fontWeight: 600 },
  modalActions: { display: "flex", gap: 8, marginTop: 16 },
  cancelBtn: { padding: "10px 16px", background: "var(--border)", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, cursor: "pointer", color: "var(--text)" },
  submitBtn: { padding: "10px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, cursor: "pointer" },
};
