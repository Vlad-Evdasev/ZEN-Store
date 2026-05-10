declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: { id: number; username?: string; first_name?: string };
          /** Параметр из startapp/start (deep-link). Например ссылка
           *  t.me/bot/app?startapp=post_42 → start_param === "post_42". */
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        disableVerticalSwipes?: () => void;
        themeParams: { bg_color?: string; text_color?: string };
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink?: (url: string) => void;
        /** Bot API 8.0+: открывает родной Telegram-пикер контактов и шлёт
         *  заранее подготовленное сообщение (требует prepare на бэкенде).
         *  Здесь оставляем как опциональный — фолбэк на t.me/share/url. */
        shareMessage?: (msgId: string, callback?: (sent: boolean) => void) => void;
        HapticFeedback?: {
          impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred?: (type: "error" | "success" | "warning") => void;
          selectionChanged?: () => void;
        };
        version?: string;
      };
    };
  }
}

export {};
