interface ProfileProps {
  userName: string | null;
  firstName: string;
  onBack: () => void;
}

export function Profile({ userName, firstName, onBack }: ProfileProps) {
  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>

      <div style={styles.avatar}>{firstName[0]?.toUpperCase() || "?"}</div>
      <h2 style={styles.name}>{firstName}</h2>
      {userName && <p style={styles.username}>{userName}</p>}

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Профиль</p>
        <p style={styles.text}>
          Добро пожаловать в ZΞN. Здесь вы можете управлять заказами и избранным.
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
  text: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text)",
  },
};
