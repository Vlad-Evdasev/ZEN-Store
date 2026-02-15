import { Router } from "express";
import { db } from "../db/schema.js";
import type { Product } from "../types.js";

export const storesRouter = Router();

storesRouter.get("/", (_req, res) => {
  const stores = db.prepare("SELECT * FROM stores ORDER BY id").all();
  res.json(stores);
});

storesRouter.get("/:id/products", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const products = db
    .prepare("SELECT * FROM products WHERE store_id = ? ORDER BY id")
    .all(id) as Product[];
  res.json(products);
});
