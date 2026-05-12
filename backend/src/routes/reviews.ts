import { Router } from "express";
import { db } from "../db/schema.js";

export const reviewsRouter = Router();

reviewsRouter.get("/", (_req, res) => {
  const reviews = db
    .prepare("SELECT * FROM reviews ORDER BY created_at DESC")
    .all() as { id: number; user_id: string; user_name: string; rating: number; text: string; image_urls: string | null; created_at: string }[];
  const comments = db
    .prepare("SELECT * FROM review_comments ORDER BY created_at ASC")
    .all() as { id: number; review_id: number; user_id: string; user_name: string; text: string; image_url: string | null; created_at: string }[];

  const byReview = new Map<number, typeof comments>();
  for (const c of comments) {
    const list = byReview.get(c.review_id) ?? [];
    list.push(c);
    byReview.set(c.review_id, list);
  }
  const result = reviews.map((r) => {
    let images: string[] = [];
    try {
      if (r.image_urls) {
        const parsed = JSON.parse(r.image_urls);
        if (Array.isArray(parsed)) images = parsed.filter((x) => typeof x === "string");
      }
    } catch {}
    return {
      ...r,
      image_urls: images,
      comments: byReview.get(r.id) ?? [],
    };
  });
  res.json(result);
});

reviewsRouter.post("/", (req, res) => {
  const { user_id, user_name, rating, text, image_urls } = req.body;
  if (!user_id || !text) return res.status(400).json({ error: "user_id and text required" });
  const name = user_name || "Гость";
  const r = Number(rating) || 5;
  const finalRating = Math.min(5, Math.max(1, r));
  // image_urls: массив data-URL'ов, валидируем + truncate до 10.
  const images = Array.isArray(image_urls)
    ? image_urls.filter((x: unknown) => typeof x === "string" && x.startsWith("data:image/")).slice(0, 10)
    : [];
  const imagesJson = images.length > 0 ? JSON.stringify(images) : null;

  db.prepare("INSERT INTO reviews (user_id, user_name, rating, text, image_urls) VALUES (?, ?, ?, ?, ?)").run(
    user_id,
    name,
    finalRating,
    String(text),
    imagesJson
  );
  const id = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  res.status(201).json({ id: id.id, ok: true });
});

reviewsRouter.post("/:reviewId/comments", (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  const { user_id, user_name, text, image_url } = req.body;
  const safeText = typeof text === "string" ? text : "";
  const safeImage = typeof image_url === "string" && image_url ? image_url : null;
  if (!user_id || (!safeText.trim() && !safeImage)) {
    return res.status(400).json({ error: "user_id and text or image required" });
  }
  const name = user_name || "Гость";

  db.prepare(
    "INSERT INTO review_comments (review_id, user_id, user_name, text, image_url) VALUES (?, ?, ?, ?, ?)"
  ).run(reviewId, user_id, name, safeText, safeImage);
  const id = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  res.status(201).json({ id: id.id, ok: true });
});
