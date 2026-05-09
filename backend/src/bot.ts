import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Bot(token);

const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-mini-app-url.vercel.app";

// Канал для рассылки постов из админки. ID может быть числовым (-100…) или
// @username публичного канала; бот должен быть админом канала.
const CHANNEL_CHAT_ID = process.env.CHANNEL_CHAT_ID || process.env.ADMIN_CHAT_ID || "";

function resolveChannelTarget(): string | number | null {
  const raw = String(CHANNEL_CHAT_ID).trim();
  if (!raw) return null;
  if (raw.startsWith("@")) return raw;
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
}

export type ChannelPostResult = { ok: true; messageId: number } | { ok: false; error: string };

export async function broadcastChannelPost(text: string, imageUrl?: string | null): Promise<ChannelPostResult> {
  const target = resolveChannelTarget();
  if (!target) {
    return { ok: false, error: "CHANNEL_CHAT_ID (или ADMIN_CHAT_ID) не задан в env. Укажи ID канала или @username и сделай бота его админом." };
  }
  const trimmed = (text || "").trim();
  if (!trimmed && !imageUrl) {
    return { ok: false, error: "Нечего публиковать: пустой текст и нет картинки" };
  }
  try {
    if (imageUrl) {
      const msg = await bot.api.sendPhoto(target, imageUrl, {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
      return { ok: true, messageId: msg.message_id };
    }
    const msg = await bot.api.sendMessage(target, trimmed, { parse_mode: "HTML" });
    return { ok: true, messageId: msg.message_id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
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
