const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const RETRY_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 500;
// 30 секунд таймаут — на холодный старт Railway бэкенда уходит до 15с,
// плюс запас на медленные мобильные сети.
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * fetch с автоматическим retry для GET-запросов чтения.
 * Cold start Railway бэкенда может занимать до 15 секунд.
 *
 * Логика retry:
 *  1) Сетевая ошибка (cold start, timeout, offline) → ретрай c
 *     exponential backoff (500ms, 1s, 2s, 4s).
 *  2) HTTP 5xx (бэкенд внутри упал) → тоже retry.
 *  3) HTTP 4xx (404 / 401) → возвращаем как есть, ретрай не поможет.
 */
async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (i < RETRY_ATTEMPTS - 1) {
      // Exponential backoff: 500, 1000, 2000, 4000 ms
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new Error("Request failed");
}

/**
 * fetch для write-запросов (POST/PATCH/DELETE) с тайм-аутом и
 * условным retry: повторяем ТОЛЬКО на pure-network ошибках (TypeError
 * "Failed to fetch", AbortError). Если сервер ответил любым HTTP-кодом,
 * не повторяем — иначе можно создать дубликаты.
 */
export async function fetchWrite(url: string, options?: RequestInit): Promise<Response> {
  const tryOnce = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await tryOnce();
  } catch (e) {
    // TypeError ("Failed to fetch"), AbortError ("aborted") — запрос
    // не дошёл до сервера. Безопасно повторить один раз.
    const msg = e instanceof Error ? e.name : "";
    if (msg === "TypeError" || msg === "AbortError") {
      await new Promise((r) => setTimeout(r, 800));
      return tryOnce();
    }
    throw e;
  }
}

export async function checkApiHealth(): Promise<{ ok: boolean; url: string; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    const data = res.ok ? await res.json().catch(() => ({})) : {};
    return { ok: res.ok, url: API_URL, error: data.error };
  } catch (e) {
    return { ok: false, url: API_URL, error: e instanceof Error ? e.message : "Ошибка" };
  }
}

export interface Product {
  id: number;
  store_id?: number;
  brand?: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  image_urls?: string[];
  category: string;
  sizes: string;
}

export interface Store {
  id: number;
  name: string;
  image_url: string | null;
  description: string;
}

export interface Category {
  code: string;
  name: string;
  /** Английский перевод названия. NULL = нет перевода → фолбэк на name. */
  name_en?: string | null;
  sort_order: number;
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetchWithRetry(`${API_URL}/api/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function createCategory(
  data: { code: string; name: string; name_en?: string | null; sort_order?: number },
  adminSecret: string
): Promise<Category> {
  const res = await fetch(`${API_URL}/api/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateCategory(
  code: string,
  data: { name?: string; name_en?: string | null; sort_order?: number },
  adminSecret: string
): Promise<Category> {
  const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteCategory(code: string, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export interface SupportEntry {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

export async function getSupportEntries(): Promise<SupportEntry[]> {
  const res = await fetchWithRetry(`${API_URL}/api/support`);
  if (!res.ok) throw new Error("Failed to fetch support entries");
  return res.json();
}

export async function createSupportEntry(
  data: { question: string; answer: string; sort_order?: number },
  adminSecret: string
): Promise<SupportEntry> {
  const res = await fetch(`${API_URL}/api/support`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateSupportEntry(
  id: number,
  data: { question?: string; answer?: string; sort_order?: number },
  adminSecret: string
): Promise<SupportEntry> {
  const res = await fetch(`${API_URL}/api/support/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteSupportEntry(id: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/support/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function getStores(): Promise<Store[]> {
  const res = await fetchWithRetry(`${API_URL}/api/stores`);
  if (!res.ok) throw new Error("Failed to fetch stores");
  return res.json();
}

export async function getStore(id: number): Promise<Store | null> {
  const res = await fetchWithRetry(`${API_URL}/api/stores/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch store");
  return res.json();
}

export async function getProductsByStore(storeId: number): Promise<Product[]> {
  const res = await fetchWithRetry(`${API_URL}/api/stores/${storeId}/products`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function createStore(
  data: { image_url: string; name?: string; description?: string },
  adminSecret?: string
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetch(`${API_URL}/api/stores`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateStore(
  id: number,
  data: Partial<{ name: string; image_url: string; description: string }>,
  adminSecret?: string
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetch(`${API_URL}/api/stores/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteStore(id: number, adminSecret?: string) {
  const headers: Record<string, string> = {};
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetch(`${API_URL}/api/stores/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export interface CartItem {
  id: number;
  product_id: number;
  size: string;
  quantity: number;
  name: string;
  price: number;
  image_url: string | null;
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetchWithRetry(`${API_URL}/api/products`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function verifyAdmin(adminSecret: string): Promise<boolean> {
  // Это первый запрос при логине в админку — может попасть на холодный
  // старт Railway. Поэтому через fetchWithRetry с увеличенным таймаутом.
  const res = await fetchWithRetry(`${API_URL}/api/admin/verify`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  return res.ok;
}

export async function createProduct(
  data: {
    store_id?: number;
    brand?: string | null;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    image_urls?: string[];
    category?: string;
    sizes?: string;
  },
  adminSecret?: string
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetchWrite(`${API_URL}/api/products`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let msg = "";
    try {
      const err = await res.json();
      msg = (err as { error?: string }).error || res.statusText;
    } catch {
      msg = await res.text().catch(() => res.statusText) || `HTTP ${res.status}`;
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateProduct(
  id: number,
  data: Partial<{
    store_id: number;
    brand: string | null;
    name: string;
    description: string;
    price: number;
    image_url: string;
    image_urls: string[];
    category: string;
    sizes: string;
  }>,
  adminSecret?: string
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetchWrite(`${API_URL}/api/products/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteProduct(id: number, adminSecret?: string) {
  const headers: Record<string, string> = {};
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetchWrite(`${API_URL}/api/products/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const res = await fetch(`${API_URL}/api/cart/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch cart");
  return res.json();
}

export async function addToCart(userId: string, productId: number, size: string, quantity = 1) {
  const res = await fetch(`${API_URL}/api/cart/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId, size, quantity }),
  });
  if (!res.ok) throw new Error("Failed to add to cart");
}

export async function removeFromCart(userId: string, itemId: number) {
  const res = await fetch(`${API_URL}/api/cart/${userId}/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove from cart");
}

export async function getWishlist(userId: string): Promise<number[]> {
  const res = await fetch(`${API_URL}/api/wishlist/${userId}?_t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function addToWishlist(userId: string, productId: number) {
  const res = await fetch(`${API_URL}/api/wishlist/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId }),
  });
  if (!res.ok) throw new Error("Failed to add to wishlist");
}

export async function removeFromWishlist(userId: string, productId: number) {
  const res = await fetch(`${API_URL}/api/wishlist/${userId}/${productId}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error("Failed to remove from wishlist");
}

export async function getSettings(userId: string): Promise<{ lang: string; theme: string; currency: string } | null> {
  const res = await fetch(`${API_URL}/api/settings/${userId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

export async function getCurrencyRate(): Promise<{ rate: number }> {
  const res = await fetchWithRetry(`${API_URL}/api/settings/currency-rate`);
  if (!res.ok) return { rate: 3.2 };
  const data = await res.json();
  return { rate: typeof data.rate === "number" ? data.rate : 3.2 };
}

// Admin TG handle — единый источник правды через app_settings.
// Используется в CustomOrderPage и пр. Admin может его править.
export async function getAdminHandle(): Promise<string> {
  try {
    const res = await fetchWithRetry(`${API_URL}/api/settings/admin-handle`);
    if (!res.ok) return "krot_eno";
    const data = await res.json();
    return typeof data.handle === "string" && data.handle ? data.handle : "krot_eno";
  } catch {
    return "krot_eno";
  }
}

export async function updateAdminHandle(handle: string, adminSecret: string): Promise<{ handle: string }> {
  const res = await fetch(`${API_URL}/api/settings/admin-handle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ handle }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// Cart seller handle — отдельный продавец для кнопки «Написать продавцу»
// после заказа из корзины. Может отличаться от admin_tg_handle.
export async function getCartSellerHandle(): Promise<string> {
  try {
    const res = await fetchWithRetry(`${API_URL}/api/settings/cart-seller-handle`);
    if (!res.ok) return "krot_eno";
    const data = await res.json();
    return typeof data.handle === "string" && data.handle ? data.handle : "krot_eno";
  } catch {
    return "krot_eno";
  }
}

export async function updateCartSellerHandle(handle: string, adminSecret: string): Promise<{ handle: string }> {
  const res = await fetch(`${API_URL}/api/settings/cart-seller-handle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ handle }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateSettings(
  userId: string,
  data: { lang?: string; theme?: string; currency?: string }
) {
  const res = await fetch(`${API_URL}/api/settings/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update settings");
}

export interface CustomOrderAdmin {
  id: number;
  user_id: string;
  user_name: string | null;
  user_username: string | null;
  user_address: string | null;
  description: string | null;
  size: string | null;
  image_data: string | null;
  status: string;
  created_at: string;
  group_id: string | null;
  group_total: number | null;
  group_payment_status: string | null;
  group_invoice_sent_at: string | null;
  group_paid_at: string | null;
}

export async function getCustomOrdersAdmin(adminSecret: string): Promise<CustomOrderAdmin[]> {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/all`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch custom orders");
  return res.json();
}

export async function updateCustomOrderStatusAdmin(
  id: number,
  status: "review" | "pending" | "in_transit" | "delivered" | "completed",
  adminSecret: string
) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/order/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update custom order status");
  return res.json();
}

export async function updateCustomOrderContentAdmin(
  id: number,
  data: { description?: string; size?: string; image_data?: string | null },
  adminSecret: string
) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/order/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteCustomOrderAdmin(id: number, adminSecret: string) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/order/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete custom order");
  return res.json();
}

export async function duplicateCustomOrderAdmin(id: number, adminSecret: string): Promise<{ ok: true; id: number; group_id: string }> {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/order/${id}/duplicate`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function setCustomGroupTotalAdmin(groupId: string, total: number, adminSecret: string) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/group/${encodeURIComponent(groupId)}/total`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ total }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function sendCustomGroupInvoiceAdmin(groupId: string, adminSecret: string) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/group/${encodeURIComponent(groupId)}/send-invoice`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function markCustomGroupPaidAdmin(groupId: string, adminSecret: string) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/group/${encodeURIComponent(groupId)}/mark-paid`, {
    method: "PATCH",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ── Bot message templates (для вкладки "Пуш") ────────────────────────────
export type BotMessageTemplate = {
  template_id: string;
  category: string;
  title: string | null;
  emoji: string | null;
  body: string;
  is_active: number;
  updated_at: string;
};

export async function getBotMessageTemplates(adminSecret: string): Promise<BotMessageTemplate[]> {
  const res = await fetch(`${API_URL}/api/messages/templates`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateBotMessageTemplate(
  templateId: string,
  patch: { title?: string; emoji?: string; body?: string; is_active?: boolean },
  adminSecret: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/messages/templates/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function submitCustomOrder(
  userId: string,
  data: { user_name?: string; user_username?: string; user_address?: string; description: string; size: string; image_data?: string | null; image_urls?: string[] }
) {
  const res = await fetch(`${API_URL}/api/custom-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to submit custom order");
}

// Минимальная инфа о собственной заявке — отдаётся юзеру в истории.
export interface MyCustomOrder {
  id: number;
  description: string;
  size: string;
  image_data: string | null;
  status: string;
  created_at: string;
}

export async function getMyCustomOrders(userId: string): Promise<MyCustomOrder[]> {
  const res = await fetchWithRetry(`${API_URL}/api/custom-orders/${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  return res.json();
}

export interface Review {
  id: number;
  user_id: string;
  user_name: string;
  rating: number;
  text: string;
  image_urls?: string[];
  created_at: string;
  comments: ReviewComment[];
}

export interface ReviewComment {
  id: number;
  review_id: number;
  user_id: string;
  user_name: string;
  text: string;
  image_url?: string | null;
  created_at: string;
}

export async function getReviews(): Promise<Review[]> {
  const res = await fetch(`${API_URL}/api/reviews?_t=${Date.now()}`);
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

export async function addReview(
  userId: string,
  data: { user_name?: string; rating?: number; text: string; image_urls?: string[] }
) {
  const res = await fetch(`${API_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to add review");
}

export async function updateReview(
  reviewId: number,
  userId: string,
  data: { rating?: number; text: string; image_urls?: string[] }
) {
  const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to update review");
  }
}

export async function addReviewComment(
  reviewId: number,
  userId: string,
  data: { user_name?: string; text: string; image_url?: string | null }
) {
  const res = await fetch(`${API_URL}/api/reviews/${reviewId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to add comment");
}

export interface Order {
  id: number;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
  user_username: string | null;
  user_address: string | null;
  items: string;
  total: number;
  status: string;
  created_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_tx_hash?: string | null;
  payment_verified_at?: string | null;
}

export async function markOrderPaid(orderId: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/payments/admin/order/${orderId}/mark-paid`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to mark paid");
}

export async function sendOrderInvoice(orderId: number, adminSecret: string): Promise<{ ok: boolean; ton: boolean }> {
  const res = await fetchWrite(`${API_URL}/api/orders/admin/order/${orderId}/send-invoice`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to send invoice");
  }
  return res.json();
}

export async function markOrderRefunded(orderId: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/payments/admin/order/${orderId}/mark-refunded`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to mark refunded");
}

export async function getOrders(userId: string): Promise<Order[]> {
  const res = await fetch(`${API_URL}/api/orders/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function getOrdersAdmin(adminSecret: string): Promise<Order[]> {
  const res = await fetch(`${API_URL}/api/orders/admin/all`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function updateOrderStatus(
  orderId: number,
  status: "pending" | "in_transit" | "delivered" | "completed",
  adminSecret: string
) {
  const res = await fetch(`${API_URL}/api/orders/order/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update order");
  return res.json();
}

export async function deleteOrderAdmin(orderId: number, adminSecret: string) {
  const res = await fetch(`${API_URL}/api/orders/order/${orderId}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete order");
  return res.json();
}

export async function createOrder(
  userId: string,
  data: {
    user_name?: string;
    user_phone?: string;
    user_username?: string;
    user_address?: string;
    items: CartItem[];
    total: number;
  }
): Promise<{ ok: boolean; orderId?: number }> {
  const res = await fetchWrite(`${API_URL}/api/orders/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create order");
  return res.json();
}

export interface ProductReview {
  id: number;
  product_id: number;
  user_id: string;
  user_name: string;
  rating: number;
  text: string;
  created_at: string;
}

export async function getProductReviews(productId: number): Promise<ProductReview[]> {
  const res = await fetch(`${API_URL}/api/products/${productId}/reviews`);
  if (!res.ok) throw new Error("Failed to fetch product reviews");
  return res.json();
}

export type ProductReviewStats = Record<number, { count: number; avg: number }>;

export async function getProductReviewStats(): Promise<ProductReviewStats> {
  const res = await fetch(`${API_URL}/api/products/reviews/stats`);
  if (!res.ok) return {};
  return res.json();
}

export async function addProductReview(
  productId: number,
  userId: string,
  data: { user_name?: string; rating?: number; text: string }
) {
  const res = await fetch(`${API_URL}/api/products/${productId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to add product review");
  return res.json();
}

export interface CurrencyRateMeta {
  rate: number;
  auto: boolean;
  updated_at: string | null;
  source: string;
}

export async function getCurrencyRateAdmin(adminSecret: string): Promise<CurrencyRateMeta> {
  const res = await fetch(`${API_URL}/api/admin/currency-rate`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch currency rate");
  return res.json();
}

export async function updateCurrencyRateAdmin(adminSecret: string, rate: number): Promise<CurrencyRateMeta> {
  const res = await fetch(`${API_URL}/api/admin/currency-rate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ rate }),
  });
  if (!res.ok) throw new Error("Failed to update currency rate");
  return res.json();
}

export async function refreshCurrencyRateFromNbrb(adminSecret: string): Promise<CurrencyRateMeta> {
  const res = await fetch(`${API_URL}/api/admin/currency-rate/refresh`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "NBRB refresh failed");
  }
  return res.json();
}

export async function setCurrencyRateAuto(enabled: boolean, adminSecret: string): Promise<CurrencyRateMeta> {
  const res = await fetch(`${API_URL}/api/admin/currency-rate/auto`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to toggle auto");
  return res.json();
}

export interface Post {
  id: number;
  caption: string | null;
  image_url: string | null;
  image_data: string | null;
  /** Бэкенд всегда возвращает images: string[] (может быть []). Для постов
   *  с одним фото содержит [image_data || image_url]. Для мульти-постов —
   *  до 10 элементов в порядке отображения. */
  images: string[];
  product_id: number | null;
  product_url: string | null;
  /** Категория поста (код из categories: tee/hoodie/...). Для блока
   *  «похожие» в expanded view. Null если не задана. */
  category: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
}

export interface PostComment {
  id: number;
  post_id: number;
  user_id: string;
  user_name: string | null;
  text: string;
  created_at: string;
}

export async function getPosts(userId?: string): Promise<Post[]> {
  const url = userId ? `${API_URL}/api/posts?user_id=${encodeURIComponent(userId)}` : `${API_URL}/api/posts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

// Похожие посты — той же категории, рандомизированный порядок, до 24 шт.
// Используется в expanded view ленты «Вдохновиться» как Pinterest-style
// «больше как этот».
export async function getRelatedPosts(postId: number, userId?: string): Promise<Post[]> {
  const url = userId
    ? `${API_URL}/api/posts/${postId}/related?user_id=${encodeURIComponent(userId)}`
    : `${API_URL}/api/posts/${postId}/related`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch related posts");
  return res.json();
}

export async function togglePostLike(postId: number, userId: string): Promise<{ liked: boolean; likes_count: number }> {
  const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error("Failed to toggle like");
  return res.json();
}

export async function getPostComments(postId: number): Promise<PostComment[]> {
  const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

export async function addPostComment(postId: number, userId: string, userName: string, text: string): Promise<PostComment> {
  const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, user_name: userName, text }),
  });
  if (!res.ok) throw new Error("Failed to add comment");
  return res.json();
}

export async function createPost(
  data: { caption?: string | null; image_url?: string | null; image_data?: string | null; images?: string[]; product_id?: number | null; product_url?: string | null; category?: string | null },
  adminSecret: string
): Promise<{ id: number; ok: boolean }> {
  const res = await fetch(`${API_URL}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updatePost(
  id: number,
  data: { caption?: string | null; image_url?: string | null; image_data?: string | null; images?: string[]; product_id?: number | null; product_url?: string | null; category?: string | null },
  adminSecret: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deletePost(id: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/posts/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function deletePostComment(postId: number, commentId: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function botHeartbeat(userId: string, name?: string, username?: string): Promise<void> {
  if (!userId) return;
  try {
    await fetch(`${API_URL}/api/users/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, name, username }),
    });
  } catch {
    // best-effort, не падаем
  }
}

export interface BotConversation {
  user_id: string;
  name: string | null;
  username: string | null;
  last_text: string | null;
  last_direction: "in" | "out" | null;
  last_has_image: boolean;
  last_at: string | null;
  unread_count: number;
}

export interface BotMessage {
  id: number;
  user_id: string;
  direction: "in" | "out";
  text: string;
  image_url: string | null;
  tg_message_id: number | null;
  created_at: string;
}

export async function getConversations(adminSecret: string): Promise<BotConversation[]> {
  const res = await fetch(`${API_URL}/api/admin/conversations`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function getConversationsUnreadCount(adminSecret: string): Promise<{ count: number }> {
  const res = await fetch(`${API_URL}/api/admin/conversations/unread-count`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) return { count: 0 };
  return res.json();
}

export async function getConversationMessages(userId: string, adminSecret: string): Promise<BotMessage[]> {
  const res = await fetch(`${API_URL}/api/admin/conversations/${encodeURIComponent(userId)}/messages`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function markConversationRead(userId: string, adminSecret: string): Promise<void> {
  await fetch(`${API_URL}/api/admin/conversations/${encodeURIComponent(userId)}/read`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
}

export async function replyToConversation(
  userId: string,
  data: { text?: string; image_url?: string | null },
  adminSecret: string
): Promise<{ ok: true; message_id: number; image_url: string | null }> {
  const res = await fetch(`${API_URL}/api/admin/conversations/${encodeURIComponent(userId)}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export interface BroadcastPost {
  id: number;
  text: string;
  image_urls: string[];
  images_count: number;
  first_image_url: string | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sample_message_id: number | null;
}

export async function getBotUsersCount(adminSecret: string): Promise<{ count: number }> {
  const res = await fetch(`${API_URL}/api/admin/broadcast/users-count`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function sendBroadcast(
  data: { text: string; image_urls?: string[] },
  adminSecret: string
): Promise<BroadcastPost> {
  const res = await fetch(`${API_URL}/api/admin/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function getBroadcasts(adminSecret: string): Promise<BroadcastPost[]> {
  const res = await fetch(`${API_URL}/api/admin/broadcasts`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateBroadcast(
  id: number,
  data: { text: string; image_urls?: string[] },
  adminSecret: string
): Promise<BroadcastPost> {
  const res = await fetch(`${API_URL}/api/admin/broadcasts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteBroadcastPost(id: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/broadcasts/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ─── Admin reviews (with nested comments) ────────────────────────────

export interface AdminReviewComment {
  id: number;
  review_id: number;
  user_id: string;
  user_name: string | null;
  username: string | null;
  text: string;
  image_url: string | null;
  created_at: string;
}

export interface AdminReview {
  id: number;
  user_id: string;
  user_name: string | null;
  username: string | null;
  rating: number;
  text: string;
  image_urls: string[];
  created_at: string;
  comments: AdminReviewComment[];
}

export async function getAdminReviews(adminSecret: string): Promise<AdminReview[]> {
  const res = await fetch(`${API_URL}/api/admin/reviews`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteAdminReview(id: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/reviews/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function deleteAdminReviewComment(id: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/reviews/comments/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ─── Engagement API ────────────────────────────────────────────────────

export async function getCategorySubscriptions(userId: string): Promise<string[]> {
  const res = await fetchWithRetry(`${API_URL}/api/engagement/subscriptions/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  return res.json();
}

export async function subscribeToCategory(userId: string, categoryCode: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/engagement/subscriptions/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_code: categoryCode }),
  });
  if (!res.ok) throw new Error("Failed to subscribe");
}

export async function unsubscribeFromCategory(userId: string, categoryCode: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/engagement/subscriptions/${userId}/${encodeURIComponent(categoryCode)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to unsubscribe");
}

export interface DropItem {
  id: number;
  title: string;
  description: string | null;
  product_ids: number[];
  drop_at: string;
  live_sent_at: string | null;
  created_at: string;
}

export async function getDrops(): Promise<DropItem[]> {
  const res = await fetchWithRetry(`${API_URL}/api/engagement/drops`);
  if (!res.ok) throw new Error("Failed to fetch drops");
  return res.json();
}

export async function createDrop(
  data: { title: string; description?: string; product_ids?: number[]; drop_at: string },
  adminSecret: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/engagement/drops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function deleteDrop(id: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/engagement/drops/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete drop");
}

export async function getTogetherProducts(productId: number): Promise<{ product_ids: number[] }> {
  const res = await fetchWithRetry(`${API_URL}/api/engagement/together/${productId}`);
  if (!res.ok) throw new Error("Failed to fetch together products");
  return res.json();
}

export interface BotAnalytics {
  dau: number;
  wau: number;
  mau: number;
  total_subscribers: number;
  blocked: number;
  orders_today: number;
  orders_week: number;
  revenue_week: number;
  cart_abandon_rate: number;
}

export async function getBotAnalytics(adminSecret: string): Promise<BotAnalytics> {
  const res = await fetch(`${API_URL}/api/engagement/analytics`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

// ─── TON payments ──────────────────────────────────────────────────────

export interface TonPaymentIntent {
  id: string;
  to_address: string;
  amount_nano: string;
  amount_ton: number;
  ton_usd_rate: number;
  payload: string;
  expires_at: string;
}

export interface TonCheckoutResponse {
  ok: true;
  order_id: number;
  payment_intent: TonPaymentIntent;
}

export async function createTonCheckout(data: {
  user_id: string;
  user_name?: string;
  user_phone?: string;
  user_username?: string;
  user_address?: string;
  items: CartItem[];
  total: number;
}): Promise<TonCheckoutResponse> {
  const res = await fetch(`${API_URL}/api/payments/ton/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export interface TonPaymentStatus {
  payment_status: "unpaid" | "paid" | "refunded" | "cancelled";
  status: string;
  tx_hash: string | null;
  payload: string | null;
}

export async function getTonPaymentStatus(orderId: number): Promise<TonPaymentStatus> {
  const res = await fetch(`${API_URL}/api/payments/ton/status/${orderId}`);
  if (!res.ok) throw new Error("Failed to fetch payment status");
  return res.json();
}

export async function verifyTonPayment(
  orderId: number
): Promise<{ ok: boolean; payment_status: string; reason?: string; tx_hash?: string }> {
  const res = await fetch(`${API_URL}/api/payments/ton/verify/${orderId}`, {
    method: "POST",
  });
  // 202 — не ошибка, просто транзакция ещё не пришла
  if (res.status === 202) {
    return res.json();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function cancelTonPayment(orderId: number): Promise<void> {
  await fetch(`${API_URL}/api/payments/ton/cancel/${orderId}`, { method: "POST" });
}

export interface TonRate {
  rate_usd: number;
  ton_for_usd: number | null;
  receive_address: string | null;
  ttl_min: number;
  fetched_at: string;
}

export async function getTonRate(usd?: number): Promise<TonRate> {
  const url = new URL(`${API_URL}/api/payments/ton/rate`);
  if (usd != null) url.searchParams.set("usd", String(usd));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch TON rate");
  return res.json();
}

// ── Maintenance mode ────────────────────────────────────────────────

export interface MaintenanceStatus {
  enabled: boolean;
  allowed: boolean;
}

export interface MaintenanceAllowItem {
  user_id: string;
  added_at: string;
  name: string | null;
  username: string | null;
}

export interface MaintenanceAdminState {
  enabled: boolean;
  allowlist: MaintenanceAllowItem[];
}

export async function getMaintenanceStatus(userId: string): Promise<MaintenanceStatus> {
  const url = userId
    ? `${API_URL}/api/maintenance/status?user_id=${encodeURIComponent(userId)}`
    : `${API_URL}/api/maintenance/status`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch maintenance status");
  return res.json();
}

export async function getMaintenanceAdmin(adminSecret: string): Promise<MaintenanceAdminState> {
  const res = await fetch(`${API_URL}/api/maintenance/admin`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch maintenance admin");
  return res.json();
}

export async function setMaintenanceEnabled(enabled: boolean, adminSecret: string): Promise<void> {
  const res = await fetchWrite(`${API_URL}/api/maintenance/admin/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to toggle maintenance");
}

export async function addMaintenanceAllow(userId: string, adminSecret: string): Promise<void> {
  const res = await fetchWrite(`${API_URL}/api/maintenance/admin/allowlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error("Failed to add to allowlist");
}

export async function removeMaintenanceAllow(userId: string, adminSecret: string): Promise<void> {
  const res = await fetchWrite(`${API_URL}/api/maintenance/admin/allowlist/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to remove from allowlist");
}

export interface MaintenanceUserHit {
  user_id: string;
  name: string | null;
  username: string | null;
}

export async function searchMaintenanceUsers(q: string, adminSecret: string): Promise<MaintenanceUserHit[]> {
  const url = q
    ? `${API_URL}/api/maintenance/admin/search-users?q=${encodeURIComponent(q)}`
    : `${API_URL}/api/maintenance/admin/search-users`;
  const res = await fetch(url, { headers: { "X-Admin-Secret": adminSecret } });
  if (!res.ok) throw new Error("Failed to search users");
  return res.json();
}
