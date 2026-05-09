export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  sizes: string;
  created_at: string;
  new_arrival_sort_order?: number | null;
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

export interface Post {
  id: number;
  caption: string | null;
  image_url: string | null;
  image_data: string | null;
  product_id: number | null;
  product_url: string | null;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

export interface PostComment {
  id: number;
  post_id: number;
  user_id: string;
  user_name: string | null;
  text: string;
  created_at: string;
}
