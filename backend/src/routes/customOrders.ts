import { Router } from "express";
import { db } from "../db/schema.js";
import { notifyCustomOrderStatusChange, notifyCustomOrderInvoice } from "../bot.js";

export const customOrdersRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const isAdmin = (req: import("express").Request): boolean => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  return !ADMIN_SECRET || secret === ADMIN_SECRET;
};

// Generate a unique group_id для нового custom order.
function makeGroupId(): string {
  return `cg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

customOrdersRouter.get("/admin/all", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  // Возвращаем custom_orders + поле group_id и данные о группе (total,
  // payment_status). Frontend группирует cards по group_id.
  const rows = db.prepare(`
    SELECT
      co.id, co.user_id, co.user_name, co.user_username, co.user_address,
      co.description, co.size, co.image_data,
      COALESCE(co.status, 'pending') as status,
      co.created_at,
      co.group_id,
      g.total as group_total,
      g.payment_status as group_payment_status,
      g.invoice_sent_at as group_invoice_sent_at,
      g.paid_at as group_paid_at
    FROM custom_orders co
    LEFT JOIN custom_order_groups g ON g.id = co.group_id
    ORDER BY co.created_at DESC
  `).all();
  res.json(rows);
});

customOrdersRouter.patch("/admin/order/:id/status", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (!status || !["review", "pending", "in_transit", "delivered", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be review, pending, in_transit, delivered or completed" });
  }
  const before = db
    .prepare("SELECT user_id, status FROM custom_orders WHERE id = ?")
    .get(id) as { user_id: string; status: string } | undefined;
  if (!before) return res.status(404).json({ error: "Custom order not found" });
  const result = db.prepare("UPDATE custom_orders SET status = ? WHERE id = ?").run(status, id);
  if (result.changes === 0) return res.status(404).json({ error: "Custom order not found" });
  // Не шлём пуш для перехода в 'review' (админский черновик) и при no-op
  if (before.status !== status && status !== "review") {
    notifyCustomOrderStatusChange(before.user_id, id, status).catch(() => {});
  }
  res.json({ ok: true });
});

// Редактирование контента заявки админом — описание/размер/фото.
// Принимает только те поля, которые явно переданы; null затирает.
customOrdersRouter.patch("/admin/order/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id, 10);
  const updates: string[] = [];
  const values: unknown[] = [];
  if (req.body.description !== undefined) {
    updates.push("description = ?");
    values.push(typeof req.body.description === "string" ? req.body.description : "");
  }
  if (req.body.size !== undefined) {
    updates.push("size = ?");
    values.push(typeof req.body.size === "string" ? req.body.size : "");
  }
  if (req.body.image_data !== undefined) {
    updates.push("image_data = ?");
    values.push(typeof req.body.image_data === "string" && req.body.image_data ? req.body.image_data : null);
  }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(id);
  const result = db.prepare(`UPDATE custom_orders SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  if (result.changes === 0) return res.status(404).json({ error: "Custom order not found" });
  res.json({ ok: true });
});

customOrdersRouter.delete("/admin/order/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id, 10);
  // Получаем group_id ДО удаления чтобы потом cleanup группы если опустела.
  const row = db.prepare("SELECT group_id FROM custom_orders WHERE id = ?").get(id) as { group_id: string | null } | undefined;
  const result = db.prepare("DELETE FROM custom_orders WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Custom order not found" });
  // Если группа осталась пустой — удалить её.
  if (row?.group_id) {
    const remaining = db.prepare("SELECT COUNT(*) as c FROM custom_orders WHERE group_id = ?").get(row.group_id) as { c: number };
    if (remaining.c === 0) {
      db.prepare("DELETE FROM custom_order_groups WHERE id = ?").run(row.group_id);
    }
  }
  res.json({ ok: true });
});

// Сделать ещё одну заявку на основе существующей: те же данные пользователя,
// СОХРАНЯЕМ group_id (новая карточка идёт в ту же группу что и источник).
// Это позволяет админу разбить multi-item заявку на отдельные карточки,
// но trackить их как ОДИН заказ (одна цена, один invoice).
customOrdersRouter.post("/admin/order/:id/duplicate", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id, 10);
  const src = db.prepare(
    "SELECT user_id, user_name, user_username, user_address, group_id FROM custom_orders WHERE id = ?"
  ).get(id) as { user_id: string; user_name: string | null; user_username: string | null; user_address: string | null; group_id: string | null } | undefined;
  if (!src) return res.status(404).json({ error: "Custom order not found" });
  // group_id из source — duplicate идёт в ту же группу.
  let groupId = src.group_id;
  if (!groupId) {
    // Legacy data — source без group_id. Создаём группу и присваиваем обоим.
    groupId = makeGroupId();
    db.prepare("INSERT INTO custom_order_groups (id, user_id) VALUES (?, ?)").run(groupId, src.user_id);
    db.prepare("UPDATE custom_orders SET group_id = ? WHERE id = ?").run(groupId, id);
  }
  const result = db.prepare(
    "INSERT INTO custom_orders (user_id, user_name, user_username, user_address, description, size, image_data, status, group_id) " +
    "VALUES (?, ?, ?, ?, '', '', NULL, 'review', ?)"
  ).run(src.user_id, src.user_name, src.user_username, src.user_address, groupId);
  res.status(201).json({ ok: true, id: Number(result.lastInsertRowid), group_id: groupId });
});

// Установить total для группы. Все cards в группе trackятся под одной
// total ценой (как заказ из каталога).
customOrdersRouter.patch("/admin/group/:groupId/total", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const groupId = req.params.groupId;
  const total = Number(req.body.total);
  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({ error: "total must be a positive number" });
  }
  const result = db.prepare("UPDATE custom_order_groups SET total = ? WHERE id = ?").run(Math.round(total), groupId);
  if (result.changes === 0) return res.status(404).json({ error: "Group not found" });
  res.json({ ok: true });
});

// Отправить инвойс пользователю по группе custom_orders. Соберём все
// cards в группе + total + отправим в чат. Симметрично catalog
// /api/orders/admin/order/:id/send-invoice.
customOrdersRouter.post("/admin/group/:groupId/send-invoice", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const groupId = req.params.groupId;
  const group = db.prepare(
    "SELECT id, user_id, total, payment_status FROM custom_order_groups WHERE id = ?"
  ).get(groupId) as { id: string; user_id: string; total: number | null; payment_status: string | null } | undefined;
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (!group.total || group.total <= 0) return res.status(400).json({ error: "Set total before sending invoice" });
  const items = db.prepare(
    "SELECT id, description, size, image_data FROM custom_orders WHERE group_id = ? ORDER BY id ASC"
  ).all(groupId) as Array<{ id: number; description: string | null; size: string | null; image_data: string | null }>;
  if (items.length === 0) return res.status(400).json({ error: "Group has no items" });
  try {
    await notifyCustomOrderInvoice(group.user_id, groupId, items, group.total);
    db.prepare("UPDATE custom_order_groups SET invoice_sent_at = CURRENT_TIMESTAMP WHERE id = ?").run(groupId);
    res.json({ ok: true });
  } catch (e) {
    console.error("[custom send-invoice]", e);
    res.status(500).json({ error: "Failed to send invoice" });
  }
});

// Отметить группу как оплаченную (manual marking from admin).
customOrdersRouter.patch("/admin/group/:groupId/mark-paid", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  const groupId = req.params.groupId;
  const result = db.prepare(
    "UPDATE custom_order_groups SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(groupId);
  if (result.changes === 0) return res.status(404).json({ error: "Group not found" });
  res.json({ ok: true });
});

customOrdersRouter.post("/", (req, res) => {
  const { user_id, user_name, user_username, user_address, description, size, image_data } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  // Новая заявка — создаём свою группу (single-item group). Если админ
  // потом duplicate-нёт карточку, duplicate унаследует этот group_id.
  const groupId = makeGroupId();
  db.prepare("INSERT INTO custom_order_groups (id, user_id) VALUES (?, ?)").run(groupId, user_id);
  // Статус 'review' — пока админ не одобрит, заявка не видна у пользователя.
  db.prepare(
    "INSERT INTO custom_orders (user_id, user_name, user_username, user_address, description, size, image_data, status, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'review', ?)"
  ).run(
    user_id,
    user_name ?? null,
    user_username ?? null,
    user_address ?? null,
    description || "",
    size || "",
    image_data || null,
    groupId
  );
  res.status(201).json({ ok: true, group_id: groupId });
});

customOrdersRouter.get("/:userId", (req, res) => {
  const { userId } = req.params;
  // Заявки в статусе 'review' (ожидают подтверждения админа) пользователю не
  // показываем — иначе он увидит их в истории до того, как мы их оформим.
  const rows = db.prepare(
    "SELECT id, description, size, image_data, COALESCE(status, 'pending') as status, created_at FROM custom_orders " +
    "WHERE user_id = ? AND COALESCE(status, 'pending') != 'review' " +
    "ORDER BY created_at DESC"
  ).all(userId);
  res.json(rows);
});
