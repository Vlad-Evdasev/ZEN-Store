import { Router } from "express";
import { db } from "../db/schema.js";

const SITE_CONTENT_KEYS = [
  "hero_title",
  "hero_subtitle",
  "hero_image_url",
  "about_text",
  "catalog_cta",
  "custom_order_cta",
  "arrived_title",
  "arrived_subtitle",
  "arrived_image_url",
  "catalog_image_url",
  "custom_order_image_url",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

function getContentMap(): Record<string, string> {
  const rows = db.prepare(
    "SELECT key, value FROM site_content WHERE key IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).all(...SITE_CONTENT_KEYS) as { key: string; value: string | null }[];
  const map: Record<string, string> = {};
  for (const k of SITE_CONTENT_KEYS) map[k] = "";
  for (const r of rows) if (r.value != null) map[r.key] = r.value;
  return map;
}

export const siteContentRouter = Router();

siteContentRouter.get("/", (_req, res) => {
  try {
    res.json(getContentMap());
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load site content" });
  }
});
