import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";

// Путь к БД настраивается через DB_PATH. На Railway указывайте путь внутри
// смонтированного Volume (например, /data/zen.db) — иначе при каждом деплое
// эфемерный контейнер пересоздаётся и весь zen.db со всеми товарами/постами
// исчезает. Локально без переменной берём ./zen.db.
const dbPath = process.env.DB_PATH || join(process.cwd(), "zen.db");
try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch {}
console.log(`[db] using SQLite at ${dbPath}`);
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

// ── Payments (TON Connect) ───────────────────────────────────────────
// Платёжные поля у orders. Старые ордера через DM с админом считаем
// уже оплаченными (payment_method='manual', payment_status='paid'),
// чтобы старая история не сломалась.
try { db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'manual'"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'paid'"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_tx_hash TEXT"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_amount_nano TEXT"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_verified_at DATETIME"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_payload TEXT"); } catch {}

// Промо/баллы — записываются прямо в ордер для аудита.
try { db.exec("ALTER TABLE orders ADD COLUMN promo_code TEXT"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN points_redeemed INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_reminder_sent_at DATETIME"); } catch {}

// Мульти-фото посты во вкладке «Вдохновиться» — JSON-массив URL/data:URL,
// до 10 элементов. image_url/image_data остаются для обратной совместимости.
try { db.exec("ALTER TABLE posts ADD COLUMN images TEXT"); } catch {}
// Категория поста (опционально). Используем существующие коды из categories
// (tee/hoodie/...). Нужна для блока «похожие посты» в expanded view.
try { db.exec("ALTER TABLE posts ADD COLUMN category TEXT"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)"); } catch {}

// Английское название категории. Когда юзер переключает язык в WebApp,
// мы предпочитаем name_en для en. Если поле NULL — фолбэк на name (RU).
try { db.exec("ALTER TABLE categories ADD COLUMN name_en TEXT"); } catch {}

// Maintenance-режим: когда включён, все пользователи кроме allowlist
// видят maintenance-экран вместо приложения. Сам флаг живёт в
// app_settings под ключом 'maintenance_mode' ('on'/'off').
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_allowlist (
      user_id TEXT PRIMARY KEY,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// ─── Индексы для горячих запросов ──────────────────────────────────────
// Используются в GET /orders/:userId, GET /custom-orders/:userId, фид
// постов, поиск по корзине/wishlist, payment-cron'ах. Без них SQLite
// делает full-scan на каждом запросе, что заметно при росте данных.
const indexStatements = [
  "CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
  "CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)",
  "CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_custom_user_created ON custom_orders(user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_custom_status ON custom_orders(status)",
  "CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_cart_created ON cart_items(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id)",
  "CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)",
  "CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id)",
  "CREATE INDEX IF NOT EXISTS idx_bot_users_last_seen ON bot_users(last_seen_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_bot_messages_user ON bot_messages(user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id)",
  "CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status)",
];
for (const sql of indexStatements) {
  try { db.exec(sql); } catch (e) { console.error("[index]", sql, e); }
}

// Платёжный intent — мост между ордером и транзакцией в сети.
// id (наш payload) уйдёт в комментарий TON-транзакции, потом по нему
// матчим входящую транзакцию на блокчейне. Курс фиксируется на момент
// создания intent'а — у юзера есть expires_at минут на оплату.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_intents (
      id TEXT PRIMARY KEY,
      order_id INTEGER NOT NULL,
      expected_amount_nano TEXT NOT NULL,
      ton_usd_rate REAL NOT NULL,
      expires_at DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Группировка custom_orders для unified invoice. Когда юзер заказывает
// несколько вещей не из каталога, админ может разбить заявку на
// несколько карточек (по одной на каждый item). Все карточки этого
// заказа имеют общий group_id, total ставится на уровне группы,
// invoice один для всей группы.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_order_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      total INTEGER,
      payment_status TEXT DEFAULT 'unpaid',
      payment_method TEXT,
      payment_payload TEXT,
      invoice_sent_at DATETIME,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}
try { db.exec("ALTER TABLE custom_orders ADD COLUMN group_id TEXT"); } catch {}

// Backfill: каждый existing custom_order без group_id получает свою
// уникальную группу (single-item group). Это для legacy data — новые
// заказы получают group_id at insert time.
try {
  const orphans = db.prepare(
    "SELECT id, user_id FROM custom_orders WHERE group_id IS NULL OR group_id = ''"
  ).all() as Array<{ id: number; user_id: string }>;
  for (const row of orphans) {
    const groupId = `cg_${row.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare("INSERT OR IGNORE INTO custom_order_groups (id, user_id) VALUES (?, ?)").run(groupId, row.user_id);
    db.prepare("UPDATE custom_orders SET group_id = ? WHERE id = ?").run(groupId, row.id);
  }
} catch (e) { console.error("[custom_order_groups backfill]", e); }

// Bot message templates — редактируемые шаблоны автоматических сообщений
// бота (welcome, order status, payment, drop teasers и т.д.). Админ
// может менять текст без redeploy. Если template отсутствует или
// is_active=0 — bot.ts использует hardcoded default.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_message_templates (
      template_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT,
      emoji TEXT,
      body TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {}

// Seed default templates (только при первом создании таблицы)
const tplCount = db.prepare("SELECT COUNT(*) as c FROM bot_message_templates").get() as { c: number };
if (tplCount.c === 0) {
  const insertTpl = db.prepare(
    "INSERT INTO bot_message_templates (template_id, category, title, emoji, body) VALUES (?, ?, ?, ?, ?)"
  );
  // Variables in {placeholders}: {id}, {hi}, {name}, {amount}, {item}, {category}, etc.
  const defaults: Array<[string, string, string, string, string]> = [
    ["welcome", "start", "Приветствие /start", "", "{hi}, ты в <b>RAW</b>.\n\nБез посредников. Только то, что носим сами."],
    ["welcome_invited", "start", "Приветствие — приглашён другом", "🎁", "Тебя пригласил друг — после первого заказа оба получите по 10 баллов."],
    ["order_pending", "order_status", "Заказ оформлен", "✅", "Заказ #{id} оформлен\n\nМы получили запрос — скоро свяжемся для уточнения деталей."],
    ["order_in_transit", "order_status", "Заказ в пути", "🚚", "Заказ #{id} в пути\n\nУже едет к тебе. Отслеживай статус в /track."],
    ["order_delivered", "order_status", "Заказ доставлен", "📦", "Заказ #{id} доставлен\n\nЗабирай! Если что-то не так — пиши, поможем."],
    ["order_completed", "order_status", "Заказ завершён", "💚", "Заказ #{id} завершён\n\nСпасибо за покупку! Будем рады видеть тебя снова 🤍"],
    ["custom_pending", "custom_status", "Кастом одобрен", "✅", "Кастом-заявка #{id} одобрена\n\nПринята в работу. Свяжемся для уточнений."],
    ["custom_in_transit", "custom_status", "Кастом в пути", "🚚", "Кастом-заявка #{id} в пути\n\nУже едет к тебе."],
    ["custom_delivered", "custom_status", "Кастом доставлен", "📦", "Кастом-заявка #{id} доставлена\n\nЗабирай!"],
    ["custom_completed", "custom_status", "Кастом завершён", "💚", "Кастом-заявка #{id} завершена\n\nСпасибо!"],
    ["payment_received", "payment", "Оплата подтверждена", "💚", "Оплата подтверждена\n{item}\n\nЗаказ ушёл в сборку. Когда отправим — пришлём трек-номер."],
    ["payment_ton_verified", "payment", "TON оплата принята", "✅", "Оплата заказа #{id} принята\n\nПолучили <b>{amount} TON</b>. Спасибо!"],
    ["cart_abandoned", "engagement", "Корзина ждёт", "🛒", "Твоя корзина ждёт\n\n{count} {noun} на сумму <b>{total} $</b>. Готов оформить?"],
    ["new_arrival", "engagement", "Новинка в категории", "🔥", "Новинка в категории «{category}»\n\n{name} — только что добавили в каталог. Залетай первым."],
    ["drop_24h", "drop", "Drop через 24 часа", "🔥", "Drop через 24 часа: {title}\n\n{description}"],
    ["drop_1h", "drop", "Drop через 1 час", "⏰", "Drop через 1 час: {title}\n\n{description}"],
    ["drop_5min", "drop", "5 минут до дропа", "🚨", "5 минут до дропа: {title}\n\n{description}"],
    ["drop_live", "drop", "Drop LIVE", "⚡", "{title} — LIVE сейчас\n\n{description}"],
  ];
  for (const tpl of defaults) insertTpl.run(...tpl);
}
