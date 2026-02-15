import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Bot(token);

const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-mini-app-url.vercel.app";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID, 10) : null;

if (!ADMIN_CHAT_ID) {
  console.warn("[ZEN] ADMIN_CHAT_ID не задан. Добавь переменную ADMIN_CHAT_ID (твой Telegram ID) в Railway → Variables → Redeploy.");
}

export async function notifyAdminNewOrder(orderId: number, userId: string, userName: string, userPhone: string, total: number, itemsCount: number) {
  if (!ADMIN_CHAT_ID) {
    return;
  }
  const text = [
    `🛒 Новый заказ #${orderId}`,
    `👤 ${userName || "—"}`,
    `📞 ${userPhone || "—"}`,
    `💰 ${total} ₽`,
    `📦 Товаров: ${itemsCount}`,
    ``,
    `Связаться: tg://user?id=${userId}`,
  ].join("\n");
  try {
    await bot.api.sendMessage(ADMIN_CHAT_ID, text);
    console.log("[ZEN] Уведомление о заказе #" + orderId + " отправлено");
  } catch (e: unknown) {
    const msg = String(e);
    console.error("[ZEN] Ошибка отправки уведомления продавцу:", e);
    if (msg.includes("403") || msg.includes("bot was blocked") || msg.includes("user is deactivated")) {
      console.error("[ZEN] Совет: открой бота в Telegram, нажми Start (/start) — бот не может первым написать.");
    }
  }
}

bot.command("start", async (ctx) => {
  await ctx.reply("👕 Добро пожаловать в ZΞN — магазин одежды.", {
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
        [{ text: "🛍 Перейти в ZΞN", web_app: { url: WEB_APP_URL } }],
      ],
    },
  });
});

export function startBot() {
  bot.start();
  console.log("🤖 Bot is running");
}
