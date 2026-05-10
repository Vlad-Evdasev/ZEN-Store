import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "../db/schema.js";
import { notifyOrderStatusChange, notifyOrderInvoice } from "../bot.js";

const TON_RECEIVE_ADDRESS = process.env.TON_RECEIVE_ADDRESS || "";
const TON_API_TOKEN = process.env.TON_API_TOKEN || "";

// Лёгкий fetcher курса TON/USD — без кеша (вызывается раз при создании
// ордера, не критично). Падаем мягко: возвращаем null, чтобы инвойс всё
// равно ушёл (без TON-кнопки).
async function getTonUsdRateOrNull(): Promise<number | null> {
  try {
    const r = await fetch("https://tonapi.io/v2/rates?tokens=ton&currencies=usd", {
      headers: TON_API_TOKEN ? { Authorization: `Bearer ${TON_API_TOKEN}` } : {},
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { rates?: { TON?: { prices?: { USD?: number } } } };
    const rate = data.rates?.TON?.prices?.USD;
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export const ordersRouter = Router();

ordersRouter.get("/admin/all", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(orders);
});

ordersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  res.json(orders);
});

ordersRouter.post("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { user_name, user_phone, user_username, user_address, items, total, promo_code, points_redeemed } = req.body;
  if (!items || total == null) return res.status(400).json({ error: "items and total required" });

  const itemsStr = typeof items === "string" ? items : JSON.stringify(items);
  const promoStr = typeof promo_code === "string" && promo_code.trim() ? promo_code.trim().toUpperCase() : null;
  const points = Math.max(0, Math.floor(Number(points_redeemed) || 0));

  // Генерим payload для TON-комментария заранее (если адрес настроен).
  // Используется и в БД (payment_payload), и в DM-инвойсе, и для матчинга
  // транзакции при ручной отметке/верификации.
  const payload = TON_RECEIVE_ADDRESS
    ? `RAW-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`
    : null;

  const create = db.transaction(() => {
    // Все ордера через WebApp теперь идут в pending_payment + unpaid.
    // Оплата приходит в боте через ton:// deep-link.
    const result = db.prepare(
      "INSERT INTO orders (user_id, user_name, user_phone, user_username, user_address, items, total, status, promo_code, points_redeemed, payment_method, payment_status, payment_payload) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, 'ton', 'unpaid', ?)"
    ).run(userId, user_name || null, user_phone || null, user_username || null, user_address || null, itemsStr, total, promoStr, points, payload);
    const orderId = Number(result.lastInsertRowid);

    if (promoStr) {
      try {
        db.prepare(
          "INSERT INTO promo_redemptions (code, user_id, order_id) VALUES (?, ?, ?)"
        ).run(promoStr, userId, orderId);
        db.prepare(
          "UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?"
        ).run(promoStr);
      } catch {}
    }

    if (points > 0) {
      const balRow = db.prepare("SELECT balance FROM loyalty_points WHERE user_id = ?").get(userId) as { balance: number } | undefined;
      const balance = balRow?.balance ?? 0;
      const applied = Math.min(balance, points);
      if (applied > 0) {
        db.prepare(
          "UPDATE loyalty_points SET balance = balance - ?, lifetime_spent = lifetime_spent + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
        ).run(applied, applied, userId);
        db.prepare(
          "INSERT INTO loyalty_log (user_id, delta, reason, ref_id) VALUES (?, ?, 'order_redeem', ?)"
        ).run(userId, -applied, orderId);
      }
    }

    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);
    return orderId;
  });

  const orderId = create();
  res.status(201).json({ ok: true, orderId });
  // ВАЖНО: автоматический инвойс БОЛЬШЕ не отправляется при создании
  // ордера. Админ обсуждает детали (доставка, наличие, размер) с
  // клиентом в чате, потом ручным тапом из OrdersTab триггерит
  // POST /admin/order/:id/send-invoice — и тогда юзеру улетает
  // красивая карточка с фото + кнопкой «Оплатить».
});

// ─── Админ: отправить инвойс юзеру вручную ─────────────────────────
ordersRouter.post("/admin/order/:orderId/send-invoice", async (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orderId = parseInt(req.params.orderId, 10);
  const order = db
    .prepare(
      "SELECT id, user_id, items, total, payment_payload, payment_method, payment_status FROM orders WHERE id = ?"
    )
    .get(orderId) as
    | {
        id: number;
        user_id: string;
        items: string;
        total: number;
        payment_payload: string | null;
        payment_method: string | null;
        payment_status: string | null;
      }
    | undefined;
  if (!order) return res.status(404).json({ error: "Order not found" });

  let parsedItems: { name?: string; size?: string; quantity?: number; image_url?: string | null }[] = [];
  try {
    parsedItems = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  } catch {}
  const cleanItems = (Array.isArray(parsedItems) ? parsedItems : []).map((i) => ({
    name: String(i?.name ?? "Товар"),
    size: typeof i?.size === "string" ? i.size : undefined,
    quantity: Number(i?.quantity) || 1,
    image_url: typeof i?.image_url === "string" ? i.image_url : null,
  }));

  // TON-блок собираем только если TON_RECEIVE_ADDRESS настроен и у
  // ордера ton-метод. Иначе шлём без Pay-кнопки (admin в чате
  // сам пришлёт реквизиты).
  let tonInfo: Parameters<typeof notifyOrderInvoice>[4] = null;
  if (TON_RECEIVE_ADDRESS && order.payment_payload && order.payment_method === "ton") {
    const rate = await getTonUsdRateOrNull();
    if (rate) {
      const amountTon = Number(order.total) / rate;
      const amountNano = BigInt(Math.round(amountTon * 1e9)).toString();
      db.prepare(
        "UPDATE orders SET payment_amount_nano = ? WHERE id = ?"
      ).run(amountNano, orderId);
      tonInfo = {
        receiveAddress: TON_RECEIVE_ADDRESS,
        amountNano,
        payload: order.payment_payload,
        amountTon,
        rateUsd: rate,
      };
    }
  }

  try {
    await notifyOrderInvoice(order.user_id, orderId, cleanItems, Number(order.total), tonInfo);
    res.json({ ok: true, ton: !!tonInfo });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Failed to send invoice" });
  }
});

ordersRouter.patch("/order/:orderId/status", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orderId = parseInt(req.params.orderId, 10);
  const { status } = req.body;
  if (!status || !["pending", "in_transit", "delivered", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be pending, in_transit, delivered or completed" });
  }
  const before = db
    .prepare("SELECT user_id, status, total FROM orders WHERE id = ?")
    .get(orderId) as { user_id: string; status: string; total: number } | undefined;
  if (!before) return res.status(404).json({ error: "Order not found" });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found" });
  // Шлём пуш только если статус действительно поменялся
  if (before.status !== status) {
    notifyOrderStatusChange(before.user_id, orderId, status).catch(() => {});
    // Бонусные баллы при completion: 1$ = 1 балл (только один раз)
    if (status === "completed" && before.status !== "completed") {
      grantLoyaltyForOrder(before.user_id, orderId, before.total).catch(() => {});
      grantReferralRewardIfFirst(before.user_id, orderId).catch(() => {});
    }
  }
  res.json({ ok: true });
});

// ── Loyalty ────────────────────────────────────────────────────────────
async function grantLoyaltyForOrder(userId: string, orderId: number, total: number): Promise<void> {
  const points = Math.max(0, Math.floor(Number(total) || 0));
  if (!points) return;
  // Идемпотентность: один заказ — одно начисление
  const exists = db
    .prepare("SELECT 1 FROM loyalty_log WHERE reason = 'order_completed' AND ref_id = ?")
    .get(orderId);
  if (exists) return;
  db.prepare(
    `INSERT INTO loyalty_points (user_id, balance, lifetime_earned)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       balance = balance + excluded.balance,
       lifetime_earned = lifetime_earned + excluded.lifetime_earned,
       updated_at = CURRENT_TIMESTAMP`
  ).run(userId, points, points);
  db.prepare(
    "INSERT INTO loyalty_log (user_id, delta, reason, ref_id) VALUES (?, ?, 'order_completed', ?)"
  ).run(userId, points, orderId);
}

async function grantReferralRewardIfFirst(invitedUserId: string, orderId: number): Promise<void> {
  // Если этот юзер был приведён рефером и это его первый завершённый заказ —
  // обоим начисляем по 10$ = 10 баллов.
  const ref = db
    .prepare(
      "SELECT id, referrer_user_id, reward_granted_at FROM referrals WHERE invited_user_id = ?"
    )
    .get(invitedUserId) as { id: number; referrer_user_id: string; reward_granted_at: string | null } | undefined;
  if (!ref || ref.reward_granted_at) return;
  const reward = 10;
  for (const uid of [ref.referrer_user_id, invitedUserId]) {
    db.prepare(
      `INSERT INTO loyalty_points (user_id, balance, lifetime_earned)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         balance = balance + excluded.balance,
         lifetime_earned = lifetime_earned + excluded.lifetime_earned,
         updated_at = CURRENT_TIMESTAMP`
    ).run(uid, reward, reward);
    db.prepare(
      "INSERT INTO loyalty_log (user_id, delta, reason, ref_id) VALUES (?, ?, 'referral', ?)"
    ).run(uid, reward, ref.id);
  }
  db.prepare(
    "UPDATE referrals SET first_order_id = ?, reward_granted_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(orderId, ref.id);
}

ordersRouter.delete("/order/:orderId", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orderId = parseInt(req.params.orderId, 10);
  const result = db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found" });
  res.json({ ok: true });
});
