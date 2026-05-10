/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TELEGRAM_BOT: string;
  readonly VITE_SELLER_LINK: string;
  /** Имя бота для t.me/<bot>/<short_name>?startapp=... share-ссылок.
   *  Если не задано — пользуемся web-URL `${WEB_APP}#post=<id>`. */
  readonly VITE_BOT_USERNAME?: string;
  /** Short_name мини-приложения внутри бота (BotFather → Edit Mini App). */
  readonly VITE_WEBAPP_SHORT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
