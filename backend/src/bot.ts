import { Bot, InputFile } from "grammy";
import { db } from "./db/schema.js";

type ChannelMediaPhoto = {
  type: "photo";
  media: string | InputFile;
  caption?: string;
  parse_mode?: "HTML";
};

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Bot(token);

const WEB_APP_URL = process.env.WEB_APP_URL || "https://your-mini-app-url.vercel.app";

const MAX_IMAGES = 10;
const SEND_DELAY_MS = 40; // ~25 msg/sec, под лимитами Telegram

function toPhotoSource(src: string): string | InputFile {
  if (!src.startsWith("data:")) return src;
  const m = src.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return src;
  const buffer = Buffer.from(m[1], "base64");
  return new InputFile(buffer, "image.jpg");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isUserBlocked = (msg: string) =>
  /forbidden:/i.test(msg) ||
  /bot was blocked/i.test(msg) ||
  /user is deactivated/i.test(msg) ||
  /chat not found/i.test(msg);

export function rememberBotUser(userId: string | number, name?: string, username?: string): void {
  const id = String(userId);
  try {
    db.prepare(
      "INSERT INTO bot_users (user_id, first_seen_at, last_seen_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP, blocked_at = NULL"
    ).run(id);
    if (name || username) {
      db.prepare(
        "UPDATE bot_users SET name = COALESCE(?, name), username = COALESCE(?, username) WHERE user_id = ?"
      ).run(name ?? null, username ?? null, id);
    }
  } catch {
    // ignore
  }
}

function markBotUserBlocked(userId: string | number): void {
  const id = String(userId);
  try {
    db.prepare(
      "INSERT INTO bot_users (user_id, first_seen_at, last_seen_at, blocked_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET blocked_at = CURRENT_TIMESTAMP"
    ).run(id);
  } catch {
    // ignore
  }
}

// Получаем уникальные user_id, которым стоит разослать пост.
// Источник: bot_users (тапнули /start) ∪ orders ∪ cart_items ∪ wishlist ∪ user_settings.
// Заблокированные через bot_users.blocked_at — исключаются.
export function getBroadcastRecipients(): string[] {
  try {
    const rows = db.prepare(`
      WITH known(user_id) AS (
        SELECT user_id FROM bot_users WHERE blocked_at IS NULL
        UNION
        SELECT user_id FROM orders
        UNION
        SELECT user_id FROM cart_items
        UNION
        SELECT user_id FROM wishlist
        UNION
        SELECT user_id FROM user_settings
      )
      SELECT DISTINCT k.user_id FROM known k
      WHERE k.user_id IS NOT NULL
        AND k.user_id <> ''
        AND k.user_id NOT IN (SELECT user_id FROM bot_users WHERE blocked_at IS NOT NULL)
    `).all() as { user_id: string }[];
    return rows.map((r) => r.user_id).filter(Boolean);
  } catch {
    return [];
  }
}

export type SendResult =
  | { ok: true; messageIds: number[] }
  | { ok: false; error: string; blocked?: boolean };

async function sendOne(target: string | number, text: string, images: string[]): Promise<SendResult> {
  const trimmed = (text || "").trim();
  try {
    if (images.length === 0) {
      const msg = await bot.api.sendMessage(target, trimmed, { parse_mode: "HTML" });
      return { ok: true, messageIds: [msg.message_id] };
    }
    if (images.length === 1) {
      const msg = await bot.api.sendPhoto(target, toPhotoSource(images[0]), {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
      return { ok: true, messageIds: [msg.message_id] };
    }
    const media: ChannelMediaPhoto[] = images.map((src, i) => {
      const item: ChannelMediaPhoto = { type: "photo", media: toPhotoSource(src) };
      if (i === 0 && trimmed) {
        item.caption = trimmed;
        item.parse_mode = "HTML";
      }
      return item;
    });
    const msgs = await bot.api.sendMediaGroup(target, media);
    return { ok: true, messageIds: msgs.map((m) => m.message_id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, blocked: isUserBlocked(msg) };
  }
}

export interface BroadcastRecipientResult {
  user_id: string;
  message_ids: number[];
  error?: string;
}

export interface BroadcastResult {
  recipients: BroadcastRecipientResult[];
  sent_count: number;
  failed_count: number;
}

export async function broadcastToUsers(
  text: string,
  imageSources: string[] = [],
  recipientsList?: string[]
): Promise<BroadcastResult> {
  const trimmed = (text || "").trim();
  const images = imageSources.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, MAX_IMAGES);
  const recipients: BroadcastRecipientResult[] = [];
  let sent = 0;
  let failed = 0;
  const userIds = recipientsList && recipientsList.length > 0 ? recipientsList : getBroadcastRecipients();
  for (const userId of userIds) {
    const result = await sendOne(userId, trimmed, images);
    if (result.ok) {
      recipients.push({ user_id: userId, message_ids: result.messageIds });
      sent++;
    } else {
      recipients.push({ user_id: userId, message_ids: [], error: result.error });
      failed++;
      if (result.blocked) markBotUserBlocked(userId);
    }
    await sleep(SEND_DELAY_MS);
  }
  return { recipients, sent_count: sent, failed_count: failed };
}

export async function editBroadcast(
  recipients: BroadcastRecipientResult[],
  text: string,
  hasMedia: boolean
): Promise<{ ok: true; updated: number; failed: number } | { ok: false; error: string }> {
  const trimmed = (text || "").trim();
  if (!hasMedia && !trimmed) return { ok: false, error: "Текст не может быть пустым" };
  let updated = 0;
  let failed = 0;
  for (const r of recipients) {
    const first = r.message_ids[0];
    if (!first) continue;
    try {
      if (hasMedia) {
        await bot.api.editMessageCaption(r.user_id, first, {
          caption: trimmed || undefined,
          parse_mode: "HTML",
        });
      } else {
        await bot.api.editMessageText(r.user_id, first, trimmed, { parse_mode: "HTML" });
      }
      updated++;
    } catch (e) {
      // «message is not modified» / «message to edit not found» — не считаем за фатальную ошибку
      const msg = e instanceof Error ? e.message : String(e);
      if (!/message is not modified|message to edit not found/i.test(msg)) failed++;
    }
    await sleep(SEND_DELAY_MS);
  }
  return { ok: true, updated, failed };
}

export async function deleteBroadcast(
  recipients: BroadcastRecipientResult[]
): Promise<{ ok: true; deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const r of recipients) {
    for (const id of r.message_ids) {
      try {
        await bot.api.deleteMessage(r.user_id, id);
        deleted++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/message to delete not found/i.test(msg)) failed++;
      }
      await sleep(SEND_DELAY_MS);
    }
  }
  return { ok: true, deleted, failed };
}

function fullName(first?: string | null, last?: string | null): string | undefined {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  const out = [a, b].filter(Boolean).join(" ").trim();
  return out || undefined;
}

function saveIncomingMessage(userId: string | number, tgMessageId: number, text: string, imageUrl?: string | null): void {
  try {
    db.prepare(
      "INSERT INTO bot_messages (user_id, direction, text, tg_message_id, read_by_admin, image_url) VALUES (?, 'in', ?, ?, 0, ?)"
    ).run(String(userId), text || null, tgMessageId, imageUrl ?? null);
  } catch {
    // ignore
  }
}

function saveOutgoingMessage(userId: string | number, tgMessageId: number, text: string, imageUrl?: string | null): void {
  try {
    db.prepare(
      "INSERT INTO bot_messages (user_id, direction, text, tg_message_id, read_by_admin, image_url) VALUES (?, 'out', ?, ?, 1, ?)"
    ).run(String(userId), text || null, tgMessageId, imageUrl ?? null);
  } catch {
    // ignore
  }
}

// Скачиваем фото из Telegram и кодируем в data:base64, чтобы сохранить целиком в
// БД и отдать в админку без проксирования через бэкенд (URL Telegram содержит
// токен бота — экспонировать его наружу нельзя).
async function downloadTelegramPhotoAsDataUrl(fileId: string): Promise<string | null> {
  try {
    const file = await bot.api.getFile(fileId);
    if (!file.file_path) return null;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = file.file_path.split(".").pop()?.toLowerCase() || "jpg";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// Отправка сообщения пользователю от имени бота. Поддерживает либо текст, либо
// текст+фото — для photo-only ответа достаточно imageUrl.
export async function replyAsBot(
  userId: string | number,
  text: string,
  imageUrl?: string | null
): Promise<{ ok: true; messageId: number; imageUrl: string | null } | { ok: false; error: string }> {
  const trimmed = (text || "").trim();
  const photo = imageUrl?.trim() || null;
  if (!trimmed && !photo) return { ok: false, error: "Пустой ответ" };
  try {
    if (photo) {
      const msg = await bot.api.sendPhoto(userId, toPhotoSource(photo), {
        caption: trimmed || undefined,
        parse_mode: "HTML",
      });
      saveOutgoingMessage(userId, msg.message_id, trimmed, photo);
      return { ok: true, messageId: msg.message_id, imageUrl: photo };
    }
    const msg = await bot.api.sendMessage(userId, trimmed, { parse_mode: "HTML" });
    saveOutgoingMessage(userId, msg.message_id, trimmed, null);
    return { ok: true, messageId: msg.message_id, imageUrl: null };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
    return { ok: false, error: err };
  }
}

// ── Order status notifications ────────────────────────────────────────────
// Бот пишет юзеру в личку, когда админ меняет статус заказа.
// Тихо игнорируем 403 / blocked-by-user (помечаем юзера как blocked).

const ORDER_STATUS_TEXT: Record<string, { emoji: string; title: string; sub?: string }> = {
  pending: { emoji: "✅", title: "Заказ #{id} оформлен", sub: "Мы получили запрос — скоро свяжемся для уточнения деталей." },
  in_transit: { emoji: "🚚", title: "Заказ #{id} в пути", sub: "Уже едет к тебе. Отслеживай статус в /track." },
  delivered: { emoji: "📦", title: "Заказ #{id} доставлен", sub: "Забирай! Если что-то не так — пиши, поможем." },
  completed: { emoji: "💚", title: "Заказ #{id} завершён", sub: "Спасибо за покупку! Будем рады видеть тебя снова 🤍" },
};

const CUSTOM_STATUS_TEXT: Record<string, { emoji: string; title: string; sub?: string }> = {
  pending: { emoji: "✅", title: "Кастом-заявка #{id} одобрена", sub: "Принята в работу. Свяжемся для уточнений." },
  in_transit: { emoji: "🚚", title: "Кастом-заявка #{id} в пути", sub: "Уже едет к тебе." },
  delivered: { emoji: "📦", title: "Кастом-заявка #{id} доставлена", sub: "Забирай!" },
  completed: { emoji: "💚", title: "Кастом-заявка #{id} завершена", sub: "Спасибо!" },
};

async function sendStatusNotification(
  userId: string | number,
  cfg: { emoji: string; title: string; sub?: string },
  id: number
): Promise<void> {
  const text = `${cfg.emoji} <b>${cfg.title.replace("{id}", String(id))}</b>${cfg.sub ? `\n\n${cfg.sub}` : ""}`;
  try {
    await bot.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть историю", web_app: { url: WEB_APP_URL } }],
        ],
      },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
    console.error(`[notify] failed for ${userId} #${id}:`, err);
  }
}

export async function notifyOrderStatusChange(userId: string | number, orderId: number, status: string): Promise<void> {
  const cfg = ORDER_STATUS_TEXT[status];
  if (!cfg) return;
  await sendStatusNotification(userId, cfg, orderId);
}

export async function notifyCustomOrderStatusChange(userId: string | number, customOrderId: number, status: string): Promise<void> {
  const cfg = CUSTOM_STATUS_TEXT[status];
  if (!cfg) return;
  await sendStatusNotification(userId, cfg, customOrderId);
}

// ── Cart abandonment reminder ────────────────────────────────────────────
// Cron-таск: каждый час смотрит cart_items старше 24h без активного заказа,
// шлёт юзеру напоминание (но не чаще 1 раза в 7 дней на юзера).

export async function notifyCartAbandonment(userId: string | number, itemsCount: number, total: number): Promise<void> {
  const text =
    `🛒 <b>Твоя корзина ждёт</b>\n\n` +
    `${itemsCount} ${itemsCount === 1 ? "вещь" : itemsCount < 5 ? "вещи" : "вещей"} на сумму <b>${total} $</b>. ` +
    `Готов оформить?`;
  try {
    await bot.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛍 Открыть корзину", web_app: { url: WEB_APP_URL } }],
        ],
      },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
  }
}

// ── New product in subscribed category ───────────────────────────────────

export async function notifyNewArrival(
  userId: string | number,
  productName: string,
  productId: number,
  categoryName: string,
  imageUrl: string | null
): Promise<void> {
  const text =
    `🔥 <b>Новинка в категории «${categoryName}»</b>\n\n` +
    `${productName} — только что добавили в каталог. Залетай первым.`;
  try {
    if (imageUrl) {
      await bot.api.sendPhoto(userId, toPhotoSource(imageUrl), {
        caption: text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🛍 Открыть каталог", web_app: { url: `${WEB_APP_URL}#product=${productId}` } }]],
        },
      });
    } else {
      await bot.api.sendMessage(userId, text, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🛍 Открыть каталог", web_app: { url: WEB_APP_URL } }]],
        },
      });
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
  }
}

// ── Pending TON payment reminder ─────────────────────────────────────
// Ордер создан, payload получен, юзер не дошёл до оплаты.
// Шлём пинг через час с deep-link обратно в WebApp.

export async function notifyPendingTonPayment(
  userId: string | number,
  orderId: number,
  amountTon: number,
  total: number
): Promise<void> {
  const text =
    `⏳ <b>Заказ #${orderId} ожидает оплату</b>\n\n` +
    `${total} $ ≈ ${amountTon.toFixed(2)} TON\n\n` +
    `Если ты не закончил оплату — открой WebApp и продолжи. Intent действует 15 минут с момента создания.`;
  try {
    await bot.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛍 Открыть WebApp", web_app: { url: WEB_APP_URL } }],
        ],
      },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
  }
}

// ── Verified TON payment notification (с TonScan-ссылкой) ────────────

export async function notifyTonPaymentVerified(
  userId: string | number,
  orderId: number,
  txHash: string,
  amountTon: number
): Promise<void> {
  const tonscan = `https://tonscan.org/tx/${txHash}`;
  const text =
    `✅ <b>Оплата заказа #${orderId} принята</b>\n\n` +
    `Получили <b>${amountTon.toFixed(4)} TON</b>. Спасибо!\n\n` +
    `<a href="${tonscan}">Транзакция в TonScan</a>`;
  try {
    await bot.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть историю", web_app: { url: WEB_APP_URL } }],
        ],
      },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
  }
}

// ── Order invoice notification ──────────────────────────────────────
// Одно красивое сообщение: фото первого товара + caption с резюме +
// inline-кнопка «Оплатить» (https://app.tonkeeper.com/transfer/...
// — универсальная HTTPS-ссылка, работает на desktop и mobile, на
// устройствах с установленным Tonkeeper deep-link открывает приложение
// сразу с подставленными адресом, суммой и комментарием).

const ADMIN_HANDLE = process.env.ADMIN_TG_HANDLE || "krot_eno";

export interface OrderItemForInvoice {
  name: string;
  size?: string;
  quantity?: number;
  image_url?: string | null;
}

export async function notifyOrderInvoice(
  userId: string | number,
  orderId: number,
  items: OrderItemForInvoice[],
  total: number,
  ton: { receiveAddress: string; amountNano: string; payload: string; amountTon: number; rateUsd: number } | null
): Promise<void> {
  // Собираем тело сообщения. Ведём с названия товара (главный визуальный
  // якорь), а номер заказа/админа уносим в подвал — фокус на покупке,
  // а не на «бухгалтерии».
  const lines: string[] = [];
  const [first, ...rest] = items;
  if (first) {
    const sz = first.size ? `  ·  ${escapeHtml(first.size)}` : "";
    const qty = (first.quantity ?? 1) > 1 ? `  ·  ×${first.quantity}` : "";
    lines.push(`<b>${escapeHtml(first.name || "Товар")}</b>${sz}${qty}`);
  }
  for (const it of rest) {
    const sz = it.size ? `  ·  ${escapeHtml(it.size)}` : "";
    const qty = (it.quantity ?? 1) > 1 ? `  ·  ×${it.quantity}` : "";
    lines.push(`+ ${escapeHtml(it.name || "Товар")}${sz}${qty}`);
  }
  lines.push("");
  if (ton) {
    lines.push(`<b>${total} $</b>  ≈ ${ton.amountTon.toFixed(2)} TON`);
    lines.push(`Курс ${ton.rateUsd.toFixed(2)} $`);
    lines.push("");
    lines.push("Жми <b>«Оплатить»</b> — кошелёк откроется с готовой суммой и адресом, останется только подтвердить транзакцию.");
  } else {
    lines.push(`<b>${total} $</b>`);
  }
  lines.push("");
  lines.push(`<a href="https://t.me/${ADMIN_HANDLE}">@${ADMIN_HANDLE}</a>`);

  const caption = lines.join("\n");

  // Универсальная Tonkeeper-ссылка вместо ton://. Работает на desktop
  // и mobile: на устройствах с Tonkeeper установленным — deep-link в
  // приложение, без — открывается web-flow Tonkeeper.
  const payUrl = ton
    ? `https://app.tonkeeper.com/transfer/${ton.receiveAddress}` +
      `?amount=${ton.amountNano}` +
      `&text=${encodeURIComponent(ton.payload)}`
    : null;

  const replyMarkup = payUrl
    ? { inline_keyboard: [[{ text: "Оплатить", url: payUrl }]] }
    : undefined;

  // Берём первое фото для главной карточки (sendPhoto поддерживает
  // и caption, и reply_markup — поэтому одно сообщение).
  const firstPhoto = items
    .map((i) => i.image_url)
    .find((u): u is string => !!u && u.trim().length > 0);

  try {
    if (firstPhoto) {
      await bot.api.sendPhoto(userId, toPhotoSource(firstPhoto), {
        caption,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    } else {
      await bot.api.sendMessage(userId, caption, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      });
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
    console.error("notifyOrderInvoice failed:", err);
  }
}

// Уведомление, что мы вручную/автоматически приняли оплату. Шлётся
// один раз — после первого перехода payment_status → 'paid'. Текст
// в той же стилистике, что и инвойс: ведём с товара, без эмодзи-шума.
export async function notifyOrderPaid(
  userId: string | number,
  orderId: number,
  firstItem?: { name?: string | null; size?: string | null }
): Promise<void> {
  const lines: string[] = [];
  lines.push("<b>Оплата подтверждена</b>");
  if (firstItem?.name) {
    const sz = firstItem.size ? `  ·  ${escapeHtml(firstItem.size)}` : "";
    lines.push(`${escapeHtml(firstItem.name)}${sz}`);
  }
  lines.push("");
  lines.push("Заказ ушёл в сборку. Когда отправим — пришлём трек-номер.");
  lines.push("");
  lines.push(`<a href="https://t.me/${ADMIN_HANDLE}">@${ADMIN_HANDLE}</a>`);
  const text = lines.join("\n");
  try {
    await bot.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть историю", web_app: { url: WEB_APP_URL } }],
        ],
      },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
    console.error("notifyOrderPaid failed:", err);
  }
}

// ── Drop teaser ──────────────────────────────────────────────────────

export async function notifyDrop(
  userId: string | number,
  title: string,
  description: string,
  phase: "24h" | "1h" | "5min" | "live",
  dropTime: number
): Promise<void> {
  let header = "";
  switch (phase) {
    case "24h":
      header = `🔥 <b>Drop через 24 часа: ${escapeHtml(title)}</b>`;
      break;
    case "1h":
      header = `⏰ <b>Drop через 1 час: ${escapeHtml(title)}</b>`;
      break;
    case "5min":
      header = `🚨 <b>5 минут до дропа: ${escapeHtml(title)}</b>`;
      break;
    case "live":
      header = `⚡ <b>${escapeHtml(title)} — LIVE сейчас</b>`;
      break;
  }
  const tail =
    phase === "live"
      ? "Залетай в каталог — первые получают первые слоты."
      : `Старт: ${new Date(dropTime).toLocaleString("ru-RU")}.`;
  const text = `${header}\n\n${description ? escapeHtml(description) + "\n\n" : ""}${tail}`;
  try {
    await bot.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🛍 Открыть каталог", web_app: { url: WEB_APP_URL } }]],
      },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isUserBlocked(err)) markBotUserBlocked(userId);
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Bot lifecycle ──────────────────────────────────────────────────────────

// Глобальный middleware: любой апдейт от любого юзера → запоминаем.
// Так подтянутся даже те, кто давно начал чат с ботом и не открывал /start
// после миграции — лишь бы написал хоть что-то.
bot.use(async (ctx, next) => {
  if (ctx.from?.id) {
    rememberBotUser(ctx.from.id, fullName(ctx.from.first_name, ctx.from.last_name), ctx.from.username);
  }
  await next();
});

bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  // /start ref_<USERID> — реферальная ссылка
  const payload = (ctx.match || "").trim();
  let invitedByRef = false;
  if (userId && payload.startsWith("ref_")) {
    const referrer = payload.slice(4);
    if (referrer && referrer !== String(userId)) {
      try {
        const exists = db
          .prepare("SELECT 1 FROM referrals WHERE invited_user_id = ?")
          .get(String(userId));
        if (!exists) {
          db.prepare(
            "INSERT INTO referrals (referrer_user_id, invited_user_id) VALUES (?, ?)"
          ).run(referrer, String(userId));
          invitedByRef = true;
        }
      } catch {}
    }
  }

  // Live-статы для приветствия — делают сообщение «живым», а не статичным.
  let productCount = 0;
  let latestProductAgo: string | null = null;
  try {
    const c = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
    productCount = c.c;
    const latest = db
      .prepare("SELECT MAX(created_at) as t FROM products")
      .get() as { t: string | null };
    if (latest?.t) latestProductAgo = humanAgo(latest.t);
  } catch {}

  const firstName = (ctx.from?.first_name || "").trim();
  const hi = firstName ? escapeHtml(firstName) : "yo";

  // Сборка тела с разными вариантами в зависимости от наличия товаров
  // и был ли юзер приглашён рефералом.
  const lines: string[] = [];
  lines.push(`<b>${hi}</b>, ты в <b>RAW</b>.`);
  lines.push("");
  if (productCount > 0) {
    const noun = pluralRu(productCount, ["вещь", "вещи", "вещей"]);
    const drop = latestProductAgo ? `Последний дроп — <i>${latestProductAgo}</i>.` : "";
    lines.push(`Сейчас в каталоге <b>${productCount} ${noun}</b>. ${drop}`.trim());
  } else {
    lines.push(`Каталог собирается. Будь первым, кто увидит дроп.`);
  }
  lines.push("");
  lines.push("Без посредников. Только то, что носим сами.");
  if (invitedByRef) {
    lines.push("");
    lines.push("<b>Тебя пригласил друг</b> — после первого заказа оба получите по 10 баллов.");
  }

  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      // Persistent reply-keyboard вместо inline-кнопок в сообщении.
      // Эта клавиатура «прицеплена» к полю ввода — юзер тапает иконку
      // переключения между OS-keyboard и нашей custom keyboard, чтобы
      // показать/спрятать. Доступна в любой момент чата.
      // Каталог открывается отдельной кнопкой Shop (menu_button), так
      // что в этой клавиатуре только вторичная навигация.
      keyboard: [
        [
          // Монохромные Unicode-глифы вместо цветных emoji — text-style,
          // плоские, в одном цвете с лейблом. Самое близкое к «безцветным»
          // иконкам, что разрешает Telegram-API.
          // ✧ — 4-конечная outline-звезда (повторяет sparkle-SVG в нав-баре)
          // ▤ — квадрат с горизонталями (лента/журнал заказов)
          // ◯ — outline-круг (avatar / профиль)
          // ◇ — outline-ромб (support-метка)
          { text: "✧  Вдохновиться", web_app: { url: `${WEB_APP_URL}#page=inspire` } },
          { text: "▤  Заказы", web_app: { url: `${WEB_APP_URL}#page=history` } },
        ],
        [
          { text: "◯  Профиль", web_app: { url: `${WEB_APP_URL}#page=settings` } },
          { text: "◇  Поддержка", web_app: { url: `${WEB_APP_URL}#page=support` } },
        ],
      ],
      is_persistent: true,
      resize_keyboard: true,
    },
  });
});

// Plural-рулетка для русских числительных.
function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

// «3 часа назад», «вчера», «5 минут назад»
function humanAgo(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  const diffMs = Date.now() - d.getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} ${pluralRu(m, ["минута", "минуты", "минут"])} назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${pluralRu(h, ["час", "часа", "часов"])} назад`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} ${pluralRu(days, ["день", "дня", "дней"])} назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

bot.command("shop", async (ctx) => {
  await ctx.reply("Каталог открывается одной кнопкой:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Перейти в RAW", web_app: { url: `${WEB_APP_URL}#page=catalog` } }],
      ],
    },
  });
});

// /track — статус последнего активного заказа (catalog или custom)
bot.command("track", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const order = db
    .prepare(
      "SELECT id, status, total, created_at FROM orders WHERE user_id = ? AND status != 'completed' ORDER BY created_at DESC LIMIT 1"
    )
    .get(String(userId)) as { id: number; status: string; total: number; created_at: string } | undefined;
  const custom = db
    .prepare(
      "SELECT id, status, created_at FROM custom_orders WHERE user_id = ? AND status NOT IN ('completed', 'review') ORDER BY created_at DESC LIMIT 1"
    )
    .get(String(userId)) as { id: number; status: string; created_at: string } | undefined;
  if (!order && !custom) {
    await ctx.reply("📭 У тебя нет активных заказов.\n\nТапни <b>«Открыть каталог»</b>, чтобы оформить первый.", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🛍 Открыть каталог", web_app: { url: WEB_APP_URL } }]],
      },
    });
    return;
  }
  const lines: string[] = ["<b>Активные заказы</b>", ""];
  if (order) {
    const cfg = ORDER_STATUS_TEXT[order.status];
    lines.push(
      `${cfg?.emoji ?? "📦"} Заказ #${order.id} — <b>${cfg?.title.replace("{id}", String(order.id)) ?? order.status}</b>`,
      `Сумма: ${order.total} $ · от ${new Date(order.created_at).toLocaleDateString("ru")}`,
      ""
    );
  }
  if (custom) {
    const cfg = CUSTOM_STATUS_TEXT[custom.status];
    lines.push(
      `${cfg?.emoji ?? "✨"} Кастом #${custom.id} — <b>${cfg?.title.replace("{id}", String(custom.id)) ?? custom.status}</b>`,
      `от ${new Date(custom.created_at).toLocaleDateString("ru")}`
    );
  }
  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "📜 История", web_app: { url: WEB_APP_URL } }]],
    },
  });
});

// /profile — сводка
bot.command("profile", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const ordersCount = db
    .prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ?")
    .get(String(userId)) as { c: number };
  const customsCount = db
    .prepare("SELECT COUNT(*) as c FROM custom_orders WHERE user_id = ? AND status != 'review'")
    .get(String(userId)) as { c: number };
  const totalSpent = db
    .prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE user_id = ? AND status = 'completed'")
    .get(String(userId)) as { t: number };
  const points = db
    .prepare("SELECT COALESCE(balance, 0) as b FROM loyalty_points WHERE user_id = ?")
    .get(String(userId)) as { b: number } | undefined;
  const totalCount = ordersCount.c + customsCount.c;
  const text =
    `<b>Твой профиль</b>\n\n` +
    `📦 Заказов: <b>${totalCount}</b> (каталог: ${ordersCount.c}, кастом: ${customsCount.c})\n` +
    `💵 Потрачено: <b>${totalSpent.t} $</b>\n` +
    `💎 Бонусов: <b>${points?.b ?? 0}</b>`;
  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍 Открыть RAW", web_app: { url: WEB_APP_URL } }],
        [{ text: "📜 История", web_app: { url: WEB_APP_URL } }],
      ],
    },
  });
});

// /size — самый частый размер из прошлых заказов
bot.command("size", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const rows = db
    .prepare("SELECT items FROM orders WHERE user_id = ?")
    .all(String(userId)) as { items: string }[];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    try {
      const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items;
      if (Array.isArray(items)) {
        for (const it of items) {
          const s = (it?.size ?? "").toString().trim();
          if (s) counts[s] = (counts[s] ?? 0) + (Number(it?.quantity) || 1);
        }
      }
    } catch {}
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    await ctx.reply("📐 У тебя ещё нет заказов — мы не знаем твой размер.\n\nЗакажи первую вещь, и в следующий раз я запомню.", {
      reply_markup: { inline_keyboard: [[{ text: "🛍 Открыть каталог", web_app: { url: WEB_APP_URL } }]] },
    });
    return;
  }
  const main = sorted[0];
  const others = sorted.slice(1, 3).map(([s, n]) => `${s} (×${n})`);
  const text =
    `📐 <b>Твой размер: ${main[0]}</b>\n\n` +
    `Заказывал ${main[1]} ${main[1] === 1 ? "раз" : "раза"}.` +
    (others.length ? `\n\nТакже встречались: ${others.join(", ")}` : "");
  await ctx.reply(text, { parse_mode: "HTML" });
});

// /help — открыть страницу поддержки в WebApp
bot.command("help", async (ctx) => {
  await ctx.reply(
    "❓ <b>Нужна помощь?</b>\n\n" +
      "Открой раздел <b>Поддержка</b> в приложении — там самые частые вопросы.\n" +
      "Или просто напиши сюда — мы всегда на связи.",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "💬 Открыть поддержку", web_app: { url: WEB_APP_URL } }]],
      },
    }
  );
});

// /referral — твоя реферальная ссылка (см. Phase 2)
bot.command("referral", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const me = await bot.api.getMe();
  const link = `https://t.me/${me.username}?start=ref_${userId}`;
  const stats = db
    .prepare("SELECT COUNT(*) as c FROM referrals WHERE referrer_user_id = ?")
    .get(String(userId)) as { c: number } | undefined;
  await ctx.reply(
    `🎁 <b>Твоя реферальная ссылка</b>\n\n` +
      `<code>${link}</code>\n\n` +
      `Кто пройдёт по ней и сделает первый заказ — оба получите <b>10% скидку</b>.\n\n` +
      `Приглашено друзей: <b>${stats?.c ?? 0}</b>`,
    { parse_mode: "HTML" }
  );
});

// Любое НЕ-командное текстовое сообщение от пользователя — ловим в админ-чат.
// Команды (/start, /shop) идут отдельными хендлерами выше и не сохраняются как
// диалог, чтобы не засорять список чатов.
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (!text || text.startsWith("/")) return;
  if (ctx.from?.id) saveIncomingMessage(ctx.from.id, ctx.message.message_id, text);
});

// Фото от пользователя — скачиваем самое большое и сохраняем как data:URL.
// Caption (если был) идёт текстом сообщения.
bot.on("message:photo", async (ctx) => {
  if (!ctx.from?.id) return;
  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];
  if (!largest) return;
  const imageUrl = await downloadTelegramPhotoAsDataUrl(largest.file_id);
  const caption = ctx.message.caption ?? "";
  saveIncomingMessage(ctx.from.id, ctx.message.message_id, caption, imageUrl);
});

// Регистрация команд + menu button в TG. Запускается при старте бота
// (асинхронно, ошибки не валим — это «приятная мелочь», не критика).
async function configureBotMenu(): Promise<void> {
  try {
    // Список slash-команд — появляется при тапе на «Menu» или вводе «/»
    await bot.api.setMyCommands([
      { command: "start", description: "Главная" },
      { command: "shop", description: "Каталог" },
      { command: "track", description: "Статус заказа" },
      { command: "profile", description: "Профиль и бонусы" },
      { command: "size", description: "Твой размер" },
      { command: "referral", description: "Пригласить друга" },
      { command: "help", description: "Поддержка" },
    ]);
    // Persistent menu button слева от поля ввода — открывает WebApp
    // одним тапом из любого диалога, без необходимости скроллить
    // вверх к /start.
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Shop",
        web_app: { url: `${WEB_APP_URL}#page=catalog` },
      },
    });
    console.log("✅ Bot menu configured (commands + menu button)");
  } catch (e) {
    console.error("Failed to configure bot menu:", e instanceof Error ? e.message : e);
  }
}

export function startBot() {
  bot.start();
  console.log("🤖 Bot is running");
  configureBotMenu();
}
