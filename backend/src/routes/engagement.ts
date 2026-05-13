import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db/schema.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_SECRET && req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const engagementRouter = Router();

// ── Bot analytics ────────────────────────────────────────────────────
// Единственная живая ручка из «engagement» — даёт админ-дашборду цифры
// DAU/WAU/MAU и сводку по заказам. Дропы, подписки на категории,
// cart-abandonment-cron и together-recommendations были вырезаны вместе
// с самим продуктовым флоу (бонусы/промо/дропы → выпилены).
// Таблицы (drops, category_subscriptions, cart_reminders) остаются в
// схеме, чтобы не терять историю если когда-то понадобится.

engagementRouter.get("/analytics", requireAdmin, (_req, res) => {
  const dau = db
    .prepare(
      "SELECT COUNT(DISTINCT user_id) as c FROM bot_users WHERE last_seen_at >= datetime('now', '-1 day') AND blocked_at IS NULL"
    )
    .get() as { c: number };
  const wau = db
    .prepare(
      "SELECT COUNT(DISTINCT user_id) as c FROM bot_users WHERE last_seen_at >= datetime('now', '-7 days') AND blocked_at IS NULL"
    )
    .get() as { c: number };
  const mau = db
    .prepare(
      "SELECT COUNT(DISTINCT user_id) as c FROM bot_users WHERE last_seen_at >= datetime('now', '-30 days') AND blocked_at IS NULL"
    )
    .get() as { c: number };
  const totalSubscribers = db
    .prepare("SELECT COUNT(*) as c FROM bot_users WHERE blocked_at IS NULL")
    .get() as { c: number };
  const blocked = db
    .prepare("SELECT COUNT(*) as c FROM bot_users WHERE blocked_at IS NOT NULL")
    .get() as { c: number };
  const ordersToday = db
    .prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')")
    .get() as { c: number };
  const ordersWeek = db
    .prepare("SELECT COUNT(*) as c FROM orders WHERE created_at >= datetime('now', '-7 days')")
    .get() as { c: number };
  const revenueWeek = db
    .prepare(
      "SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE created_at >= datetime('now', '-7 days') AND status = 'completed'"
    )
    .get() as { t: number };
  const cartAbandonRate = (() => {
    const cartUsers = db
      .prepare("SELECT COUNT(DISTINCT user_id) as c FROM cart_items").get() as { c: number };
    const orderUsers = db
      .prepare("SELECT COUNT(DISTINCT user_id) as c FROM orders").get() as { c: number };
    if (!cartUsers.c) return 0;
    return Math.round((1 - Math.min(orderUsers.c, cartUsers.c) / cartUsers.c) * 100);
  })();
  res.json({
    dau: dau.c,
    wau: wau.c,
    mau: mau.c,
    total_subscribers: totalSubscribers.c,
    blocked: blocked.c,
    orders_today: ordersToday.c,
    orders_week: ordersWeek.c,
    revenue_week: revenueWeek.t,
    cart_abandon_rate: cartAbandonRate,
  });
});
