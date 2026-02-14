import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

const bot = new Bot(token);

const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-mini-app-url.vercel.app";

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
