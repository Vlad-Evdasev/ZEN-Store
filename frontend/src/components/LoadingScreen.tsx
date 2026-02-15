export function LoadingScreen() {
  return (
    <div style={styles.wrapper}>
      <img
        src="/zen-circle.png"
        alt=""
        style={styles.circle}
        aria-hidden
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "fixed",
    inset: 0,
    background: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  circle: {
    width: 120,
    height: 120,
    animation: "zen-spin 1.2s linear infinite",
  },
};
