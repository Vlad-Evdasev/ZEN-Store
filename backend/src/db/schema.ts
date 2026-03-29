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

  CREATE TABLE IF NOT EXISTS support_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_username TEXT,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL,
    text TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES support_chats(id)
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
  db.exec("ALTER TABLE support_chats ADD COLUMN title TEXT");
} catch {}
try {
  db.exec("ALTER TABLE support_messages ADD COLUMN image_url TEXT");
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_chat_read (
      user_id TEXT NOT NULL,
      chat_id INTEGER NOT NULL,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, chat_id),
      FOREIGN KEY (chat_id) REFERENCES support_chats(id)
    )
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_chat_read_admin (
      chat_id INTEGER PRIMARY KEY,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (chat_id) REFERENCES support_chats(id)
    )
  `);
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

// Контент главной страницы (hero, тексты) — редактируется в админке
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
} catch {}
// Предзаполнение главной (как у Ralph Lauren): hero + два блока
const siteContentCount = db.prepare("SELECT COUNT(*) as count FROM site_content").get() as { count: number };
if (siteContentCount.count === 0) {
  const insertSc = db.prepare("INSERT OR IGNORE INTO site_content (key, value) VALUES (?, ?)");
  const defaults: [string, string][] = [
    ["hero_title", "RAW"],
    ["hero_subtitle", "Оригинальная одежда из брендовых магазинов"],
    ["hero_image_url", "https://images.unsplash.com/photo-1558769132-cb1aea3c9b9e?w=1200"],
    ["about_text", "Все вещи оригинальные. В каталоге — в наличии в Минске. Под заказ — доставка из Китая."],
    ["catalog_cta", "В каталог"],
    ["custom_order_cta", "Заказать не из каталога"],
    ["arrived_title", "Уже привезли"],
    ["arrived_subtitle", "Вещи в наличии после заказов клиентов"],
    ["arrived_image_url", "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800"],
    ["catalog_image_url", "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800"],
    ["custom_order_image_url", "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800"],
  ];
  for (const [k, v] of defaults) insertSc.run(k, v);
}

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

// New arrivals: NULL = not in section, 0,1,2... = order in "Новинки"
try {
  db.exec("ALTER TABLE products ADD COLUMN new_arrival_sort_order INTEGER");
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

// Seed stores — 4 нишевых магазина
const storeCount = db.prepare("SELECT COUNT(*) as count FROM stores").get() as { count: number };
if (storeCount.count === 0) {
  const insertStore = db.prepare(`
    INSERT INTO stores (name, image_url, description) VALUES (?, ?, ?)
  `);
  const stores: [string, string, string][] = [
    ["Минимал", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", "Базовые вещи без лишнего. Футболки и худи в сдержанной палитре."],
    ["Уличный стиль", "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", "Оверсайз, худи, куртки и вещи для города."],
    ["Классика", "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", "Штаны, брюки и верхняя одежда на каждый день."],
    ["Аксессуары", "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400", "Кепки, сумки и детали, которые дополняют образ."],
  ];
  for (const s of stores) insertStore.run(...s);
}

// Seed products — 5–7 товаров в каждом магазине
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (productCount.count === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (store_id, name, description, price, image_url, category, sizes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  type Row = [number, string, string, number, string, string, string];
  const products: Row[] = [
    // Минимал (1) — 6 товаров
    [1, "Базовый чёрный", "Хлопковая футболка оверсайз, плотная ткань", 2990, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", "tee", "S,M,L,XL"],
    [1, "Белый минимал", "Классический крой, матовый хлопок", 2790, "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400", "tee", "S,M,L,XL"],
    [1, "Серый оверсайз", "Футболка свободного кроя", 3190, "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400", "tee", "S,M,L,XL"],
    [1, "Худи базовое", "Толстовка из флиса, капюшон", 5490, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", "hoodie", "S,M,L,XL"],
    [1, "Свитшот без капюшона", "Минималистичный свитшот", 4490, "https://images.unsplash.com/photo-1578768079052-aa76e52d2e3a?w=400", "hoodie", "S,M,L,XL"],
    [1, "Лонгслив", "Длинный рукав, плотный хлопок", 3490, "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400", "tee", "S,M,L,XL"],
    // Уличный стиль (2) — 6 товаров
    [2, "Оверсайз худи", "Объёмное худи из мягкого флиса", 5990, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", "hoodie", "S,M,L,XL"],
    [2, "Кроп-топ", "Короткая футболка для девушек", 2490, "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400", "tee", "S,M,L"],
    [2, "Ветровка", "Лёгкая ветровка с капюшоном", 6990, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", "jacket", "S,M,L,XL"],
    [2, "Парка уличная", "Тёплая парка на осень-зиму", 8990, "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400", "jacket", "S,M,L,XL"],
    [2, "Худи с принтом", "Худи с минималистичным принтом", 5490, "https://images.unsplash.com/photo-1545127398-14699f92334b?w=400", "hoodie", "S,M,L,XL"],
    [2, "Футболка оверсайз", "Свободная футболка для стрита", 3190, "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400", "tee", "S,M,L,XL"],
    // Классика (3) — 5 товаров
    [3, "Чиносы", "Классические брюки чинос", 4990, "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", "pants", "S,M,L,XL"],
    [3, "Карго", "Широкие карго с карманами", 5290, "https://images.unsplash.com/photo-1624378515192-6b8f2b17b4d2?w=400", "pants", "S,M,L,XL"],
    [3, "Куртка бомбер", "Лёгкая куртка-бомбер", 7490, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", "jacket", "S,M,L,XL"],
    [3, "Брюки оверсайз", "Свободные брюки из хлопка", 4790, "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400", "pants", "S,M,L,XL"],
    [3, "Пальто лёгкое", "Демисезонное пальто", 9990, "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400", "jacket", "S,M,L,XL"],
    // Аксессуары (4) — 6 товаров
    [4, "Кепка чёрная", "Кепка с минималистичной вышивкой", 1990, "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400", "accessories", "One size"],
    [4, "Кепка белая", "Белая кепка, универсальный размер", 1990, "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400", "accessories", "One size"],
    [4, "Шапка бини", "Трикотажная шапка бини", 1490, "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=400", "accessories", "One size"],
    [4, "Сумка шоппер", "Хлопковая сумка с принтом", 2490, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400", "accessories", "One size"],
    [4, "Рюкзак минимал", "Компактный рюкзак на каждый день", 3990, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400", "accessories", "One size"],
    [4, "Пояс кожаный", "Минималистичный кожаный ремень", 2990, "https://images.unsplash.com/photo-1624222247344-550fb60583c2?w=400", "accessories", "One size"],
  ];
  for (const p of products) insertProduct.run(...p);
}
