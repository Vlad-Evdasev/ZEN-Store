import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Bot(token);

const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-mini-app-url.vercel.app";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID, 10) : null;

export async function notifyAdminNewOrder(orderId: number, userId: string, userName: string, userPhone: string, total: number, itemsCount: number) {
  if (!ADMIN_CHAT_ID) return;
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
  } catch (e) {
    console.error("Failed to notify admin:", e);
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
