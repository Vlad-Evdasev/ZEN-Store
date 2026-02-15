interface ProfileProps {
  userName: string | null;
  firstName: string;
  onBack: () => void;
  onOpenFavorites?: () => void;
  onOpenReviews?: () => void;
}

export function Profile({ userName, firstName, onBack, onOpenFavorites, onOpenReviews }: ProfileProps) {
  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>

      <div style={styles.avatar}>{firstName[0]?.toUpperCase() || "?"}</div>
      <h2 style={styles.name}>{firstName}</h2>
      {userName && <p style={styles.username}>{userName}</p>}

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Быстрые действия</p>
        <div style={styles.actions}>
          {onOpenFavorites && (
            <button onClick={onOpenFavorites} style={styles.actionBtn}>
              ♡ Избранное
            </button>
          )}
          {onOpenReviews && (
            <button onClick={onOpenReviews} style={styles.actionBtn}>
              ★ Оставить отзыв
            </button>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>О магазине</p>
        <p style={styles.text}>
          ZΞN — минималистичный магазин одежды. Качество, стиль, твой выбор.
        </p>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Поддержка</p>
        <p style={styles.text}>
          По вопросам заказов пишите в Telegram. Мы ответим в течение 24 часов.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  name: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 4,
  },
  username: {
    color: "var(--muted)",
    fontSize: 14,
    marginBottom: 32,
  },
  section: {
    padding: 20,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  sectionTitle: {
    fontSize: 12,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 8,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  actionBtn: {
    padding: 14,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  text: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text)",
  },
};
