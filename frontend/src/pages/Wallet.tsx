import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { BackButton } from "../components/BackButton";
import {
  getWallet,
  getTopups,
  getTopupConfig,
  createTopup,
  type WalletTransaction,
  type WalletTxType,
  type TopupRequest,
  type TopupInstructions,
  type TopupStatus,
} from "../api";

interface WalletProps {
  userId: string;
  onBack: () => void;
}

const PRESETS = [10, 25, 50, 100];

/** Formats integer USD cents as a $ amount. */
function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TX_LABEL_KEY: Record<WalletTxType, string> = {
  topup: "txTopup",
  order_payment: "txOrderPayment",
  commission: "txCommission",
  cargo_fee: "txCargoFee",
  refund: "txRefund",
  adjustment: "txAdjustment",
};

const STATUS_LABEL_KEY: Record<TopupStatus, string> = {
  pending: "walletStatusPending",
  processing: "walletStatusProcessing",
  completed: "walletStatusCompleted",
  rejected: "walletStatusRejected",
  failed: "walletStatusFailed",
};

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function Wallet({ userId, onBack }: WalletProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [topups, setTopups] = useState<TopupRequest[]>([]);

  const [minUsd, setMinUsd] = useState(10);
  const [amount, setAmount] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [instructions, setInstructions] = useState<(TopupInstructions & { amountCents: number }) | null>(null);

  const load = async () => {
    if (!userId) return;
    setError(false);
    try {
      const [w, cfg, tps] = await Promise.all([getWallet(userId), getTopupConfig(), getTopups(userId)]);
      setBalanceCents(w.balance_fen);
      setTransactions(w.transactions);
      setMinUsd(cfg.topup_min_usd);
      setTopups(tps);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const amountNum = Number(amount);
  const amountValid = Number.isInteger(amountNum) && amountNum >= minUsd;
  const pendingTopups = topups.filter((tp) => tp.status === "pending" || tp.status === "processing");

  const submit = async () => {
    if (!amountValid || submitting) return;
    setSubmitting(true);
    try {
      const { instructions: instr } = await createTopup(userId, amountNum);
      setInstructions({ ...instr, amountCents: amountNum * 100 });
      setAmount("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "wallet")}</h2>

      <div style={styles.balanceCard}>
        <span style={styles.balanceLabel}>{t(lang, "walletBalance")}</span>
        <span style={styles.balanceValue}>{loading ? "…" : fmtUsd(balanceCents)}</span>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <span>{t(lang, "walletError")}</span>
          <button type="button" style={styles.retryBtn} onClick={() => { setLoading(true); load(); }}>
            {t(lang, "walletRetry")}
          </button>
        </div>
      )}

      <p style={styles.kicker}>{t(lang, "walletTopupTitle")}</p>
      <div style={styles.card}>
        <div style={styles.presetRow}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              style={{ ...styles.preset, ...(amount === String(p) ? styles.presetActive : {}) }}
            >
              ${p}
            </button>
          ))}
        </div>
        <label style={styles.fieldLabel}>{t(lang, "walletTopupAmount")}</label>
        <input
          type="number"
          inputMode="numeric"
          min={minUsd}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(minUsd)}
          style={styles.input}
        />
        <p style={styles.hint}>{t(lang, "walletMin").replace("{n}", String(minUsd))}</p>
        <button
          type="button"
          disabled={!amountValid || submitting}
          onClick={submit}
          style={{ ...styles.cta, ...(!amountValid || submitting ? styles.ctaDisabled : {}) }}
        >
          {t(lang, "walletTopupBtn")}{amountValid ? ` · $${amountNum}` : ""}
        </button>
        <div style={styles.secureNote}>
          <LockIcon />
          <span>{t(lang, "walletSecureNote")}</span>
        </div>
      </div>

      {pendingTopups.length > 0 && (
        <>
          <p style={styles.kicker}>{t(lang, "walletPendingTitle")}</p>
          <div style={styles.card}>
            {pendingTopups.map((tp) => (
              <div key={tp.id} style={styles.txRow}>
                <div>
                  <div style={styles.txTitle}>{fmtUsd(tp.amount_fen)}</div>
                  <div style={styles.txSub}>{t(lang, STATUS_LABEL_KEY[tp.status])}</div>
                </div>
                <span style={styles.badgePending}>{t(lang, STATUS_LABEL_KEY[tp.status])}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={styles.kicker}>{t(lang, "walletHistory")}</p>
      <div style={styles.card}>
        {transactions.length === 0 ? (
          <p style={{ ...styles.muted, textAlign: "center", padding: "12px 0" }}>{t(lang, "walletNoTx")}</p>
        ) : (
          transactions.map((tx) => {
            const credit = tx.amount_fen >= 0;
            return (
              <div key={tx.id} style={styles.txRow}>
                <div>
                  <div style={styles.txTitle}>{t(lang, TX_LABEL_KEY[tx.type] ?? "txAdjustment")}</div>
                  <div style={styles.txSub}>{new Date(tx.created_at + "Z").toLocaleString(lang === "en" ? "en-GB" : "ru-RU")}</div>
                </div>
                <span style={{ ...styles.txAmount, color: credit ? "#1a8f4c" : "var(--text)" }}>
                  {credit ? "+" : "−"}{fmtUsd(Math.abs(tx.amount_fen))}
                </span>
              </div>
            );
          })
        )}
      </div>

      {instructions && (
        <div style={styles.overlay} onClick={() => setInstructions(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.sheetTitle}>{t(lang, "walletInstructionsTitle")}</h3>
            <div style={styles.amountSummary}>
              <span style={styles.payValue}>{fmtUsd(instructions.amountCents)}</span>
            </div>
            <p style={styles.instrText}>{instructions.instructions}</p>
            {instructions.payTo && (
              <div style={styles.payToBox}>
                <div style={styles.muted}>{t(lang, "walletPayTo")}</div>
                <div style={styles.payToValue}>{instructions.payTo}</div>
              </div>
            )}
            <div style={styles.secureNote}><LockIcon /><span>{t(lang, "walletSecureNote")}</span></div>
            <button type="button" style={{ ...styles.cta, marginTop: 14 }} onClick={() => setInstructions(null)}>
              {t(lang, "walletDone")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  title: { marginBottom: 16 },
  balanceCard: {
    background: "var(--accent)",
    color: "#fff",
    borderRadius: 18,
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  balanceLabel: { fontSize: 12, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.08em" },
  balanceValue: { fontSize: 34, fontWeight: 800, fontFamily: "Unbounded, sans-serif", lineHeight: 1 },
  errorBox: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    color: "var(--muted)",
  },
  retryBtn: {
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "5px 12px",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "20px 0 10px",
  },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 },
  presetRow: { display: "flex", gap: 8, marginBottom: 14 },
  preset: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  presetActive: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  fieldLabel: { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 16,
    fontFamily: "inherit",
  },
  hint: { fontSize: 11, color: "var(--muted)", margin: "10px 0 14px" },
  cta: {
    width: "100%",
    padding: "13px 0",
    borderRadius: 12,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  ctaDisabled: { opacity: 0.45, cursor: "not-allowed" },
  secureNote: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 10,
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.4,
  },
  txRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  txTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  txSub: { fontSize: 11, color: "var(--muted)", marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" },
  badgePending: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--accent)",
    background: "rgba(165,42,42,0.1)",
    padding: "4px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  muted: { color: "var(--muted)", fontSize: 12 },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 2000,
  },
  sheet: {
    width: "100%",
    maxWidth: 460,
    background: "var(--bg)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px 18px max(20px, env(safe-area-inset-bottom))",
    boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
  },
  sheetTitle: { fontSize: 18, fontWeight: 800, margin: "0 0 14px", color: "var(--text)" },
  amountSummary: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 },
  payValue: { fontSize: 22, fontWeight: 800, color: "var(--text)" },
  instrText: { fontSize: 13, lineHeight: 1.5, color: "var(--text)", margin: "0 0 14px", whiteSpace: "pre-wrap" },
  payToBox: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    marginBottom: 6,
  },
  payToValue: { fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2, wordBreak: "break-all" },
};
