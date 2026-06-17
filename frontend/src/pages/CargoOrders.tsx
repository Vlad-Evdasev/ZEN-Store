import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import { BackButton } from "../components/BackButton";
import {
  getCargoOrders,
  createCargoOrder,
  payCargoGoods,
  payCargoShipping,
  cancelCargoOrder,
  getWallet,
  type CargoOrder,
  type CargoStatus,
} from "../api";

interface CargoOrdersProps {
  userId: string;
  onBack: () => void;
  onTopup: () => void;
  initialFormOpen?: boolean;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_KEY: Record<CargoStatus, string> = {
  new: "cargoStatusNew",
  quoted: "cargoStatusQuoted",
  paid: "cargoStatusPaid",
  purchasing: "cargoStatusPurchasing",
  at_warehouse: "cargoStatusAtWarehouse",
  shipped: "cargoStatusShipped",
  delivered: "cargoStatusDelivered",
  cancelled: "cargoStatusCancelled",
};

function statusColor(status: CargoStatus): string {
  if (status === "delivered") return "#1a8f4c";
  if (status === "cancelled") return "var(--muted)";
  if (status === "quoted" || status === "at_warehouse") return "var(--accent)";
  return "var(--text)";
}

export function CargoOrders({ userId, onBack, onTopup, initialFormOpen = false }: CargoOrdersProps) {
  const { settings } = useSettings();
  const lang = settings.lang;

  const [orders, setOrders] = useState<CargoOrder[]>([]);
  const [balanceFen, setBalanceFen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(initialFormOpen);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState("");
  const [qty, setQty] = useState("1");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!userId) return;
    try {
      const [o, w] = await Promise.all([getCargoOrders(userId), getWallet(userId).catch(() => null)]);
      setOrders(o);
      if (w) setBalanceFen(w.balance_fen);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submitNew = async () => {
    if (!url.trim() || creating) return;
    setCreating(true);
    try {
      const q = parseInt(qty, 10);
      await createCargoOrder(userId, {
        source: "link",
        product_url: url.trim(),
        title: title.trim() || undefined,
        options: options.trim() || undefined,
        quantity: Number.isInteger(q) && q > 0 ? q : 1,
      });
      setUrl(""); setTitle(""); setOptions(""); setQty("1"); setFormOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (msg === "insufficient_funds") alert(t(lang, "cargoInsufficient"));
      else alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={styles.wrap}>
      <BackButton onClick={onBack} label={t(lang, "back")} />
      <h2 className="zen-page-title" style={styles.title}>{t(lang, "cargoOrders")}</h2>

      {/* Создание заказа по ссылке */}
      <button type="button" style={styles.newToggle} onClick={() => setFormOpen((v) => !v)}>
        + {t(lang, "cargoNewByLink")}
      </button>
      {formOpen && (
        <div style={styles.card}>
          <input style={styles.input} placeholder={t(lang, "cargoLinkPlaceholder")} value={url} onChange={(e) => setUrl(e.target.value)} />
          <input style={styles.input} placeholder={t(lang, "cargoTitlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input style={styles.input} placeholder={t(lang, "cargoOptionsPlaceholder")} value={options} onChange={(e) => setOptions(e.target.value)} />
          <div style={styles.qtyRow}>
            <span style={styles.muted}>{t(lang, "cargoQty")}</span>
            <input style={{ ...styles.input, width: 70, margin: 0 }} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <button type="button" disabled={!url.trim() || creating} onClick={submitNew} style={{ ...styles.cta, ...(!url.trim() || creating ? styles.ctaDisabled : {}) }}>
            {t(lang, "cargoCreate")}
          </button>
        </div>
      )}

      {/* Список заказов */}
      {loading ? (
        <p style={{ ...styles.muted, textAlign: "center", padding: 24 }}>…</p>
      ) : orders.length === 0 ? (
        <p style={{ ...styles.muted, textAlign: "center", padding: 24 }}>{t(lang, "cargoEmpty")}</p>
      ) : (
        orders.map((o) => {
          const goodsTotal = (o.price_fen ?? 0) + (o.commission_fen ?? 0);
          const canPayGoods = o.status === "quoted" && o.price_fen != null;
          const canPayCargo = o.status === "at_warehouse" && o.cargo_fee_fen != null;
          const canCancel = o.status === "new" || o.status === "quoted";
          const goodsAfford = balanceFen >= goodsTotal;
          const cargoAfford = balanceFen >= (o.cargo_fee_fen ?? 0);
          const busy = busyId === o.id;

          return (
            <div key={o.id} style={styles.orderCard}>
              <div style={styles.orderHead}>
                <span style={styles.orderTitle}>{o.title || t(lang, "cargoGoods")}</span>
                <span style={{ ...styles.statusBadge, color: statusColor(o.status) }}>{t(lang, STATUS_KEY[o.status])}</span>
              </div>
              <div style={styles.orderMeta}>
                {t(lang, "cargoOrderNo")}{o.id} · {o.quantity} {t(lang, "cargoQty").toLowerCase()}
              </div>
              {o.options && <div style={styles.orderOptions}>{o.options}</div>}
              {o.product_url && (
                <a href={o.product_url} target="_blank" rel="noreferrer" style={styles.link}>{t(lang, "cargoOpenLink")} ↗</a>
              )}

              {/* Суммы */}
              {o.price_fen != null && (
                <div style={styles.sums}>
                  <div style={styles.sumRow}><span style={styles.muted}>{t(lang, "cargoGoods")}</span><span>{fmtUsd(o.price_fen)}</span></div>
                  {o.commission_fen != null && (
                    <div style={styles.sumRow}><span style={styles.muted}>{t(lang, "cargoCommission")}</span><span>{fmtUsd(o.commission_fen)}</span></div>
                  )}
                  {o.cargo_fee_fen != null && (
                    <div style={styles.sumRow}>
                      <span style={styles.muted}>{t(lang, "cargoShippingFee")}{o.weight_g ? ` · ${o.weight_g} ${t(lang, "cargoWeight").toLowerCase()}` : ""}</span>
                      <span>{fmtUsd(o.cargo_fee_fen)}</span>
                    </div>
                  )}
                </div>
              )}

              {o.track_no && (o.status === "shipped" || o.status === "delivered") && (
                <div style={styles.trackBox}>{t(lang, "cargoTrack")}: <b>{o.track_no}</b></div>
              )}

              {/* Действия */}
              {canPayGoods && (
                <>
                  {!goodsAfford && <p style={styles.warn}>{t(lang, "cargoInsufficient")}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (goodsAfford ? act(o.id, () => payCargoGoods(userId, o.id)) : onTopup())}
                    style={styles.cta}
                  >
                    {goodsAfford ? `${t(lang, "cargoPayGoods")} · ${fmtUsd(goodsTotal)}` : t(lang, "walletTopupBtn")}
                  </button>
                </>
              )}
              {canPayCargo && (
                <>
                  {!cargoAfford && <p style={styles.warn}>{t(lang, "cargoInsufficient")}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (cargoAfford ? act(o.id, () => payCargoShipping(userId, o.id)) : onTopup())}
                    style={styles.cta}
                  >
                    {cargoAfford ? `${t(lang, "cargoPayShipping")} · ${fmtUsd(o.cargo_fee_fen!)}` : t(lang, "walletTopupBtn")}
                  </button>
                </>
              )}
              {canCancel && (
                <button type="button" disabled={busy} onClick={() => act(o.id, () => cancelCargoOrder(userId, o.id))} style={styles.cancelBtn}>
                  {t(lang, "cargoCancel")}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  title: { marginBottom: 14 },
  newToggle: {
    width: "100%",
    padding: "11px 0",
    borderRadius: 12,
    background: "var(--surface)",
    border: "1px dashed var(--border)",
    color: "var(--accent)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 14,
  },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 18 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 15,
    fontFamily: "inherit",
    marginBottom: 10,
  },
  qtyRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cta: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 12,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: 4,
  },
  ctaDisabled: { opacity: 0.45, cursor: "not-allowed" },
  cancelBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 12,
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: 8,
  },
  orderCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 12 },
  orderHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  orderTitle: { fontSize: 15, fontWeight: 700, color: "var(--text)" },
  statusBadge: { fontSize: 11, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 },
  orderMeta: { fontSize: 11, color: "var(--muted)", marginTop: 3 },
  orderOptions: { fontSize: 13, color: "var(--text)", marginTop: 6 },
  link: { display: "inline-block", marginTop: 6, fontSize: 12, color: "var(--accent)", textDecoration: "none" },
  sums: { marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" },
  sumRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text)", padding: "3px 0" },
  trackBox: { marginTop: 8, fontSize: 12, color: "var(--text)" },
  warn: { fontSize: 12, color: "var(--accent)", margin: "8px 0 0" },
  muted: { color: "var(--muted)", fontSize: 12 },
};
