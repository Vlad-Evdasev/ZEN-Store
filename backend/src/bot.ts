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

// Канал для рассылки постов. Сначала смотрим в app_settings (чтобы админ мог
// сменить канал из UI без редеплоя), потом env CHANNEL_CHAT_ID, потом
// исторический ADMIN_CHAT_ID (раньше использовался для уведомлений о заказах).
const ENV_CHANNEL = process.env.CHANNEL_CHAT_ID || process.env.ADMIN_CHAT_ID || "";

const MAX_IMAGES = 10;

export function getChannelTargetRaw(): string {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'channel_chat_id'").get() as { value: string } | undefined;
    if (row && row.value && row.value.trim()) return row.value.trim();
  } catch {
    // app_settings table may not exist on first boot
  }
  return ENV_CHANNEL;
}

export function setChannelTargetRaw(value: string): void {
  const v = (value || "").trim();
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("channel_chat_id", v);
}

function resolveChannelTarget(): string | number | null {
  const raw = getChannelTargetRaw();
  if (!raw) return null;
  if (raw.startsWith("@")) return raw;
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
}

// Telegram Bot API не принимает data:base64 URL в поле photo — это «remote
// file identifier». Если приходит data-URL, декодируем и шлём как InputFile
// (multipart). Обычные http(s) URL пропускаем как есть.
function toPhotoSource(src: string): string | InputFile {
  if (!src.startsWith("data:")) return src;
  const m = src.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return src;
  const buffer = Buffer.from(m[1], "base64");
  return new InputFile(buffer, "image.jpg");
}

export type ChannelPostResult =
  | { ok: true; messageIds: number[]; firstHttpImage: string | null }
  | { ok: false; error: string };

export async function broadcastChannelPost(text: string, imageSources: string[] = []): Promise<ChannelPostResult> {
  const target = resolveChannelTarget();
  if (!target) {
    return { ok: false, error: "CHANNEL_CHAT_ID (или ADMIN_CHAT_ID) не задан в env. Укажи ID канала или @username и сделай бота его админом." };
  }
  const trimmed = (text || "").trim();
  const images = imageSources.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, MAX_IMAGES);
  if (!trimmed && images.length === 0) {
    return { ok: false, error: "Нечего публиковать: пустой текст и нет картинки" };
  }
  const firstHttp = images.find((s) => /^https?:\/\//i.test(s)) ?? null;
  try {
    if (images.length === 0) {
      const msg = await bot.api.sendMessage(target, trimmed, { parse_mode: "HTML" });
      return { ok: true, messageIds: [msg.message_id], firstHttpImage: null };
    }
    if (images.length === 1) {
      const msg = await bot.api.sendPhoto(target, toPhotoSource(images[0]), {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
      return { ok: true, messageIds: [msg.message_id], firstHttpImage: firstHttp };
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
    return { ok: true, messageIds: msgs.map((m) => m.message_id), firstHttpImage: firstHttp };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// Редактирование подписи/текста уже отправленного поста. Для альбома меняем
// caption на ПЕРВОМ message_id (там было caption у sendMediaGroup). Telegram
// разрешает edit в течение 48 часов после отправки.
export async function editChannelPost(messageIds: number[], hasMedia: boolean, text: string): Promise<ChannelPostResult> {
  const target = resolveChannelTarget();
  if (!target) return { ok: false, error: "CHANNEL_CHAT_ID не задан" };
  const first = messageIds[0];
  if (!first) return { ok: false, error: "Нет message_id для редактирования" };
  const trimmed = (text || "").trim();
  try {
    if (hasMedia) {
      await bot.api.editMessageCaption(target, first, {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
    } else {
      if (!trimmed) return { ok: false, error: "Текст не может быть пустым" };
      await bot.api.editMessageText(target, first, trimmed, { parse_mode: "HTML" });
    }
    return { ok: true, messageIds, firstHttpImage: null };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteChannelPost(messageIds: number[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = resolveChannelTarget();
  if (!target) return { ok: false, error: "CHANNEL_CHAT_ID не задан" };
  const errors: string[] = [];
  for (const id of messageIds) {
    try {
      await bot.api.deleteMessage(target, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Telegram возвращает 400 «message to delete not found», если уже удалено
      // — это не ошибка для нас. Остальное копим.
      if (!/message to delete not found/i.test(msg)) errors.push(`#${id}: ${msg}`);
    }
  }
  if (errors.length) return { ok: false, error: errors.join("; ") };
  return { ok: true };
}

// Полный «republish»: удаляем старые сообщения и отправляем заново. Используется,
// когда меняется состав/количество фото — Telegram Bot API не разрешает добавлять
// сообщения в существующий media group, проще пересоздать пост целиком.
// message_ids меняются — сохраним новые в БД на стороне роута.
export async function republishChannelPost(oldMessageIds: number[], text: string, images: string[]): Promise<ChannelPostResult> {
  if (oldMessageIds.length > 0) {
    await deleteChannelPost(oldMessageIds);
  }
  return broadcastChannelPost(text, images);
}

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

export function startBot() {
  bot.start();
  console.log("🤖 Bot is running");
}
