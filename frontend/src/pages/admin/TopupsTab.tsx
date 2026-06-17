import { useEffect, useState } from "react";
import {
  getTopupsAdmin,
  confirmTopupAdmin,
  rejectTopupAdmin,
  getWalletConfigAdmin,
  updateWalletConfigAdmin,
  type TopupRequest,
  type WalletConfigAdmin,
} from "../../api";

const fmtCny = (fen: number) => `¥${(fen / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;
const fmtByn = (kop: number) => `${(kop / 100).toFixed(2)} BYN`;

const STATUS_RU: Record<string, string> = {
  pending: "Ожидает",
  processing: "Проверяется",
  completed: "Зачислено",
  rejected: "Отклонено",
  failed: "Ошибка",
};

export function TopupsTab({ adminSecret }: { adminSecret: string }) {
  const [rows, setRows] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [cfg, setCfg] = useState<WalletConfigAdmin | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);

  const load = async () => {
    try {
      const [r, c] = await Promise.all([getTopupsAdmin(adminSecret), getWalletConfigAdmin(adminSecret)]);
      setRows(r);
      setCfg(c);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const saveCfg = async () => {
    if (!cfg) return;
    setSavingCfg(true);
    try {
      const saved = await updateWalletConfigAdmin(adminSecret, cfg);
      setCfg(saved);
      alert("Сохранено");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingCfg(false);
    }
  };

  if (loading) return <p>Загрузка…</p>;

  const pending = rows.filter((r) => r.status === "pending" || r.status === "processing");
  const rest = rows.filter((r) => r.status !== "pending" && r.status !== "processing");

  return (
    <div>
      <h2 style={S.h}>Настройки пополнения</h2>
      {cfg && (
        <div style={S.card}>
          <label style={S.lbl}>Курс: BYN за 1 ¥</label>
          <input style={S.inp} type="number" step="0.01" value={cfg.cny_byn_rate}
            onChange={(e) => setCfg({ ...cfg, cny_byn_rate: Number(e.target.value) })} />
          <label style={S.lbl}>Минимум пополнения, ¥</label>
          <input style={S.inp} type="number" value={cfg.topup_min_cny}
            onChange={(e) => setCfg({ ...cfg, topup_min_cny: Number(e.target.value) })} />
          <label style={S.lbl}>Реквизиты для оплаты (карта/телефон)</label>
          <input style={S.inp} value={cfg.topup_pay_to}
            onChange={(e) => setCfg({ ...cfg, topup_pay_to: e.target.value })} />
          <label style={S.lbl}>Инструкция для клиента</label>
          <textarea style={{ ...S.inp, minHeight: 70 }} value={cfg.topup_instructions}
            onChange={(e) => setCfg({ ...cfg, topup_instructions: e.target.value })} />
          <button style={S.btn} disabled={savingCfg} onClick={saveCfg}>Сохранить настройки</button>
        </div>
      )}

      <h2 style={S.h}>Заявки на пополнение ({pending.length})</h2>
      {pending.length === 0 && <p style={S.muted}>Нет ожидающих заявок</p>}
      {pending.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={S.rowBetween}>
            <div>
              <div style={S.big}>{fmtCny(r.amount_fen)}</div>
              <div style={S.muted}>#{r.id} · {fmtByn(r.amount_local)} · user {r.user_id}</div>
              <div style={S.muted}>{r.created_at}</div>
            </div>
            <span style={S.badge}>{STATUS_RU[r.status] || r.status}</span>
          </div>
          <div style={S.actions}>
            <button style={S.btn} disabled={busy === r.id} onClick={() => act(r.id, () => confirmTopupAdmin(r.id, adminSecret))}>
              Подтвердить
            </button>
            <button style={S.btnGhost} disabled={busy === r.id} onClick={() => act(r.id, () => rejectTopupAdmin(r.id, adminSecret))}>
              Отклонить
            </button>
          </div>
        </div>
      ))}

      <h2 style={S.h}>История ({rest.length})</h2>
      {rest.map((r) => (
        <div key={r.id} style={S.histRow}>
          <span>#{r.id} · {fmtCny(r.amount_fen)} · user {r.user_id}</span>
          <span style={S.muted}>{STATUS_RU[r.status] || r.status}</span>
        </div>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  h: { fontSize: 16, fontWeight: 800, margin: "18px 0 10px" },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12 },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  big: { fontSize: 18, fontWeight: 800 },
  muted: { color: "var(--muted)", fontSize: 12 },
  badge: { fontSize: 12, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" },
  actions: { display: "flex", gap: 8, marginTop: 12 },
  lbl: { display: "block", fontSize: 12, color: "var(--muted)", margin: "8px 0 4px" },
  inp: { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, fontFamily: "inherit" },
  btn: { padding: "9px 16px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
  btnGhost: { padding: "9px 16px", borderRadius: 8, background: "none", border: "1px solid var(--border)", color: "var(--text)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
  histRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--border)" },
};
