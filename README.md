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
# Установить зависимости
npm install

# Создать .env
cp .env.example .env
# Заполни BOT_TOKEN и WEB_APP_URL

# Запустить backend и frontend
npm run dev
```

- **Backend (API + Bot):** http://localhost:3001
- **Frontend (Mini App):** http://localhost:5173

### 4. Локальная разработка Mini App

Для тестирования Mini App в Telegram нужен HTTPS. Варианты:

- **ngrok:** `ngrok http 5173` — получишь HTTPS URL
- **Telegram Bot:** после деплоя frontend на Vercel/Netlify — укажи этот URL в BotFather

## Переменные окружения

```env
BOT_TOKEN=     # Токен от @BotFather
WEB_APP_URL=   # URL Mini App (HTTPS)
PORT=3001      # Порт API (опционально)
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск backend и frontend |
| `npm run dev:backend` | Только API + Bot |
| `npm run dev:frontend` | Только Mini App |

## API

- `GET /api/products` — список товаров
- `GET /api/products/:id` — товар по ID
- `GET /api/cart/:userId` — корзина
- `POST /api/cart/:userId` — добавить в корзину
- `DELETE /api/cart/:userId/:itemId` — удалить из корзины
- `POST /api/orders/:userId` — создать заказ

## Деплой

- **Frontend:** Vercel, Netlify (статика)
- **Backend:** Railway, Render, VPS (Node.js)
- Обнови `WEB_APP_URL` в backend после деплоя frontend
