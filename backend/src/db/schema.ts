import Database from "better-sqlite3";
import { join } from "path";

const dbPath = join(process.cwd(), "zen.db");
export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image_url TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL,
    sizes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_phone TEXT,
    user_address TEXT,
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    rating INTEGER DEFAULT 5,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS review_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id)
  );
`);

// Add store_id to products if missing (migration)
try {
  db.exec("ALTER TABLE products ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1");
} catch {
  // column already exists
}

// Seed stores
const storeCount = db.prepare("SELECT COUNT(*) as count FROM stores").get() as { count: number };
if (storeCount.count === 0) {
  const insertStore = db.prepare(`
    INSERT INTO stores (name, image_url, description) VALUES (?, ?, ?)
  `);
  const stores = [
    ["Футболки", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", "Базовые и оверсайз футболки"],
    ["Худи", "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", "Худи и свитшоты"],
    ["Штаны", "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", "Карго и классика"],
    ["Верхняя одежда", "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", "Куртки и аксессуары"],
  ];
  for (const s of stores) insertStore.run(...s);
}

// Seed products
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (productCount.count === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (store_id, name, description, price, image_url, category, sizes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const products: [number, string, string, number, string, string, string][] = [
    [1, "Essential Tee", "Базовая хлопковая футболка премиум качества", 2990, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", "tee", "S,M,L,XL"],
    [2, "Oversized Hoodie", "Оверсайз худи из мягкого флиса", 5990, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", "hoodie", "S,M,L,XL"],
    [3, "Cargo Pants", "Широкие карго с множеством карманов", 4990, "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", "pants", "S,M,L,XL"],
    [4, "Minimal Jacket", "Минималистичная ветровка", 7990, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", "jacket", "S,M,L,XL"],
    [4, "Black Cap", "Чёрная кепка с вышивкой ZΞN", 1990, "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400", "accessories", "One size"],
  ];
  for (const p of products) insertProduct.run(...p);
}
