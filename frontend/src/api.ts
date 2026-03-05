const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function checkApiHealth(): Promise<{ ok: boolean; url: string; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return { ok: res.ok, url: API_URL };
  } catch (e) {
    return { ok: false, url: API_URL, error: e instanceof Error ? e.message : "Ошибка" };
  }
}

export interface Product {
  id: number;
  store_id?: number;
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

export async function getStores(): Promise<Store[]> {
  const res = await fetch(`${API_URL}/api/stores`);
  if (!res.ok) throw new Error("Failed to fetch stores");
  return res.json();
}

export async function getProductsByStore(storeId: number): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/stores/${storeId}/products`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function createStore(
  data: { name: string; image_url?: string; description?: string },
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
  const res = await fetch(`${API_URL}/api/products`);
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
  created_at: string;
}

export async function getCustomOrdersAdmin(adminSecret: string): Promise<CustomOrderAdmin[]> {
  const res = await fetch(`${API_URL}/api/custom-orders/admin/all`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch custom orders");
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
  created_at: string;
}

export interface SupportMessage {
  id: number;
  chat_id: number;
  sender_type: "user" | "admin";
  text: string;
  created_at: string;
}

export async function getSupportChats(userId: string): Promise<SupportChat[]> {
  const res = await fetch(`${API_URL}/api/support/chats?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function getSupportChatsAdmin(adminSecret: string): Promise<SupportChat[]> {
  const res = await fetch(`${API_URL}/api/support/chats`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function createSupportChat(
  userId: string,
  data: { user_name?: string; user_username?: string }
): Promise<SupportChat> {
  const res = await fetch(`${API_URL}/api/support/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export async function getSupportMessages(chatId: number, userId: string): Promise<SupportMessage[]> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function getSupportMessagesAdmin(chatId: number, adminSecret: string): Promise<SupportMessage[]> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function sendSupportMessage(chatId: number, userId: string, text: string): Promise<SupportMessage> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function sendSupportMessageAdmin(chatId: number, adminSecret: string, text: string): Promise<SupportMessage> {
  const res = await fetch(`${API_URL}/api/support/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
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
