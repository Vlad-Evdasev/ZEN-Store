import { Router } from "express";
import { db } from "../db/schema.js";
import type { Post, PostComment } from "../types.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function checkAdmin(secret: string | undefined): boolean {
  return !ADMIN_SECRET || secret === ADMIN_SECRET;
}

export const postsRouter = Router();

postsRouter.get("/", (req, res) => {
  const userId = req.query.user_id as string | undefined;

  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comments_count
       FROM posts p
       ORDER BY p.created_at DESC`
    )
    .all() as (Post & { likes_count: number; comments_count: number })[];

  if (userId) {
    const likedSet = new Set<number>();
    const liked = db
      .prepare("SELECT post_id FROM post_likes WHERE user_id = ?")
      .all(userId) as { post_id: number }[];
    for (const r of liked) likedSet.add(r.post_id);
    return res.json(rows.map((p) => ({ ...p, user_liked: likedSet.has(p.id) })));
  }

  return res.json(rows);
});

postsRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.query.user_id as string | undefined;

  const row = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comments_count
       FROM posts p
       WHERE p.id = ?`
    )
    .get(id) as (Post & { likes_count: number; comments_count: number }) | undefined;

  if (!row) return res.status(404).json({ error: "Post not found" });

  if (userId) {
    const like = db
      .prepare("SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?")
      .get(id, userId);
    return res.json({ ...row, user_liked: !!like });
  }

  return res.json(row);
});

postsRouter.post("/", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!checkAdmin(secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { caption, image_url, image_data, product_id, product_url } = req.body;

  try {
    const result = db
      .prepare(
        "INSERT INTO posts (caption, image_url, image_data, product_id, product_url) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        caption ?? null,
        image_url ?? null,
        image_data ?? null,
        product_id ?? null,
        product_url ?? null
      );
    return res.status(201).json({ id: result.lastInsertRowid, ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: msg });
  }
});

postsRouter.patch("/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!checkAdmin(secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id, 10);
  const existing = db.prepare("SELECT id FROM posts WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Post not found" });

  const { caption, image_url, image_data, product_id, product_url } = req.body;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (caption !== undefined) { updates.push("caption = ?"); values.push(caption); }
  if (image_url !== undefined) { updates.push("image_url = ?"); values.push(image_url); }
  if (image_data !== undefined) { updates.push("image_data = ?"); values.push(image_data); }
  if (product_id !== undefined) { updates.push("product_id = ?"); values.push(product_id); }
  if (product_url !== undefined) { updates.push("product_url = ?"); values.push(product_url); }

  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

  values.push(id);
  try {
    db.prepare(`UPDATE posts SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: msg });
  }
});

postsRouter.delete("/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!checkAdmin(secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id, 10);
  const existing = db.prepare("SELECT id FROM posts WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Post not found" });

  db.prepare("DELETE FROM post_comments WHERE post_id = ?").run(id);
  db.prepare("DELETE FROM post_likes WHERE post_id = ?").run(id);
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);

  return res.json({ ok: true });
});

postsRouter.post("/:id/like", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  const existing = db.prepare("SELECT id FROM posts WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Post not found" });

  const existingLike = db
    .prepare("SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?")
    .get(id, user_id);

  if (existingLike) {
    db.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?").run(id, user_id);
  } else {
    db.prepare("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)").run(id, user_id);
  }

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?")
    .get(id) as { count: number };

  return res.json({ liked: !existingLike, likes_count: count });
});

postsRouter.delete("/:id/like", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  db.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?").run(id, user_id);

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?")
    .get(id) as { count: number };

  return res.json({ liked: false, likes_count: count });
});

postsRouter.get("/:id/comments", (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const comments = db
    .prepare("SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC")
    .all(postId) as PostComment[];
  return res.json(comments);
});

postsRouter.post("/:id/comments", (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const { user_id, user_name, text } = req.body;
  if (!user_id || !text) return res.status(400).json({ error: "user_id and text required" });

  const existing = db.prepare("SELECT id FROM posts WHERE id = ?").get(postId);
  if (!existing) return res.status(404).json({ error: "Post not found" });

  const name = user_name || null;
  try {
    const result = db
      .prepare(
        "INSERT INTO post_comments (post_id, user_id, user_name, text) VALUES (?, ?, ?, ?)"
      )
      .run(postId, user_id, name, String(text));

    const comment = db
      .prepare("SELECT * FROM post_comments WHERE id = ?")
      .get(result.lastInsertRowid) as PostComment;

    return res.status(201).json(comment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return res.status(500).json({ error: msg });
  }
});

postsRouter.delete("/:id/comments/:commentId", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!checkAdmin(secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const commentId = parseInt(req.params.commentId, 10);
  const result = db.prepare("DELETE FROM post_comments WHERE id = ?").run(commentId);
  if (result.changes === 0) return res.status(404).json({ error: "Comment not found" });

  return res.json({ ok: true });
});
