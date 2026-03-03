import { Router } from "express";
import { db } from "../db/schema.js";

export const wishlistRouter = Router();

wishlistRouter.get("/:userId", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const { userId } = req.params;
  const rows = db.prepare("SELECT product_id FROM wishlist WHERE user_id = ?").all(userId) as { product_id: number }[];
  res.json(rows.map((r) => r.product_id));
});

wishlistRouter.post("/:userId", (req, res) => {
  const { userId } = req.params;
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: "product_id required" });
  try {
    db.prepare("INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)").run(userId, product_id);
  } catch {
    // ignore duplicate
  }
  res.status(201).json({ ok: true });
});

wishlistRouter.delete("/:userId/:productId", (req, res) => {
  const { userId, productId } = req.params;
  const pid = parseInt(productId, 10);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid product id" });
  db.prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?").run(userId, pid);
  res.json({ ok: true });
});
