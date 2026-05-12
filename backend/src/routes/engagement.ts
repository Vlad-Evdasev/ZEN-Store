import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db/schema.js";
import { notifyCartAbandonment, notifyDrop } from "../bot.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_SECRET && req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const engagementRouter = Router();

// ── Category subscriptions ───────────────────────────────────────────

engagementRouter.get("/subscriptions/:userId", (req, res) => {
  const rows = db
    .prepare("SELECT category_code FROM category_subscriptions WHERE user_id = ?")
    .all(req.params.userId) as { category_code: string }[];
  res.json(rows.map((r) => r.category_code));
});

engagementRouter.post("/subscriptions/:userId", (req, res) => {
  const userId = req.params.userId;
  const code = String(req.body?.category_code ?? "").trim();
  if (!code) return res.status(400).json({ error: "category_code required" });
  try {
    db.prepare(
      "INSERT INTO category_subscriptions (user_id, category_code) VALUES (?, ?) ON CONFLICT DO NOTHING"
    ).run(userId, code);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Database error" });
  }
});

engagementRouter.delete("/subscriptions/:userId/:code", (req, res) => {
  db.prepare(
    "DELETE FROM category_subscriptions WHERE user_id = ? AND category_code = ?"
  ).run(req.params.userId, req.params.code);
  res.json({ ok: true });
});

// ── Drops (admin-managed) ────────────────────────────────────────────

engagementRouter.get("/drops", (_req, res) => {
  const rows = db
    .prepare(
      "SELECT id, title, description, product_ids, drop_at, live_sent_at, created_at FROM drops " +
        "WHERE drop_at >= datetime('now', '-30 days') ORDER BY drop_at ASC"
    )
    .all() as {
    id: number;
    title: string;
    description: string | null;
    product_ids: string;
    drop_at: string;
    live_sent_at: string | null;
    created_at: string;
  }[];
  res.json(
    rows.map((r) => ({
      ...r,
      product_ids: safeJsonArrayInt(r.product_ids),
    }))
  );
});

engagementRouter.post("/drops", requireAdmin, (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "");
  const productIds = Array.isArray(req.body?.product_ids)
    ? req.body.product_ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n))
    : [];
  const dropAt = String(req.body?.drop_at ?? "").trim();
  if (!title || !dropAt) return res.status(400).json({ error: "title и drop_at обязательны" });
  const result = db
    .prepare(
      "INSERT INTO drops (title, description, product_ids, drop_at) VALUES (?, ?, ?, ?)"
    )
    .run(title, description, JSON.stringify(productIds), dropAt);
  res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
});

engagementRouter.delete("/drops/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM drops WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

function safeJsonArrayInt(s: string | null | undefined): number[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

// ── Cart abandonment cron-driver (вызывается из server.ts через setInterval) ─

export async function runCartAbandonmentSweep(): Promise<{ sent: number; skipped: number }> {
  // Берём всех юзеров, у кого есть cart_items старше 24 часов и при этом
  // не было заказа с момента добавления. Не чаще 1 раза в 7 дней на юзера.
  const candidates = db
    .prepare(
      `SELECT user_id, COUNT(*) AS items_count, COALESCE(SUM(price * quantity), 0) AS total
       FROM cart_items
       WHERE datetime(created_at) <= datetime('now', '-24 hours')
       GROUP BY user_id`
    )
    .all() as { user_id: string; items_count: number; total: number }[];
  let sent = 0;
  let skipped = 0;
  for (const c of candidates) {
    const last = db
      .prepare("SELECT last_sent_at FROM cart_reminders WHERE user_id = ?")
      .get(c.user_id) as { last_sent_at: string } | undefined;
    if (last) {
      const diffDays = (Date.now() - new Date(last.last_sent_at).getTime()) / 86400000;
      if (diffDays < 7) {
        skipped++;
        continue;
      }
    }
    // Не пингуем тех, кто уже оформил заказ за последние 24 часа.
    const recentOrder = db
      .prepare(
        "SELECT 1 FROM orders WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-24 hours') LIMIT 1"
      )
      .get(c.user_id);
    if (recentOrder) {
      skipped++;
      continue;
    }
    try {
      await notifyCartAbandonment(c.user_id, c.items_count, Math.round(c.total));
      db.prepare(
        "INSERT INTO cart_reminders (user_id, last_sent_at) VALUES (?, CURRENT_TIMESTAMP) " +
          "ON CONFLICT(user_id) DO UPDATE SET last_sent_at = CURRENT_TIMESTAMP"
      ).run(c.user_id);
      sent++;
    } catch {
      skipped++;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return { sent, skipped };
}

// ── Drop teaser sweep (Phase 4) ──────────────────────────────────────
// При каждом тике проверяем все будущие drops. Если до drop_at осталось
// 24h / 1h / 5min, шлём соответствующий тизер всем подписчикам бота
// (только тем, кто не блокировал бота). Идемпотентность через
// teaser_sent_*_at колонки.

export async function runDropTeaserSweep(): Promise<{ sent: number }> {
  const drops = db
    .prepare(
      "SELECT id, title, description, product_ids, drop_at, teaser_sent_24h_at, teaser_sent_1h_at, teaser_sent_5min_at, live_sent_at " +
        "FROM drops WHERE drop_at >= datetime('now', '-30 minutes')"
    )
    .all() as {
    id: number;
    title: string;
    description: string | null;
    product_ids: string;
    drop_at: string;
    teaser_sent_24h_at: string | null;
    teaser_sent_1h_at: string | null;
    teaser_sent_5min_at: string | null;
    live_sent_at: string | null;
  }[];
  let sent = 0;
  const now = Date.now();
  const recipients = db
    .prepare("SELECT user_id FROM bot_users WHERE blocked_at IS NULL")
    .all() as { user_id: string }[];
  for (const d of drops) {
    const dropTime = new Date(d.drop_at).getTime();
    const diff = dropTime - now;
    let phase: "24h" | "1h" | "5min" | "live" | null = null;
    if (!d.teaser_sent_24h_at && diff <= 24 * 3600_000 && diff > 60 * 60_000) phase = "24h";
    else if (!d.teaser_sent_1h_at && diff <= 60 * 60_000 && diff > 5 * 60_000) phase = "1h";
    else if (!d.teaser_sent_5min_at && diff <= 5 * 60_000 && diff > 0) phase = "5min";
    else if (!d.live_sent_at && diff <= 0 && diff > -30 * 60_000) phase = "live";
    if (!phase) continue;
    for (const r of recipients) {
      try {
        await notifyDrop(r.user_id, d.title, d.description ?? "", phase, dropTime);
        sent++;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    const col =
      phase === "24h" ? "teaser_sent_24h_at" :
      phase === "1h" ? "teaser_sent_1h_at" :
      phase === "5min" ? "teaser_sent_5min_at" :
      "live_sent_at";
    db.prepare(`UPDATE drops SET ${col} = CURRENT_TIMESTAMP WHERE id = ?`).run(d.id);
  }
  return { sent };
}

// ── Customer segments (для targeted broadcasts, Phase 5) ─────────────

export type SegmentKey =
  | "all"
  | "vip"            // 5+ completed orders
  | "loyal"          // 2-4 completed orders
  | "new"            // нет заказов
  | "dormant"        // нет активности 30+ дней
  | "cart_abandoners"; // есть cart_items > 24h без заказа

export function getSegmentRecipients(segment: SegmentKey): string[] {
  const all = db
    .prepare(
      "SELECT user_id FROM bot_users WHERE blocked_at IS NULL"
    )
    .all() as { user_id: string }[];
  if (segment === "all") return all.map((r) => r.user_id);
  const out: string[] = [];
  for (const { user_id } of all) {
    const cnt = db
      .prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'completed'")
      .get(user_id) as { c: number };
    if (segment === "vip" && cnt.c >= 5) out.push(user_id);
    else if (segment === "loyal" && cnt.c >= 2 && cnt.c < 5) out.push(user_id);
    else if (segment === "new" && cnt.c === 0) {
      // Дополнительно: проверяем последнюю активность — пока всё, считаем «новым».
      out.push(user_id);
    } else if (segment === "dormant") {
      const last = db
        .prepare(
          "SELECT MAX(created_at) as last_at FROM orders WHERE user_id = ?"
        )
        .get(user_id) as { last_at: string | null };
      if (!last.last_at) continue;
      const days = (Date.now() - new Date(last.last_at).getTime()) / 86400000;
      if (days >= 30) out.push(user_id);
    } else if (segment === "cart_abandoners") {
      const has = db
        .prepare(
          "SELECT 1 FROM cart_items WHERE user_id = ? AND datetime(created_at) <= datetime('now', '-24 hours') LIMIT 1"
        )
        .get(user_id);
      if (has) out.push(user_id);
    }
  }
  return out;
}

engagementRouter.get("/segments/:key/count", requireAdmin, (req, res) => {
  const key = req.params.key as SegmentKey;
  const ids = getSegmentRecipients(key);
  res.json({ count: ids.length });
});

// ── Frequently bought together (Phase 7) ─────────────────────────────

engagementRouter.get("/together/:productId", (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isFinite(productId)) return res.status(400).json({ error: "Bad productId" });
  // Агрегируем парные продукты из items одного и того же заказа.
  const rows = db.prepare("SELECT items FROM orders").all() as { items: string }[];
  const counts = new Map<number, number>();
  for (const r of rows) {
    let parsed: unknown;
    try {
      parsed = typeof r.items === "string" ? JSON.parse(r.items) : r.items;
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    const ids = new Set<number>();
    for (const it of parsed as { product_id?: number }[]) {
      if (typeof it?.product_id === "number") ids.add(it.product_id);
    }
    if (!ids.has(productId)) continue;
    for (const other of ids) {
      if (other !== productId) counts.set(other, (counts.get(other) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  res.json({ product_ids: top });
});

// ── Bot analytics (Phase 6) ──────────────────────────────────────────

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
