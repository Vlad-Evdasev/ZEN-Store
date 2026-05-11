import { Router } from "express";
import { db } from "../db/schema.js";

export const messagesRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const isAdmin = (req: import("express").Request): boolean => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  return !ADMIN_SECRET || secret === ADMIN_SECRET;
};

type TemplateRow = {
  template_id: string;
  category: string;
  title: string | null;
  emoji: string | null;
  body: string;
  is_active: number;
  updated_at: string;
};

messagesRouter.get("/templates", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const rows = db.prepare(
    "SELECT template_id, category, title, emoji, body, is_active, updated_at FROM bot_message_templates ORDER BY category ASC, template_id ASC"
  ).all() as TemplateRow[];
  res.json(rows);
});

messagesRouter.get("/templates/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const row = db.prepare(
    "SELECT template_id, category, title, emoji, body, is_active, updated_at FROM bot_message_templates WHERE template_id = ?"
  ).get(req.params.id) as TemplateRow | undefined;
  if (!row) return res.status(404).json({ error: "Template not found" });
  res.json(row);
});

messagesRouter.patch("/templates/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;
  const existing = db.prepare("SELECT template_id FROM bot_message_templates WHERE template_id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (typeof req.body.title === "string") { updates.push("title = ?"); values.push(req.body.title); }
  if (typeof req.body.emoji === "string") { updates.push("emoji = ?"); values.push(req.body.emoji); }
  if (typeof req.body.body === "string") { updates.push("body = ?"); values.push(req.body.body); }
  if (typeof req.body.is_active === "boolean") {
    updates.push("is_active = ?");
    values.push(req.body.is_active ? 1 : 0);
  }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  db.prepare(`UPDATE bot_message_templates SET ${updates.join(", ")} WHERE template_id = ?`).run(...values);
  res.json({ ok: true });
});
