# ZΞN — Telegram Mini App магазин одежды

Telegram Mini App для магазина одежды на Node.js + React.

## Структура проекта

```
├── backend/     # API + Telegram Bot (grammY, Express)
├── frontend/    # Mini App (React + Vite)
└── package.json # Monorepo корень
```

## Быстрый старт

### 1. Создай бота в Telegram

1. Открой [@BotFather](https://t.me/BotFather)
2. Команда `/newbot`, укажи имя и username
3. Сохрани **токен** бота

### 2. Настрой Web App URL

1. В BotFather: `/mybots` → твой бот → Bot Settings → Menu Button
2. Либо: Bot Settings → Configure Web App
3. Укажи URL Mini App (после деплоя — например `https://zen-store.vercel.app`)

### 3. Установка и запуск

```bash
npm install
cp .env.example .env
# Заполни BOT_TOKEN, WEB_APP_URL, ADMIN_CHAT_ID
npm run dev
```

- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:5173

## Переменные окружения

**Backend (.env):**
```env
BOT_TOKEN=        # Токен от @BotFather
WEB_APP_URL=      # URL Mini App (HTTPS)
PORT=3001
ADMIN_SECRET=     # Пароль админки
ADMIN_CHAT_ID=    # Telegram ID чата для уведомлений о заказах
```

**Frontend (Vercel):**
```env
VITE_API_URL=     # URL backend (Railway)
VITE_TELEGRAM_BOT= # Username бота (для входа в браузере)
VITE_SELLER_LINK=  # Ссылка на продавца (t.me/username)
```

## API

- `GET /api/products` — список товаров
- `POST /api/orders/:userId` — создать заказ (отправляет уведомление продавцу)
- `PATCH /api/orders/order/:orderId/status` — обновить статус заказа (admin, body: `{status: "completed"}`)

## Браузерная версия

В браузере приложение показывает экран входа через Telegram. Нужно:
1. Добавить `VITE_TELEGRAM_BOT` (username бота) на Vercel
2. Настроить Telegram Login Widget в BotFather (Bot Settings → Domain)
3. Указать домен приложения (например `zen-store.vercel.app`)
