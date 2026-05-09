import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db/schema.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_SECRET && req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const supportRouter = Router();

export type SupportEntryRow = {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
};

supportRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      "SELECT id, question, answer, sort_order, created_at FROM support_entries ORDER BY sort_order, id"
    )
    .all() as SupportEntryRow[];
  res.json(rows);
});

supportRouter.post("/", requireAdmin, (req, res) => {
  const { question, answer, sort_order } = req.body ?? {};
  if (!question || typeof question !== "string" || !answer || typeof answer !== "string") {
    return res.status(400).json({ error: "Требуются question и answer" });
  }
  const order = typeof sort_order === "number" ? sort_order : 0;
  const result = db
    .prepare(
      "INSERT INTO support_entries (question, answer, sort_order) VALUES (?, ?, ?)"
    )
    .run(String(question).trim(), String(answer), order);
  const row = db
    .prepare(
      "SELECT id, question, answer, sort_order, created_at FROM support_entries WHERE id = ?"
    )
    .get(Number(result.lastInsertRowid)) as SupportEntryRow;
  res.status(201).json(row);
});

supportRouter.patch("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id, question, answer, sort_order FROM support_entries WHERE id = ?")
    .get(id) as SupportEntryRow | undefined;
  if (!row) return res.status(404).json({ error: "Запись не найдена" });
  const { question, answer, sort_order } = req.body ?? {};
  const newQuestion =
    question !== undefined ? String(question).trim() : row.question;
  const newAnswer = answer !== undefined ? String(answer) : row.answer;
  const newOrder = sort_order !== undefined ? Number(sort_order) : row.sort_order;
  db.prepare(
    "UPDATE support_entries SET question = ?, answer = ?, sort_order = ? WHERE id = ?"
  ).run(newQuestion, newAnswer, newOrder, id);
  const updated = db
    .prepare(
      "SELECT id, question, answer, sort_order, created_at FROM support_entries WHERE id = ?"
    )
    .get(id) as SupportEntryRow;
  res.json(updated);
});

supportRouter.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT id FROM support_entries WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Запись не найдена" });
  db.prepare("DELETE FROM support_entries WHERE id = ?").run(id);
  res.json({ ok: true });
});
