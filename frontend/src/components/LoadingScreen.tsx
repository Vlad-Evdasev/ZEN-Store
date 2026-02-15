export function LoadingScreen() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.circleMask}>
        <img
          src="/zen-circle.png"
          alt=""
          style={styles.circle}
          aria-hidden
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100vh",
    minHeight: "100dvh",
    background: "#000000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  circleMask: {
    width: 160,
    height: 160,
    minWidth: 160,
    minHeight: 160,
    aspectRatio: "1",
    borderRadius: "50%",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
  },
  circle: {
    width: 140,
    height: 140,
    minWidth: 140,
    minHeight: 140,
    aspectRatio: "1",
    objectFit: "cover",
    animation: "zen-spin 2.4s linear infinite",
  },
};
