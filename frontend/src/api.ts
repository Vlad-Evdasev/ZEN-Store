const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 600;

async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status === 404 || res.status === 401) return res;
      lastErr = new Error(res.statusText || `HTTP ${res.status}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (i < RETRY_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw lastErr ?? new Error("Request failed");
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
  new_arrival_sort_order?: number | null;
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
  sort_order: number;
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetchWithRetry(`${API_URL}/api/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function createCategory(
  data: { code: string; name: string; sort_order?: number },
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
  data: { name?: string; sort_order?: number },
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

export type SiteContent = Record<string, string>;

export async function getSiteContent(): Promise<SiteContent> {
  const res = await fetchWithRetry(`${API_URL}/api/site-content`);
  if (!res.ok) return {};
  return res.json();
}

export async function updateSiteContentAdmin(data: SiteContent, adminSecret: string): Promise<SiteContent> {
  const res = await fetch(`${API_URL}/api/admin/site-content`, {
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
  const res = await fetch(`${API_URL}/api/admin/verify`, {
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
  const res = await fetch(`${API_URL}/api/products`, {
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
    new_arrival_sort_order: number | null;
  }>,
  adminSecret?: string
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminSecret) headers["X-Admin-Secret"] = adminSecret;
  const res = await fetch(`${API_URL}/api/products/${id}`, {
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
  const res = await fetch(`${API_URL}/api/products/${id}`, {
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
  status: "pending" | "in_transit" | "delivered" | "completed",
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

export async function deleteCustomOrderAdmin(id: number, adminSecret: string) {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/order/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete custom order");
  return res.json();
}

export async function submitCustomOrder(
  userId: string,
  data: { user_name?: string; user_username?: string; user_address?: string; description: string; size: string; image_data?: string | null }
) {
  const res = await fetch(`${API_URL}/api/custom-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to submit custom order");
}

export interface Review {
  id: number;
  user_id: string;
  user_name: string;
  rating: number;
  text: string;
  created_at: string;
  comments: ReviewComment[];
}

export interface ReviewComment {
  id: number;
  review_id: number;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export async function getReviews(): Promise<Review[]> {
  const res = await fetch(`${API_URL}/api/reviews?_t=${Date.now()}`);
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

export async function addReview(
  userId: string,
  data: { user_name?: string; rating?: number; text: string }
) {
  const res = await fetch(`${API_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to add review");
}

export async function addReviewComment(
  reviewId: number,
  userId: string,
  data: { user_name?: string; text: string }
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
  data: { user_name?: string; user_phone?: string; user_username?: string; user_address?: string; items: CartItem[]; total: number }
): Promise<{ ok: boolean; orderId?: number }> {
  const res = await fetch(`${API_URL}/api/orders/${userId}`, {
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

export interface SupportChat {
  id: number;
  user_id: string;
  user_name: string | null;
  user_username: string | null;
  title: string | null;
  created_at: string;
  /** Present for user chats: number of unread messages from admin */
  unread_count?: number;
}

export interface SupportMessage {
  id: number;
  chat_id: number;
  sender_type: "user" | "admin";
  text: string;
  image_url: string | null;
  created_at: string;
}

export async function getSupportChats(userId: string): Promise<SupportChat[]> {
  const res = await fetch(`${API_URL}/api/support/chats?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function getSupportUnreadCount(userId: string): Promise<{ count: number }> {
  const res = await fetch(`${API_URL}/api/support/unread-count?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function getSupportUnreadCountAdmin(adminSecret: string): Promise<{ count: number }> {
  const res = await fetch(`${API_URL}/api/support/unread-count`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function getCurrencyRateAdmin(adminSecret: string): Promise<{ rate: number }> {
  const res = await fetch(`${API_URL}/api/admin/currency-rate`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch currency rate");
  return res.json();
}

export async function updateCurrencyRateAdmin(adminSecret: string, rate: number): Promise<{ rate: number }> {
  const res = await fetch(`${API_URL}/api/admin/currency-rate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ rate }),
  });
  if (!res.ok) throw new Error("Failed to update currency rate");
  return res.json();
}

export async function getSupportChatsAdmin(adminSecret: string): Promise<SupportChat[]> {
  const res = await fetch(`${API_URL}/api/support/chats`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function markSupportChatReadAdmin(chatId: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/read-admin`, {
    method: "POST",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to mark chat read");
}

export async function createSupportChat(
  userId: string,
  data: { user_name?: string; user_username?: string; title?: string }
): Promise<SupportChat> {
  const res = await fetch(`${API_URL}/api/support/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export async function updateSupportChat(
  chatId: number,
  userId: string,
  data: { title?: string | null }
): Promise<SupportChat> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}?userId=${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update chat");
  return res.json();
}

export async function getSupportMessages(chatId: number, userId: string): Promise<SupportMessage[]> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function markSupportChatRead(chatId: number, userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/read?userId=${encodeURIComponent(userId)}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark chat read");
}

export async function getSupportMessagesAdmin(chatId: number, adminSecret: string): Promise<SupportMessage[]> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function sendSupportMessage(
  chatId: number,
  userId: string,
  data: { text?: string; image_url?: string }
): Promise<SupportMessage> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function updateSupportMessage(
  chatId: number,
  messageId: number,
  userId: string,
  data: { text: string }
): Promise<SupportMessage> {
  const res = await fetch(
    `${API_URL}/api/support/chats/${chatId}/messages/${messageId}?userId=${encodeURIComponent(userId)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
  );
  if (!res.ok) throw new Error("Failed to update message");
  return res.json();
}

export async function deleteSupportMessage(chatId: number, messageId: number, userId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/support/chats/${chatId}/messages/${messageId}?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete message");
}

export async function sendSupportMessageAdmin(
  chatId: number,
  adminSecret: string,
  data: { text?: string; image_url?: string }
): Promise<SupportMessage> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function updateSupportMessageAdmin(
  chatId: number,
  messageId: number,
  adminSecret: string,
  data: { text: string }
): Promise<SupportMessage> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update message");
  return res.json();
}

export async function deleteSupportMessageAdmin(
  chatId: number,
  messageId: number,
  adminSecret: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages/${messageId}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete message");
}

export async function deleteSupportChat(chatId: number, userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete chat");
}

export async function deleteSupportChatAdmin(chatId: number, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete chat");
}
