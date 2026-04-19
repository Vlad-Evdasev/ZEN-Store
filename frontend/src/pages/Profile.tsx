import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n";
import type { Order, Product } from "../api";

interface ProfileProps {
  userName: string | null;
  firstName: string;
  onBack: () => void;
  onOpenDeliveryTerms?: () => void;
  onOpenSupport?: () => void;
  supportUnreadCount?: number;
  recentOrders?: Order[];
  favoriteProducts?: Product[];
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onProductClick?: (id: number) => void;
}

function formatShortDate(s: string, lang: string) {
  try {
    return new Date(s).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" });
  } catch { return s; }
}

export function Profile({
  userName,
  firstName,
  onOpenDeliveryTerms,
  onOpenSupport,
  supportUnreadCount = 0,
  recentOrders = [],
  favoriteProducts = [],
  onOpenHistory,
  onOpenSettings,
  onProductClick,
}: ProfileProps) {
  const { settings, formatPrice } = useSettings();
  const lang = settings.lang;
  const initial = (firstName?.[0] || "?").toUpperCase();

  return (
    <div style={styles.wrap}>
      <div style={styles.hero}>
        <div style={styles.avatarWrap}><div style={styles.avatar}>{initial}</div></div>
        <h2 style={styles.name}>{firstName}</h2>
        {userName && <p style={styles.username}>{userName}</p>}
      </div>

      {recentOrders.length > 0 && (
        <>
          <p style={styles.kicker}>{t(lang, "profileRecentOrders")}</p>
          <div
            style={{ ...styles.sectionList, cursor: onOpenHistory ? "pointer" : "default" }}
            onClick={onOpenHistory}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onOpenHistory?.(); }}
          >
            {recentOrders.map((o) => {
              let items: { name?: string; image_url?: string; quantity?: number }[] = [];
              try { items = JSON.parse(o.items); } catch {}
              const first = items[0];
              return (
                <div key={o.id} style={styles.orderRow}>
                  {first?.image_url
                    ? <img src={first.image_url} alt="" style={styles.thumb} />
                    : <div style={{ ...styles.thumb, background: "var(--surface-elevated)" }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={styles.orderName}>{first?.name || "Товар"} × {first?.quantity || 1}</p>
                    <p style={styles.orderMeta}>{formatShortDate(o.created_at, lang)} · #{o.id}</p>
                  </div>
                  <span style={styles.orderTotal}>{formatPrice(o.total)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p style={styles.kicker}>{t(lang, "profileFavorites")}</p>
      {favoriteProducts.length > 0 ? (
        <div style={styles.favRow}>
          {favoriteProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProductClick?.(p.id)}
              style={styles.favBtn}
              aria-label={p.name ?? undefined}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" style={styles.favThumb} />
              ) : (
                <div style={{ ...styles.favThumb, background: "var(--surface-elevated)" }} />
              )}
            </button>
          ))}
        </div>
      ) : (
        <p style={styles.emptyHint}>{t(lang, "profileFavoritesEmpty")}</p>
      )}

      <p style={styles.kicker}>{t(lang, "profileActions")}</p>
      <div style={styles.actions}>
        {onOpenDeliveryTerms && (
          <ActionRow icon="📋" label={t(lang, "profileDeliveryTerms")} onClick={onOpenDeliveryTerms} />
        )}
        {onOpenSupport && (
          <ActionRow icon="💬" label={t(lang, "profileSupport")} onClick={onOpenSupport} badge={supportUnreadCount} />
        )}
        {onOpenSettings && (
          <ActionRow icon="⚙︎" label={t(lang, "settings")} onClick={onOpenSettings} />
        )}
      </div>
    </div>
  );
}

function ActionRow({ icon, label, onClick, badge = 0 }: { icon: string; label: string; onClick: () => void; badge?: number }) {
  return (
    <button type="button" onClick={onClick} style={styles.actionBtn}>
      <span style={styles.actionIco}>{icon}</span>
      <span style={styles.actionLabel}>{label}</span>
      {badge > 0 && <span style={styles.badge}>{badge > 99 ? "99+" : badge}</span>}
      <span style={styles.chev} aria-hidden>›</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: "8px 0 96px" },
  hero: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0 4px" },
  avatarWrap: {
    width: 64, height: 64, borderRadius: "50%",
    background: "linear-gradient(135deg, var(--accent), var(--accent-dim))",
    padding: 2.5,
  },
  avatar: {
    width: "100%", height: "100%", borderRadius: "50%",
    background: "var(--bg)",
    color: "var(--accent)",
    fontSize: 26, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: 700, margin: 0 },
  username: { fontSize: 12, color: "var(--muted)", margin: 0 },
  kicker: {
    fontSize: 11, fontWeight: 600, color: "var(--muted)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    margin: "22px 0 10px",
  },
  sectionList: {
    display: "flex", flexDirection: "column", gap: 8,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: 8,
  },
  orderRow: { display: "flex", alignItems: "center", gap: 10, padding: 4 },
  thumb: { width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  orderName: { fontSize: 13, fontWeight: 600, margin: 0 },
  orderMeta: { fontSize: 11, color: "var(--muted)", margin: 0, marginTop: 2 },
  orderTotal: { fontSize: 13, fontWeight: 700, color: "var(--accent)" },
  favRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 },
  favBtn: {
    width: 56, height: 56, borderRadius: 12,
    border: "1px solid var(--border)", padding: 0, overflow: "hidden",
    background: "var(--surface)", cursor: "pointer", flexShrink: 0,
  },
  favThumb: { width: "100%", height: "100%", objectFit: "cover" },
  emptyHint: { textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "14px 8px", margin: 0 },
  actions: { display: "flex", flexDirection: "column", gap: 10 },
  actionBtn: {
    display: "flex", alignItems: "center", gap: 10,
    padding: 14, background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 14,
    color: "var(--text)", fontSize: 14, fontFamily: "inherit",
    cursor: "pointer", textAlign: "left", position: "relative",
  },
  actionIco: {
    width: 32, height: 32, borderRadius: 10,
    background: "rgba(165,42,42,0.08)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
    flexShrink: 0,
  },
  actionLabel: { flex: 1, fontSize: 13 },
  badge: {
    minWidth: 20, height: 20, padding: "0 6px",
    borderRadius: 10, background: "var(--accent)", color: "#fff",
    fontSize: 11, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  chev: { color: "var(--muted)", fontSize: 16 },
};
