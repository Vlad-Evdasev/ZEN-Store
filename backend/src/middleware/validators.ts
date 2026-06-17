/** Shared input validators/sanitizers for the public API. */

export const LIMITS = {
  REVIEW_TEXT: 2000,
  COMMENT_TEXT: 1000,
  USER_NAME: 100,
  POST_CAPTION: 2000,
  ORDER_TEXT: 1000,
  ADDRESS: 500,
  PHONE: 40,
  PRODUCT_NAME: 200,
  PRODUCT_DESCRIPTION: 4000,
} as const;

export function trimText(value: unknown, maxLength: number): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  return str.slice(0, maxLength);
}

export function trimOrNull(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = typeof value === "string" ? value : String(value);
  const trimmed = str.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Returns true if `url` is a safe image URL:
 *  - https:// (or http:// for flexibility),
 *  - data:image/(png|jpeg|jpg|webp|gif);base64,...
 * SVG is rejected because it can execute JavaScript.
 */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (u.length === 0) return false;
  if (u.length > 5 * 1024 * 1024) return false; // 5 MB for base64
  if (/^https?:\/\//i.test(u)) {
    return u.length <= 2048;
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(u)) {
    return true;
  }
  return false;
}

export function sanitizeImageUrl(url: unknown): string | null {
  return isSafeImageUrl(url) ? url : null;
}
