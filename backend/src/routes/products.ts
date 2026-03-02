import { Router } from "express";
import { db } from "../db/schema.js";
import type { Product } from "../types.js";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY id").all() as Product[];
  res.json(products);
});

productsRouter.get("/reviews/stats", (_req, res) => {
  const rows = db
    .prepare("SELECT product_id, COUNT(*) as count, AVG(rating) as avg FROM product_reviews GROUP BY product_id")
    .all() as { product_id: number; count: number; avg: number }[];
  const stats: Record<number, { count: number; avg: number }> = {};
  for (const r of rows) {
    stats[r.product_id] = { count: r.count, avg: Math.round((r.avg || 0) * 10) / 10 };
  }
  res.json(stats);
});

productsRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

productsRouter.post("/", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized. Проверь ADMIN_SECRET и заголовок X-Admin-Secret." });
  }
  const { store_id, name, description, price, image_url, category, sizes } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "Требуются name и price" });
  const sid = store_id ?? 1;
  const cat = category || "tee";
  const sz = sizes || "S,M,L,XL";
  try {
    db.prepare(
      "INSERT INTO products (store_id, name, description, price, image_url, category, sizes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(sid, name, description ?? "", Number(price), image_url ?? null, cat, sz);
    const row = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
    return res.status(201).json({ id: row.id, ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: `Ошибка БД: ${msg}` });
  }
});

productsRouter.patch("/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const { store_id, name, description, price, image_url, category, sizes } = req.body;
  const row = db.prepare("SELECT id FROM products WHERE id = ?").get(id) as { id: number } | undefined;
  if (!row) return res.status(404).json({ error: "Product not found" });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (store_id != null) { updates.push("store_id = ?"); values.push(store_id); }
  if (name != null) { updates.push("name = ?"); values.push(name); }
  if (description != null) { updates.push("description = ?"); values.push(description); }
  if (price != null) { updates.push("price = ?"); values.push(Number(price)); }
  if (image_url != null) { updates.push("image_url = ?"); values.push(image_url); }
  if (category != null) { updates.push("category = ?"); values.push(category); }
  if (sizes != null) { updates.push("sizes = ?"); values.push(sizes); }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(id);
  try {
    db.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: `Ошибка БД: ${msg}` });
  }
});

productsRouter.delete("/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Product not found" });
  return res.json({ ok: true });
});

productsRouter.get("/:id/reviews", (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const reviews = db
    .prepare("SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC")
    .all(productId) as { id: number; product_id: number; user_id: string; user_name: string; rating: number; text: string; created_at: string }[];
  res.json(reviews);
});

productsRouter.post("/:id/reviews", (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { user_id, user_name, rating, text } = req.body;
  if (!user_id || !text) return res.status(400).json({ error: "user_id and text required" });
  const name = user_name || "Гость";
  const r = Number(rating) || 5;
  const finalRating = Math.min(5, Math.max(1, r));

  db.prepare(
    "INSERT INTO product_reviews (product_id, user_id, user_name, rating, text) VALUES (?, ?, ?, ?, ?)"
  ).run(productId, user_id, name, finalRating, String(text));
  const id = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  res.status(201).json({ id: id.id, ok: true });
});
