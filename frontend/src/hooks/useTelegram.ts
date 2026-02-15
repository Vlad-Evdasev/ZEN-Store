export function useTelegram() {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const user = tg?.initDataUnsafe?.user;
  const userId = user?.id?.toString() ?? "dev-user";
  const userName = user?.username ? `@${user.username}` : null;
  const firstName = user?.first_name ?? "Гость";

  if (tg) {
    tg.ready();
    tg.expand();
  }

  return { tg, userId, userName, firstName };
}
