import type { Store } from "../api";

interface StoreCardProps {
  store: Store;
  onClick: () => void;
  selected?: boolean;
}

export function StoreCard({ store, onClick, selected }: StoreCardProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        ...styles.card,
        ...(selected ? styles.cardSelected : {}),
        outline: "none",
      }}
    >
      <div style={styles.imageWrap}>
        <img
          src={store.image_url || "https://via.placeholder.com/200"}
          alt=""
          style={styles.image}
        />
        <div style={styles.overlay}>
          <p style={styles.title}>{store.name}</p>
          <p style={styles.desc}>{store.description}</p>
        </div>
      </div>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    flexShrink: 0,
    display: "block",
    width: 140,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
  },
  cardSelected: {
    borderColor: "var(--accent)",
    boxShadow: "0 0 0 2px var(--accent)",
  },
  imageWrap: {
    position: "relative",
    aspectRatio: "1",
    overflow: "hidden",
    background: "var(--bg)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "24px 10px 10px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
    color: "#fff",
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 2,
  },
  desc: {
    fontSize: 11,
    opacity: 0.9,
    lineHeight: 1.3,
  },
};
