interface FeaturedCardProps {
  image: string;
  title: string;
  description: string;
  onClick: () => void;
}

export function FeaturedCard({ image, title, description, onClick }: FeaturedCardProps) {
  return (
    <button onClick={onClick} style={styles.card}>
      <div style={styles.imageWrap}>
        <img src={image} alt="" style={styles.image} />
      </div>
      <p style={styles.title}>{title}</p>
      <p style={styles.desc}>{description}</p>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
  },
  imageWrap: {
    aspectRatio: "4/3",
    overflow: "hidden",
    background: "var(--bg)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  title: {
    padding: "12px 12px 4px",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  desc: {
    padding: "0 12px 12px",
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.4,
  },
};
