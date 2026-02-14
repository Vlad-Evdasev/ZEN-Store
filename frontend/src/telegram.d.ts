declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: { user?: { id: number; username?: string; first_name?: string } };
        ready: () => void;
        expand: () => void;
        close: () => void;
        themeParams: { bg_color?: string; text_color?: string };
      };
    };
  }
}

export {};
