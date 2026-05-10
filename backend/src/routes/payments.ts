import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "crypto";
import { db } from "../db/schema.js";
import { notifyOrderStatusChange, notifyTonPaymentVerified, notifyPendingTonPayment } from "../bot.js";

// ─── Конфигурация ─────────────────────────────────────────────────────
// TON_RECEIVE_ADDRESS — наш приёмный адрес (raw или EQ-формат).
// TON_API_TOKEN — опциональный токен tonapi.io (без него работает на
// бесплатном лимите ~1 req/sec, для одного магазина хватает).
const TON_RECEIVE_ADDRESS = process.env.TON_RECEIVE_ADDRESS || "";
const TON_API_TOKEN = process.env.TON_API_TOKEN || "";
const TON_API_BASE = "https://tonapi.io/v2";
const INTENT_TTL_MIN = 15; // минут на оплату
const AMOUNT_TOLERANCE = 0.02; // ±2% от ожидаемой суммы
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_SECRET && req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const paymentsRouter = Router();

// Публичный endpoint для preview курса в чекауте.
paymentsRouter.get("/ton/rate", async (req, res) => {
  try {
    const rate = await getTonUsdRate();
    const usd = Number(req.query.usd);
    const ton = Number.isFinite(usd) && usd > 0 ? usd / rate : null;
    res.json({
      rate_usd: rate,
      ton_for_usd: ton,
      receive_address: TON_RECEIVE_ADDRESS || null,
      ttl_min: INTENT_TTL_MIN,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Failed to fetch TON rate" });
  }
});

// ─── Refund баллов / промо при отмене ────────────────────────────────
// Вызывается при auto-cancel (cron expiry sweep) и ручной отмене,
// и admin mark-refunded. Идемпотентно: проверяем флаг refunded_at
// в payment_intents.

function refundOrderArtifacts(orderId: number): void {
  const order = db.prepare(
    "SELECT user_id, promo_code, points_redeemed FROM orders WHERE id = ?"
  ).get(orderId) as { user_id: string; promo_code: string | null; points_redeemed: number } | undefined;
  if (!order) return;

  // Проверяем не возвращали ли уже
  const intent = db.prepare(
    "SELECT id, status FROM payment_intents WHERE order_id = ? ORDER BY id DESC LIMIT 1"
  ).get(orderId) as { id: string; status: string } | undefined;
  if (intent?.status === "refunded") return;

  db.transaction(() => {
    // Возврат баллов
    if (order.points_redeemed > 0) {
      db.prepare(
        `INSERT INTO loyalty_points (user_id, balance, lifetime_spent)
         VALUES (?, ?, 0)
         ON CONFLICT(user_id) DO UPDATE SET
           balance = balance + excluded.balance,
           lifetime_spent = MAX(0, lifetime_spent - excluded.balance),
           updated_at = CURRENT_TIMESTAMP`
      ).run(order.user_id, order.points_redeemed);
      db.prepare(
        "INSERT INTO loyalty_log (user_id, delta, reason, ref_id) VALUES (?, ?, 'order_refund', ?)"
      ).run(order.user_id, order.points_redeemed, orderId);
    }
    // Откат промокода
    if (order.promo_code) {
      db.prepare(
        "DELETE FROM promo_redemptions WHERE order_id = ? AND code = ?"
      ).run(orderId, order.promo_code);
      db.prepare(
        "UPDATE promo_codes SET used_count = MAX(0, used_count - 1) WHERE code = ?"
      ).run(order.promo_code);
    }
    // Помечаем intent как refunded чтобы не возвращать дважды
    if (intent) {
      db.prepare("UPDATE payment_intents SET status = 'refunded' WHERE id = ?").run(intent.id);
    }
  })();
}

// ─── Курс TON/USD ────────────────────────────────────────────────────
// Кеш минимальный (3 секунды) — только чтобы не спамить TonAPI при
// одновременном preview + checkout с одной страницы. Юзер всегда
// видит актуальный курс.
let cachedRate: { rate: number; at: number } | null = null;
const RATE_CACHE_MS = 3_000;

async function getTonUsdRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.at < RATE_CACHE_MS) return cachedRate.rate;
  const res = await fetch(`${TON_API_BASE}/rates?tokens=ton&currencies=usd`, {
    headers: TON_API_TOKEN ? { Authorization: `Bearer ${TON_API_TOKEN}` } : {},
  });
  if (!res.ok) throw new Error(`TON rate fetch failed: ${res.status}`);
  const data = (await res.json()) as { rates?: { TON?: { prices?: { USD?: number } } } };
  const rate = data.rates?.TON?.prices?.USD;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid TON rate from API");
  }
  cachedRate = { rate, at: Date.now() };
  return rate;
}

function usdToNano(usd: number, tonUsdRate: number): bigint {
  // 1 TON = tonUsdRate USD, 1 TON = 1e9 nano. nano = usd / rate * 1e9.
  const ton = usd / tonUsdRate;
  // Округление: используем floor + 9 знаков, потом приводим к BigInt.
  const nanoFloat = ton * 1e9;
  return BigInt(Math.round(nanoFloat));
}

function generatePayload(orderId: number): string {
  // Короткий и читаемый идентификатор: RAW-<orderId>-<6 hex>.
  // Помещается в TON-комментарий (макс ~120 символов), уникальный.
  const rand = randomBytes(3).toString("hex");
  return `RAW-${orderId}-${rand}`;
}

// ─── POST /api/payments/ton/checkout ─────────────────────────────────
// Создаёт ордер + intent. Карта корзины очищается, чтобы юзер не
// смог дважды оформить одно и то же. Если он не оплатит — ордер
// остаётся в payment_status='unpaid', cron очистит через 24h.
paymentsRouter.post("/ton/checkout", async (req, res) => {
  if (!TON_RECEIVE_ADDRESS) {
    return res.status(500).json({ error: "Payment not configured: TON_RECEIVE_ADDRESS missing" });
  }
  const userId = String(req.body?.user_id ?? "").trim();
  const items = req.body?.items;
  const total = Number(req.body?.total);
  const userName = req.body?.user_name ?? null;
  const userPhone = req.body?.user_phone ?? null;
  const userUsername = req.body?.user_username ?? null;
  const userAddress = req.body?.user_address ?? null;
  const promoCode = typeof req.body?.promo_code === "string" && req.body.promo_code.trim() ? req.body.promo_code.trim().toUpperCase() : null;
  const pointsRedeemed = Math.max(0, Math.floor(Number(req.body?.points_redeemed) || 0));
  if (!userId || !items || !Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: "user_id, items, total required" });
  }

  let rate: number;
  try {
    rate = await getTonUsdRate();
  } catch (e) {
    return res.status(502).json({ error: "Не удалось получить курс TON. Попробуй ещё раз." });
  }

  const expectedNano = usdToNano(total, rate);

  const itemsStr = typeof items === "string" ? items : JSON.stringify(items);

  const create = db.transaction(() => {
    const orderRes = db.prepare(
      `INSERT INTO orders (
        user_id, user_name, user_phone, user_username, user_address,
        items, total, status,
        payment_method, payment_status, payment_amount_nano,
        promo_code, points_redeemed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'ton', 'unpaid', ?, ?, ?)`
    ).run(userId, userName, userPhone, userUsername, userAddress, itemsStr, total, expectedNano.toString(), promoCode, pointsRedeemed);
    const orderId = Number(orderRes.lastInsertRowid);

    const payload = generatePayload(orderId);
    const expiresAt = new Date(Date.now() + INTENT_TTL_MIN * 60_000).toISOString();
    db.prepare(
      `INSERT INTO payment_intents (id, order_id, expected_amount_nano, ton_usd_rate, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(payload, orderId, expectedNano.toString(), rate, expiresAt);

    db.prepare("UPDATE orders SET payment_payload = ? WHERE id = ?").run(payload, orderId);
    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);

    // Промо/баллы фиксируем сразу — пусть будет атомарно с ордером.
    // Если оплата не состоится, отдельный sweep ничего не вернёт
    // (баллы остаются на ордере, юзер видит «ты потратил, но не оплатил»);
    // приемлемо для v1, можно докрутить refund в отдельной задаче.
    if (promoCode) {
      try {
        db.prepare(
          "INSERT INTO promo_redemptions (code, user_id, order_id) VALUES (?, ?, ?)"
        ).run(promoCode, userId, orderId);
        db.prepare("UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?").run(promoCode);
      } catch {}
    }
    if (pointsRedeemed > 0) {
      const balRow = db.prepare("SELECT balance FROM loyalty_points WHERE user_id = ?").get(userId) as { balance: number } | undefined;
      const balance = balRow?.balance ?? 0;
      const applied = Math.min(balance, pointsRedeemed);
      if (applied > 0) {
        db.prepare(
          "UPDATE loyalty_points SET balance = balance - ?, lifetime_spent = lifetime_spent + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
        ).run(applied, applied, userId);
        db.prepare(
          "INSERT INTO loyalty_log (user_id, delta, reason, ref_id) VALUES (?, ?, 'order_redeem', ?)"
        ).run(userId, -applied, orderId);
      }
    }

    return { orderId, payload, expiresAt };
  });

  const { orderId, payload, expiresAt } = create();

  res.status(201).json({
    ok: true,
    order_id: orderId,
    payment_intent: {
      id: payload,
      to_address: TON_RECEIVE_ADDRESS,
      amount_nano: expectedNano.toString(),
      amount_ton: Number(expectedNano) / 1e9,
      ton_usd_rate: rate,
      payload,
      expires_at: expiresAt,
    },
  });
});

// ─── GET /api/payments/ton/status/:orderId ───────────────────────────
// Поллим этот endpoint после отправки tx из фронта — пока не вернёт paid.
paymentsRouter.get("/ton/status/:orderId", (req, res) => {
  const id = Number(req.params.orderId);
  const row = db
    .prepare(
      "SELECT id, user_id, status, payment_status, payment_tx_hash, payment_payload FROM orders WHERE id = ?"
    )
    .get(id) as
    | { id: number; user_id: string; status: string; payment_status: string; payment_tx_hash: string | null; payment_payload: string | null }
    | undefined;
  if (!row) return res.status(404).json({ error: "Order not found" });
  res.json({
    payment_status: row.payment_status,
    status: row.status,
    tx_hash: row.payment_tx_hash,
    payload: row.payment_payload,
  });
});

// ─── POST /api/payments/ton/verify/:orderId ──────────────────────────
// После того как юзер подписал транзакцию через TonConnect, фронт
// шлёт сюда. Мы сами идём в TonAPI и проверяем:
// 1) транзакция существует и подтверждена,
// 2) destination = наш адрес,
// 3) сумма >= expected (с tolerance ±2%),
// 4) комментарий = наш payload.
paymentsRouter.post("/ton/verify/:orderId", async (req, res) => {
  const id = Number(req.params.orderId);
  const order = db
    .prepare(
      "SELECT id, user_id, total, status, payment_status, payment_payload, payment_amount_nano FROM orders WHERE id = ?"
    )
    .get(id) as
    | {
        id: number;
        user_id: string;
        total: number;
        status: string;
        payment_status: string;
        payment_payload: string | null;
        payment_amount_nano: string | null;
      }
    | undefined;
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.payment_status === "paid") {
    return res.json({ ok: true, payment_status: "paid", already: true });
  }
  if (!order.payment_payload || !order.payment_amount_nano) {
    return res.status(400).json({ error: "Order has no payment intent" });
  }

  // Поиск транзакции: TonAPI возвращает входящие тхи на наш адрес.
  // Фильтруем по комментарию = payload.
  let found: { hash: string; amount_nano: bigint; comment: string } | null = null;
  try {
    const url = `${TON_API_BASE}/blockchain/accounts/${TON_RECEIVE_ADDRESS}/transactions?limit=50`;
    const r = await fetch(url, {
      headers: TON_API_TOKEN ? { Authorization: `Bearer ${TON_API_TOKEN}` } : {},
    });
    if (!r.ok) {
      return res.status(502).json({ error: `TonAPI error: ${r.status}` });
    }
    type ApiTx = {
      hash: string;
      success: boolean;
      in_msg?: { value?: string | number; decoded_body?: { text?: string }; raw_body?: string };
    };
    const data = (await r.json()) as { transactions?: ApiTx[] };
    const txs = data.transactions ?? [];
    for (const tx of txs) {
      if (!tx.success) continue;
      const comment = tx.in_msg?.decoded_body?.text ?? "";
      if (comment !== order.payment_payload) continue;
      const value = tx.in_msg?.value;
      const amountNano = BigInt(value ?? 0);
      found = { hash: tx.hash, amount_nano: amountNano, comment };
      break;
    }
  } catch (e) {
    return res.status(502).json({ error: "Сеть TON недоступна, попробуй ещё раз." });
  }

  if (!found) {
    return res.status(202).json({ ok: false, payment_status: "unpaid", reason: "Транзакция пока не найдена" });
  }

  const expected = BigInt(order.payment_amount_nano);
  // Допускаем ±2%
  const minAccept = (expected * BigInt(Math.round((1 - AMOUNT_TOLERANCE) * 1000))) / 1000n;
  if (found.amount_nano < minAccept) {
    return res.status(400).json({
      ok: false,
      payment_status: "unpaid",
      reason: "Сумма транзакции меньше ожидаемой",
    });
  }

  // Идемпотентность: проверяем, не помечен ли этот hash уже у другого ордера.
  const dup = db
    .prepare("SELECT id FROM orders WHERE payment_tx_hash = ? AND id != ?")
    .get(found.hash, id) as { id: number } | undefined;
  if (dup) {
    return res.status(409).json({ error: "Этот платёж уже привязан к другому ордеру" });
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE orders SET
         payment_status = 'paid',
         payment_tx_hash = ?,
         payment_verified_at = CURRENT_TIMESTAMP,
         status = 'pending'
       WHERE id = ?`
    ).run(found!.hash, id);
    db.prepare(
      "UPDATE payment_intents SET status = 'confirmed', tx_hash = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(found!.hash, order.payment_payload!);
  })();

  // Уведомляем юзера: пуш с TonScan-ссылкой (с amount), плюс стандартный
  // pending-нотиф «заказ оформлен».
  notifyTonPaymentVerified(order.user_id, id, found.hash, Number(found.amount_nano) / 1e9).catch(() => {});
  notifyOrderStatusChange(order.user_id, id, "pending").catch(() => {});

  res.json({ ok: true, payment_status: "paid", tx_hash: found.hash });
});

// ─── POST /api/payments/ton/cancel/:orderId ──────────────────────────
// Юзер передумал. Помечаем ордер как 'cancelled' (новый статус) и
// удаляем intent. Корзина уже очищена при checkout, восстанавливать
// не будем — слишком сложно. Юзер просто заново соберёт.
paymentsRouter.post("/ton/cancel/:orderId", (req, res) => {
  const id = Number(req.params.orderId);
  const order = db
    .prepare("SELECT id, payment_status, payment_payload FROM orders WHERE id = ?")
    .get(id) as { id: number; payment_status: string; payment_payload: string | null } | undefined;
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.payment_status === "paid") {
    return res.status(400).json({ error: "Оплаченный ордер нельзя отменить через эндпойнт" });
  }
  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'cancelled', payment_status = 'cancelled' WHERE id = ?").run(id);
    if (order.payment_payload) {
      db.prepare("UPDATE payment_intents SET status = 'cancelled' WHERE id = ?").run(order.payment_payload);
    }
  })();
  // Возвращаем потраченные баллы и откатываем промокод
  refundOrderArtifacts(id);
  res.json({ ok: true });
});

// ─── Cron: ─── чистка просроченных intent'ов и unpaid ордеров ────────

// Отдельный sweep: ордера в pending_payment > 1h без напоминания.
// Шлём пуш «оплата висит, проверь» один раз и помечаем reminder_sent_at.
export async function runPendingPaymentReminderSweep(): Promise<{ sent: number }> {
  const candidates = db.prepare(
    `SELECT id, user_id, total, payment_amount_nano FROM orders
     WHERE payment_status = 'unpaid' AND status = 'pending_payment'
     AND payment_reminder_sent_at IS NULL
     AND datetime(created_at) <= datetime('now', '-1 hour')
     AND datetime(created_at) >= datetime('now', '-23 hours')`
  ).all() as { id: number; user_id: string; total: number; payment_amount_nano: string | null }[];
  let sent = 0;
  for (const c of candidates) {
    const amountTon = c.payment_amount_nano ? Number(c.payment_amount_nano) / 1e9 : 0;
    try {
      await notifyPendingTonPayment(c.user_id, c.id, amountTon, c.total);
      db.prepare("UPDATE orders SET payment_reminder_sent_at = CURRENT_TIMESTAMP WHERE id = ?").run(c.id);
      sent++;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  return { sent };
}

export function runPaymentExpirySweep(): void {
  // Помечаем intent'ы старше TTL как expired.
  db.prepare(
    "UPDATE payment_intents SET status = 'expired' WHERE status = 'pending' AND datetime(expires_at) < CURRENT_TIMESTAMP"
  ).run();
  // Находим unpaid ордера старше 24h и возвращаем баллы/промо для каждого,
  // потом отменяем ордер.
  const stale = db.prepare(
    `SELECT id FROM orders
     WHERE payment_status = 'unpaid' AND status = 'pending_payment'
     AND datetime(created_at) < datetime('now', '-24 hours')`
  ).all() as { id: number }[];
  for (const { id } of stale) {
    refundOrderArtifacts(id);
    db.prepare(
      "UPDATE orders SET status = 'cancelled', payment_status = 'cancelled' WHERE id = ?"
    ).run(id);
  }
}

// ─── Admin: вручную пометить оплачено / refund ───────────────────────

paymentsRouter.post("/admin/order/:id/mark-paid", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare(
    `UPDATE orders SET payment_status = 'paid',
       payment_verified_at = COALESCE(payment_verified_at, CURRENT_TIMESTAMP),
       status = CASE WHEN status = 'pending_payment' THEN 'pending' ELSE status END
     WHERE id = ?`
  ).run(id);
  res.json({ ok: true });
});

paymentsRouter.post("/admin/order/:id/mark-refunded", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?").run(id);
  // Возврат баллов / промо при ручном refund (если ещё не делали)
  refundOrderArtifacts(id);
  res.json({ ok: true });
});
