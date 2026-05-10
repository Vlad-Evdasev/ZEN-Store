import { Router } from "express";
import { db } from "../db/schema.js";
import type { Post, PostComment } from "../types.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const MAX_POST_IMAGES = 10;

function checkAdmin(secret: string | undefined): boolean {
  return !ADMIN_SECRET || secret === ADMIN_SECRET;
}

// Парсим images из БД (JSON-массив строк) → string[]. Падает в []
// если поле NULL или невалидный JSON.
function parsePostImages(raw: unknown): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, MAX_POST_IMAGES);
  } catch {
    return [];
  }
}

// Берём массив из тела запроса. Принимаем строки, slice до 10. Для
// обратной совместимости: если только image_url/image_data передан —
// возвращаем undefined чтобы не затирать images.
function readImagesFromBody(body: { images?: unknown }): string[] | undefined {
  if (!Array.isArray(body.images)) return undefined;
  return body.images
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, MAX_POST_IMAGES);
}

// Из row БД (с images-string) собираем нормализованный пост: images
// всегда string[] (возможно пустой). image_url/image_data сохраняем для
// клиентов, ещё не обновлённых.
function expandPost<T extends { image_url?: string | null; image_data?: string | null; images?: string | null }>(row: T) {
  const imagesParsed = parsePostImages(row.images);
  // Если images пуст, но есть legacy image_data/image_url — кладём в массив
  // как один элемент. Клиент тогда рендерит как single-photo пост.
  let images = imagesParsed;
  if (images.length === 0) {
    const legacy = (row.image_data || row.image_url) as string | undefined | null;
    if (legacy) images = [legacy];
  }
  return { ...row, images };
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
    .all() as (Post & { likes_count: number; comments_count: number; images?: string | null })[];

  if (userId) {
    const likedSet = new Set<number>();
    const liked = db
      .prepare("SELECT post_id FROM post_likes WHERE user_id = ?")
      .all(userId) as { post_id: number }[];
    for (const r of liked) likedSet.add(r.post_id);
    return res.json(rows.map((p) => ({ ...expandPost(p), user_liked: likedSet.has(p.id) })));
  }

  return res.json(rows.map(expandPost));
});

// Похожие посты — для блока «больше как этот» в expanded view.
// Если у текущего поста есть category, фильтруем по ней; иначе — берём
// общие свежие посты. Случайный порядок (RANDOM()) даёт «открытие чего-то
// нового» каждый раз. Лимит 24 — достаточно чтобы заполнить экран
// несколькими прокрутками, но не убить трафик base64-картинками.
postsRouter.get("/:id/related", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.query.user_id as string | undefined;
  const post = db
    .prepare("SELECT id, category FROM posts WHERE id = ?")
    .get(id) as { id: number; category: string | null } | undefined;
  if (!post) return res.status(404).json({ error: "Post not found" });

  const rows = post.category
    ? db.prepare(
        `SELECT p.*,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
          (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comments_count
         FROM posts p
         WHERE p.id != ? AND p.category = ?
         ORDER BY RANDOM()
         LIMIT 24`
      ).all(id, post.category) as (Post & { likes_count: number; comments_count: number; images?: string | null })[]
    : db.prepare(
        `SELECT p.*,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
          (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comments_count
         FROM posts p
         WHERE p.id != ?
         ORDER BY RANDOM()
         LIMIT 24`
      ).all(id) as (Post & { likes_count: number; comments_count: number; images?: string | null })[];

  if (userId) {
    const likedSet = new Set<number>();
    const liked = db
      .prepare("SELECT post_id FROM post_likes WHERE user_id = ?")
      .all(userId) as { post_id: number }[];
    for (const r of liked) likedSet.add(r.post_id);
    return res.json(rows.map((p) => ({ ...expandPost(p), user_liked: likedSet.has(p.id) })));
  }
  return res.json(rows.map(expandPost));
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
    .get(id) as (Post & { likes_count: number; comments_count: number; images?: string | null }) | undefined;

  if (!row) return res.status(404).json({ error: "Post not found" });

  if (userId) {
    const like = db
      .prepare("SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?")
      .get(id, userId);
    return res.json({ ...expandPost(row), user_liked: !!like });
  }

  return res.json(expandPost(row));
});

postsRouter.post("/", (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!checkAdmin(secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { caption, image_url, image_data, product_id, product_url, category } = req.body;
  const images = readImagesFromBody(req.body);
  const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null;
  // Когда передан images-массив, в legacy-поля кладём первый элемент,
  // чтобы старые клиенты (без поддержки images) могли отрендерить хотя
  // бы первое фото.
  const legacyUrl = images && images.length > 0
    ? (images[0].startsWith("data:") ? null : images[0])
    : (image_url ?? null);
  const legacyData = images && images.length > 0
    ? (images[0].startsWith("data:") ? images[0] : null)
    : (image_data ?? null);

  try {
    const result = db
      .prepare(
        "INSERT INTO posts (caption, image_url, image_data, images, product_id, product_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        caption ?? null,
        legacyUrl,
        legacyData,
        imagesJson,
        product_id ?? null,
        product_url ?? null,
        category ?? null
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

  const { caption, image_url, image_data, product_id, product_url, category } = req.body;
  const images = readImagesFromBody(req.body);

  const updates: string[] = [];
  const values: unknown[] = [];

  if (caption !== undefined) { updates.push("caption = ?"); values.push(caption); }
  if (category !== undefined) { updates.push("category = ?"); values.push(category || null); }
  if (images !== undefined) {
    updates.push("images = ?");
    values.push(images.length > 0 ? JSON.stringify(images) : null);
    // Legacy-поля синхронизируем с первым элементом
    if (images.length > 0) {
      const first = images[0];
      updates.push("image_url = ?");
      values.push(first.startsWith("data:") ? null : first);
      updates.push("image_data = ?");
      values.push(first.startsWith("data:") ? first : null);
    } else {
      updates.push("image_url = ?"); values.push(null);
      updates.push("image_data = ?"); values.push(null);
    }
  } else {
    if (image_url !== undefined) { updates.push("image_url = ?"); values.push(image_url); }
    if (image_data !== undefined) { updates.push("image_data = ?"); values.push(image_data); }
  }
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
