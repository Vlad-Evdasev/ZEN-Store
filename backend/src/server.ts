import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products.js";
import { storesRouter } from "./routes/stores.js";
import { cartRouter } from "./routes/cart.js";
import { wishlistRouter } from "./routes/wishlist.js";
import { settingsRouter } from "./routes/settings.js";
import { customOrdersRouter } from "./routes/customOrders.js";
import { ordersRouter } from "./routes/orders.js";
import { reviewsRouter } from "./routes/reviews.js";
import { adminRouter } from "./routes/admin.js";
import { supportRouter } from "./routes/support.js";
import { categoriesRouter } from "./routes/categories.js";
import { siteContentRouter } from "./routes/siteContent.js";
import { postsRouter } from "./routes/posts.js";
import { db } from "./db/schema.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/products", productsRouter);
app.use("/api/stores", storesRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/custom-orders", customOrdersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/site-content", siteContentRouter);
app.use("/api/support", supportRouter);
app.use("/api/posts", postsRouter);

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

export function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 API running at http://localhost:${PORT}`);
  });
}
