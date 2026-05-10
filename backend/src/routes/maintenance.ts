import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db/schema.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_SECRET && req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const maintenanceRouter = Router();

// ─── Публичный эндпоинт: статус для конкретного юзера ─────────────────
// Возвращает { enabled, allowed }: enabled — включён ли maintenance,
// allowed — есть ли userId в allowlist (когда enabled=true и
// allowed=false, фронт покажет maintenance-экран).
maintenanceRouter.get("/status", (req, res) => {
  const userId = (req.query.user_id as string | undefined) || "";
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("maintenance_mode") as { value: string } | undefined;
  const enabled = row?.value === "on";
  let allowed = false;
  if (userId) {
    const a = db.prepare("SELECT 1 FROM maintenance_allowlist WHERE user_id = ?").get(userId);
    allowed = !!a;
  }
  res.json({ enabled, allowed });
});

// ─── Админ-эндпоинты: тоггл и управление allowlist ────────────────────

maintenanceRouter.get("/admin", requireAdmin, (_req, res) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("maintenance_mode") as { value: string } | undefined;
  const enabled = row?.value === "on";

  // Возвращаем allowlist с обогащением из bot_users (имя/username),
  // чтобы админ видел кого добавил, а не сухие числовые id.
  const list = db
    .prepare(
      `SELECT a.user_id, a.added_at, b.name, b.username
       FROM maintenance_allowlist a
       LEFT JOIN bot_users b ON b.user_id = a.user_id
       ORDER BY a.added_at DESC`
    )
    .all() as { user_id: string; added_at: string; name: string | null; username: string | null }[];

  res.json({ enabled, allowlist: list });
});

maintenanceRouter.post("/admin/toggle", requireAdmin, (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  const value = enabled ? "on" : "off";
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('maintenance_mode', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(value);
  res.json({ ok: true, enabled });
});

maintenanceRouter.post("/admin/allowlist", requireAdmin, (req, res) => {
  const { user_id } = req.body as { user_id: string };
  if (!user_id || typeof user_id !== "string") {
    return res.status(400).json({ error: "user_id required" });
  }
  const id = user_id.trim();
  if (!id) return res.status(400).json({ error: "user_id required" });
  try {
    db.prepare("INSERT OR IGNORE INTO maintenance_allowlist (user_id) VALUES (?)").run(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "DB error" });
  }
});

maintenanceRouter.delete("/admin/allowlist/:userId", requireAdmin, (req, res) => {
  const { userId } = req.params;
  db.prepare("DELETE FROM maintenance_allowlist WHERE user_id = ?").run(userId);
  res.json({ ok: true });
});

// Поиск юзеров для добавления — по имени, username, id (LIKE).
// Лимит 30 чтобы не отдавать огромный список.
maintenanceRouter.get("/admin/search-users", requireAdmin, (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() || "";
  const limit = 30;
  if (!q) {
    const recent = db
      .prepare(
        `SELECT user_id, name, username FROM bot_users
         WHERE blocked_at IS NULL
         ORDER BY last_seen_at DESC LIMIT ?`
      )
      .all(limit);
    return res.json(recent);
  }
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT user_id, name, username FROM bot_users
       WHERE blocked_at IS NULL
         AND (user_id LIKE ? OR name LIKE ? OR username LIKE ?)
       ORDER BY last_seen_at DESC LIMIT ?`
    )
    .all(like, like, like, limit);
  res.json(rows);
});
