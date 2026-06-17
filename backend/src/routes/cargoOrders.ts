import { Router } from "express";
import { db } from "../db/schema.js";
import { requireOwnership } from "../middleware/telegramAuth.js";
import { requireAdmin } from "../middleware/adminGuard.js";
import { LIMITS, trimOrNull, trimText, sanitizeImageUrl } from "../middleware/validators.js";
import { getAppSettingNumber } from "../lib/appSettings.js";
import { getBalanceFen, postEntry, sumDebitsForRef, LedgerError } from "../wallet/ledger.js";

export const cargoOrdersRouter = Router();

const MAX_PRICE_CNY = 1_000_000;
const MAX_WEIGHT_G = 2_000_000;

interface CargoOrder {
  id: number;
  user_id: string;
  source: string;
  product_id: number | null;
  product_url: string | null;
  title: string | null;
  options: string | null;
  quantity: number;
  image_data: string | null;
  price_fen: number | null;
  commission_fen: number | null;
  cargo_fee_fen: number | null;
  weight_g: number | null;
  track_no: string | null;
  status: string;
  admin_note: string | null;
  user_name: string | null;
  user_username: string | null;
  user_phone: string | null;
  user_address: string | null;
  created_at: string;
  updated_at: string;
}

function getOrder(id: number): CargoOrder | undefined {
  return db.prepare("SELECT * FROM cargo_orders WHERE id = ?").get(id) as CargoOrder | undefined;
}

function getHistory(orderId: number) {
  return db
    .prepare("SELECT id, status, note, created_at FROM cargo_order_history WHERE order_id = ? ORDER BY id ASC")
    .all(orderId);
}

/** Updates status and appends a history row. */
function setStatus(orderId: number, status: string, note?: string | null) {
  db.prepare("UPDATE cargo_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, orderId);
  db.prepare("INSERT INTO cargo_order_history (order_id, status, note) VALUES (?, ?, ?)").run(orderId, status, note ?? null);
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) && value.trim().length <= 2048;
}

// ── Админ: список и управление ──────────────────────────────────────────────
cargoOrdersRouter.get("/admin/all", requireAdmin, (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const rows = status
    ? db.prepare("SELECT * FROM cargo_orders WHERE status = ? ORDER BY id DESC").all(status)
    : db.prepare("SELECT * FROM cargo_orders ORDER BY id DESC").all();
  res.json(rows);
});

cargoOrdersRouter.get("/admin/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ ...order, history: getHistory(id) });
});

// Оценка: задаём цену товара, считаем комиссию, переводим в quoted.
cargoOrdersRouter.post("/admin/:id/quote", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!["new", "quoted"].includes(order.status)) {
    return res.status(409).json({ error: "Quote allowed only for new/quoted orders" });
  }

  const priceCny = Number(req.body?.price_cny);
  if (!Number.isInteger(priceCny) || priceCny <= 0 || priceCny > MAX_PRICE_CNY) {
    return res.status(400).json({ error: "invalid price_cny" });
  }
  const priceFen = priceCny * 100;
  const percent = getAppSettingNumber("commission_percent", 2);
  const commissionFen = Math.round((priceFen * percent) / 100);

  db.prepare("UPDATE cargo_orders SET price_fen = ?, commission_fen = ?, admin_note = ? WHERE id = ?").run(
    priceFen,
    commissionFen,
    trimOrNull(req.body?.admin_note, LIMITS.ORDER_TEXT),
    id
  );
  setStatus(id, "quoted", `Оценка: ¥${priceCny} + комиссия ${percent}%`);
  res.json({ ...getOrder(id)!, history: getHistory(id) });
});

// Склад: фиксируем вес и стоимость доставки, переводим в at_warehouse.
cargoOrdersRouter.post("/admin/:id/warehouse", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!["paid", "purchasing"].includes(order.status)) {
    return res.status(409).json({ error: "Warehouse step allowed only after payment" });
  }

  const weightG = Number(req.body?.weight_g);
  const cargoFeeCny = Number(req.body?.cargo_fee_cny);
  if (!Number.isInteger(weightG) || weightG <= 0 || weightG > MAX_WEIGHT_G) {
    return res.status(400).json({ error: "invalid weight_g" });
  }
  if (!Number.isInteger(cargoFeeCny) || cargoFeeCny <= 0 || cargoFeeCny > MAX_PRICE_CNY) {
    return res.status(400).json({ error: "invalid cargo_fee_cny" });
  }

  db.prepare("UPDATE cargo_orders SET weight_g = ?, cargo_fee_fen = ? WHERE id = ?").run(
    weightG,
    cargoFeeCny * 100,
    id
  );
  setStatus(id, "at_warehouse", `Вес ${weightG} г · доставка ¥${cargoFeeCny}`);
  res.json({ ...getOrder(id)!, history: getHistory(id) });
});

// Продвижение статуса: purchasing (из paid) и delivered (из shipped).
cargoOrdersRouter.post("/admin/:id/status", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const status = String(req.body?.status || "");
  const allowed: Record<string, string[]> = {
    purchasing: ["paid"],
    delivered: ["shipped"],
  };
  if (!allowed[status]) {
    return res.status(400).json({ error: "status must be purchasing or delivered" });
  }
  if (!allowed[status].includes(order.status)) {
    return res.status(409).json({ error: `cannot move to ${status} from ${order.status}` });
  }

  const trackNo = trimOrNull(req.body?.track_no, 120);
  if (trackNo) db.prepare("UPDATE cargo_orders SET track_no = ? WHERE id = ?").run(trackNo, id);
  setStatus(id, status, trimOrNull(req.body?.note, LIMITS.ORDER_TEXT));
  res.json({ ...getOrder(id)!, history: getHistory(id) });
});

// Отмена админом: возврат всех списаний по заказу.
cargoOrdersRouter.post("/admin/:id/cancel", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (["delivered", "cancelled"].includes(order.status)) {
    return res.status(409).json({ error: `cannot cancel a ${order.status} order` });
  }

  const refundFen = sumDebitsForRef("cargo_order", id);
  if (refundFen > 0) {
    postEntry({
      userId: order.user_id,
      type: "refund",
      amountFen: refundFen,
      refType: "cargo_order",
      refId: id,
      idempotencyKey: `order_refund:${id}`,
      note: `Возврат по заказу #${id}`,
    });
  }
  setStatus(id, "cancelled", trimOrNull(req.body?.note, LIMITS.ORDER_TEXT) || "Отменён оператором");
  res.json({ ...getOrder(id)!, history: getHistory(id), refunded_fen: refundFen });
});

cargoOrdersRouter.delete("/admin/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("DELETE FROM cargo_order_history WHERE order_id = ?").run(id);
  const result = db.prepare("DELETE FROM cargo_orders WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found" });
  res.json({ ok: true });
});

// ── Пользователь: список и детали ───────────────────────────────────────────
cargoOrdersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const rows = db.prepare("SELECT * FROM cargo_orders WHERE user_id = ? ORDER BY id DESC").all(userId);
  res.json(rows);
});

cargoOrdersRouter.get("/:userId/:orderId", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const id = parseInt(req.params.orderId, 10);
  const order = getOrder(id);
  if (!order || order.user_id !== userId) return res.status(404).json({ error: "Order not found" });
  res.json({ ...order, history: getHistory(id) });
});

// ── Пользователь: создать заказ (по ссылке или из каталога) ─────────────────
cargoOrdersRouter.post("/:userId", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const source = req.body?.source === "catalog" ? "catalog" : "link";

  let productId: number | null = null;
  let productUrl: string | null = null;
  let title = trimOrNull(req.body?.title, LIMITS.PRODUCT_NAME);

  if (source === "catalog") {
    productId = Number(req.body?.product_id);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: "product_id required" });
    const product = db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId) as
      | { id: number; name: string }
      | undefined;
    if (!product) return res.status(404).json({ error: "product not found" });
    if (!title) title = product.name;
  } else {
    if (!isHttpUrl(req.body?.product_url)) {
      return res.status(400).json({ error: "valid product_url required" });
    }
    productUrl = String(req.body.product_url).trim();
  }

  const quantity = Number(req.body?.quantity);
  const qty = Number.isInteger(quantity) && quantity > 0 && quantity <= 999 ? quantity : 1;
  const options = trimText(req.body?.options, LIMITS.ORDER_TEXT);
  const imageData = sanitizeImageUrl(req.body?.image_data);

  const info = db
    .prepare(
      `INSERT INTO cargo_orders
         (user_id, source, product_id, product_url, title, options, quantity, image_data,
          user_name, user_username, user_phone, user_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    )
    .run(
      userId,
      source,
      productId,
      productUrl,
      title,
      options || null,
      qty,
      imageData,
      trimOrNull(req.body?.user_name, LIMITS.USER_NAME),
      trimOrNull(req.body?.user_username, LIMITS.USER_NAME),
      trimOrNull(req.body?.user_phone, LIMITS.PHONE),
      trimOrNull(req.body?.user_address, LIMITS.ADDRESS)
    );
  const id = Number(info.lastInsertRowid);
  setStatus(id, "new", "Заявка создана");
  res.status(201).json({ ...getOrder(id)!, history: getHistory(id) });
});

// ── Пользователь: оплата товара с баланса (quoted → paid) ───────────────────
cargoOrdersRouter.post("/:userId/:orderId/pay-goods", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const id = parseInt(req.params.orderId, 10);
  const order = getOrder(id);
  if (!order || order.user_id !== userId) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "quoted") return res.status(409).json({ error: "Order is not awaiting goods payment" });
  if (order.price_fen == null) return res.status(409).json({ error: "Order is not priced yet" });

  const commissionFen = order.commission_fen ?? 0;
  const totalFen = order.price_fen + commissionFen;
  if (getBalanceFen(userId) < totalFen) {
    return res.status(402).json({ error: "insufficient_funds", needed_fen: totalFen, balance_fen: getBalanceFen(userId) });
  }

  try {
    // Идемпотентно: повтор после сбоя не спишет дважды.
    postEntry({
      userId,
      type: "order_payment",
      amountFen: -order.price_fen,
      refType: "cargo_order",
      refId: id,
      idempotencyKey: `order_pay:${id}`,
      note: `Оплата заказа #${id}`,
    });
    if (commissionFen > 0) {
      postEntry({
        userId,
        type: "commission",
        amountFen: -commissionFen,
        refType: "cargo_order",
        refId: id,
        idempotencyKey: `order_commission:${id}`,
        note: `Комиссия по заказу #${id}`,
      });
    }
  } catch (e) {
    if (e instanceof LedgerError) return res.status(400).json({ error: e.message });
    throw e;
  }

  setStatus(id, "paid", "Оплачено с баланса");
  res.json({ ...getOrder(id)!, history: getHistory(id), balance_fen: getBalanceFen(userId) });
});

// ── Пользователь: оплата доставки карго (at_warehouse → shipped) ────────────
cargoOrdersRouter.post("/:userId/:orderId/pay-cargo", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const id = parseInt(req.params.orderId, 10);
  const order = getOrder(id);
  if (!order || order.user_id !== userId) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "at_warehouse") return res.status(409).json({ error: "Order is not awaiting cargo payment" });
  if (order.cargo_fee_fen == null) return res.status(409).json({ error: "Cargo fee is not set yet" });

  if (getBalanceFen(userId) < order.cargo_fee_fen) {
    return res.status(402).json({ error: "insufficient_funds", needed_fen: order.cargo_fee_fen, balance_fen: getBalanceFen(userId) });
  }

  try {
    postEntry({
      userId,
      type: "cargo_fee",
      amountFen: -order.cargo_fee_fen,
      refType: "cargo_order",
      refId: id,
      idempotencyKey: `order_cargo:${id}`,
      note: `Доставка карго по заказу #${id}`,
    });
  } catch (e) {
    if (e instanceof LedgerError) return res.status(400).json({ error: e.message });
    throw e;
  }

  setStatus(id, "shipped", "Доставка оплачена, отправлено");
  res.json({ ...getOrder(id)!, history: getHistory(id), balance_fen: getBalanceFen(userId) });
});

// ── Пользователь: отмена до оплаты (new/quoted) ─────────────────────────────
cargoOrdersRouter.post("/:userId/:orderId/cancel", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const id = parseInt(req.params.orderId, 10);
  const order = getOrder(id);
  if (!order || order.user_id !== userId) return res.status(404).json({ error: "Order not found" });
  if (!["new", "quoted"].includes(order.status)) {
    return res.status(409).json({ error: "Only unpaid orders can be cancelled by the user" });
  }
  setStatus(id, "cancelled", "Отменён покупателем");
  res.json({ ...getOrder(id)!, history: getHistory(id) });
});
