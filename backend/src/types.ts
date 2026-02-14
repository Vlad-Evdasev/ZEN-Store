export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  sizes: string;
  created_at: string;
}

export interface CartItem {
  id: number;
  user_id: string;
  product_id: number;
  size: string;
  quantity: number;
  product?: Product;
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
