export function useTelegram() {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const userId = tg?.initDataUnsafe?.user?.id?.toString() ?? "dev-user";

  if (tg) {
    tg.ready();
    tg.expand();
  }

  return { tg, userId };
}
