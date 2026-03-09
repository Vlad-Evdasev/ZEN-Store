export function Footer() {
  return (
    <footer style={styles.footer}>
      <div className="zen-brand" style={styles.brand}>RAW</div>
      <p style={styles.tagline}>Минимализм. Качество. Твой стиль.</p>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    marginTop: 32,
    padding: "24px 20px",
    paddingBottom: "max(24px, env(safe-area-inset-bottom))",
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
  },
};
