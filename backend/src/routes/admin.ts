import { Router } from "express";
import { db } from "../db/schema.js";
import { broadcastChannelPost } from "../bot.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: { headers: Record<string, unknown> }, res: { status: (n: number) => { json: (o: object) => void } }, next: () => void) {
  if (!ADMIN_SECRET) {
    next();
    return;
  }
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export const adminRouter = Router();

adminRouter.get("/verify", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!ADMIN_SECRET) {
    return res.json({ ok: true });
  }
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ ok: true });
});

adminRouter.get("/currency-rate", requireAdmin, (_req, res) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("currency_rate_byn") as { value: string } | undefined;
  const rate = row ? parseFloat(row.value) : 3.2;
  res.json({ rate: Number.isFinite(rate) ? rate : 3.2 });
});

adminRouter.patch("/currency-rate", requireAdmin, (req, res) => {
  const rate = typeof req.body.rate === "number" ? req.body.rate : parseFloat(String(req.body.rate));
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1000) {
    return res.status(400).json({ error: "Invalid rate" });
  }
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("currency_rate_byn", String(rate));
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("currency_rate_byn") as { value: string } | undefined;
  const savedRate = row ? parseFloat(row.value) : 3.2;
  res.json({ rate: Number.isFinite(savedRate) ? savedRate : 3.2 });
});

// Публикация поста в Telegram-канал. Бот должен быть админом канала; ID канала
// берётся из CHANNEL_CHAT_ID (или ADMIN_CHAT_ID для обратной совместимости).
// Принимает image_urls (массив до 10) или одиночный image_url для обратной совместимости.
adminRouter.post("/telegram/post", requireAdmin, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const rawImages: unknown = req.body?.image_urls ?? (req.body?.image_url ? [req.body.image_url] : []);
  const images: string[] = Array.isArray(rawImages)
    ? rawImages.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  if (!text.trim() && images.length === 0) {
    return res.status(400).json({ error: "Укажи текст или хотя бы одну картинку" });
  }
  const result = await broadcastChannelPost(text, images);
  if (!result.ok) return res.status(500).json({ error: result.error });
  return res.json({ ok: true, message_id: result.messageId });
});
