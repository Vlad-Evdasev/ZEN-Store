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

  const rows: Array<{ key: string; icon: string; label: string; onClick: () => void; accent?: boolean }> = [
    { key: "wallet", icon: "💳", label: t(lang, "wallet"), onClick: onWallet, accent: true },
    { key: "orders", icon: "📦", label: t(lang, "cargoOrders"), onClick: onOrders },
    { key: "favorites", icon: "♡", label: t(lang, "favorites"), onClick: onFavorites },
    { key: "history", icon: "🕘", label: t(lang, "history"), onClick: onHistory },
    { key: "reviews", icon: "★", label: t(lang, "reviews"), onClick: onReviews },
    { key: "support", icon: "💬", label: t(lang, "support"), onClick: onSupport },
    { key: "settings", icon: "⚙", label: t(lang, "settings"), onClick: onSettings },
  ];

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />

      <div style={styles.head}>
        <div style={styles.avatar}>{(firstName || "U").slice(0, 1).toUpperCase()}</div>
        <div>
          <div style={styles.name}>{firstName || t(lang, "guest")}</div>
          <button type="button" style={styles.balancePill} onClick={onWallet}>
            {t(lang, "walletBalance")}: <b>{balanceCents == null ? "…" : fmtUsd(balanceCents)}</b>
          </button>
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
            <span style={styles.rowIcon} aria-hidden>{r.icon}</span>
            <span style={{ ...styles.rowLabel, color: r.accent ? "var(--accent)" : "var(--text)" }}>{r.label}</span>
            <span style={styles.chev} aria-hidden>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  head: { display: "flex", alignItems: "center", gap: 14, margin: "8px 0 22px" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 800,
    fontFamily: "Unbounded, sans-serif",
    flexShrink: 0,
  },
  name: { fontSize: 18, fontWeight: 800, color: "var(--text)" },
  balancePill: {
    marginTop: 6,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    color: "var(--muted)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  list: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  rowIcon: { fontSize: 18, width: 22, textAlign: "center", flexShrink: 0 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: 600 },
  chev: { color: "var(--muted)", fontSize: 20 },
};
