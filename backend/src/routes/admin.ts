import { Router } from "express";
import { db } from "../db/schema.js";
import {
  broadcastToUsers,
  editBroadcast,
  deleteBroadcast,
  getBroadcastRecipients,
  rememberBotUser,
  replyAsBot,
  type BroadcastRecipientResult,
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

type BroadcastRow = {
  id: number;
  text: string | null;
  image_urls: string | null;
  images_count: number;
  first_image_url: string | null;
  recipients: string;
  sent_count: number;
  failed_count: number;
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

function isRecipientResult(x: unknown): x is BroadcastRecipientResult {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.user_id === "string" && Array.isArray(r.message_ids);
}

function parseRecipients(raw: string | null | undefined): BroadcastRecipientResult[] {
  return parseJsonArray<BroadcastRecipientResult>(raw, isRecipientResult);
}

function rowToBroadcast(row: BroadcastRow) {
  const recipients = parseRecipients(row.recipients);
  const images = parseJsonArray<string>(row.image_urls, (x): x is string => typeof x === "string");
  return {
    id: row.id,
    text: row.text ?? "",
    image_urls: images.map((u) => (u.startsWith("data:") ? "" : u)),
    images_count: row.images_count,
    first_image_url: row.first_image_url,
    recipients_count: recipients.length,
    sent_count: row.sent_count,
    failed_count: row.failed_count,
    created_at: row.created_at,
    // первое успешное message_id для отображения «msg #N»
    sample_message_id: recipients.find((r) => r.message_ids.length > 0)?.message_ids[0] ?? null,
  };
}

adminRouter.get("/broadcast/users-count", requireAdmin, (_req, res) => {
  const ids = getBroadcastRecipients();
  res.json({ count: ids.length });
});

adminRouter.post("/broadcast", requireAdmin, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const rawImages: unknown = req.body?.image_urls ?? (req.body?.image_url ? [req.body.image_url] : []);
  const images: string[] = Array.isArray(rawImages)
    ? rawImages.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  if (!text.trim() && images.length === 0) {
    return res.status(400).json({ error: "Укажи текст или хотя бы одну картинку" });
  }
  const recipients = getBroadcastRecipients();
  if (recipients.length === 0) {
    return res.status(400).json({ error: "Нет ни одного получателя. Подписчики появятся, когда хоть кто-то нажмёт /start у бота или сделает заказ." });
  }
  const result = await broadcastToUsers(text, images);
  const firstHttp = images.find((s) => /^https?:\/\//i.test(s)) ?? null;
  const insert = db.prepare(
    "INSERT INTO broadcasts (text, image_urls, images_count, first_image_url, recipients, sent_count, failed_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const info = insert.run(
    text || null,
    JSON.stringify(images),
    images.length,
    firstHttp,
    JSON.stringify(result.recipients),
    result.sent_count,
    result.failed_count,
  );
  const created = db.prepare("SELECT * FROM broadcasts WHERE id = ?").get(Number(info.lastInsertRowid)) as BroadcastRow;
  res.json(rowToBroadcast(created));
});

adminRouter.get("/broadcasts", requireAdmin, (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM broadcasts WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 100")
    .all() as BroadcastRow[];
  res.json(rows.map(rowToBroadcast));
});

adminRouter.patch("/broadcasts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT * FROM broadcasts WHERE id = ? AND deleted_at IS NULL").get(id) as BroadcastRow | undefined;
  if (!row) return res.status(404).json({ error: "Рассылка не найдена" });
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const oldRecipients = parseRecipients(row.recipients);
  const oldImages = parseJsonArray<string>(row.image_urls, (x): x is string => typeof x === "string");
  const incomingImagesRaw: unknown = req.body?.image_urls;
  const imagesProvided = Array.isArray(incomingImagesRaw);
  const newImages: string[] = imagesProvided
    ? (incomingImagesRaw as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : oldImages;
  const sameImages = newImages.length === oldImages.length && newImages.every((u, i) => u === oldImages[i]);

  if (!imagesProvided || sameImages) {
    const r = await editBroadcast(oldRecipients, text, row.images_count > 0);
    if (!r.ok) return res.status(500).json({ error: r.error });
    db.prepare("UPDATE broadcasts SET text = ? WHERE id = ?").run(text || null, id);
  } else {
    if (!text.trim() && newImages.length === 0) {
      return res.status(400).json({ error: "Нечего публиковать: пустой текст и нет картинки" });
    }
    // Состав фото изменился — нельзя точечно отредактировать альбомы у каждого
    // получателя. Удаляем старые сообщения и шлём заново всем подписчикам.
    await deleteBroadcast(oldRecipients);
    const result = await broadcastToUsers(text, newImages);
    const firstHttp = newImages.find((s) => /^https?:\/\//i.test(s)) ?? null;
    db.prepare(
      "UPDATE broadcasts SET text = ?, image_urls = ?, images_count = ?, first_image_url = ?, recipients = ?, sent_count = ?, failed_count = ? WHERE id = ?"
    ).run(
      text || null,
      JSON.stringify(newImages),
      newImages.length,
      firstHttp,
      JSON.stringify(result.recipients),
      result.sent_count,
      result.failed_count,
      id,
    );
  }

  const updated = db.prepare("SELECT * FROM broadcasts WHERE id = ?").get(id) as BroadcastRow;
  res.json(rowToBroadcast(updated));
});

adminRouter.delete("/broadcasts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare("SELECT * FROM broadcasts WHERE id = ? AND deleted_at IS NULL").get(id) as BroadcastRow | undefined;
  if (!row) return res.status(404).json({ error: "Рассылка не найдена" });
  const recipients = parseRecipients(row.recipients);
  await deleteBroadcast(recipients);
  db.prepare("UPDATE broadcasts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ── Чаты с пользователями ─────────────────────────────────────────────

interface ConversationRow {
  user_id: string;
  name: string | null;
  username: string | null;
  last_text: string | null;
  last_direction: "in" | "out" | null;
  last_has_image: number;
  last_at: string | null;
  unread_count: number;
}

adminRouter.get("/conversations", requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT
      bm.user_id,
      bu.name,
      bu.username,
      (SELECT text FROM bot_messages WHERE user_id = bm.user_id ORDER BY id DESC LIMIT 1) AS last_text,
      (SELECT direction FROM bot_messages WHERE user_id = bm.user_id ORDER BY id DESC LIMIT 1) AS last_direction,
      (SELECT CASE WHEN image_url IS NOT NULL AND image_url <> '' THEN 1 ELSE 0 END FROM bot_messages WHERE user_id = bm.user_id ORDER BY id DESC LIMIT 1) AS last_has_image,
      (SELECT created_at FROM bot_messages WHERE user_id = bm.user_id ORDER BY id DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM bot_messages WHERE user_id = bm.user_id AND direction = 'in' AND read_by_admin = 0) AS unread_count
    FROM bot_messages bm
    LEFT JOIN bot_users bu ON bu.user_id = bm.user_id
    GROUP BY bm.user_id
    ORDER BY MAX(bm.id) DESC
    LIMIT 200
  `).all() as ConversationRow[];
  res.json(rows.map((r) => ({
    user_id: r.user_id,
    name: r.name,
    username: r.username,
    last_text: r.last_text,
    last_direction: r.last_direction,
    last_has_image: !!r.last_has_image,
    last_at: r.last_at,
    unread_count: r.unread_count,
  })));
});

adminRouter.get("/conversations/unread-count", requireAdmin, (_req, res) => {
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM bot_messages WHERE direction = 'in' AND read_by_admin = 0"
  ).get() as { count: number };
  res.json({ count: row.count });
});

interface BotMessageRow {
  id: number;
  user_id: string;
  direction: "in" | "out";
  text: string | null;
  tg_message_id: number | null;
  image_url: string | null;
  created_at: string;
  read_by_admin: number;
}

adminRouter.get("/conversations/:userId/messages", requireAdmin, (req, res) => {
  const userId = String(req.params.userId);
  const rows = db
    .prepare("SELECT * FROM bot_messages WHERE user_id = ? ORDER BY id ASC")
    .all(userId) as BotMessageRow[];
  res.json(rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    direction: r.direction,
    text: r.text ?? "",
    image_url: r.image_url,
    tg_message_id: r.tg_message_id,
    created_at: r.created_at,
  })));
});

adminRouter.post("/conversations/:userId/read", requireAdmin, (req, res) => {
  const userId = String(req.params.userId);
  db.prepare("UPDATE bot_messages SET read_by_admin = 1 WHERE user_id = ? AND direction = 'in'").run(userId);
  res.json({ ok: true });
});

adminRouter.post("/conversations/:userId/reply", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId);
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const imageUrl = typeof req.body?.image_url === "string" && req.body.image_url.trim() ? req.body.image_url.trim() : null;
  if (!text.trim() && !imageUrl) return res.status(400).json({ error: "Пустой ответ" });
  const result = await replyAsBot(userId, text, imageUrl);
  if (!result.ok) return res.status(500).json({ error: result.error });
  res.json({ ok: true, message_id: result.messageId, image_url: result.imageUrl });
});

// Heartbeat от WebApp: при первом открытии мини-аппы регистрируем пользователя
// в bot_users, чтобы он попал в список подписчиков. Без admin-secret — открыто.
const usersHeartbeatRouter = Router();
usersHeartbeatRouter.post("/heartbeat", (req, res) => {
  const userId = req.body?.user_id;
  if (!userId) return res.status(400).json({ error: "user_id required" });
  const name = typeof req.body?.name === "string" ? req.body.name : undefined;
  const username = typeof req.body?.username === "string" ? req.body.username : undefined;
  rememberBotUser(String(userId), name, username);
  res.json({ ok: true });
});
export { usersHeartbeatRouter };
