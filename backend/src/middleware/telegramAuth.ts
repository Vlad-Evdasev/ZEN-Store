import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";

// Проверяет initData из Telegram WebApp (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
// и устанавливает req.tgUserId, если подпись валидна. Не отбраковывает
// запросы сама — за это отвечает requireOwnership ниже (так роуты могут
// решать сами: public-read или per-user).
//
// Защищает от подмены user_id в URL/body — без этого любой мог бы
// сходить в /api/cart/<чужой_id> и прочитать чужую корзину.
//
// ENV:
//   TG_AUTH_STRICT=1 → отказывать в обслуживании, если verified-id
//     не совпадает с запрошенным userId. Дефолт — 0 (мягкий режим
//     для безболезненного rollout: backend ↔ frontend могут
//     выкатываться независимо, юзеры со старым кэшем не ломаются).
//     Включай в Railway после деплоя обоих частей.

const BOT_TOKEN = process.env.BOT_TOKEN || "";

declare module "express-serve-static-core" {
  interface Request {
    tgUserId?: string;
  }
}

// Возвращает user_id (строкой) если initData валидна и не просрочена
// (24h окно по auth_date), иначе null. Любые ошибки парсинга → null.
function verifyInitData(initData: string): string | null {
  if (!initData || !BOT_TOKEN) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  // data_check_string: пары key=value, отсортированные по ключу, через \n.
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  // secret_key = HMAC_SHA256("WebAppData", bot_token); hash = HMAC_SHA256(secret_key, data_check_string)
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  // timingSafeEqual — защищает от timing-атак сравнения строк.
  let equal = false;
  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    equal = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    equal = false;
  }
  if (!equal) return null;

  // Freshness: auth_date в секундах. 24h окно — иначе старый initData
  // можно было бы переиспользовать неделями.
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (Date.now() / 1000 - authDate > 86400) return null;

  try {
    const userRaw = params.get("user");
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as { id?: number };
    if (typeof user?.id !== "number") return null;
    return String(user.id);
  } catch {
    return null;
  }
}

// Глобальный мидлвар: пытается вытащить и проверить initData. Никогда
// не отвечает за нас — просто populate'ит req.tgUserId.
export function attachTelegramUser(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers["x-telegram-init-data"];
  if (typeof raw === "string" && raw.length > 0) {
    const uid = verifyInitData(raw);
    if (uid) req.tgUserId = uid;
  }
  next();
}

// Хелпер для роутов с user-data. Проверяет, что запрос реально идёт
// от того юзера, чей user_id указан в URL/body.
//
// Возвращает { ok: true } если можно продолжать, иначе { ok: false, ... }
// с готовым 401/403. Роут сам решает: res.status(...).json(...).
//
// Поведение:
//   - STRICT=1 + valid auth match → ok
//   - STRICT=1 + invalid/missing/mismatch → reject
//   - STRICT=0 (дефолт) + valid match → ok
//   - STRICT=0 + valid mismatch → reject (даже в мягком режиме нельзя
//     лезть к чужому ID, если ты verified)
//   - STRICT=0 + missing auth → ok (legacy/rollout)
export function requireOwnership(
  req: Request,
  expectedUserId: string | number
): { ok: true } | { ok: false; status: number; error: string } {
  const STRICT = process.env.TG_AUTH_STRICT === "1";
  const expected = String(expectedUserId);

  if (req.tgUserId) {
    if (req.tgUserId === expected) return { ok: true };
    return { ok: false, status: 403, error: "Forbidden: user mismatch" };
  }
  if (STRICT) {
    return { ok: false, status: 401, error: "Telegram auth required" };
  }
  return { ok: true };
}
