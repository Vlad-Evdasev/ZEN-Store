interface DeliveryTermsProps {
  onBack: () => void;
}

export function DeliveryTerms({ onBack }: DeliveryTermsProps) {
  return (
    <div style={styles.wrap}>
      <button onClick={onBack} style={styles.back}>
        ← Назад
      </button>
      <h2 style={styles.title}>Условия доставки</h2>
      <div style={styles.content}>
        <p style={styles.p}>
          Доставка осуществляется по всей Беларуси. Сроки и стоимость зависят от выбранного способа и населённого пункта.
        </p>
        <p style={styles.p}>
          После оформления заказа с вами свяжется менеджер для уточнения адреса и вариантов доставки.
        </p>
        <p style={styles.p}>
          По вопросам доставки и заказов пишите в Telegram — мы ответим в течение 24 часов.
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
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 20,
  },
  content: { display: "flex", flexDirection: "column", gap: 16 },
  p: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text)",
  },
};
