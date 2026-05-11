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

  // tg-методы зовём ровно один раз на mount, а не на каждый render.
  // Раньше каждый ре-рендер триггерил expand() / setBackgroundColor() и
  // т.д. — это могло вызывать layout-shift / scroll-jump на iOS.
  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
    tg.setBackgroundColor?.("#000000");
    tg.setHeaderColor?.("#000000");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tg, userId, userName, firstName, isInTelegram, setBrowserAuth };
}
