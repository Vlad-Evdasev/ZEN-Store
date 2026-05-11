import express from "express";
import cors from "cors";
import compression from "compression";
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
import {
  engagementRouter,
  runCartAbandonmentSweep,
  runDropTeaserSweep,
} from "./routes/engagement.js";
import {
  paymentsRouter,
  runPaymentExpirySweep,
} from "./routes/payments.js";
import { messagesRouter } from "./routes/messages.js";
import { db } from "./db/schema.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: "*", maxAge: 600 })); // CORS preflight кешируется на 10 минут
app.use(compression()); // gzip JSON / text — экономит до 70% трафика на orders/posts/products
app.use(express.json({ limit: "30mb" }));

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

// Cron-задачи: cart-abandonment sweep + drop teasers + apply referral signups.
// Запускаем сразу при старте, потом каждый час. Лёгкий setInterval — не для
// production-cron, но достаточно для одного процесса бэкэнда.
function startCronJobs() {
  const HOUR = 60 * 60 * 1000;
  const tick = async () => {
    try {
      const r = await runCartAbandonmentSweep();
      if (r.sent > 0) console.log(`[cron] cart-abandon sweep: sent=${r.sent}, skipped=${r.skipped}`);
    } catch (e) {
      console.error("[cron] cart-abandon failed:", e);
    }
    try {
      const r = await runDropTeaserSweep();
      if (r.sent > 0) console.log(`[cron] drop-teaser sweep: sent=${r.sent}`);
    } catch (e) {
      console.error("[cron] drop-teaser failed:", e);
    }
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
