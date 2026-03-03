import { Router } from "express";
import { db } from "../db/schema.js";

export const customOrdersRouter = Router();

customOrdersRouter.post("/", (req, res) => {
  const { user_id, description, size, image_data } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  db.prepare(
    "INSERT INTO custom_orders (user_id, description, size, image_data) VALUES (?, ?, ?, ?)"
  ).run(user_id, description || "", size || "", image_data || null);
  res.status(201).json({ ok: true });
});

customOrdersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const rows = db.prepare("SELECT id, description, size, created_at FROM custom_orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  res.json(rows);
});
