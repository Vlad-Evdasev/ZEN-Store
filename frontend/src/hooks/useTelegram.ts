import { useState, useEffect, useCallback } from "react";

const BROWSER_AUTH_KEY = "zen-tg-auth";

function loadBrowserUser(): { userId: string; firstName: string; userName: string | null } | null {
  try {
    const raw = localStorage.getItem(BROWSER_AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.userId) return { userId: data.userId, firstName: data.firstName || "Гость", userName: data.userName || null };
  } catch {}
  return null;
}

function saveBrowserUser(userId: string, firstName: string, userName: string | null) {
  try {
    localStorage.setItem(BROWSER_AUTH_KEY, JSON.stringify({ userId, firstName, userName }));
  } catch {}
}

export function useTelegram() {
  const [browserUser, setBrowserUser] = useState<{ userId: string; firstName: string; userName: string | null } | null>(null);

  useEffect(() => {
    setBrowserUser(loadBrowserUser());
  }, []);

  const isInTelegram = typeof window !== "undefined" && !!window.Telegram?.WebApp;
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const user = tg?.initDataUnsafe?.user;

  const userId = user?.id?.toString() ?? browserUser?.userId ?? "";
  const userName = user?.username ? `@${user.username}` : browserUser?.userName ?? null;
  const firstName = user?.first_name ?? browserUser?.firstName ?? "Гость";

  const setBrowserAuth = useCallback((id: string, name: string, uname: string | null) => {
    saveBrowserUser(id, name, uname);
    setBrowserUser({ userId: id, firstName: name, userName: uname });
  }, []);

  if (tg) {
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
    // Telegram WebView container bg по дефолту берёт цвет theme юзера —
    // на iOS при slide-up клавиатуры это viable как «прозрачный» переход
    // (Telegram bg выглядит чуть светлее нашего OLED-#000). Принудительно
    // выставляем чёрный чтобы все слои совпадали и не было flash'а.
    tg.setBackgroundColor?.("#000000");
    tg.setHeaderColor?.("#000000");
  }

  return { tg, userId, userName, firstName, isInTelegram, setBrowserAuth };
}
