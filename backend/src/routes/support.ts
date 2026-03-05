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
        "SELECT id, user_id, user_name, user_username, created_at FROM support_chats WHERE deleted_at IS NULL ORDER BY created_at DESC"
      )
      .all();
    return res.json(rows);
  }

  if (!userId) return res.status(400).json({ error: "userId required" });
  const rows = db
    .prepare(
      "SELECT id, user_id, user_name, user_username, created_at FROM support_chats WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
    )
    .all(userId);
  res.json(rows);
});

supportRouter.post("/chats", (req, res) => {
  const { user_id, user_name, user_username } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  const r = db
    .prepare(
      "INSERT INTO support_chats (user_id, user_name, user_username) VALUES (?, ?, ?)"
    )
    .run(user_id, user_name ?? null, user_username ?? null);
  const id = r.lastInsertRowid as number;
  const row = db.prepare("SELECT id, user_id, user_name, user_username, created_at FROM support_chats WHERE id = ?").get(id) as Record<string, unknown>;
  res.status(201).json(row);
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
    .prepare("SELECT id, chat_id, sender_type, text, created_at FROM support_messages WHERE chat_id = ? ORDER BY created_at ASC")
    .all(chatId);
  res.json(rows);
});

supportRouter.post("/chats/:id/messages", (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  const { text, sender_type } = req.body;
  const userId = req.query.userId as string | undefined;
  const asAdmin = isAdmin(req);

  if (!text || typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
  const sender = (asAdmin ? "admin" : "user") as string;
  if (asAdmin && sender_type !== "admin") {
    // admin always sends as admin
  }

  const chat = db.prepare("SELECT id, user_id, deleted_at FROM support_chats WHERE id = ?").get(chatId) as { id: number; user_id: string; deleted_at: string | null } | undefined;
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.deleted_at) return res.status(404).json({ error: "Chat deleted" });
  if (!asAdmin && chat.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

  db.prepare("INSERT INTO support_messages (chat_id, sender_type, text) VALUES (?, ?, ?)").run(chatId, sender, text.trim());
  const row = db.prepare("SELECT id, chat_id, sender_type, text, created_at FROM support_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1").get(chatId) as Record<string, unknown>;
  res.status(201).json(row);
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
