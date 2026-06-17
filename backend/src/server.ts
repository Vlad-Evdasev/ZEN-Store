import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { productsRouter } from "./routes/products.js";
import { storesRouter } from "./routes/stores.js";
import { cartRouter } from "./routes/cart.js";
import { wishlistRouter } from "./routes/wishlist.js";
import { settingsRouter } from "./routes/settings.js";
import { maintenanceRouter } from "./routes/maintenance.js";
import { customOrdersRouter } from "./routes/customOrders.js";
import { ordersRouter } from "./routes/orders.js";
import { reviewsRouter } from "./routes/reviews.js";
import { adminRouter, usersHeartbeatRouter, runCurrencyRateAutoRefresh } from "./routes/admin.js";
import { categoriesRouter } from "./routes/categories.js";
import { postsRouter } from "./routes/posts.js";
import { supportRouter } from "./routes/support.js";
import { engagementRouter } from "./routes/engagement.js";
import {
  paymentsRouter,
  runPaymentExpirySweep,
} from "./routes/payments.js";
import { messagesRouter } from "./routes/messages.js";
import { walletRouter } from "./routes/wallet.js";
import { cargoOrdersRouter } from "./routes/cargoOrders.js";
import { db } from "./db/schema.js";
import { attachTelegramUser } from "./middleware/telegramAuth.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: "*", maxAge: 600 })); // CORS preflight кешируется на 10 минут
app.use(compression()); // gzip JSON / text — экономит до 70% трафика на orders/posts/products
// JSON body limit: 8 MB. Раньше было 30 MB — это позволяло слать
// 30-мегабайтные запросы по одному в секунду и съесть всю память
// контейнера на Railway. Клиент даунскейлит фотки до ~400КБ; альбом
// из 10 фоток помещается в 8 МБ с большим запасом.
app.use(express.json({ limit: "8mb" }));
app.use(attachTelegramUser); // populate req.tgUserId если есть валидный X-Telegram-Init-Data

// Brute-force защита логина в админку. /api/admin/verify раньше можно
// было долбить без ограничений — для коротких паролей это означало
// возможность подобрать ADMIN_SECRET. 8 попыток в минуту на IP — даёт
// человеку «опечататься», но убивает скрипты-перебиратели.
const adminVerifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток. Попробуй через минуту." },
});
app.use("/api/admin/verify", adminVerifyLimiter);

app.use("/api/products", productsRouter);
app.use("/api/stores", storesRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/custom-orders", customOrdersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersHeartbeatRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/posts", postsRouter);
app.use("/api/support", supportRouter);
app.use("/api/engagement", engagementRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/cargo-orders", cargoOrdersRouter);

app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    return res.json({ ok: true, db: "ok" });
  } catch (e) {
    return res.status(503).json({ ok: false, db: "error", error: e instanceof Error ? e.message : "Database unavailable" });
  }
});

// Централизованная обработка ошибок (необработанные исключения в маршрутах)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
});

// Cron-задачи: payment expiry + currency rate refresh.
// Лёгкий setInterval — не для production-cron, но достаточно для
// одного процесса бэкэнда.
function startCronJobs() {
  const HOUR = 60 * 60 * 1000;
  const tick = async () => {
    try {
      runPaymentExpirySweep();
    } catch (e) {
      console.error("[cron] payment-expiry failed:", e);
    }
    try {
      const r = await runCurrencyRateAutoRefresh();
      if (r.refreshed) console.log(`[cron] currency rate refreshed from NBRB: ${r.rate}`);
    } catch (e) {
      console.error("[cron] currency-rate refresh failed:", e);
    }
  };
  // Прогон при старте — но через 30 секунд после, чтобы дождаться готовности БД.
  setTimeout(tick, 30_000);
  setInterval(tick, HOUR);
}

export function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 API running at http://localhost:${PORT}`);
  });
  startCronJobs();
}
