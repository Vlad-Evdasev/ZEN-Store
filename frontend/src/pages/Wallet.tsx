import { useEffect, useMemo, useState } from "react";
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
  onOrders: () => void;
}

const PRESETS = [100, 300, 500, 1000];

/** Formats fen (1 CNY = 100 fen) as a ¥ amount. */
function fmtCny(fen: number): string {
  const yuan = fen / 100;
  return `¥${yuan.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;
}

/** Formats local minor units (kopecks) as a BYN amount. */
function fmtByn(kopecks: number): string {
  return `${(kopecks / 100).toFixed(2)} BYN`;
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

export function Wallet({ userId, onBack, onOrders }: WalletProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [balanceFen, setBalanceFen] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [topups, setTopups] = useState<TopupRequest[]>([]);

  const [rate, setRate] = useState(0.46);
  const [minCny, setMinCny] = useState(50);
  const [amount, setAmount] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [instructions, setInstructions] = useState<(TopupInstructions & { amountLocal: number; amountCny: number }) | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!userId) return;
    setError(false);
    try {
      const [w, cfg, tps] = await Promise.all([getWallet(userId), getTopupConfig(), getTopups(userId)]);
      setBalanceFen(w.balance_fen);
      setTransactions(w.transactions);
      setRate(cfg.cny_byn_rate);
      setMinCny(cfg.topup_min_cny);
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
  const amountValid = Number.isInteger(amountNum) && amountNum >= minCny;
  const bynToPay = useMemo(
    () => (amountValid ? Math.round(amountNum * rate * 100) : 0),
    [amountValid, amountNum, rate]
  );

  const pendingTopups = topups.filter((tp) => tp.status === "pending" || tp.status === "processing");

  const submit = async () => {
    if (!amountValid || submitting) return;
    setSubmitting(true);
    try {
      const { instructions: instr } = await createTopup(userId, amountNum);
      setInstructions({ ...instr, amountLocal: bynToPay, amountCny: amountNum });
      setAmount("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const copyPayTo = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard может быть недоступен — игнорируем */
    }
  };

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "wallet")}</h2>

      {/* Баланс */}
      <div style={styles.balanceCard}>
        <span style={styles.balanceLabel}>{t(lang, "walletBalance")}</span>
        <span style={styles.balanceValue}>{loading ? "…" : fmtCny(balanceFen)}</span>
      </div>

      <button type="button" style={styles.ordersLink} onClick={onOrders}>
        {t(lang, "cargoOrders")} ›
      </button>

      {error && (
        <div style={styles.errorBox}>
          <span>{t(lang, "walletError")}</span>
          <button type="button" style={styles.retryBtn} onClick={() => { setLoading(true); load(); }}>
            {t(lang, "walletRetry")}
          </button>
        </div>
      )}

      {/* Пополнение */}
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
              ¥{p}
            </button>
          ))}
        </div>
        <label style={styles.fieldLabel}>{t(lang, "walletTopupAmount")}</label>
        <input
          type="number"
          inputMode="numeric"
          min={minCny}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(minCny)}
          style={styles.input}
        />
        <div style={styles.payRow}>
          <span style={styles.muted}>{t(lang, "walletYouPay")}</span>
          <span style={styles.payValue}>{amountValid ? fmtByn(bynToPay) : "—"}</span>
        </div>
        <p style={styles.hint}>{t(lang, "walletMin").replace("{n}", String(minCny))}</p>
        <button
          type="button"
          disabled={!amountValid || submitting}
          onClick={submit}
          style={{ ...styles.cta, ...(!amountValid || submitting ? styles.ctaDisabled : {}) }}
        >
          {t(lang, "walletTopupBtn")}
        </button>
      </div>

      {/* Ожидающие подтверждения заявки */}
      {pendingTopups.length > 0 && (
        <>
          <p style={styles.kicker}>{t(lang, "walletPendingTitle")}</p>
          <div style={styles.card}>
            {pendingTopups.map((tp) => (
              <div key={tp.id} style={styles.txRow}>
                <div>
                  <div style={styles.txTitle}>{fmtCny(tp.amount_fen)}</div>
                  <div style={styles.txSub}>{fmtByn(tp.amount_local)} · {t(lang, STATUS_LABEL_KEY[tp.status])}</div>
                </div>
                <span style={styles.badgePending}>{t(lang, STATUS_LABEL_KEY[tp.status])}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* История операций */}
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
                  {credit ? "+" : "−"}{fmtCny(Math.abs(tx.amount_fen))}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Модалка с реквизитами после создания заявки */}
      {instructions && (
        <div style={styles.overlay} onClick={() => setInstructions(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.sheetTitle}>{t(lang, "walletInstructionsTitle")}</h3>
            <div style={styles.amountSummary}>
              <span style={styles.payValue}>{fmtByn(instructions.amountLocal)}</span>
              <span style={styles.muted}>≈ ¥{instructions.amountCny}</span>
            </div>
            <p style={styles.instrText}>{instructions.instructions}</p>
            {instructions.payTo && (
              <div style={styles.payToBox}>
                <div>
                  <div style={styles.muted}>{t(lang, "walletPayTo")}</div>
                  <div style={styles.payToValue}>{instructions.payTo}</div>
                </div>
                <button type="button" style={styles.copyBtn} onClick={() => copyPayTo(instructions.payTo!)}>
                  {copied ? t(lang, "walletCopied") : t(lang, "walletCopy")}
                </button>
              </div>
            )}
            <button type="button" style={styles.cta} onClick={() => setInstructions(null)}>
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
  ordersLink: {
    width: "100%",
    marginTop: 10,
    padding: "12px 14px",
    borderRadius: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
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
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
  },
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
  payRow: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 4px" },
  payValue: { fontSize: 18, fontWeight: 800, color: "var(--text)" },
  hint: { fontSize: 11, color: "var(--muted)", margin: "0 0 14px" },
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
    padding: 0,
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
  instrText: { fontSize: 13, lineHeight: 1.5, color: "var(--text)", margin: "0 0 14px", whiteSpace: "pre-wrap" },
  payToBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    marginBottom: 16,
  },
  payToValue: { fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2, wordBreak: "break-all" },
  copyBtn: {
    flexShrink: 0,
    background: "none",
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    borderRadius: 999,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
