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

// Контент страницы «Поддержка»: пары вопрос-ответ, редактируется в админке.
// answer поддерживает абзацы (\n\n) и markdown-ссылки [текст](url).
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Seed поддержки тем же контентом, что был зашит в Support.tsx
const supportCount = db.prepare("SELECT COUNT(*) as count FROM support_entries").get() as { count: number };
if (supportCount.count === 0) {
  const insertSup = db.prepare("INSERT INTO support_entries (question, answer, sort_order) VALUES (?, ?, ?)");
  const defaults: [string, string, number][] = [
    [
      "Условия доставки",
      "Доставка осуществляется по всей Беларуси. Сроки и стоимость зависят от выбранного способа и населённого пункта.\n\nПосле оформления заказа с вами свяжется менеджер для уточнения вариантов доставки.",
      1,
    ],
    [
      "Контакты",
      "Админ [@krot_eno](https://t.me/krot_eno)",
      2,
    ],
  ];
  for (const r of defaults) insertSup.run(...r);
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

// ─── Engagement / loyalty / referrals tables ────────────────────────────

// Бонусные баллы пользователя (1$ потрачено в completed заказе = 1 балл).
// Тратятся на следующих чекаутах (см. Phase 3).
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_points (
      user_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      lifetime_earned INTEGER NOT NULL DEFAULT 0,
      lifetime_spent INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Журнал движений баллов — для дебага и отображения в профиле.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Реферальные связи. invited_user_id — UNIQUE: один юзер может быть приведён
// только одним рефером (тот, кто привёл первым).
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_user_id TEXT NOT NULL,
      invited_user_id TEXT NOT NULL UNIQUE,
      first_order_id INTEGER,
      reward_granted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Подписка юзера на новинки в категории. Когда админ создаёт продукт в этой
// категории — бот пингует подписчика.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category_code)
    )
  `);
} catch {}

// Логи отправленных cart-abandonment напоминаний — чтобы не спамить (не чаще
// 1 раза в 7 дней на юзера).
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_reminders (
      user_id TEXT PRIMARY KEY,
      last_sent_at DATETIME NOT NULL
    )
  `);
} catch {}

// Промокоды.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      discount_percent INTEGER NOT NULL,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      valid_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Применения промокодов конкретными пользователями.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      order_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code, user_id)
    )
  `);
} catch {}

// Live drops — запланированный релиз товаров с обратным отсчётом.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      product_ids TEXT NOT NULL DEFAULT '[]',
      drop_at DATETIME NOT NULL,
      teaser_sent_24h_at DATETIME,
      teaser_sent_1h_at DATETIME,
      teaser_sent_5min_at DATETIME,
      live_sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Стиль-квиз: ответы юзера для персонализации (Phase 8).
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS style_profiles (
      user_id TEXT PRIMARY KEY,
      answers TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}
