import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "../db/schema.js";
import { notifyOrderStatusChange, notifyOrderInvoice } from "../bot.js";
import { requireOwnership } from "../middleware/telegramAuth.js";

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
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  res.json(orders);
});

ordersRouter.post("/:userId", async (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { user_name, user_phone, user_username, user_address, items, total } = req.body;
  if (!items || total == null) return res.status(400).json({ error: "items and total required" });

  const itemsStr = typeof items === "string" ? items : JSON.stringify(items);

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
      "INSERT INTO orders (user_id, user_name, user_phone, user_username, user_address, items, total, status, payment_method, payment_status, payment_payload) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'ton', 'unpaid', ?)"
    ).run(userId, user_name || null, user_phone || null, user_username || null, user_address || null, itemsStr, total, payload);
    const orderId = Number(result.lastInsertRowid);

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
    .prepare("SELECT user_id, status FROM orders WHERE id = ?")
    .get(orderId) as { user_id: string; status: string } | undefined;
  if (!before) return res.status(404).json({ error: "Order not found" });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found" });
  // Шлём пуш только если статус действительно поменялся
  if (before.status !== status) {
    notifyOrderStatusChange(before.user_id, orderId, status).catch(() => {});
  }
  res.json({ ok: true });
});

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
