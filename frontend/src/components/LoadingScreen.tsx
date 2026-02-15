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
    borderRadius: "50%",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
  },
  circle: {
    width: 120,
    height: 120,
    animation: "zen-spin 1.2s linear infinite",
  },
};
