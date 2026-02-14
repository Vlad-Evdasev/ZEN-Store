const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  sizes: string;
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

export async function createOrder(
  userId: string,
  data: { user_name?: string; user_phone?: string; user_address?: string; items: CartItem[]; total: number }
) {
  const res = await fetch(`${API_URL}/api/orders/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create order");
}
