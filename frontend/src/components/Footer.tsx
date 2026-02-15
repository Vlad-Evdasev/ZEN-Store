export function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.brand}>ZΞN</div>
      <p style={styles.tagline}>Минимализм. Качество. Твой стиль.</p>
      <div style={styles.links}>
        <a href="https://t.me/zen_store" style={styles.link}>
          Telegram
        </a>
      </div>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    marginTop: 32,
    padding: "24px 20px",
    borderTop: "1px solid var(--border)",
    textAlign: "center",
    background: "var(--surface)",
  },
  brand: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    color: "var(--muted)",
    marginBottom: 12,
  },
  links: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  link: {
    fontSize: 13,
    color: "var(--accent)",
  },
};
