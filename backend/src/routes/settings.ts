import { Router } from "express";
import { db } from "../db/schema.js";

export const settingsRouter = Router();

settingsRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const row = db.prepare("SELECT lang, theme, currency FROM user_settings WHERE user_id = ?").get(userId) as
    | { lang: string; theme: string; currency: string }
    | undefined;
  if (!row) return res.json(null);
  res.json({ lang: row.lang || "ru", theme: row.theme || "light", currency: row.currency || "USD" });
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
    theme ?? "light",
    currency ?? "USD",
    lang ?? "ru",
    theme ?? "light",
    currency ?? "USD"
  );
  res.json({ ok: true });
});
