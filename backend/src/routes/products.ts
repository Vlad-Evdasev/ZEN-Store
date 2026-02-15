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

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

productsRouter.post("/", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { store_id, name, description, price, image_url, category, sizes } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "name and price required" });
  const sid = store_id ?? 1;
  const cat = category || "tee";
  const sz = sizes || "S,M,L,XL";
  db.prepare(
    "INSERT INTO products (store_id, name, description, price, image_url, category, sizes) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(sid, name, description ?? "", Number(price), image_url ?? null, cat, sz);
  const row = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  res.status(201).json({ id: row.id, ok: true });
});
