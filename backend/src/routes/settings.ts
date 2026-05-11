import { Router } from "express";
import { db } from "../db/schema.js";

export const settingsRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const isAdmin = (req: import("express").Request): boolean => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  return !ADMIN_SECRET || secret === ADMIN_SECRET;
};

settingsRouter.get("/currency-rate", (_req, res) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("currency_rate_byn") as { value: string } | undefined;
  const rate = row ? parseFloat(row.value) : 3.2;
  res.json({ rate: Number.isFinite(rate) ? rate : 3.2 });
});

// Public: контакт админа (handle без '@') — для CustomOrderPage и пр.
settingsRouter.get("/admin-handle", (_req, res) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("admin_tg_handle") as { value: string } | undefined;
  res.json({ handle: (row?.value || "krot_eno").replace(/^@/, "") });
});

// Admin: задать новый handle.
settingsRouter.patch("/admin-handle", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const raw = String(req.body?.handle ?? "").trim().replace(/^@/, "");
  if (!raw || !/^[A-Za-z0-9_]{3,32}$/.test(raw)) {
    return res.status(400).json({ error: "handle must be 3–32 chars: latin / digits / underscore" });
  }
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES ('admin_tg_handle', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(raw);
  res.json({ ok: true, handle: raw });
});

settingsRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const row = db.prepare("SELECT lang, theme, currency FROM user_settings WHERE user_id = ?").get(userId) as
    | { lang: string; theme: string; currency: string }
    | undefined;
  if (!row) return res.json(null);
  // Дефолт темы — dark. Фронт стартует на dark; если бэк возвращал
  // "light", при синхронизации он перетирал локальный dark и юзер
  // на первом входе получал светлую тему.
  res.json({ lang: row.lang || "ru", theme: row.theme || "dark", currency: row.currency || "USD" });
});

settingsRouter.patch("/:userId", (req, res) => {
  const { userId } = req.params;
  const { lang, theme, currency } = req.body;
  db.prepare(
    `INSERT INTO user_settings (user_id, lang, theme, currency, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET lang=?, theme=?, currency=?, updated_at=CURRENT_TIMESTAMP`
  ).run(
    userId,
    lang ?? "ru",
    theme ?? "dark",
    currency ?? "USD",
    lang ?? "ru",
    theme ?? "dark",
    currency ?? "USD"
  );
  res.json({ ok: true });
});
