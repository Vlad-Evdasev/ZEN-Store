import { Router } from "express";
import { db } from "../db/schema.js";

export const reviewsRouter = Router();

reviewsRouter.get("/", (_req, res) => {
  const reviews = db
    .prepare("SELECT * FROM reviews ORDER BY created_at DESC")
    .all() as { id: number; user_id: string; user_name: string; rating: number; text: string; created_at: string }[];
  const comments = db
    .prepare("SELECT * FROM review_comments ORDER BY created_at ASC")
    .all() as { id: number; review_id: number; user_id: string; user_name: string; text: string; created_at: string }[];

  const byReview = new Map<number, typeof comments>();
  for (const c of comments) {
    const list = byReview.get(c.review_id) ?? [];
    list.push(c);
    byReview.set(c.review_id, list);
  }
  const result = reviews.map((r) => ({ ...r, comments: byReview.get(r.id) ?? [] }));
  res.json(result);
});

reviewsRouter.post("/", (req, res) => {
  const { user_id, user_name, rating, text } = req.body;
  if (!user_id || !text) return res.status(400).json({ error: "user_id and text required" });
  const name = user_name || "Гость";
  const r = Number(rating) || 5;
  const finalRating = Math.min(5, Math.max(1, r));

  db.prepare("INSERT INTO reviews (user_id, user_name, rating, text) VALUES (?, ?, ?, ?)").run(
    user_id,
    name,
    finalRating,
    String(text)
  );
  const id = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  res.status(201).json({ id: id.id, ok: true });
});

reviewsRouter.post("/:reviewId/comments", (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  const { user_id, user_name, text } = req.body;
  if (!user_id || !text) return res.status(400).json({ error: "user_id and text required" });
  const name = user_name || "Гость";

  db.prepare(
    "INSERT INTO review_comments (review_id, user_id, user_name, text) VALUES (?, ?, ?, ?)"
  ).run(reviewId, user_id, name, String(text));
  const id = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  res.status(201).json({ id: id.id, ok: true });
});
