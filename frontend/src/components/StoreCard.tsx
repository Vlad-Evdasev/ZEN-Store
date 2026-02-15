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
      </div>
      <p style={styles.title}>{store.name}</p>
      <p style={styles.desc}>{store.description}</p>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
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
    boxShadow: "0 0 0 1px var(--accent)",
  },
  imageWrap: {
    aspectRatio: "1",
    overflow: "hidden",
    background: "var(--bg)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  title: {
    padding: "10px 10px 2px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  desc: {
    padding: "0 10px 10px",
    fontSize: 11,
    color: "var(--muted)",
    lineHeight: 1.3,
  },
};
