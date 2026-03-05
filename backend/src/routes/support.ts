import { Router } from "express";
import { db } from "../db/schema.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function isAdmin(req: { headers: Record<string, unknown> }): boolean {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  return !ADMIN_SECRET || secret === ADMIN_SECRET;
}

export const supportRouter = Router();

supportRouter.get("/chats", (req, res) => {
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  if (asAdmin) {
    const rows = db
      .prepare(
        "SELECT id, user_id, user_name, user_username, title, created_at FROM support_chats WHERE deleted_at IS NULL ORDER BY created_at DESC"
      )
      .all();
    return res.json(rows);
  }

  if (!userId) return res.status(400).json({ error: "userId required" });
  const rows = db
    .prepare(
      `SELECT c.id, c.user_id, c.user_name, c.user_username, c.title, c.created_at,
        (SELECT COUNT(*) FROM support_messages m WHERE m.chat_id = c.id AND m.sender_type = 'admin' AND m.id > COALESCE((SELECT r.last_read_message_id FROM support_chat_read r WHERE r.user_id = ? AND r.chat_id = c.id), 0)) AS unread_count
       FROM support_chats c WHERE c.user_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC`
    )
    .all(userId, userId);
  res.json(rows);
});

supportRouter.get("/unread-count", (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (isAdmin(req)) return res.json({ count: 0 });
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(
        (SELECT COUNT(*) FROM support_messages m WHERE m.chat_id = c.id AND m.sender_type = 'admin' AND m.id > COALESCE((SELECT r.last_read_message_id FROM support_chat_read r WHERE r.user_id = ? AND r.chat_id = c.id), 0))
      ), 0) AS total FROM support_chats c WHERE c.user_id = ? AND c.deleted_at IS NULL`
    )
    .get(userId, userId) as { total: number };
  res.json({ count: row?.total ?? 0 });
});

supportRouter.post("/chats", (req, res) => {
  const { user_id, user_name, user_username, title } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  const r = db
    .prepare(
      "INSERT INTO support_chats (user_id, user_name, user_username, title) VALUES (?, ?, ?, ?)"
    )
    .run(user_id, user_name ?? null, user_username ?? null, title ?? null);
  const id = r.lastInsertRowid as number;
  const row = db.prepare("SELECT id, user_id, user_name, user_username, title, created_at FROM support_chats WHERE id = ?").get(id) as Record<string, unknown>;
  res.status(201).json(row);
});

supportRouter.patch("/chats/:id", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const { title } = req.body;
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat deleted" });
  if (!asAdmin && chat.user_id !== userId) return res.status(403).json({ error: "Forbidden" });
  if (title !== undefined && typeof title !== "string") return res.status(400).json({ error: "title must be string" });

  db.prepare("UPDATE support_chats SET title = ? WHERE id = ?").run(title ?? null, chatId);
  const row = db.prepare("SELECT id, user_id, user_name, user_username, title, created_at FROM support_chats WHERE id = ?").get(chatId) as Record<string, unknown>;
  res.json(row);
});

supportRouter.get("/chats/:id/messages", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat deleted" });
  if (!asAdmin && chat.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

  const rows = db
    .prepare("SELECT id, chat_id, sender_type, text, image_url, created_at FROM support_messages WHERE chat_id = ? ORDER BY created_at ASC")
    .all(chatId);
  if (!asAdmin && userId) {
    const maxId = rows.length ? Math.max(...(rows as { id: number }[]).map((r) => r.id)) : 0;
    db.prepare(
      "INSERT INTO support_chat_read (user_id, chat_id, last_read_message_id) VALUES (?, ?, ?) ON CONFLICT(user_id, chat_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id"
    ).run(userId, chatId, maxId);
  }
  res.json(rows);
});

supportRouter.post("/chats/:id/messages", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const { text, image_url } = req.body;
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  const textVal = typeof text === "string" ? text.trim() : "";
  const imageVal = typeof image_url === "string" && image_url.length > 0 ? image_url : null;
  if (!textVal && !imageVal) return res.status(400).json({ error: "text or image_url required" });

  const sender = (asAdmin ? "admin" : "user") as string;

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat deleted" });
  if (!asAdmin && chat.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

  db.prepare("INSERT INTO support_messages (chat_id, sender_type, text, image_url) VALUES (?, ?, ?, ?)").run(chatId, sender, textVal || "", imageVal);
  const row = db.prepare("SELECT id, chat_id, sender_type, text, image_url, created_at FROM support_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1").get(chatId) as Record<string, unknown>;
  res.status(201).json(row);
});

supportRouter.patch("/chats/:id/messages/:messageId", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);
  const { text } = req.body;

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat deleted" });
  const msg = db.prepare("SELECT id, chat_id, sender_type, text FROM support_messages WHERE id = ? AND chat_id = ?").get(messageId, chatId) as { id: number; sender_type: string } | undefined;
  if (!msg) return res.status(404).json({ error: "Message not found" });
  const canEdit = asAdmin ? msg.sender_type === "admin" : msg.sender_type === "user" && chat.user_id === userId;
  if (!canEdit) return res.status(403).json({ error: "Can only edit own messages" });
  const textVal = typeof text === "string" ? text.trim() : "";
  db.prepare("UPDATE support_messages SET text = ? WHERE id = ? AND chat_id = ?").run(textVal, messageId, chatId);
  const row = db.prepare("SELECT id, chat_id, sender_type, text, image_url, created_at FROM support_messages WHERE id = ?").get(messageId) as Record<string, unknown>;
  res.json(row);
});

supportRouter.delete("/chats/:id/messages/:messageId", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat deleted" });
  const msg = db.prepare("SELECT id, sender_type FROM support_messages WHERE id = ? AND chat_id = ?").get(messageId, chatId) as { sender_type: string } | undefined;
  if (!msg) return res.status(404).json({ error: "Message not found" });
  const canDelete = asAdmin ? msg.sender_type === "admin" : msg.sender_type === "user" && chat.user_id === userId;
  if (!canDelete) return res.status(403).json({ error: "Can only delete own messages" });
  db.prepare("DELETE FROM support_messages WHERE id = ? AND chat_id = ?").run(messageId, chatId);
  res.json({ ok: true });
});

supportRouter.delete("/chats/:id", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat already deleted" });
  if (!asAdmin && chat.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

  db.prepare("UPDATE support_chats SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(chatId);
  res.json({ ok: true });
});
