import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db/schema.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_SECRET && req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const categoriesRouter = Router();

export type CategoryRow = { code: string; name: string; sort_order: number };

categoriesRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT code, name, sort_order FROM categories ORDER BY sort_order, code").all() as CategoryRow[];
  res.json(rows);
});

categoriesRouter.post("/", requireAdmin, (req, res) => {
  const { code, name, sort_order } = req.body;
  if (!code || typeof code !== "string" || !name || typeof name !== "string") {
    return res.status(400).json({ error: "Требуются code и name" });
  }
  const slug = code.trim().toLowerCase().replace(/\s+/g, "_");
  if (!slug) return res.status(400).json({ error: "Недопустимый code" });
  const order = typeof sort_order === "number" ? sort_order : 0;
  try {
    db.prepare("INSERT INTO categories (code, name, sort_order) VALUES (?, ?, ?)").run(slug, String(name).trim(), order);
    const row = db.prepare("SELECT code, name, sort_order FROM categories WHERE code = ?").get(slug) as CategoryRow;
    return res.status(201).json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE")) return res.status(409).json({ error: "Категория с таким code уже есть" });
    return res.status(500).json({ error: msg || "Ошибка БД" });
  }
});

categoriesRouter.patch("/:code", requireAdmin, (req, res) => {
  const code = req.params.code;
  const { name, sort_order } = req.body;
  const row = db.prepare("SELECT code, name, sort_order FROM categories WHERE code = ?").get(code) as CategoryRow | undefined;
  if (!row) return res.status(404).json({ error: "Категория не найдена" });
  const newName = name !== undefined ? String(name).trim() : row.name;
  const newOrder = sort_order !== undefined ? Number(sort_order) : row.sort_order;
  db.prepare("UPDATE categories SET name = ?, sort_order = ? WHERE code = ?").run(newName, newOrder, code);
  const updated = db.prepare("SELECT code, name, sort_order FROM categories WHERE code = ?").get(code) as CategoryRow;
  res.json(updated);
});

categoriesRouter.delete("/:code", requireAdmin, (req, res) => {
  const code = req.params.code;
  const row = db.prepare("SELECT code FROM categories WHERE code = ?").get(code);
  if (!row) return res.status(404).json({ error: "Категория не найдена" });
  const used = db.prepare("SELECT COUNT(*) as count FROM products WHERE category = ?").get(code) as { count: number };
  if (used.count > 0) {
    return res.status(400).json({ error: `Нельзя удалить: в категории ${used.count} товаров. Сначала смените категорию у товаров.` });
  }
  db.prepare("DELETE FROM categories WHERE code = ?").run(code);
  res.json({ ok: true });
});
