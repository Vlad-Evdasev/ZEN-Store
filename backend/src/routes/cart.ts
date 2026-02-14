import { Router } from "express";
import { db } from "../db/schema.js";
import type { CartItem, Product } from "../types.js";

export const cartRouter = Router();

cartRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const items = db
    .prepare(
      `SELECT ci.*, p.name, p.description, p.price, p.image_url, p.category, p.sizes
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`
    )
    .all(userId) as (CartItem & Product)[];
  res.json(items);
});

cartRouter.post("/:userId", (req, res) => {
  const { userId } = req.params;
  const { product_id, size, quantity = 1 } = req.body;
  if (!product_id || !size) return res.status(400).json({ error: "product_id and size required" });

  db.prepare(
    "INSERT INTO cart_items (user_id, product_id, size, quantity) VALUES (?, ?, ?, ?)"
  ).run(userId, product_id, size, quantity);
  res.status(201).json({ ok: true });
});

cartRouter.delete("/:userId/:itemId", (req, res) => {
  const { userId, itemId } = req.params;
  const result = db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?").run(itemId, userId);
  if (result.changes === 0) return res.status(404).json({ error: "Item not found" });
  res.json({ ok: true });
});
