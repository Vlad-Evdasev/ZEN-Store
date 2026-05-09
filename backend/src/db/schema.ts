import Database from "better-sqlite3";
import { join } from "path";

const dbPath = join(process.cwd(), "zen.db");
export const db = new Database(dbPath);

// Улучшение работы при одновременном доступе: WAL и ожидание при занятости БД
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 10000");

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

  CREATE TABLE IF NOT EXISTS wishlist (
    user_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_phone TEXT,
    user_username TEXT,
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
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id)
  );

  CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    rating INTEGER DEFAULT 5,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    lang TEXT DEFAULT 'ru',
    theme TEXT DEFAULT 'light',
    currency TEXT DEFAULT 'USD',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_username TEXT,
    user_address TEXT,
    description TEXT,
    size TEXT,
    image_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

`);

// Migrations for existing DBs
try {
  db.exec("ALTER TABLE orders ADD COLUMN user_username TEXT");
} catch {
  // column already exists
}
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN user_name TEXT");
} catch {}
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN user_username TEXT");
} catch {}
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN user_address TEXT");
} catch {}
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN status TEXT DEFAULT 'pending'");
} catch {}

try {
  db.exec("ALTER TABLE review_comments ADD COLUMN image_url TEXT");
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_rate_byn', '3.2')").run();
} catch {}

// Подписчики бота — тапнули /start, открыли мини-аппу или были замечены в
// заказах/корзине. Шлём им рассылки. blocked_at — если TG вернул 403.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_users (
      user_id TEXT PRIMARY KEY,
      name TEXT,
      username TEXT,
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      blocked_at DATETIME
    )
  `);
} catch {}
try { db.exec("ALTER TABLE bot_users ADD COLUMN name TEXT"); } catch {}
try { db.exec("ALTER TABLE bot_users ADD COLUMN username TEXT"); } catch {}

// Переписка пользователей с ботом. direction = 'in' (от пользователя боту) /
// 'out' (бот отвечает). Использует одну запись на сообщение.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      text TEXT,
      tg_message_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_by_admin INTEGER NOT NULL DEFAULT 0
    )
  `);
} catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_bot_messages_user ON bot_messages(user_id, id)"); } catch {}
try { db.exec("ALTER TABLE bot_messages ADD COLUMN image_url TEXT"); } catch {}

// История рассылок от бота к подписчикам (и опциональным каналам).
// recipients = JSON [{ user_id, message_ids, error? }]; image_urls = JSON
// массив исходных src (включая data: для restore при edit).
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT,
      image_urls TEXT,
      images_count INTEGER NOT NULL DEFAULT 0,
      first_image_url TEXT,
      recipients TEXT NOT NULL DEFAULT '[]',
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )
  `);
} catch {}

// Add store_id to products if missing (migration)
try {
  db.exec("ALTER TABLE products ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1");
} catch {
  // column already exists
}

// Add images (JSON array of URLs, max 5) for product gallery
try {
  db.exec("ALTER TABLE products ADD COLUMN images TEXT");
} catch {
  // column already exists
}

// Brand (replaces store in UI; store_id kept for StoreCatalog)
try {
  db.exec("ALTER TABLE products ADD COLUMN brand TEXT");
} catch {
  // column already exists
}

// Add user_username to orders (instead of/in addition to phone)
try {
  db.exec("ALTER TABLE orders ADD COLUMN user_username TEXT");
} catch {
  // column already exists
}

// Add contact fields to custom_orders (same as catalog checkout)
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN user_name TEXT");
} catch {}
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN user_username TEXT");
} catch {}
try {
  db.exec("ALTER TABLE custom_orders ADD COLUMN user_address TEXT");
} catch {}

// Seed categories (редактируются в админке)
const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0) {
  const insertCat = db.prepare("INSERT INTO categories (code, name, sort_order) VALUES (?, ?, ?)");
  const defaultCategories: [string, string, number][] = [
    ["tee", "Футболки", 1],
    ["hoodie", "Худи", 2],
    ["pants", "Штаны", 3],
    ["jacket", "Куртки", 4],
    ["accessories", "Аксессуары", 5],
  ];
  for (const c of defaultCategories) insertCat.run(...c);
}

// Posts, likes, comments tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caption TEXT,
      image_url TEXT,
      image_data TEXT,
      product_id INTEGER,
      product_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Один технический магазин с id=1 — продукты ссылаются на него по умолчанию.
// Sample-сторов больше не добавляем.
const storeCount = db.prepare("SELECT COUNT(*) as count FROM stores").get() as { count: number };
if (storeCount.count === 0) {
  db.prepare("INSERT INTO stores (id, name, image_url, description) VALUES (1, 'RAW', '', '')").run();
}

// Товары вносятся через админку — никаких sample/seed-данных не подкладываем.
