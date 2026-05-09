import { Bot, InputFile } from "grammy";
import { db } from "./db/schema.js";

type ChannelMediaPhoto = {
  type: "photo";
  media: string | InputFile;
  caption?: string;
  parse_mode?: "HTML";
};

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Bot(token);

const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-mini-app-url.vercel.app";

const MAX_IMAGES = 10;
const SEND_DELAY_MS = 40; // ~25 msg/sec, под лимитами Telegram

function toPhotoSource(src: string): string | InputFile {
  if (!src.startsWith("data:")) return src;
  const m = src.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return src;
  const buffer = Buffer.from(m[1], "base64");
  return new InputFile(buffer, "image.jpg");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isUserBlocked = (msg: string) =>
  /forbidden:/i.test(msg) ||
  /bot was blocked/i.test(msg) ||
  /user is deactivated/i.test(msg) ||
  /chat not found/i.test(msg);

export function rememberBotUser(userId: string | number, name?: string, username?: string): void {
  const id = String(userId);
  try {
    db.prepare(
      "INSERT INTO bot_users (user_id, first_seen_at, last_seen_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP, blocked_at = NULL"
    ).run(id);
    if (name || username) {
      db.prepare(
        "UPDATE bot_users SET name = COALESCE(?, name), username = COALESCE(?, username) WHERE user_id = ?"
      ).run(name ?? null, username ?? null, id);
    }
  } catch {
    // ignore
  }
}

function markBotUserBlocked(userId: string | number): void {
  const id = String(userId);
  try {
    db.prepare(
      "INSERT INTO bot_users (user_id, first_seen_at, last_seen_at, blocked_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET blocked_at = CURRENT_TIMESTAMP"
    ).run(id);
  } catch {
    // ignore
  }
}

// Получаем уникальные user_id, которым стоит разослать пост.
// Источник: bot_users (тапнули /start) ∪ orders ∪ cart_items ∪ wishlist ∪ user_settings.
// Заблокированные через bot_users.blocked_at — исключаются.
export function getBroadcastRecipients(): string[] {
  try {
    const rows = db.prepare(`
      WITH known(user_id) AS (
        SELECT user_id FROM bot_users WHERE blocked_at IS NULL
        UNION
        SELECT user_id FROM orders
        UNION
        SELECT user_id FROM cart_items
        UNION
        SELECT user_id FROM wishlist
        UNION
        SELECT user_id FROM user_settings
      )
      SELECT DISTINCT k.user_id FROM known k
      WHERE k.user_id IS NOT NULL
        AND k.user_id <> ''
        AND k.user_id NOT IN (SELECT user_id FROM bot_users WHERE blocked_at IS NOT NULL)
    `).all() as { user_id: string }[];
    return rows.map((r) => r.user_id).filter(Boolean);
  } catch {
    return [];
  }
}

export type SendResult =
  | { ok: true; messageIds: number[] }
  | { ok: false; error: string; blocked?: boolean };

async function sendOne(target: string | number, text: string, images: string[]): Promise<SendResult> {
  const trimmed = (text || "").trim();
  try {
    if (images.length === 0) {
      const msg = await bot.api.sendMessage(target, trimmed, { parse_mode: "HTML" });
      return { ok: true, messageIds: [msg.message_id] };
    }
    if (images.length === 1) {
      const msg = await bot.api.sendPhoto(target, toPhotoSource(images[0]), {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
      return { ok: true, messageIds: [msg.message_id] };
    }
    const media: ChannelMediaPhoto[] = images.map((src, i) => {
      const item: ChannelMediaPhoto = { type: "photo", media: toPhotoSource(src) };
      if (i === 0 && trimmed) {
        item.caption = trimmed;
        item.parse_mode = "HTML";
      }
      return item;
    });
    const msgs = await bot.api.sendMediaGroup(target, media);
    return { ok: true, messageIds: msgs.map((m) => m.message_id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, blocked: isUserBlocked(msg) };
  }
}

export interface BroadcastRecipientResult {
  user_id: string;
  message_ids: number[];
  error?: string;
}

export interface BroadcastResult {
  recipients: BroadcastRecipientResult[];
  sent_count: number;
  failed_count: number;
}

export async function broadcastToUsers(text: string, imageSources: string[] = []): Promise<BroadcastResult> {
  const trimmed = (text || "").trim();
  const images = imageSources.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, MAX_IMAGES);
  const recipients: BroadcastRecipientResult[] = [];
  let sent = 0;
  let failed = 0;
  const userIds = getBroadcastRecipients();
  for (const userId of userIds) {
    const result = await sendOne(userId, trimmed, images);
    if (result.ok) {
      recipients.push({ user_id: userId, message_ids: result.messageIds });
      sent++;
    } else {
      recipients.push({ user_id: userId, message_ids: [], error: result.error });
      failed++;
      if (result.blocked) markBotUserBlocked(userId);
    }
    await sleep(SEND_DELAY_MS);
  }
  return { recipients, sent_count: sent, failed_count: failed };
}

export async function editBroadcast(
  recipients: BroadcastRecipientResult[],
  text: string,
  hasMedia: boolean
): Promise<{ ok: true; updated: number; failed: number } | { ok: false; error: string }> {
  const trimmed = (text || "").trim();
  if (!hasMedia && !trimmed) return { ok: false, error: "Текст не может быть пустым" };
  let updated = 0;
  let failed = 0;
  for (const r of recipients) {
    const first = r.message_ids[0];
    if (!first) continue;
    try {
      if (hasMedia) {
        await bot.api.editMessageCaption(r.user_id, first, {
          caption: trimmed || undefined,
          parse_mode: "HTML",
        });
      } else {
        await bot.api.editMessageText(r.user_id, first, trimmed, { parse_mode: "HTML" });
      }
      updated++;
    } catch (e) {
      // «message is not modified» / «message to edit not found» — не считаем за фатальную ошибку
      const msg = e instanceof Error ? e.message : String(e);
      if (!/message is not modified|message to edit not found/i.test(msg)) failed++;
    }
    await sleep(SEND_DELAY_MS);
  }
  return { ok: true, updated, failed };
}

export async function deleteBroadcast(
  recipients: BroadcastRecipientResult[]
): Promise<{ ok: true; deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const r of recipients) {
    for (const id of r.message_ids) {
      try {
        await bot.api.deleteMessage(r.user_id, id);
        deleted++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/message to delete not found/i.test(msg)) failed++;
      }
      await sleep(SEND_DELAY_MS);
    }
  }
  return { ok: true, deleted, failed };
}

function fullName(first?: string | null, last?: string | null): string | undefined {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  const out = [a, b].filter(Boolean).join(" ").trim();
  return out || undefined;
}

function saveIncomingMessage(userId: string | number, tgMessageId: number, text: string, imageUrl?: string | null): void {
  try {
    db.prepare(
      "INSERT INTO bot_messages (user_id, direction, text, tg_message_id, read_by_admin, image_url) VALUES (?, 'in', ?, ?, 0, ?)"
    ).run(String(userId), text || null, tgMessageId, imageUrl ?? null);
  } catch {
    // ignore
  }
}

function saveOutgoingMessage(userId: string | number, tgMessageId: number, text: string, imageUrl?: string | null): void {
  try {
    db.prepare(
      "INSERT INTO bot_messages (user_id, direction, text, tg_message_id, read_by_admin, image_url) VALUES (?, 'out', ?, ?, 1, ?)"
    ).run(String(userId), text || null, tgMessageId, imageUrl ?? null);
  } catch {
    // ignore
  }
}

// Скачиваем фото из Telegram и кодируем в data:base64, чтобы сохранить целиком в
// БД и отдать в админку без проксирования через бэкенд (URL Telegram содержит
// токен бота — экспонировать его наружу нельзя).
async function downloadTelegramPhotoAsDataUrl(fileId: string): Promise<string | null> {
  try {
    const file = await bot.api.getFile(fileId);
    if (!file.file_path) return null;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = file.file_path.split(".").pop()?.toLowerCase() || "jpg";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// Отправка сообщения пользователю от имени бота. Поддерживает либо текст, либо
// текст+фото — для photo-only ответа достаточно imageUrl.
export async function replyAsBot(
  userId: string | number,
  text: string,
  imageUrl?: string | null
): Promise<{ ok: true; messageId: number; imageUrl: string | null } | { ok: false; error: string }> {
  const trimmed = (text || "").trim();
  const photo = imageUrl?.trim() || null;
  if (!trimmed && !photo) return { ok: false, error: "Пустой ответ" };
  try {
    if (photo) {
      const msg = await bot.api.sendPhoto(userId, toPhotoSource(photo), {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
      saveOutgoingMessage(userId, msg.message_id, trimmed, photo);
      return { ok: true, messageId: msg.message_id, imageUrl: photo };
    }
    const msg = await bot.api.sendMessage(userId, trimmed, { parse_mode: "HTML" });
    saveOutgoingMessage(userId, msg.message_id, trimmed, null);
    return { ok: true, messageId: msg.message_id, imageUrl: null };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
    return { ok: false, error: err };
  }
}

// ── Bot lifecycle ──────────────────────────────────────────────────────────

// Глобальный middleware: любой апдейт от любого юзера → запоминаем.
// Так подтянутся даже те, кто давно начал чат с ботом и не открывал /start
// после миграции — лишь бы написал хоть что-то.
bot.use(async (ctx, next) => {
  if (ctx.from?.id) {
    rememberBotUser(ctx.from.id, fullName(ctx.from.first_name, ctx.from.last_name), ctx.from.username);
  }
  await next();
});

bot.command("start", async (ctx) => {
  await ctx.reply("👕 Добро пожаловать в RAW — магазин одежды.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍 Открыть каталог", web_app: { url: WEB_APP_URL } }],
      ],
    },
  });
});

bot.command("shop", async (ctx) => {
  await ctx.reply("Открыть магазин:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍 Перейти в RAW", web_app: { url: WEB_APP_URL } }],
      ],
    },
  });
});

// Любое НЕ-командное текстовое сообщение от пользователя — ловим в админ-чат.
// Команды (/start, /shop) идут отдельными хендлерами выше и не сохраняются как
// диалог, чтобы не засорять список чатов.
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (!text || text.startsWith("/")) return;
  if (ctx.from?.id) saveIncomingMessage(ctx.from.id, ctx.message.message_id, text);
});

// Фото от пользователя — скачиваем самое большое и сохраняем как data:URL.
// Caption (если был) идёт текстом сообщения.
bot.on("message:photo", async (ctx) => {
  if (!ctx.from?.id) return;
  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];
  if (!largest) return;
  const imageUrl = await downloadTelegramPhotoAsDataUrl(largest.file_id);
  const caption = ctx.message.caption ?? "";
  saveIncomingMessage(ctx.from.id, ctx.message.message_id, caption, imageUrl);
});

export function startBot() {
  bot.start();
  console.log("🤖 Bot is running");
}
