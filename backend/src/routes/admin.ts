import { Router } from "express";
import { db } from "../db/schema.js";
import {
  broadcastChannelPost,
  editChannelPost,
  deleteChannelPost,
  republishChannelPost,
  getChannelTargetRaw,
  setChannelTargetRaw,
} from "../bot.js";

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

type ChannelPostRow = {
  id: number;
  message_ids: string;
  text: string | null;
  images_count: number;
  first_image_url: string | null;
  image_urls: string | null;
  created_at: string;
  deleted_at: string | null;
};

function parseJsonArray<T>(raw: string | null | undefined, guard: (x: unknown) => x is T): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function rowToPost(row: ChannelPostRow) {
  return {
    id: row.id,
    message_ids: parseJsonArray<number>(row.message_ids, (x): x is number => typeof x === "number"),
    text: row.text ?? "",
    images_count: row.images_count,
    first_image_url: row.first_image_url,
    image_urls: parseJsonArray<string>(row.image_urls, (x): x is string => typeof x === "string"),
    created_at: row.created_at,
  };
}

function rowToPostPublic(row: ChannelPostRow) {
  // Скрываем base64 data: URL из API: их объём огромен и админу они в превью
  // не нужны (для миниатюры используем first_image_url).
  const post = rowToPost(row);
  const safeImages = post.image_urls.map((u) => (u.startsWith("data:") ? "" : u));
  return { ...post, image_urls: safeImages };
}

// Канал, в который шлём посты. Бот должен быть админом канала.
adminRouter.get("/channel-settings", requireAdmin, (_req, res) => {
  res.json({
    channel_chat_id: getChannelTargetRaw(),
    env_default: process.env.CHANNEL_CHAT_ID || process.env.ADMIN_CHAT_ID || "",
  });
});

adminRouter.patch("/channel-settings", requireAdmin, (req, res) => {
  const value = typeof req.body?.channel_chat_id === "string" ? req.body.channel_chat_id : "";
  setChannelTargetRaw(value);
  res.json({ ok: true, channel_chat_id: getChannelTargetRaw() });
});

// Публикация поста в Telegram-канал. Бот должен быть админом канала; ID канала
// берётся из CHANNEL_CHAT_ID (или ADMIN_CHAT_ID для обратной совместимости).
// Принимает image_urls (массив до 10) или одиночный image_url для совместимости.
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
  const insert = db.prepare(
    "INSERT INTO channel_posts (message_ids, text, images_count, first_image_url, image_urls) VALUES (?, ?, ?, ?, ?)"
  );
  const info = insert.run(
    JSON.stringify(result.messageIds),
    text || null,
    images.length,
    result.firstHttpImage,
    JSON.stringify(images),
  );
  const created = db.prepare("SELECT * FROM channel_posts WHERE id = ?").get(Number(info.lastInsertRowid)) as ChannelPostRow;
  res.json(rowToPostPublic(created));
});

adminRouter.get("/telegram/posts", requireAdmin, (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM channel_posts WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 100")
    .all() as ChannelPostRow[];
  res.json(rows.map(rowToPostPublic));
});

adminRouter.patch("/telegram/posts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT * FROM channel_posts WHERE id = ? AND deleted_at IS NULL").get(id) as ChannelPostRow | undefined;
  if (!row) return res.status(404).json({ error: "Пост не найден" });
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const oldMessageIds = parseJsonArray<number>(row.message_ids, (x): x is number => typeof x === "number");
  const oldImages = parseJsonArray<string>(row.image_urls, (x): x is string => typeof x === "string");

  // Если клиент прислал image_urls — это явное намерение поменять состав фото.
  // Иначе оставляем старые message_id и просто меняем caption/text.
  const incomingImagesRaw: unknown = req.body?.image_urls;
  const imagesProvided = Array.isArray(incomingImagesRaw);
  const newImages: string[] = imagesProvided
    ? (incomingImagesRaw as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : oldImages;

  // Считаем, что фотки совпадают, если массивы идентичны (по строкам, по порядку).
  const sameImages = newImages.length === oldImages.length && newImages.every((u, i) => u === oldImages[i]);

  if (!imagesProvided || sameImages) {
    const result = await editChannelPost(oldMessageIds, row.images_count > 0, text);
    if (!result.ok) return res.status(500).json({ error: result.error });
    db.prepare("UPDATE channel_posts SET text = ? WHERE id = ?").run(text || null, id);
  } else {
    if (!text.trim() && newImages.length === 0) {
      return res.status(400).json({ error: "Нечего публиковать: пустой текст и нет картинки" });
    }
    const result = await republishChannelPost(oldMessageIds, text, newImages);
    if (!result.ok) return res.status(500).json({ error: result.error });
    const firstHttp = newImages.find((s) => /^https?:\/\//i.test(s)) ?? null;
    db.prepare(
      "UPDATE channel_posts SET message_ids = ?, text = ?, images_count = ?, first_image_url = ?, image_urls = ? WHERE id = ?"
    ).run(
      JSON.stringify(result.messageIds),
      text || null,
      newImages.length,
      firstHttp,
      JSON.stringify(newImages),
      id,
    );
  }

  const updated = db.prepare("SELECT * FROM channel_posts WHERE id = ?").get(id) as ChannelPostRow;
  res.json(rowToPostPublic(updated));
});

adminRouter.delete("/telegram/posts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT * FROM channel_posts WHERE id = ? AND deleted_at IS NULL").get(id) as ChannelPostRow | undefined;
  if (!row) return res.status(404).json({ error: "Пост не найден" });
  const messageIds = parseJsonArray<number>(row.message_ids, (x): x is number => typeof x === "number");
  const result = await deleteChannelPost(messageIds);
  if (!result.ok) return res.status(500).json({ error: result.error });
  db.prepare("UPDATE channel_posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.json({ ok: true });
});
