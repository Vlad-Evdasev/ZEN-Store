import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products.js";
import { storesRouter } from "./routes/stores.js";
import { cartRouter } from "./routes/cart.js";
import { ordersRouter } from "./routes/orders.js";
import { reviewsRouter } from "./routes/reviews.js";
import "./db/schema.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/products", productsRouter);
app.use("/api/stores", storesRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reviews", reviewsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

export function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 API running at http://localhost:${PORT}`);
  });
}
