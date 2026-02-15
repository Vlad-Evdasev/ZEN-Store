import { Router } from "express";
import { db } from "../db/schema.js";
import type { Product } from "../types.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

export const storesRouter = Router();

storesRouter.get("/", (_req, res) => {
  const stores = db.prepare("SELECT * FROM stores ORDER BY id").all();
  res.json(stores);
});

storesRouter.get("/:id/products", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const products = db
    .prepare("SELECT * FROM products WHERE store_id = ? ORDER BY id")
    .all(id) as Product[];
  res.json(products);
});

storesRouter.post("/", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { name, image_url, description } = req.body;
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
  try {
    db.prepare("INSERT INTO stores (name, image_url, description) VALUES (?, ?, ?)").run(
      name.trim(),
      image_url?.trim() || null,
      description?.trim() || null
    );
    const row = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
    return res.status(201).json({ id: row.id, ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: msg });
  }
});

storesRouter.patch("/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT id FROM stores WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Store not found" });
  const { name, image_url, description } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];
  if (name != null) { updates.push("name = ?"); values.push(String(name).trim()); }
  if (image_url != null) { updates.push("image_url = ?"); values.push(image_url?.trim() || null); }
  if (description != null) { updates.push("description = ?"); values.push(description?.trim() || null); }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(id);
  try {
    db.prepare(`UPDATE stores SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: msg });
  }
});

storesRouter.delete("/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const firstStore = db.prepare("SELECT id FROM stores WHERE id != ? ORDER BY id LIMIT 1").get(id) as { id: number } | undefined;
  const fallbackId = firstStore?.id ?? 1;
  db.prepare("UPDATE products SET store_id = ? WHERE store_id = ?").run(fallbackId, id);
  const result = db.prepare("DELETE FROM stores WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Store not found" });
  return res.json({ ok: true });
});
