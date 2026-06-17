import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { BackButton } from "../components/BackButton";
import { getWallet } from "../api";

interface ProfileProps {
  userId: string;
  userName?: string | null;
  firstName?: string;
  onBack: () => void;
  onWallet: () => void;
  onOrders: () => void;
  onFavorites: () => void;
  onHistory: () => void;
  onReviews: () => void;
  onSupport: () => void;
  onSettings: () => void;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ICON = {
  wallet: "M3 8.5A2.5 2.5 0 0 1 5.5 6H18a1.5 1.5 0 0 1 1.5 1.5V8H5.5A2.5 2.5 0 0 1 3 8.5ZM3 8.5V16a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1M16.5 13h.01",
  orders: "M12 3 4 7v10l8 4 8-4V7l-8-4ZM4 7l8 4 8-4M12 11v10",
  heart: "M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5Z",
  chat: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7M4.6 5.1l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
} as const;

function RowIcon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Profile({
  userId,
  firstName,
  onBack,
  onWallet,
  onOrders,
  onFavorites,
  onHistory,
  onReviews,
  onSupport,
  onSettings,
}: ProfileProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    getWallet(userId).then((w) => setBalanceCents(w.balance_fen)).catch(() => {});
  }, [userId]);

  const rows: Array<{ key: string; d: string; label: string; onClick: () => void }> = [
    { key: "wallet", d: ICON.wallet, label: t(lang, "wallet"), onClick: onWallet },
    { key: "orders", d: ICON.orders, label: t(lang, "cargoOrders"), onClick: onOrders },
    { key: "favorites", d: ICON.heart, label: t(lang, "favorites"), onClick: onFavorites },
    { key: "history", d: ICON.clock, label: t(lang, "history"), onClick: onHistory },
    { key: "reviews", d: ICON.star, label: t(lang, "reviews"), onClick: onReviews },
    { key: "support", d: ICON.chat, label: t(lang, "support"), onClick: onSupport },
    { key: "settings", d: ICON.gear, label: t(lang, "settings"), onClick: onSettings },
  ];

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />

      <div style={styles.head}>
        <div style={styles.avatar}>{(firstName || "U").slice(0, 1).toUpperCase()}</div>
        <div style={styles.headText}>
          <div style={styles.name}>{firstName || t(lang, "guest")}</div>
          <div style={styles.balance}>{balanceCents == null ? "—" : fmtUsd(balanceCents)}</div>
        </div>
      </div>

      <div style={styles.list}>
        {rows.map((r, i) => (
          <button
            key={r.key}
            type="button"
            onClick={r.onClick}
            style={{ ...styles.row, borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--border)" }}
          >
            <span style={styles.rowIcon}><RowIcon d={r.d} /></span>
            <span style={styles.rowLabel}>{r.label}</span>
            <span style={styles.chev} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  head: { display: "flex", alignItems: "center", gap: 14, margin: "12px 0 26px" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 600,
    flexShrink: 0,
  },
  headText: { minWidth: 0 },
  name: { fontSize: 19, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 },
  balance: { marginTop: 3, fontSize: 14, color: "var(--muted)" },
  list: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "15px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  rowIcon: { display: "inline-flex", color: "var(--text)", flexShrink: 0 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" },
  chev: { display: "inline-flex", color: "var(--muted)", flexShrink: 0 },
};
