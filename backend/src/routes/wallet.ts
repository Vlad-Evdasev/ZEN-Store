import { Router } from "express";
import { db } from "../db/schema.js";
import { requireOwnership } from "../middleware/telegramAuth.js";
import { requireAdmin } from "../middleware/adminGuard.js";
import { getAppSetting, getAppSettingNumber, setAppSetting } from "../lib/appSettings.js";
import { getProvider } from "../wallet/topupProvider.js";
import { getBalanceFen, listTransactions, postEntry, LedgerError } from "../wallet/ledger.js";

export const walletRouter = Router();

const MAX_TOPUP_USD = 100_000; // $ за одну заявку — потолок против опечаток

interface TopupRow {
  id: number;
  user_id: string;
  amount_fen: number;
  amount_local: number;
  local_currency: string;
  rate: number;
  provider: string;
  provider_ref: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Публичная конфигурация пополнения (курс + минимум) ──────────────────────
walletRouter.get("/config", (_req, res) => {
  res.json({ topup_min_usd: getAppSettingNumber("topup_min_usd", 10) });
});

// ── Админ: заявки на пополнение ─────────────────────────────────────────────
walletRouter.get("/admin/topups", requireAdmin, (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const rows = status
    ? db.prepare("SELECT * FROM topup_requests WHERE status = ? ORDER BY id DESC").all(status)
    : db.prepare("SELECT * FROM topup_requests ORDER BY id DESC").all();
  res.json(rows);
});

walletRouter.post("/admin/topups/:id/confirm", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

  const row = db.prepare("SELECT * FROM topup_requests WHERE id = ?").get(id) as TopupRow | undefined;
  if (!row) return res.status(404).json({ error: "Top-up not found" });
  if (row.status === "completed") {
    return res.json({ ok: true, status: "completed", balance_fen: getBalanceFen(row.user_id) });
  }
  if (row.status === "rejected") {
    return res.status(409).json({ error: "Top-up already rejected" });
  }

  try {
    // Идемпотентность: даже при двойном клике зачисление произойдёт один раз.
    postEntry({
      userId: row.user_id,
      type: "topup",
      amountFen: row.amount_fen,
      refType: "topup_request",
      refId: row.id,
      idempotencyKey: `topup:${row.id}`,
      note: "Пополнение кошелька",
    });
  } catch (e) {
    if (e instanceof LedgerError) return res.status(400).json({ error: e.message });
    throw e;
  }

  db.prepare("UPDATE topup_requests SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.json({ ok: true, status: "completed", balance_fen: getBalanceFen(row.user_id) });
});

walletRouter.post("/admin/topups/:id/reject", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

  const row = db.prepare("SELECT * FROM topup_requests WHERE id = ?").get(id) as TopupRow | undefined;
  if (!row) return res.status(404).json({ error: "Top-up not found" });
  if (row.status === "completed") return res.status(409).json({ error: "Top-up already completed" });

  db.prepare("UPDATE topup_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.json({ ok: true, status: "rejected" });
});

// ── Админ: курс и реквизиты ─────────────────────────────────────────────────
walletRouter.get("/admin/config", requireAdmin, (_req, res) => {
  res.json({
    topup_min_usd: getAppSettingNumber("topup_min_usd", 10),
    topup_pay_to: getAppSetting("topup_pay_to") || "",
    topup_instructions: getAppSetting("topup_instructions") || "",
  });
});

walletRouter.patch("/admin/config", requireAdmin, (req, res) => {
  const { topup_min_usd, topup_pay_to, topup_instructions } = req.body ?? {};

  if (topup_min_usd !== undefined) {
    const m = Number(topup_min_usd);
    if (!Number.isInteger(m) || m < 1 || m > MAX_TOPUP_USD) return res.status(400).json({ error: "invalid topup_min_usd" });
    setAppSetting("topup_min_usd", String(m));
  }
  if (topup_pay_to !== undefined) {
    setAppSetting("topup_pay_to", String(topup_pay_to).slice(0, 500));
  }
  if (topup_instructions !== undefined) {
    setAppSetting("topup_instructions", String(topup_instructions).slice(0, 2000));
  }

  res.json({
    topup_min_usd: getAppSettingNumber("topup_min_usd", 10),
    topup_pay_to: getAppSetting("topup_pay_to") || "",
    topup_instructions: getAppSetting("topup_instructions") || "",
  });
});

// ── Пользователь: баланс + последние проводки ───────────────────────────────
walletRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  res.json({
    balance_fen: getBalanceFen(userId),
    transactions: listTransactions(userId, 50),
  });
});

walletRouter.get("/:userId/transactions", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  res.json(listTransactions(userId, 200));
});

walletRouter.get("/:userId/topups", (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const rows = db
    .prepare("SELECT * FROM topup_requests WHERE user_id = ? ORDER BY id DESC LIMIT 50")
    .all(userId);
  res.json(rows);
});

// ── Пользователь: создать заявку на пополнение ──────────────────────────────
walletRouter.post("/:userId/topups", async (req, res) => {
  const { userId } = req.params;
  const auth = requireOwnership(req, userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const amountUsd = Number(req.body?.amount_usd);
  const minUsd = getAppSettingNumber("topup_min_usd", 10);

  if (!Number.isInteger(amountUsd) || amountUsd < minUsd || amountUsd > MAX_TOPUP_USD) {
    return res.status(400).json({ error: `amount_usd must be an integer between ${minUsd} and ${MAX_TOPUP_USD}` });
  }

  // Деньги в центах USD. amount_local == amount_fen (валюта USD), rate = 1.
  const amountCents = amountUsd * 100;

  const info = db
    .prepare(
      `INSERT INTO topup_requests (user_id, amount_fen, amount_local, local_currency, rate, provider, status)
       VALUES (?, ?, ?, 'USD', 1, 'manual', 'pending')`
    )
    .run(userId, amountCents, amountCents);
  const topupId = Number(info.lastInsertRowid);

  const provider = getProvider("manual");
  const instructions = await provider.createTopup({
    topupId,
    userId,
    amountFen: amountCents,
    amountLocal: amountCents,
    localCurrency: "USD",
  });

  if (instructions.providerRef) {
    db.prepare("UPDATE topup_requests SET provider_ref = ? WHERE id = ?").run(instructions.providerRef, topupId);
  }

  const request = db.prepare("SELECT * FROM topup_requests WHERE id = ?").get(topupId) as TopupRow;
  res.status(201).json({ request, instructions });
});
