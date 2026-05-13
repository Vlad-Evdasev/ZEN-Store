import { Router } from "express";
import { db } from "../db/schema.js";
import type { Product } from "../types.js";

const MAX_IMAGES = 5;
type ProductRow = Product & { images?: string | null };

function toImageUrls(row: ProductRow): string[] {
  if (row.images) {
    try {
      const arr = JSON.parse(row.images) as string[];
      return (Array.isArray(arr) ? arr : []).slice(0, MAX_IMAGES).filter(Boolean);
    } catch {
      //
    }
  }
  return row.image_url ? [row.image_url] : [];
}

function toProduct(row: ProductRow) {
  const { images: _im, ...rest } = row;
  return { ...rest, image_urls: toImageUrls(row) };
}

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY id").all() as ProductRow[];
  res.json(rows.map(toProduct));
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
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  if (!row) return res.status(404).json({ error: "Product not found" });
  res.json(toProduct(row));
});

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

productsRouter.post("/", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized. Проверь ADMIN_SECRET и заголовок X-Admin-Secret." });
  }
  const { store_id, name, description, price, image_url, image_urls, category, sizes, brand } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "Требуются name и price" });
  const sid = store_id ?? 1;
  const cat = category || "tee";
  const sz = sizes || "S,M,L,XL";
  const brandVal = typeof brand === "string" ? (brand.trim() || null) : null;
  const urls = Array.isArray(image_urls) ? image_urls.slice(0, MAX_IMAGES).filter(Boolean) : (image_url ? [image_url] : []);
  const firstUrl = urls[0] ?? image_url ?? null;
  const imagesJson = urls.length > 0 ? JSON.stringify(urls) : null;
  try {
    db.prepare(
      "INSERT INTO products (store_id, name, description, price, image_url, images, category, sizes, brand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(sid, name, description ?? "", Number(price), firstUrl, imagesJson, cat, sz, brandVal);
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
  const { store_id, name, description, price, image_url, image_urls, category, sizes, brand } = req.body;
  const row = db.prepare("SELECT id FROM products WHERE id = ?").get(id) as { id: number } | undefined;
  if (!row) return res.status(404).json({ error: "Product not found" });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (store_id != null) { updates.push("store_id = ?"); values.push(store_id); }
  if (name != null) { updates.push("name = ?"); values.push(name); }
  if (description != null) { updates.push("description = ?"); values.push(description); }
  if (price != null) { updates.push("price = ?"); values.push(Number(price)); }
  if (brand !== undefined) {
    updates.push("brand = ?");
    values.push(typeof brand === "string" && brand.trim() ? brand.trim() : null);
  }
  if (image_urls !== undefined) {
    const urls = Array.isArray(image_urls) ? image_urls.slice(0, MAX_IMAGES).filter(Boolean) : [];
    const firstUrl = urls[0] ?? null;
    updates.push("image_url = ?"); values.push(firstUrl);
    updates.push("images = ?"); values.push(urls.length > 0 ? JSON.stringify(urls) : null);
  } else if (image_url != null) {
    updates.push("image_url = ?"); values.push(image_url);
  }
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
  // Перед удалением товара чистим все связанные записи, иначе SQLite роняет
  // FK-проверку у юзеров, которые когда-то добавляли товар в корзину/избранное
  // или оставляли по нему отзыв. Делаем атомарно в транзакции.
  const cascadeDelete = db.transaction((productId: number) => {
    db.prepare("DELETE FROM cart_items WHERE product_id = ?").run(productId);
    db.prepare("DELETE FROM wishlist WHERE product_id = ?").run(productId);
    db.prepare("DELETE FROM product_reviews WHERE product_id = ?").run(productId);
    // posts.product_id хранит привязку к товару, без FK — разрываем ссылку,
    // чтобы старые посты остались, но больше не указывали на удалённый товар.
    db.prepare("UPDATE posts SET product_id = NULL WHERE product_id = ?").run(productId);
    return db.prepare("DELETE FROM products WHERE id = ?").run(productId);
  });
  try {
    const result = cascadeDelete(id);
    if (result.changes === 0) return res.status(404).json({ error: "Product not found" });
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: `Ошибка БД: ${msg}` });
  }
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
