import { Router } from "express";
import { db } from "../db/schema.js";

export const ordersRouter = Router();

ordersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  res.json(orders);
});

ordersRouter.post("/:userId", (req, res) => {
  const { userId } = req.params;
  const { user_name, user_phone, user_address, items, total } = req.body;
  if (!items || total == null) return res.status(400).json({ error: "items and total required" });

  const itemsStr = typeof items === "string" ? items : JSON.stringify(items);
  db.prepare(
    "INSERT INTO orders (user_id, user_name, user_phone, user_address, items, total, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
  ).run(userId, user_name || null, user_phone || null, user_address || null, itemsStr, total);

  // Clear cart after order
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);

  res.status(201).json({ ok: true });
});
