# Profile → Support Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Profile page, rename the arc-menu entry to «Поддержка», and replace `Support.tsx` with a zen-styled single-chat hub containing two accordion sections: delivery terms + embedded support chat.

**Architecture:** Frontend-only refactor. Delete `Profile.tsx` + `DeliveryTerms.tsx`. Rewrite `Support.tsx` as a standalone hub page that lazily resolves a single «active» support chat (the most recent existing one, or auto-creates one if none). Add a reusable local `AccordionCard` component inside `Support.tsx`. Patch `HeaderArcMenu` to swap the Profile item for Support (with an unread dot). Patch `App.tsx` routing and i18n to add/remove keys.

**Tech Stack:** React 18 + TypeScript (inline `React.CSSProperties` styles, consistent with existing code). No new libraries. Uses existing API module (`frontend/src/api.ts`), `useSettings` context, and `t()` i18n helper.

**Spec:** `docs/superpowers/specs/2026-04-19-profile-to-support-redesign-design.md`

---

## File Structure

**Created:**
- _none_ (everything reuses existing files)

**Modified:**
- `frontend/src/pages/Support.tsx` — rewritten from scratch
- `frontend/src/components/HeaderArcMenu.tsx` — Profile item → Support item, add unread-dot prop
- `frontend/src/App.tsx` — remove profile/deliveryTerms routing, pass `supportUnreadCount` to `HeaderArcMenu`, add `support` to bottom-nav whitelist, update props passed to `<Support />`
- `frontend/src/i18n.ts` — add new keys, remove obsolete `profile*` keys

**Deleted:**
- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/DeliveryTerms.tsx`

---

## Task 1: Add new i18n keys, remove obsolete profile keys

**Files:**
- Modify: `frontend/src/i18n.ts`

- [ ] **Step 1: Add new support-hub keys (ru + en)**

In `frontend/src/i18n.ts`, inside the `ru` object, after `supportTitle: "Поддержка",` line add the four new keys (keep the existing `supportTitle`, do NOT remove):

```ts
    support: "Поддержка",
    supportHeroSubtitle: "Мы рядом — спросите что угодно",
    supportChatSection: "Чат с поддержкой",
    supportStartConversation: "Напишите первое сообщение — мы ответим в течение 24 часов.",
```

Inside the `en` object, after `supportTitle: "Support",`:

```ts
    support: "Support",
    supportHeroSubtitle: "We're here — ask us anything",
    supportChatSection: "Support chat",
    supportStartConversation: "Send your first message — we'll reply within 24 hours.",
```

- [ ] **Step 2: Remove obsolete profile-only keys**

Delete these exact lines from the `ru` block:

```ts
    profileQuickActions: "Быстрые действия",
    profileRecentOrders: "Последние заказы",
    profileFavorites: "Избранное",
    profileActions: "Действия",
    profileFavoritesEmpty: "Лайкни что-нибудь, чтобы оно появилось здесь",
```

```ts
    profileDeliveryTerms: "Условия доставки",
    profileSupport: "Поддержка",
    profileAboutTitle: "О магазине",
    profileAboutText: "RAW — минималистичный магазин одежды. Качество, стиль, твой выбор.",
    profileSupportText: "По вопросам заказов пишите в Telegram. Мы ответим в течение 24 часов.",
```

Delete the same keys from the `en` block (their values are the English equivalents already in the file).

**Keep** these keys — they're still used:
- `profile` (menu item localisation fallback) — actually also becomes unused after Task 2. It's cheap to leave; delete only if grep after Task 4 confirms 0 refs. Do NOT delete in this step.
- `deliveryTermsTitle`, `deliveryTermsP1`, `deliveryTermsP2`, `deliveryTermsP3` — still used in new Support page.
- All `support*` keys except the ones we're removing in Task 3.

- [ ] **Step 3: Verify file still parses**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors relating to `frontend/src/i18n.ts`. Errors in other files (Profile.tsx references, App.tsx references) are expected at this stage — leave them, they'll be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n.ts
git commit -m "i18n: add support hub keys, drop obsolete profile keys"
```

---

## Task 2: Update `HeaderArcMenu` — Profile item → Support item with unread dot

**Files:**
- Modify: `frontend/src/components/HeaderArcMenu.tsx`

- [ ] **Step 1: Replace `IconProfile` with `IconSupport`**

In `frontend/src/components/HeaderArcMenu.tsx` replace the whole `IconProfile` function (lines ~31–47) with:

```tsx
function IconSupport() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle}
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
```

- [ ] **Step 2: Update `HeaderArcMenuProps` interface**

Replace the existing interface (around lines 12–21) with:

```tsx
export interface HeaderArcMenuProps {
  open: boolean;
  lang: Lang;
  anchorRef: React.RefObject<HTMLElement>;
  supportUnreadCount?: number;
  onClose: () => void;
  onSupport: () => void;
  onHistory: () => void;
  onReviews: () => void;
  onSettings: () => void;
}
```

- [ ] **Step 3: Update component signature + items array**

In the `HeaderArcMenu` function (around line 120), replace:

```tsx
export function HeaderArcMenu({
  open,
  lang,
  anchorRef,
  onClose,
  onProfile,
  onHistory,
  onReviews,
  onSettings,
}: HeaderArcMenuProps) {
```

with:

```tsx
export function HeaderArcMenu({
  open,
  lang,
  anchorRef,
  supportUnreadCount = 0,
  onClose,
  onSupport,
  onHistory,
  onReviews,
  onSettings,
}: HeaderArcMenuProps) {
```

And change the `items` array definition (around line 163):

```tsx
  const items: Array<{ key: string; label: string; onClick: () => void; Icon: React.FC; badge?: boolean }> = [
    { key: "support", label: t(lang, "support"), onClick: onSupport, Icon: IconSupport, badge: supportUnreadCount > 0 },
    { key: "history", label: t(lang, "history"), onClick: onHistory, Icon: IconHistory },
    { key: "reviews", label: t(lang, "reviews"), onClick: onReviews, Icon: IconReviews },
    { key: "settings", label: t(lang, "settings"), onClick: onSettings, Icon: IconSettings },
  ];
```

- [ ] **Step 4: Render unread dot inside the Support button**

Replace the `items.map(...)` block (around lines 190–202) with:

```tsx
        {items.map(({ key, label, onClick, Icon, badge }, i) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            aria-label={label}
            tabIndex={open ? 0 : -1}
            className={open ? "zen-arc-item" : "zen-arc-item zen-arc-item--closed"}
            style={{ ...styles.item, ...positions[i], ...(open ? styles.itemOpen : styles.itemClosed) }}
          >
            <Icon />
            {badge && <span style={styles.itemDot} aria-hidden />}
          </button>
        ))}
```

- [ ] **Step 5: Add `itemDot` style**

In the `styles` object at the bottom of the file, after `itemClosed`, append:

```tsx
  itemDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    border: "1.5px solid var(--bg)",
    pointerEvents: "none",
  },
```

- [ ] **Step 6: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors inside `App.tsx` referencing `onProfile={...}` — that's expected, we'll fix in Task 4. No errors should originate *inside* `HeaderArcMenu.tsx`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/HeaderArcMenu.tsx
git commit -m "refactor(header-menu): replace Profile item with Support + unread dot"
```

---

## Task 3: Rewrite `Support.tsx` as zen-styled hub page

**Files:**
- Modify (full rewrite): `frontend/src/pages/Support.tsx`

- [ ] **Step 1: Delete current file contents and write the new implementation**

Overwrite `frontend/src/pages/Support.tsx` with exactly this content:

```tsx
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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
  const [resolving, setResolving] = useState(false);
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
  // or create a new one if none exists. We only run this when the chat
  // accordion is actually opened, to avoid unnecessary writes.
  const resolveChatId = useCallback(() => {
    if (!userId || resolving) return;
    setResolving(true);
    getSupportChats(userId)
      .then((chats) => {
        if (chats.length === 0) {
          return createSupportChat(userId, {
            user_name: firstName,
            user_username: userName ?? undefined,
          }).then((c) => c.id);
        }
        const sorted = [...chats].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return sorted[0].id;
      })
      .then((id) => { if (id != null) setChatId(id); })
      .catch(console.error)
      .finally(() => setResolving(false));
  }, [userId, firstName, userName, resolving]);

  useEffect(() => {
    if (chatOpen && chatId == null && !resolving) {
      resolveChatId();
    }
  }, [chatOpen, chatId, resolving, resolveChatId]);

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
  children: ReactNode;
}

function AccordionCard({ icon, title, open, onToggle, badge = 0, children }: AccordionCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | "none">(0);

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
      <button type="button" onClick={onToggle} style={styles.cardHeader}>
        <span style={styles.cardIcon}>{icon}</span>
        <span style={styles.cardTitle}>{title}</span>
        {badge > 0 && (
          <span style={styles.cardBadge} aria-label="unread">
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
        ref={contentRef}
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
```

- [ ] **Step 2: Verify TypeScript compiles for this file**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "pages/Support" || echo "OK: no Support errors"`
Expected: `OK: no Support errors`. (Errors elsewhere — in App.tsx — are expected until Task 4.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Support.tsx
git commit -m "feat(support): zen-styled hub page with delivery + embedded chat accordion"
```

---

## Task 4: Wire up `App.tsx` — remove Profile/DeliveryTerms, plug in new Support

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Remove imports for deleted pages**

In `frontend/src/App.tsx`, delete these two import lines:

```tsx
import { Profile } from "./pages/Profile";
import { DeliveryTerms } from "./pages/DeliveryTerms";
```

- [ ] **Step 2: Update `Page` type**

Replace:

```tsx
type Page = "catalog" | "cart" | "product" | "checkout" | "profile" | "reviews" | "favorites" | "newArrivals" | "customOrder" | "settings" | "history" | "deliveryTerms" | "support";
```

with:

```tsx
type Page = "catalog" | "cart" | "product" | "checkout" | "reviews" | "favorites" | "newArrivals" | "customOrder" | "settings" | "history" | "support";
```

- [ ] **Step 3: Update the support-unread-count effect to drop `profile`**

Replace:

```tsx
  useEffect(() => {
    if ((page !== "profile" && page !== "support") || !userId) return;
    getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {});
  }, [page, userId]);
```

with:

```tsx
  useEffect(() => {
    if (page !== "support" || !userId) return;
    getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {});
  }, [page, userId]);
```

- [ ] **Step 4: Remove `recentOrders` state and loading effect branch**

`recentOrders` was only used by `<Profile />`. Delete the `recentOrders` state (`const [recentOrders, setRecentOrders] = useState<Order[]>([]);`) and remove both:

- the `getOrders(userId).then(...)` block inside the initial load `useEffect` (the 5-line block that sets `setRecentOrders(orders.slice(0, 3))`),
- the `else if (!cancelled) { setRecentOrders([]); }` branch that goes with it.

Also remove the unused `Order` from the import line:

```tsx
import { getProducts, getStores, getCategories, getCart, getSupportUnreadCount, getOrders, type Product, type Store, type Category, type Order } from "./api";
```

becomes:

```tsx
import { getProducts, getStores, getCategories, getCart, getSupportUnreadCount, type Product, type Store, type Category } from "./api";
```

Also delete the `getOrders` import — it's no longer used.

- [ ] **Step 5: Replace `openProfile` + `openDeliveryTerms` with `openSupport`**

Remove these two blocks entirely:

```tsx
  const openProfile = () => {
    setMenuOpen(false);
    setPage("profile");
  };
```

```tsx
  const openDeliveryTerms = () => {
    setMenuOpen(false);
    setPage("deliveryTerms");
  };
```

Replace the existing `openSupport`:

```tsx
  const openSupport = () => {
    setMenuOpen(false);
    setPage("support");
  };
```

(If `openSupport` already exists with this exact body, leave it. The function appears in the current file — just ensure it stays and is used by the menu.)

- [ ] **Step 6: Update `<HeaderArcMenu />` call**

Replace the existing JSX (around lines 289–298) with:

```tsx
          <HeaderArcMenu
            open={menuOpen}
            lang={lang}
            anchorRef={hamburgerRef}
            supportUnreadCount={supportUnreadCount}
            onClose={() => setMenuOpen(false)}
            onSupport={openSupport}
            onHistory={openHistory}
            onReviews={openReviews}
            onSettings={openSettings}
          />
```

- [ ] **Step 7: Remove Profile + DeliveryTerms render branches**

Delete the entire `{page === "profile" && ( … )}` block (14 lines starting with `{page === "profile" && (`).

Delete the entire `{page === "deliveryTerms" && ( … )}` block (3 lines).

- [ ] **Step 8: Update `<Support />` render branch**

Replace:

```tsx
        {page === "support" && (
          <Support
            userId={userId || ""}
            userName={userName}
            firstName={firstName}
            onBack={openProfile}
            onUnreadCountChange={userId ? () => getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {}) : undefined}
          />
        )}
```

with:

```tsx
        {page === "support" && (
          <Support
            userId={userId || ""}
            userName={userName}
            firstName={firstName}
            supportUnreadCount={supportUnreadCount}
            onUnreadCountChange={userId ? () => getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {}) : undefined}
          />
        )}
```

- [ ] **Step 9: Update the BottomNavBar whitelist**

Replace:

```tsx
      {(["catalog", "customOrder", "newArrivals", "profile", "history", "settings", "reviews"] as Page[]).includes(page) && (
```

with:

```tsx
      {(["catalog", "customOrder", "newArrivals", "support", "history", "settings", "reviews"] as Page[]).includes(page) && (
```

- [ ] **Step 10: Make `<main>` not force `paddingBottom: 0` on support (we now want nav visible)**

Replace the existing `<main>` opening tag:

```tsx
      <main ref={mainScrollRef} className={page === "catalog" ? "zen-main--catalog" : undefined} style={page === "support" ? { ...styles.main, paddingBottom: 0 } : styles.main}>
```

with:

```tsx
      <main ref={mainScrollRef} className={page === "catalog" ? "zen-main--catalog" : undefined} style={styles.main}>
```

Rationale: the previous override was for the old Support page that fixed its input at the bottom; the new Support page uses normal block flow with internal scroll for the thread, so standard main padding is correct.

- [ ] **Step 11: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit code 0. No errors.

- [ ] **Step 12: Run dev build**

Run: `cd frontend && npx vite build 2>&1 | tail -n 20`
Expected: build succeeds (`✓ built in …`). No errors about missing `./pages/Profile` or `./pages/DeliveryTerms`.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor(app): replace profile/delivery routing with unified support page"
```

---

## Task 5: Delete `Profile.tsx` and `DeliveryTerms.tsx`

**Files:**
- Delete: `frontend/src/pages/Profile.tsx`
- Delete: `frontend/src/pages/DeliveryTerms.tsx`

- [ ] **Step 1: Verify nothing else imports them**

Run: `cd "/Users/admin/Documents/Cursor Mani App" && rg "pages/Profile|pages/DeliveryTerms" frontend/src`
Expected: no results (besides possibly the files themselves, which we're about to delete).

- [ ] **Step 2: Delete the files**

```bash
rm frontend/src/pages/Profile.tsx
rm frontend/src/pages/DeliveryTerms.tsx
```

- [ ] **Step 3: Verify TypeScript still compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Verify build succeeds**

Run: `cd frontend && npx vite build 2>&1 | tail -n 10`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/pages/
git commit -m "chore: remove obsolete Profile and DeliveryTerms pages"
```

---

## Task 6: Manual smoke test

**Files:** _none (QA only)_

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev`
Expected: Vite starts on `http://localhost:5173` (or next free port). No console errors at startup.

- [ ] **Step 2: Open the app in a browser**

Navigate to the Vite URL. The catalog loads normally.

- [ ] **Step 3: Open the burger menu**

Click the hamburger icon (top-left). The arc menu fans out with **4 items**: Support, History, Reviews, Settings. There is **no "Profile" item**. The first item (Support) has the speech-bubble icon.

- [ ] **Step 4: (Optional) Check unread dot**

If your dev account has unread support messages, the Support arc item shows a small red dot in its top-right. Otherwise skip.

- [ ] **Step 5: Click Support**

The page navigates to Support. Verify:
- Hero with small accent speech-bubble icon, title «Поддержка» (Unbounded font), subtitle «Мы рядом — спросите что угодно».
- Two cards: «Условия доставки» (collapsed) and «Чат с поддержкой» (collapsed, unless there were unread messages).
- `BottomNavBar` visible at the bottom.

- [ ] **Step 6: Expand delivery terms**

Click the «Условия доставки» card. Chevron rotates 180°, content expands smoothly showing 3 paragraphs. Click again → collapses smoothly.

- [ ] **Step 7: Expand chat**

Click the «Чат с поддержкой» card. Loading spinner (text) briefly shows, then either:
- existing messages render with user bubbles (accent) on the right and admin bubbles (grey) on the left, OR
- empty state «Напишите первое сообщение — мы ответим в течение 24 часов.»

The message input + attach + send row is visible at the bottom of the card.

- [ ] **Step 8: Send a text message**

Type "тестовое сообщение" and press Send. A user bubble appears immediately (optimistic update). After ~1 second it's persisted (no id flip-flop).

- [ ] **Step 9: Attach and send a photo**

Click the paperclip, pick an image, send. Preview appears, send succeeds, bubble contains the image. Click the image → fullscreen overlay. Click close → overlay dismisses.

- [ ] **Step 10: Polling**

Wait ~5 seconds with the chat open. No visible flicker. If the admin sends a reply from the backend/admin UI, it appears within 5 seconds.

- [ ] **Step 11: Navigate away + back**

Click a BottomNavBar item (catalog). Navigate back via burger → Support. The chat should still contain the same messages (fresh load, same chat id).

- [ ] **Step 12: Switch language**

Go to Settings → switch to English. Return to Support. Verify: title "Support", subtitle "We're here — ask us anything", cards "Delivery conditions" / "Support chat", empty state "Send your first message — we'll reply within 24 hours.".

- [ ] **Step 13: Commit (if any fixes made during smoke test)**

If smoke test required fixes, commit with `fix(support): <description>`. Otherwise skip.

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Implementing task |
|---|---|
| Delete `Profile.tsx` | Task 5 |
| Delete `DeliveryTerms.tsx` | Task 5 |
| Remove `"profile"` / `"deliveryTerms"` from Page union + routing | Task 4 |
| Rename arc-menu «Профиль» → «Поддержка» with new icon | Task 2 |
| Unread-dot on Support menu item | Task 2 (dot render) + Task 4 (prop wiring) |
| New i18n keys `support`, `supportHeroSubtitle`, `supportChatSection`, `supportStartConversation` | Task 1 |
| Remove obsolete `profile*` keys | Task 1 |
| New Support hub page: hero + 2 accordions | Task 3 |
| `AccordionCard` local component with smooth max-height animation | Task 3 |
| Single active chat resolution (most recent or auto-create) | Task 3 (`resolveChatId`) |
| Polling every 5s + `markSupportChatRead` + unread count refresh | Task 3 (useEffect) |
| Message send (text + image) with optimistic update | Task 3 (`handleSend`) |
| Image fullscreen overlay | Task 3 |
| `BottomNavBar` visible on support page | Task 4 Step 9 |
| No chat list, no rename, no delete, no edit-message | Task 3 (API funcs not imported) |

All spec requirements are covered.

**2. Placeholder scan**

- No "TBD" / "TODO" / "implement later" strings in the plan.
- Every code step has complete code (not pseudo-code).
- Every command has expected output.

**3. Type consistency**

- `HeaderArcMenuProps`: new prop `onSupport` used in Task 2 Step 2, Task 2 Step 3, and Task 4 Step 6 — matches.
- `SupportProps`: new `supportUnreadCount: number` prop in Task 3, consumed by `AccordionCard` via `badge`, and passed from App in Task 4 Step 8 — matches.
- `AccordionCard` signature (Task 3) is consistent with its two call-sites in the same file (delivery card + chat card).
- i18n keys used in Task 3 (`support`, `supportHeroSubtitle`, `supportChatSection`, `supportStartConversation`, plus existing `deliveryTermsTitle`, `deliveryTermsP1..P3`, `supportMessagePlaceholder`, `send`, `close`, `loading`) — all either added in Task 1 or already present in the codebase (verified before writing plan).
- API functions used in Task 3: `getSupportChats`, `createSupportChat`, `getSupportMessages`, `markSupportChatRead`, `sendSupportMessage`, type `SupportMessage` — all exist in `frontend/src/api.ts` (verified).
- `getOrders` / `Order` removed in Task 4 Step 4 — consistent with removing `recentOrders` state.

No inconsistencies found.
