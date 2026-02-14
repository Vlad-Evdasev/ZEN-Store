import { Router } from "express";
import { db } from "../db/schema.js";
import type { Product } from "../types.js";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY id").all() as Product[];
  res.json(products);
});

productsRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});
