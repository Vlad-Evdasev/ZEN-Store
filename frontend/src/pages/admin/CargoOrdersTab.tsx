import { useEffect, useState } from "react";
import {
  getCargoOrdersAdmin,
  quoteCargoOrder,
  warehouseCargoOrder,
  advanceCargoOrder,
  cancelCargoOrderAdmin,
  deleteCargoOrderAdmin,
  type CargoOrder,
  type CargoStatus,
} from "../../api";

const fmtCny = (fen: number) => `¥${(fen / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;

const STATUS_RU: Record<CargoStatus, string> = {
  new: "Новый",
  quoted: "Оценён",
  paid: "Оплачен",
  purchasing: "Выкуплен",
  at_warehouse: "На складе",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const FILTERS: Array<{ key: CargoStatus | "all"; label: string }> = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "quoted", label: "Оценённые" },
  { key: "paid", label: "Оплачены" },
  { key: "at_warehouse", label: "На складе" },
  { key: "shipped", label: "Отправлены" },
];

export function CargoOrdersTab({ adminSecret }: { adminSecret: string }) {
  const [rows, setRows] = useState<CargoOrder[]>([]);
  const [filter, setFilter] = useState<CargoStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  // Локальные поля ввода по заказу
  const [price, setPrice] = useState<Record<number, string>>({});
  const [weight, setWeight] = useState<Record<number, string>>({});
  const [fee, setFee] = useState<Record<number, string>>({});
  const [track, setTrack] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      const r = await getCargoOrdersAdmin(adminSecret, filter === "all" ? undefined : filter);
      setRows(r);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h2 style={S.h}>Заказы карго</h2>
      <div style={S.filters}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ ...S.chip, ...(filter === f.key ? S.chipActive : {}) }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <p>Загрузка…</p> : rows.length === 0 ? <p style={S.muted}>Нет заказов</p> : rows.map((o) => {
        const b = busy === o.id;
        return (
          <div key={o.id} style={S.card}>
            <div style={S.rowBetween}>
              <div>
                <div style={S.big}>#{o.id} · {o.title || "Без названия"}</div>
                <div style={S.muted}>{o.source === "catalog" ? "Из каталога" : "По ссылке"} · {o.quantity} шт · user {o.user_id}</div>
                {o.options && <div style={S.muted}>{o.options}</div>}
                {o.product_url && <a href={o.product_url} target="_blank" rel="noreferrer" style={S.link}>ссылка ↗</a>}
                {o.user_username && <div style={S.muted}>{o.user_username}</div>}
                {o.user_address && <div style={S.muted}>📦 {o.user_address}</div>}
              </div>
              <span style={S.badge}>{STATUS_RU[o.status]}</span>
            </div>

            {o.price_fen != null && (
              <div style={S.sums}>
                Товар {fmtCny(o.price_fen)}
                {o.commission_fen != null && ` · комиссия ${fmtCny(o.commission_fen)}`}
                {o.cargo_fee_fen != null && ` · доставка ${fmtCny(o.cargo_fee_fen)}`}
                {o.weight_g != null && ` · ${o.weight_g} г`}
                {o.track_no && ` · трек ${o.track_no}`}
              </div>
            )}

            {/* Оценка */}
            {(o.status === "new" || o.status === "quoted") && (
              <div style={S.actionRow}>
                <input style={S.inp} type="number" placeholder="Цена товара, ¥"
                  value={price[o.id] ?? ""} onChange={(e) => setPrice({ ...price, [o.id]: e.target.value })} />
                <button style={S.btn} disabled={b} onClick={() => act(o.id, () => quoteCargoOrder(o.id, parseInt(price[o.id], 10), adminSecret))}>
                  Оценить
                </button>
              </div>
            )}

            {/* Выкуплен */}
            {o.status === "paid" && (
              <div style={S.actionRow}>
                <input style={S.inp} placeholder="Трек-номер" value={track[o.id] ?? ""} onChange={(e) => setTrack({ ...track, [o.id]: e.target.value })} />
                <button style={S.btn} disabled={b} onClick={() => act(o.id, () => advanceCargoOrder(o.id, { status: "purchasing", track_no: track[o.id] || undefined }, adminSecret))}>
                  Выкуплен
                </button>
              </div>
            )}

            {/* Склад: вес + доставка */}
            {(o.status === "paid" || o.status === "purchasing") && (
              <div style={S.actionRow}>
                <input style={S.inp} type="number" placeholder="Вес, г" value={weight[o.id] ?? ""} onChange={(e) => setWeight({ ...weight, [o.id]: e.target.value })} />
                <input style={S.inp} type="number" placeholder="Доставка, ¥" value={fee[o.id] ?? ""} onChange={(e) => setFee({ ...fee, [o.id]: e.target.value })} />
                <button style={S.btn} disabled={b} onClick={() => act(o.id, () => warehouseCargoOrder(o.id, { weight_g: parseInt(weight[o.id], 10), cargo_fee_cny: parseInt(fee[o.id], 10) }, adminSecret))}>
                  На склад
                </button>
              </div>
            )}

            {/* Доставлен */}
            {o.status === "shipped" && (
              <div style={S.actionRow}>
                <button style={S.btn} disabled={b} onClick={() => act(o.id, () => advanceCargoOrder(o.id, { status: "delivered" }, adminSecret))}>
                  Доставлен
                </button>
              </div>
            )}

            <div style={S.actions}>
              {!["delivered", "cancelled"].includes(o.status) && (
                <button style={S.btnGhost} disabled={b} onClick={() => { if (confirm("Отменить заказ и вернуть деньги?")) act(o.id, () => cancelCargoOrderAdmin(o.id, "Отменён оператором", adminSecret)); }}>
                  Отменить + возврат
                </button>
              )}
              <button style={S.btnGhost} disabled={b} onClick={() => { if (confirm("Удалить заказ?")) act(o.id, () => deleteCargoOrderAdmin(o.id, adminSecret)); }}>
                Удалить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  h: { fontSize: 16, fontWeight: 800, margin: "0 0 12px" },
  filters: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  chip: { padding: "6px 12px", borderRadius: 999, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  chipActive: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12 },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  big: { fontSize: 15, fontWeight: 800 },
  muted: { color: "var(--muted)", fontSize: 12, marginTop: 2 },
  link: { display: "inline-block", marginTop: 4, fontSize: 12, color: "var(--accent)", textDecoration: "none" },
  badge: { fontSize: 12, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" },
  sums: { marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 13 },
  actionRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  actions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  inp: { flex: 1, minWidth: 90, boxSizing: "border-box", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, fontFamily: "inherit" },
  btn: { padding: "9px 16px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  btnGhost: { padding: "9px 16px", borderRadius: 8, background: "none", border: "1px solid var(--border)", color: "var(--text)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};
