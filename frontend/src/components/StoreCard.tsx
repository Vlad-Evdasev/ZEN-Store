import type { Store } from "../api";

interface StoreCardProps {
  store: Store;
  onClick: () => void;
  selected?: boolean;
  /** Уменьшенный размер (70%) для карусели под новинками */
  compact?: boolean;
}

export function StoreCard({ store, onClick, selected, compact }: StoreCardProps) {
  const cardStyle = compact ? { ...styles.card, ...styles.cardCompact } : styles.card;
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        ...cardStyle,
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
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    flexShrink: 0,
    display: "block",
    width: 210,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
  },
  cardCompact: {
    width: 147,
    borderRadius: 10,
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
};
