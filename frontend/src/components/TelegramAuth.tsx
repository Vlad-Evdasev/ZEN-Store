import { useEffect, useRef } from "react";

declare global {
  interface Window {
    onTelegramAuth?: (user: { id: number; first_name: string; username?: string }) => void;
  }
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT || "";

interface TelegramAuthProps {
  onAuth: (userId: string, firstName: string, userName: string | null) => void;
}

export function TelegramAuth({ onAuth }: TelegramAuthProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!BOT_USERNAME || !containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "window.__onTgAuth(user)");
    script.async = true;

    (window as unknown as { __onTgAuth?: (u: { id: number; first_name?: string; username?: string }) => void }).__onTgAuth = (user) => {
      onAuth(
        String(user.id),
        user.first_name || "Гость",
        user.username ? `@${user.username}` : null
      );
    };

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);

    return () => {
      delete (window as unknown as { __onTgAuth?: (u: unknown) => void }).__onTgAuth;
    };
  }, [onAuth]);

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>ZΞN</h2>
      <p style={styles.text}>Войдите через Telegram для заказа</p>
      {BOT_USERNAME ? (
        <div ref={containerRef} />
      ) : (
        <p style={styles.hint}>Настройте VITE_TELEGRAM_BOT для входа в браузере</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontFamily: "Unbounded, sans-serif", fontSize: 28, marginBottom: 16 },
  text: { color: "var(--muted)", marginBottom: 24 },
  hint: { fontSize: 13, color: "var(--muted)" },
};
