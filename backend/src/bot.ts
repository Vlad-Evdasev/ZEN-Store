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

function rememberBotUser(userId: string | number): void {
  const id = String(userId);
  try {
    db.prepare(
      "INSERT INTO bot_users (user_id, first_seen_at, last_seen_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP, blocked_at = NULL"
    ).run(id);
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

bot.command("start", async (ctx) => {
  if (ctx.from?.id) rememberBotUser(ctx.from.id);
  await ctx.reply("👕 Добро пожаловать в RAW — магазин одежды.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍 Открыть каталог", web_app: { url: WEB_APP_URL } }],
      ],
    },
  });
});

bot.command("shop", async (ctx) => {
  if (ctx.from?.id) rememberBotUser(ctx.from.id);
  await ctx.reply("Открыть магазин:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍 Перейти в RAW", web_app: { url: WEB_APP_URL } }],
      ],
    },
  });
});

// Любое взаимодействие с ботом — обновляем last_seen.
bot.on("message", async (ctx, next) => {
  if (ctx.from?.id) rememberBotUser(ctx.from.id);
  await next();
});

export function startBot() {
  bot.start();
  console.log("🤖 Bot is running");
}
