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

export async function duplicateCustomOrderAdmin(id: number, adminSecret: string): Promise<{ ok: true; id: number }> {
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
    promo_code?: string;
    points_redeemed?: number;
  }
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

export interface Post {
  id: number;
  caption: string | null;
  image_url: string | null;
  image_data: string | null;
  product_id: number | null;
  product_url: string | null;
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
  data: { caption?: string | null; image_url?: string | null; image_data?: string | null; product_id?: number | null; product_url?: string | null },
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
  data: { caption?: string | null; image_url?: string | null; image_data?: string | null; product_id?: number | null; product_url?: string | null },
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
  data: { text: string; image_urls?: string[]; segment?: SegmentKey },
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

// ─── Engagement API ────────────────────────────────────────────────────

export interface LoyaltyBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export async function getLoyaltyBalance(userId: string): Promise<LoyaltyBalance> {
  const res = await fetchWithRetry(`${API_URL}/api/engagement/points/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch loyalty balance");
  return res.json();
}

export async function redeemLoyaltyPoints(
  userId: string,
  amount: number
): Promise<{ ok: true; applied: number }> {
  const res = await fetch(`${API_URL}/api/engagement/points/${userId}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error("Failed to redeem points");
  return res.json();
}

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

export interface PromoCode {
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  created_at: string;
}

export async function getPromoCodes(adminSecret: string): Promise<PromoCode[]> {
  const res = await fetch(`${API_URL}/api/engagement/promo`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch promo codes");
  return res.json();
}

export async function createPromoCode(
  data: { code: string; discount_percent: number; max_uses?: number | null; valid_until?: string | null },
  adminSecret: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/engagement/promo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function deletePromoCode(code: string, adminSecret: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/engagement/promo/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to delete promo");
}

export async function applyPromoCode(
  code: string,
  userId: string
): Promise<{ ok: true; discount_percent: number }> {
  const res = await fetch(
    `${API_URL}/api/engagement/promo/${encodeURIComponent(code)}/apply/${userId}`,
    { method: "POST" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Промокод недоступен");
  }
  return data as { ok: true; discount_percent: number };
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

export type SegmentKey = "all" | "vip" | "loyal" | "new" | "dormant" | "cart_abandoners";

export async function getSegmentCount(
  segment: SegmentKey,
  adminSecret: string
): Promise<number> {
  const res = await fetch(`${API_URL}/api/engagement/segments/${segment}/count`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  if (!res.ok) throw new Error("Failed to fetch segment count");
  const data = (await res.json()) as { count: number };
  return data.count;
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
  promo_code?: string;
  points_redeemed?: number;
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
