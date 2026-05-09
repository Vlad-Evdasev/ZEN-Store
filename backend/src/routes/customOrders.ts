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
    "SELECT id, user_id, user_name, user_username, user_address, description, size, image_data, COALESCE(status, 'pending') as status, created_at FROM custom_orders ORDER BY created_at DESC"
  ).all();
  res.json(rows);
});

customOrdersRouter.patch("/admin/order/:id/status", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (!status || !["review", "pending", "in_transit", "delivered", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be review, pending, in_transit, delivered or completed" });
  }
  const result = db.prepare("UPDATE custom_orders SET status = ? WHERE id = ?").run(status, id);
  if (result.changes === 0) return res.status(404).json({ error: "Custom order not found" });
  res.json({ ok: true });
});

// Редактирование контента заявки админом — описание/размер/фото.
// Принимает только те поля, которые явно переданы; null затирает.
customOrdersRouter.patch("/admin/order/:id", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const updates: string[] = [];
  const values: unknown[] = [];
  if (req.body.description !== undefined) {
    updates.push("description = ?");
    values.push(typeof req.body.description === "string" ? req.body.description : "");
  }
  if (req.body.size !== undefined) {
    updates.push("size = ?");
    values.push(typeof req.body.size === "string" ? req.body.size : "");
  }
  if (req.body.image_data !== undefined) {
    updates.push("image_data = ?");
    values.push(typeof req.body.image_data === "string" && req.body.image_data ? req.body.image_data : null);
  }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(id);
  const result = db.prepare(`UPDATE custom_orders SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  if (result.changes === 0) return res.status(404).json({ error: "Custom order not found" });
  res.json({ ok: true });
});

customOrdersRouter.delete("/admin/order/:id", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const id = parseInt(req.params.id, 10);
  const result = db.prepare("DELETE FROM custom_orders WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Custom order not found" });
  res.json({ ok: true });
});

customOrdersRouter.post("/", (req, res) => {
  const { user_id, user_name, user_username, user_address, description, size, image_data } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  // Новые заявки идут в статус 'review' — пока админ не одобрит, они не видны
  // у пользователя в истории.
  db.prepare(
    "INSERT INTO custom_orders (user_id, user_name, user_username, user_address, description, size, image_data, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'review')"
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
  // Заявки в статусе 'review' (ожидают подтверждения админа) пользователю не
  // показываем — иначе он увидит их в истории до того, как мы их оформим.
  const rows = db.prepare(
    "SELECT id, description, size, image_data, COALESCE(status, 'pending') as status, created_at FROM custom_orders " +
    "WHERE user_id = ? AND COALESCE(status, 'pending') != 'review' " +
    "ORDER BY created_at DESC"
  ).all(userId);
  res.json(rows);
});
