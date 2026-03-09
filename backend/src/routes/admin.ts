import { Router } from "express";
import { db } from "../db/schema.js";

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

const SITE_CONTENT_KEYS = [
  "hero_title", "hero_subtitle", "hero_image_url", "about_text",
  "catalog_cta", "custom_order_cta", "arrived_title", "arrived_subtitle", "arrived_image_url",
  "catalog_image_url", "custom_order_image_url",
] as const;

adminRouter.patch("/site-content", requireAdmin, (req, res) => {
  const body = req.body as Record<string, unknown>;
  const upsert = db.prepare("INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const key of SITE_CONTENT_KEYS) {
    const v = body[key];
    const value = v === undefined || v === null ? "" : String(v).trim();
    upsert.run(key, value);
  }
  const rows = db.prepare("SELECT key, value FROM site_content WHERE key IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").all(...SITE_CONTENT_KEYS) as { key: string; value: string | null }[];
  const map: Record<string, string> = {};
  for (const k of SITE_CONTENT_KEYS) map[k] = "";
  for (const r of rows) if (r.value != null) map[r.key] = r.value;
  res.json(map);
});
