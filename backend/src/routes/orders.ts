import { Router } from "express";
import { db } from "../db/schema.js";
import { notifyAdminNewOrder } from "../bot.js";

export const ordersRouter = Router();

ordersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  res.json(orders);
});

ordersRouter.post("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { user_name, user_phone, user_address, items, total } = req.body;
  if (!items || total == null) return res.status(400).json({ error: "items and total required" });

  const itemsStr = typeof items === "string" ? items : JSON.stringify(items);
  const itemsArr = typeof items === "string" ? JSON.parse(items) : items;
  const itemsCount = Array.isArray(itemsArr) ? itemsArr.reduce((s: number, i: { quantity?: number }) => s + (i.quantity || 1), 0) : 0;

  db.prepare(
    "INSERT INTO orders (user_id, user_name, user_phone, user_address, items, total, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
  ).run(userId, user_name || null, user_phone || null, user_address || null, itemsStr, total);

  const row = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };

  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);

  notifyAdminNewOrder(row.id, userId, user_name || "", user_phone || "", total, itemsCount).catch((err) => {
    console.error("[ZEN] Ошибка отправки уведомления о заказе:", err);
  });

  res.status(201).json({ ok: true, orderId: row.id });
});

ordersRouter.patch("/order/:orderId/status", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orderId = parseInt(req.params.orderId, 10);
  const { status } = req.body;
  if (!status || !["pending", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be pending or completed" });
  }
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found" });
  res.json({ ok: true });
});
