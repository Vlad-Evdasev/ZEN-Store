import { Router } from "express";
import { db } from "../db/schema.js";

export const customOrdersRouter = Router();

customOrdersRouter.get("/admin/all", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const rows = db.prepare(
    "SELECT id, user_id, user_name, user_username, user_address, description, size, image_data, created_at FROM custom_orders ORDER BY created_at DESC"
  ).all();
  res.json(rows);
});

customOrdersRouter.post("/", (req, res) => {
  const { user_id, user_name, user_username, user_address, description, size, image_data } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  db.prepare(
    "INSERT INTO custom_orders (user_id, user_name, user_username, user_address, description, size, image_data) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    user_id,
    user_name ?? null,
    user_username ?? null,
    user_address ?? null,
    description || "",
    size || "",
    image_data || null
  );
  res.status(201).json({ ok: true });
});

customOrdersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const rows = db.prepare("SELECT id, description, size, created_at FROM custom_orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  res.json(rows);
});
