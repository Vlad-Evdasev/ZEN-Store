import { useState, useEffect, useRef } from "react";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  verifyAdmin,
  checkApiHealth,
  getOrdersAdmin,
  getCustomOrdersAdmin,
  updateOrderStatus,
  deleteOrderAdmin,
  updateCustomOrderStatusAdmin,
  updateCustomOrderContentAdmin,
  deleteCustomOrderAdmin,
  duplicateCustomOrderAdmin,
  getCurrencyRateAdmin,
  updateCurrencyRateAdmin,
  sendBroadcast,
  getBroadcasts,
  updateBroadcast,
  deleteBroadcastPost,
  getBotUsersCount,
  getConversations,
  getConversationsUnreadCount,
  getConversationMessages,
  markConversationRead,
  replyToConversation,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  getSupportEntries,
  createSupportEntry,
  updateSupportEntry,
  deleteSupportEntry,
  type Product,
  type Category,
  type Order,
  type CustomOrderAdmin,
  type Post,
  type BroadcastPost,
  type BotConversation,
  type BotMessage,
  type SupportEntry,
} from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// Семантический pill статуса заказа/заявки. Цвет → этап в воронке:
// review (warn), pending (info), in_transit (info), delivered (success),
// completed (neutral). Используется и в каталог-заказах, и в кастом-заявках.
function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; variant: "neutral" | "info" | "warn" | "success" | "danger" }> = {
    review: { label: "На модерации", variant: "warn" },
    pending: { label: "Оформлен", variant: "info" },
    in_transit: { label: "В пути", variant: "info" },
    delivered: { label: "Доставлено", variant: "success" },
    completed: { label: "Завершён", variant: "neutral" },
  };
  const c = cfg[status] ?? { label: status, variant: "neutral" };
  return <span className={`admin-status admin-status--${c.variant}`}>{c.label}</span>;
}

function NavIcon({ tab }: { tab: "products" | "categories" | "orders" | "customOrders" | "currencyRate" | "posts" | "channel" | "chats" | "support" }) {
  switch (tab) {
    case "products":
      return (<svg viewBox="0 0 24 24" aria-hidden><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>);
    case "categories":
      return (<svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>);
    case "orders":
      return (<svg viewBox="0 0 24 24" aria-hidden><path d="M9 3h6l1 4H8z"/><rect x="4" y="7" width="16" height="14" rx="2"/></svg>);
    case "customOrders":
      return (<svg viewBox="0 0 24 24" aria-hidden><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 14l2 2 4-4"/></svg>);
    case "currencyRate":
      return (<svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9h5a2 2 0 010 4H9.5a2 2 0 000 4H15"/></svg>);
    case "posts":
      return (<svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>);
    case "channel":
      return (<svg viewBox="0 0 24 24" aria-hidden><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>);
    case "chats":
      return (<svg viewBox="0 0 24 24" aria-hidden><path d="M21 11.5a8.4 8.4 0 01-1.2 4.4 8.5 8.5 0 01-7.4 4.1 8.4 8.4 0 01-4.4-1.2L3 20l1.2-4.9A8.4 8.4 0 013 10.5a8.5 8.5 0 014.2-7.4A8.4 8.4 0 0111.5 2h.5a8.5 8.5 0 018 8z"/></svg>);
    case "support":
      return (<svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M9.1 9.5a3 3 0 015.8 1c0 1.5-1.5 2-2.4 2.5-.4.2-.5.5-.5.9V14"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>);
  }
}

/** Ссылка для открытия диалога с пользователем в Telegram */
function telegramChatLink(username?: string | null, userId?: string): string {
  if (username && String(username).trim()) {
    const u = String(username).trim().replace(/^@/, "");
    if (u) return `https://t.me/${u}`;
  }
  if (userId) return `tg://user?id=${userId}`;
  return "#";
}

type Tab = "products" | "categories" | "orders" | "customOrders" | "currencyRate" | "posts" | "channel" | "chats" | "support";

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [chatsUnread, setChatsUnread] = useState(0);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; url: string; error?: string } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const adminMainRef = useRef<HTMLElement | null>(null);

  const refresh = () => {
    setRefreshError(null);
    Promise.allSettled([
      getProducts().then((r) => ({ ok: true as const, data: r })),
      getCategories().then((r) => ({ ok: true as const, data: r })),
    ]).then(([p, c]) => {
      if (p.status === "fulfilled" && p.value.ok) setProducts(p.value.data);
      if (c.status === "fulfilled" && c.value.ok) setCategories(c.value.data);
      const errs: string[] = [];
      if (p.status === "rejected") errs.push("товары");
      if (c.status === "rejected") errs.push("категории");
      if (errs.length) setRefreshError("Не загружено: " + errs.join(", ") + ". Повторите обновление.");
    });
  };

  useEffect(() => {
    if (authenticated) refresh();
  }, [authenticated]);

  const refreshChatsUnread = () => {
    if (!adminSecret) return;
    getConversationsUnreadCount(adminSecret)
      .then(({ count }) => setChatsUnread(Number(count) || 0))
      .catch(() => {});
  };
  useEffect(() => {
    if (!adminSecret) return;
    refreshChatsUnread();
    const t = setInterval(refreshChatsUnread, 20000);
    return () => clearInterval(t);
  }, [adminSecret]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const ok = await verifyAdmin(passwordInput);
    if (ok) {
      setAdminSecret(passwordInput);
      setAuthenticated(true);
    } else {
      setAuthError("Неверный пароль");
    }
  };

  if (!authenticated) {
    return (
      <div className="zen-admin" style={styles.authWrap}>
        <div style={styles.authCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 10px -4px var(--accent-glow)",
            }} aria-hidden />
            <h1 style={{ ...styles.title, marginBottom: 0 }}>RAW Admin</h1>
          </div>
          <p style={{ ...styles.hint, marginBottom: 22 }}>Введи пароль администратора, чтобы продолжить.</p>
          <form onSubmit={handleLogin} style={styles.authForm}>
            <label style={styles.label}>
              Пароль
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                style={styles.input}
                autoComplete="current-password"
                autoFocus
              />
            </label>
            {authError && <p style={styles.authError}>{authError}</p>}
            <button type="submit" style={{ ...styles.submit, width: "100%" }}>
              Войти →
            </button>
          </form>
        </div>
      </div>
    );
  }

  const setTabAndReset = (t: Tab) => {
    setTab(t);
    setEditingProductId(null);
  };

  return (
    <div className="zen-admin">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">RAW Admin</div>
          <button type="button" onClick={() => setTabAndReset("products")} className={`admin-nav-btn ${tab === "products" ? "active" : ""}`}>
            <NavIcon tab="products" /> Товары
          </button>
          <button type="button" onClick={() => setTabAndReset("categories")} className={`admin-nav-btn ${tab === "categories" ? "active" : ""}`}>
            <NavIcon tab="categories" /> Категории
          </button>
          <button type="button" onClick={() => setTabAndReset("orders")} className={`admin-nav-btn ${tab === "orders" ? "active" : ""}`}>
            <NavIcon tab="orders" /> Заказы
          </button>
          <button type="button" onClick={() => setTabAndReset("customOrders")} className={`admin-nav-btn ${tab === "customOrders" ? "active" : ""}`}>
            <NavIcon tab="customOrders" /> Заявки не из каталога
          </button>
          <button type="button" onClick={() => setTabAndReset("currencyRate")} className={`admin-nav-btn ${tab === "currencyRate" ? "active" : ""}`}>
            <NavIcon tab="currencyRate" /> Курс валюты
          </button>
          <button type="button" onClick={() => setTabAndReset("posts")} className={`admin-nav-btn ${tab === "posts" ? "active" : ""}`}>
            <NavIcon tab="posts" /> Посты
          </button>
          <button type="button" onClick={() => setTabAndReset("channel")} className={`admin-nav-btn ${tab === "channel" ? "active" : ""}`}>
            <NavIcon tab="channel" /> Рассылка
          </button>
          <button type="button" onClick={() => setTabAndReset("chats")} className={`admin-nav-btn ${tab === "chats" ? "active" : ""}`}>
            <NavIcon tab="chats" />
            <span style={{ flex: 1 }}>Чаты</span>
            {chatsUnread > 0 && (
              <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                {chatsUnread > 99 ? "99+" : chatsUnread}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setTabAndReset("support")} className={`admin-nav-btn ${tab === "support" ? "active" : ""}`}>
            <NavIcon tab="support" /> Поддержка
          </button>
          <div style={{ flex: 1 }} />
          <div style={styles.sidebarFooter}>
            <button
              type="button"
              onClick={() => checkApiHealth().then(setApiStatus)}
              style={styles.checkBtn}
              title="Пинг бэкенда"
            >
              <span style={{
                display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 7,
                background: apiStatus == null ? "var(--muted-soft)" : apiStatus.ok ? "var(--green)" : "var(--accent)",
                boxShadow: apiStatus?.ok ? "0 0 0 3px var(--green-soft)" : undefined,
              }} />
              {apiStatus == null ? "Проверить API" : apiStatus.ok ? "API онлайн" : "API недоступен"}
            </button>
            {apiStatus && !apiStatus.ok && (
              <p style={{ ...styles.apiHint, color: "var(--accent)" }}>{apiStatus.error}</p>
            )}
            <p style={{ ...styles.apiHint, wordBreak: "break-all" }}>{API_URL.replace(/^https?:\/\//, "")}</p>
            <button
              type="button"
              onClick={() => {
                setAuthenticated(false);
                setAdminSecret("");
                setPasswordInput("");
                setEditingProductId(null);
              }}
              style={styles.logoutBtn}
            >
              Выйти
            </button>
          </div>
        </aside>
        <main ref={adminMainRef} className="admin-main">
          <div className="admin-content">
      {refreshError && (
        <div style={{ marginBottom: 12, padding: 12, background: "rgba(198,40,40,0.1)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#c62828" }}>{refreshError}</span>
          <button type="button" onClick={refresh} style={styles.submit}>Повторить</button>
        </div>
      )}
      {tab === "products" && (
        <ProductsTab
          products={products}
          categories={categories}
          adminSecret={adminSecret}
          editingId={editingProductId}
          onEdit={(id) => {
            setEditingProductId(id);
            adminMainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onRefresh={refresh}
          message={message}
          setMessage={setMessage}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}

      {tab === "categories" && (
        <CategoriesTab
          categories={categories}
          adminSecret={adminSecret}
          onRefresh={refresh}
        />
      )}

      {tab === "orders" && (
        <OrdersTab adminSecret={adminSecret} />
      )}

      {tab === "customOrders" && (
        <CustomOrdersTab adminSecret={adminSecret} />
      )}

      {tab === "currencyRate" && (
        <CurrencyRateTab adminSecret={adminSecret} />
      )}

      {tab === "posts" && (
        <PostsTab adminSecret={adminSecret} />
      )}

      {tab === "channel" && (
        <ChannelTab adminSecret={adminSecret} products={products} />
      )}

      {tab === "chats" && (
        <ChatsTab adminSecret={adminSecret} onUnreadChanged={refreshChatsUnread} />
      )}

      {tab === "support" && (
        <SupportTab adminSecret={adminSecret} />
      )}

          </div>
        </main>
      </div>
    </div>
  );
}

function ImagePreviewModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Увеличить фото"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        cursor: "pointer",
      }}
    >
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
      />
    </div>
  );
}

type StatusFilter = "all" | "review" | "pending" | "in_transit" | "delivered" | "completed";

function OrdersTab({ adminSecret }: { adminSecret: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = () => {
    setLoading(true);
    getOrdersAdmin(adminSecret)
      .then(setOrders)
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (adminSecret) load();
  }, [adminSecret]);

  const handleStatus = async (id: number, status: "pending" | "in_transit" | "delivered" | "completed") => {
    setUpdatingId(id);
    setMessage("");
    try {
      await updateOrderStatus(id, status, adminSecret);
      setMessage("Статус обновлён");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Удалить заказ #${id}? Это действие нельзя отменить.`)) return;
    setMessage("");
    try {
      await deleteOrderAdmin(id, adminSecret);
      setMessage("Заказ удалён");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    }
  };

  const filteredOrders = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  if (loading) return <p style={styles.hint}>Загрузка заказов...</p>;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Заказы</h2>
          <p className="admin-page-head-sub">
            {orders.length === 0
              ? "Здесь появятся заказы, оформленные через каталог"
              : `Всего: ${orders.length}${statusFilter !== "all" ? ` · показано ${filteredOrders.length}` : ""}`}
          </p>
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}
      <div className="admin-toolbar">
        <span className="admin-toolbar-label">Статус</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={styles.statusSelect}
        >
          <option value="all">Все</option>
          <option value="pending">Оформлен</option>
          <option value="in_transit">В пути</option>
          <option value="delivered">Доставлено</option>
          <option value="completed">Завершён</option>
        </select>
      </div>
      {orders.length === 0 ? (
        <div className="admin-empty">
          <p className="admin-empty-title">Заказов пока нет</p>
          <p className="admin-empty-sub">Когда клиент оформит заказ из каталога — он появится здесь</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-empty">
          <p className="admin-empty-title">Ничего не найдено</p>
          <p className="admin-empty-sub">Нет заказов с выбранным статусом</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Товары</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                let orderItems: { name?: string; size?: string; quantity?: number; image_url?: string | null }[] = [];
                try {
                  orderItems = typeof o.items === "string" ? JSON.parse(o.items) : o.items;
                } catch {}
                const itemsStr = Array.isArray(orderItems)
                  ? orderItems.map((i) => `${i.name || "Товар"} × ${i.quantity || 1} (${i.size || "—"})`).join(", ")
                  : String(o.items);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>#{o.id}</td>
                    <td style={{ fontSize: 12.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{new Date(o.created_at).toLocaleString("ru")}</td>
                    <td>{o.user_name || <span style={{ color: "var(--muted-soft)" }}>—</span>}</td>
                    <td style={{ maxWidth: 320, fontSize: 13 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {Array.isArray(orderItems) ? (
                          orderItems.map((i, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {i.image_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(i.image_url!)}
                                  style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
                                  title="Открыть фото"
                                >
                                  <img
                                    src={i.image_url}
                                    alt=""
                                    style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
                                  />
                                </button>
                              )}
                              <span style={{ minWidth: 0 }}>
                                <span style={{ fontWeight: 500 }}>{i.name || "Товар"}</span>
                                <span style={{ color: "var(--muted)", marginLeft: 6 }}>× {i.quantity || 1} · {i.size || "—"}</span>
                              </span>
                            </div>
                          ))
                        ) : (
                          <span>{itemsStr}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{o.total} $</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StatusPill status={o.status} />
                        <select
                          aria-label="Изменить статус"
                          value={o.status}
                          onChange={(e) => handleStatus(o.id, e.target.value as "pending" | "in_transit" | "delivered" | "completed")}
                          disabled={updatingId === o.id}
                          style={{ ...styles.statusSelect, height: 26, fontSize: 11.5, padding: "0 6px" }}
                          title="Изменить статус"
                        >
                          <option value="pending">Оформлен</option>
                          <option value="in_transit">В пути</option>
                          <option value="delivered">Доставлено</option>
                          <option value="completed">Завершён</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <a href={telegramChatLink(o.user_username ?? null, o.user_id)} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
                          Telegram
                        </a>
                        <button type="button" onClick={() => handleDelete(o.id)} style={styles.deleteOrderIconBtn} aria-label="Удалить заказ" title="Удалить">
                          <TrashIcon />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}
    </>
  );
}

function CustomOrdersTab({ adminSecret }: { adminSecret: string }) {
  const [list, setList] = useState<CustomOrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Inline-редактирование одной заявки
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editImage, setEditImage] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    setLoading(true);
    getCustomOrdersAdmin(adminSecret)
      .then(setList)
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (adminSecret) load();
  }, [adminSecret]);

  const handleStatus = async (id: number, status: "review" | "pending" | "in_transit" | "delivered" | "completed") => {
    setUpdatingId(id);
    setMessage("");
    try {
      await updateCustomOrderStatusAdmin(id, status, adminSecret);
      setMessage("Статус обновлён");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Удалить заявку #${id}? Это действие нельзя отменить.`)) return;
    setMessage("");
    try {
      await deleteCustomOrderAdmin(id, adminSecret);
      setMessage("Заявка удалена");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    }
  };

  const handleDuplicate = async (id: number) => {
    setUpdatingId(id);
    setMessage("");
    try {
      await duplicateCustomOrderAdmin(id, adminSecret);
      setMessage("Создана пустая заявка-дубликат — заполни её и одобри");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setUpdatingId(null);
    }
  };

  const startEdit = (c: CustomOrderAdmin) => {
    setEditingId(c.id);
    setEditDesc(c.description ?? "");
    setEditSize(c.size ?? "");
    setEditImage(c.image_data ?? null);
    setMessage("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDesc("");
    setEditSize("");
    setEditImage(null);
  };
  const onEditFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { setMessage("Макс размер фото 5 МБ"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const v = reader.result;
      if (typeof v === "string") setEditImage(v);
    };
    reader.readAsDataURL(file);
  };
  const saveEdit = async () => {
    if (editingId == null) return;
    setUpdatingId(editingId);
    setMessage("");
    try {
      await updateCustomOrderContentAdmin(editingId, {
        description: editDesc,
        size: editSize,
        image_data: editImage,
      }, adminSecret);
      setMessage("Заявка обновлена");
      cancelEdit();
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredList = statusFilter === "all" ? list : list.filter((c) => (c.status || "pending") === statusFilter);
  const reviewCount = list.filter((c) => (c.status || "pending") === "review").length;

  if (loading) return <p style={styles.hint}>Загрузка заявок...</p>;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Заявки не из каталога</h2>
          <p className="admin-page-head-sub">
            Кастомные заказы клиентов — те, что вне основного ассортимента. Заполняй карточку и одобряй, чтобы клиент увидел заявку у себя в истории.
          </p>
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}
      {reviewCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 14, background: "var(--amber-soft)", border: "1px solid transparent", borderRadius: "var(--radius-sm)", fontSize: 12.5, color: "var(--amber)", fontWeight: 500 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--amber)" }} />
          На модерации: {reviewCount} — пока статус «На модерации», в истории у клиента карточка не появится
        </div>
      )}
      <div className="admin-toolbar">
        <span className="admin-toolbar-label">Статус</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={styles.statusSelect}
        >
          <option value="all">Все</option>
          <option value="review">На модерации</option>
          <option value="pending">Оформлен</option>
          <option value="in_transit">В пути</option>
          <option value="delivered">Доставлено</option>
          <option value="completed">Завершён</option>
        </select>
        <span className="admin-toolbar-spacer" />
        <span className="admin-toolbar-count">
          {list.length === 0 ? "Нет заявок" : `${filteredList.length}${statusFilter !== "all" ? ` из ${list.length}` : ""}`}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="admin-empty">
          <p className="admin-empty-title">Заявок пока нет</p>
          <p className="admin-empty-sub">Сюда попадут все запросы клиентов на товары вне каталога</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="admin-empty">
          <p className="admin-empty-title">Ничего не найдено</p>
          <p className="admin-empty-sub">Нет заявок с выбранным статусом</p>
        </div>
      ) : (
        <div>
          {filteredList.map((c) => {
            const status = c.status || "pending";
            const isReview = status === "review";
            const isEditing = editingId === c.id;
            const hasThumb = !!c.image_data && !isEditing;
            return (
              <div key={c.id} className={`admin-case${isReview ? " admin-case--review" : ""}`}>
                <div className="admin-case-head">
                  <span className="admin-case-id">#{c.id}</span>
                  <span className="admin-case-date">{new Date(c.created_at).toLocaleString("ru")}</span>
                  <span className="admin-case-head-spacer" />
                  <StatusPill status={status} />
                  <button type="button" onClick={() => handleDelete(c.id)} style={styles.deleteOrderIconBtn} aria-label="Удалить заявку" title="Удалить">
                    <TrashIcon />
                  </button>
                </div>
                <div className={`admin-case-body${hasThumb ? "" : " admin-case-body--no-thumb"}`}>
                  {hasThumb && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(c.image_data!)}
                      style={{ padding: 0, border: "none", background: "none" }}
                      title="Открыть фото в полном размере"
                    >
                      <img src={c.image_data!} alt="Фото товара" className="admin-case-thumb" />
                    </button>
                  )}
                  <div className="admin-case-content">
                    <div className="admin-case-row">
                      <span className="admin-case-row-key">Клиент</span>
                      <span className="admin-case-row-val">{c.user_name || <span className="admin-case-row-val--muted">—</span>}</span>
                    </div>
                    <div className="admin-case-row">
                      <span className="admin-case-row-key">Telegram</span>
                      <span className="admin-case-row-val">
                        {c.user_username ? `@${c.user_username.replace(/^@/, "")}` : <span className="admin-case-row-val--muted">—</span>}
                      </span>
                    </div>
                    {c.user_address && (
                      <div className="admin-case-row">
                        <span className="admin-case-row-key">Адрес</span>
                        <span className="admin-case-row-val">{c.user_address}</span>
                      </div>
                    )}
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, padding: 12, background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                        <label className="admin-field">
                          <span className="admin-field-label">Описание / название</span>
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={3}
                            style={{ ...styles.input, minHeight: 72, height: "auto" }}
                            placeholder="Что заказывает клиент"
                          />
                        </label>
                        <label className="admin-field">
                          <span className="admin-field-label">Размер</span>
                          <input
                            type="text"
                            value={editSize}
                            onChange={(e) => setEditSize(e.target.value)}
                            style={styles.input}
                            placeholder="например, M или 42"
                          />
                        </label>
                        <div className="admin-field">
                          <span className="admin-field-label">Фото</span>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button type="button" onClick={() => editFileRef.current?.click()} style={styles.smallBtn}>
                              {editImage ? "Заменить фото" : "Загрузить фото"}
                            </button>
                            <input ref={editFileRef} type="file" accept="image/*" onChange={onEditFile} style={{ display: "none" }} />
                            {editImage && (
                              <button type="button" onClick={() => setEditImage(null)} style={{ ...styles.smallBtn, color: "var(--accent)" }}>
                                Удалить фото
                              </button>
                            )}
                          </div>
                          {editImage && (
                            <img src={editImage} alt="Превью" style={{ maxWidth: 160, maxHeight: 160, objectFit: "cover", borderRadius: 8, marginTop: 8, border: "1px solid var(--border)" }} />
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <button type="button" onClick={saveEdit} disabled={updatingId === c.id} style={styles.submit}>
                            {updatingId === c.id ? "Сохраняю…" : "Сохранить"}
                          </button>
                          <button type="button" onClick={cancelEdit} style={styles.cancelBtn}>Отмена</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="admin-case-row">
                          <span className="admin-case-row-key">Описание</span>
                          <span className={`admin-case-row-val${c.description ? "" : " admin-case-row-val--muted"}`}>
                            {c.description || "— нет описания —"}
                          </span>
                        </div>
                        {c.size && (
                          <div className="admin-case-row">
                            <span className="admin-case-row-key">Размер</span>
                            <span className="admin-case-row-val">{c.size}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="admin-case-foot">
                  {!isEditing && (
                    <>
                      <button type="button" onClick={() => startEdit(c)} style={styles.smallBtn}>
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(c.id)}
                        disabled={updatingId === c.id}
                        style={styles.smallBtn}
                        title="Создать дубликат: пользователь увидит ещё одну отдельную карточку"
                      >
                        + Дубликат
                      </button>
                    </>
                  )}
                  {isReview && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleStatus(c.id, "pending")}
                      disabled={updatingId === c.id}
                      style={styles.submit}
                    >
                      Одобрить
                    </button>
                  )}
                  <span style={{ flex: 1 }} />
                  <select
                    aria-label="Изменить статус"
                    value={status}
                    onChange={(e) => handleStatus(c.id, e.target.value as "review" | "pending" | "in_transit" | "delivered" | "completed")}
                    disabled={updatingId === c.id}
                    style={styles.statusSelect}
                  >
                    <option value="review">На модерации</option>
                    <option value="pending">Оформлен</option>
                    <option value="in_transit">В пути</option>
                    <option value="delivered">Доставлено</option>
                    <option value="completed">Завершён</option>
                  </select>
                  <a href={telegramChatLink(c.user_username ?? null, c.user_id)} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
                    Написать в Telegram
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}
    </>
  );
}

function CategoriesTab({
  categories,
  adminSecret,
  onRefresh,
}: {
  categories: Category[];
  adminSecret: string;
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setMessage("Укажите code и название");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await createCategory({ code: newCode.trim(), name: newName.trim(), sort_order: newSortOrder }, adminSecret);
      setMessage("Категория добавлена");
      setNewCode("");
      setNewName("");
      setNewSortOrder(categories.length + 1);
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: Category) => {
    setEditingCode(c.code);
    setEditName(c.name);
    setEditSortOrder(c.sort_order);
  };

  const handleUpdate = async () => {
    if (editingCode == null) return;
    setSubmitting(true);
    setMessage("");
    try {
      await updateCategory(editingCode, { name: editName.trim(), sort_order: editSortOrder }, adminSecret);
      setMessage("Категория обновлена");
      setEditingCode(null);
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Удалить категорию «${code}»? Товары с этой категорией нужно будет переназначить.`)) return;
    setSubmitting(true);
    setMessage("");
    try {
      await deleteCategory(code, adminSecret);
      setMessage("Категория удалена");
      if (editingCode === code) setEditingCode(null);
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Категории</h2>
          <p className="admin-page-head-sub">Имя категории видно в каталоге, код (латиница) используется в карточках товаров.</p>
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}

      <section className="admin-card">
        <div className="admin-card-head"><h3>Новая категория</h3></div>
        <form onSubmit={handleCreate} className="admin-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label className="admin-field">
            <span className="admin-field-label">Код (латиница)</span>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="hoodie"
              style={{ ...styles.input, width: 140 }}
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Название</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Худи"
              style={{ ...styles.input, width: 200 }}
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Порядок</span>
            <input
              type="number"
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(Number(e.target.value))}
              style={{ ...styles.input, width: 96 }}
            />
          </label>
          <button type="submit" disabled={submitting} style={styles.submit}>
            Добавить
          </button>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <h3>Список категорий</h3>
          <span className="admin-card-head-meta">{categories.length}</span>
        </div>
        {categories.length === 0 ? (
          <div className="admin-empty" style={{ borderRadius: 0, border: "none" }}>
            <p className="admin-empty-title">Категорий нет</p>
            <p className="admin-empty-sub">Добавь первую через форму выше</p>
          </div>
        ) : (
          <table className="admin-table" style={{ borderRadius: 0, border: "none" }}>
            <thead>
              <tr>
                <th>Код</th>
                <th>Название</th>
                <th>Порядок</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.code}>
                  <td style={{ fontWeight: 600 }}>{c.code}</td>
                  <td>
                    {editingCode === c.code ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ ...styles.input, width: "100%", maxWidth: 200 }}
                      />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td>
                    {editingCode === c.code ? (
                      <input
                        type="number"
                        value={editSortOrder}
                        onChange={(e) => setEditSortOrder(Number(e.target.value))}
                        style={{ ...styles.input, width: 72 }}
                      />
                    ) : (
                      c.sort_order
                    )}
                  </td>
                  <td>
                    {editingCode === c.code ? (
                      <>
                        <button type="button" onClick={handleUpdate} disabled={submitting} style={styles.smallBtn}>
                          Сохранить
                        </button>
                        <button type="button" onClick={() => setEditingCode(null)} style={styles.cancelBtn}>
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(c)} style={styles.smallBtn}>
                          Изменить
                        </button>
                        <button type="button" onClick={() => handleDelete(c.code)} style={styles.deleteBtn}>
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function CurrencyRateTab({ adminSecret }: { adminSecret: string }) {
  const [rate, setRate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadRate = () => {
    getCurrencyRateAdmin(adminSecret)
      .then(({ rate: r }) => setRate(String(r)))
      .catch(() => setMessage("Не удалось загрузить курс"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRate();
  }, [adminSecret]);

  useEffect(() => {
    const onFocus = () => loadRate();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [adminSecret]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(rate.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0 || num > 1000) {
      setMessage("Введите число от 0.01 до 1000 (курс BYN за 1 USD)");
      return;
    }
    setSaving(true);
    setMessage("");
    updateCurrencyRateAdmin(adminSecret, num)
      .then(({ rate: r }) => {
        setRate(String(r));
        setMessage("Курс сохранён");
      })
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setSaving(false));
  };

  if (loading) return <p style={styles.hint}>Загрузка...</p>;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Курс валюты</h2>
          <p className="admin-page-head-sub">Курс белорусского рубля (BYN) к 1 USD. Используется для отображения цен в приложении.</p>
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}

      <section className="admin-card" style={{ maxWidth: 480 }}>
        <div className="admin-card-head"><h3>Текущий курс</h3></div>
        <form onSubmit={handleSave} className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="admin-field">
            <span className="admin-field-label">Курс BYN за 1 $</span>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="3.2"
                style={{ ...styles.input, paddingRight: 52, fontVariantNumeric: "tabular-nums" }}
              />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--muted)", letterSpacing: 0.04, pointerEvents: "none" }}>BYN</span>
            </div>
            <span className="admin-field-hint">Например: 3.2 — значит 1$ = 3.2 BYN</span>
          </label>
          <div style={styles.formActions}>
            <button type="submit" style={styles.submit} disabled={saving}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

const MAX_CHANNEL_IMAGES = 10;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function categoryEmoji(category: string | undefined): string {
  switch ((category || "").toLowerCase()) {
    case "tee": return "👕";
    case "hoodie": return "🧥";
    case "pants": return "👖";
    case "jacket": return "🧥";
    case "accessories": return "👜";
    default: return "✨";
  }
}

const HEADLINE_HOOKS = [
  "✨ Только что подъехало",
  "🆕 Новинка в наличии",
  "🔥 Залетай — это база",
  "🛍 Лови, пока есть",
] as const;

function pickHook(seed: number): string {
  return HEADLINE_HOOKS[seed % HEADLINE_HOOKS.length];
}

// Делает рассылку «как в инсте бренда»: короткий хук, имя крупно, бренд в теге,
// описание лид-абзацем, цена + размеры в одной строке как мета. Без воды.
function buildProductTemplate(p: Product): { text: string; images: string[] } {
  const emoji = categoryEmoji(p.category);
  const hook = pickHook(p.id || Date.now());
  const lines: string[] = [];
  lines.push(hook);
  lines.push("");
  lines.push(`${emoji} <b>${escapeHtml(p.name)}</b>`);
  if (p.brand?.trim()) lines.push(`<i>${escapeHtml(p.brand.trim())}</i>`);
  if (p.description?.trim()) {
    lines.push("");
    lines.push(escapeHtml(p.description.trim()));
  }
  lines.push("");
  const meta: string[] = [`<b>${p.price} $</b>`];
  if (p.sizes?.trim()) meta.push(p.sizes.trim());
  lines.push(meta.join("  ·  "));
  lines.push("");
  lines.push("Тапни «Открыть каталог» в боте, чтобы заказать →");
  const imgs = (p.image_urls && p.image_urls.length > 0)
    ? p.image_urls.slice(0, MAX_CHANNEL_IMAGES)
    : (p.image_url ? [p.image_url] : []);
  return { text: lines.join("\n"), images: imgs };
}

function relTime(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} дн назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function ChannelPreview({ text, images }: { text: string; images: string[] }) {
  const visible = images.slice(0, 4);
  const rest = Math.max(0, images.length - 4);
  const html = (text || "").trim().replace(/\n/g, "<br>");
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 8px 24px -16px rgba(0,0,0,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15,
        }}>R</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>RAW</div>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 0.2 }}>канал · сейчас</div>
        </div>
      </div>
      {images.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: images.length === 1 ? "1fr" : "1fr 1fr",
          gap: 2,
          background: "#fff",
        }}>
          {visible.map((src, i) => {
            const last = i === visible.length - 1 && rest > 0;
            const span = images.length === 3 && i === 2;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  aspectRatio: images.length === 1 ? "4 / 5" : "1 / 1",
                  background: "#eee",
                  overflow: "hidden",
                  gridColumn: span ? "span 2" : undefined,
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
                {last && (
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 700, letterSpacing: -0.5,
                  }}>+{rest}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {(html || images.length === 0) && (
        <div style={{ padding: "12px 14px 14px" }}>
          {html ? (
            <div
              style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)", wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
              (без подписи — будет только альбом)
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 8 }}>сейчас</div>
        </div>
      )}
    </div>
  );
}

function ChatsTab({ adminSecret, onUnreadChanged }: { adminSecret: string; onUnreadChanged: () => void }) {
  const [conversations, setConversations] = useState<BotConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyFileRef = useRef<HTMLInputElement | null>(null);

  const refreshConversations = () => {
    setLoading(true);
    getConversations(adminSecret)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  };

  useEffect(refreshConversations, [adminSecret]);
  useEffect(() => {
    const t = setInterval(refreshConversations, 15000);
    return () => clearInterval(t);
  }, [adminSecret]);

  const loadMessages = (userId: string) => {
    setMessagesLoading(true);
    getConversationMessages(userId, adminSecret)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false));
  };

  const openConversation = (c: BotConversation) => {
    setSelectedUserId(c.user_id);
    loadMessages(c.user_id);
    if (c.unread_count > 0) {
      markConversationRead(c.user_id, adminSecret).then(() => {
        setConversations((prev) => prev.map((x) => (x.user_id === c.user_id ? { ...x, unread_count: 0 } : x)));
        onUnreadChanged();
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Подгружаем выбранный диалог по таймеру, пока он открыт.
  useEffect(() => {
    if (!selectedUserId) return;
    const t = setInterval(() => loadMessages(selectedUserId), 8000);
    return () => clearInterval(t);
  }, [selectedUserId, adminSecret]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!reply.trim() && !replyImage) return;
    setSending(true);
    try {
      await replyToConversation(selectedUserId, { text: reply.trim(), image_url: replyImage }, adminSecret);
      setReply("");
      setReplyImage(null);
      loadMessages(selectedUserId);
      refreshConversations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  const onReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === "string") setReplyImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const selected = conversations.find((c) => c.user_id === selectedUserId) ?? null;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Чаты</h2>
          <p className="admin-page-head-sub">
            Каждое сообщение, которое пользователь пишет боту (кроме команд) — приходит сюда. Ты отвечаешь от имени бота.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 14, alignItems: "stretch", minHeight: 480 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {loading ? (
            <p style={{ ...styles.hint, padding: 14 }}>Загрузка…</p>
          ) : conversations.length === 0 ? (
            <p style={{ ...styles.hint, padding: 14 }}>Никто не писал боту.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {conversations.map((c) => {
                const isActive = c.user_id === selectedUserId;
                const display = c.name || (c.username ? `@${c.username}` : `id ${c.user_id}`);
                return (
                  <button
                    key={c.user_id}
                    type="button"
                    onClick={() => openConversation(c)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                      borderBottom: "1px solid var(--border)",
                      background: isActive ? "rgba(198,40,40,0.06)" : "transparent",
                      border: "none",
                      borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                      borderTop: "none", borderRight: "none",
                      borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--border)",
                      textAlign: "left", cursor: "pointer", width: "100%",
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#888", flex: "0 0 auto", textTransform: "uppercase" }}>
                      {(display[0] || "?").replace("@", "")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{display}</strong>
                        {c.last_at && <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{relTime(c.last_at)}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                        {c.last_direction === "out" ? "Ты: " : ""}
                        {c.last_text?.trim() || (c.last_has_image ? "📷 Фото" : "—")}
                      </div>
                    </div>
                    {c.unread_count > 0 && (
                      <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "2px 7px" }}>
                        {c.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", background: "#fff", minHeight: 480 }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", padding: 24 }}>
              Выбери диалог слева
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#888", textTransform: "uppercase" }}>
                  {((selected.name || selected.username || "?")[0] || "?").replace("@", "")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.name || (selected.username ? `@${selected.username}` : `id ${selected.user_id}`)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {selected.username && <a href={`https://t.me/${selected.username}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>@{selected.username}</a>}
                    {selected.username && " · "}id {selected.user_id}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 12px", background: "#fafafa" }}>
                {messagesLoading && messages.length === 0 ? (
                  <p style={styles.hint}>Загрузка…</p>
                ) : messages.length === 0 ? (
                  <p style={styles.hint}>Сообщений ещё нет.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {messages.map((m) => {
                      const isOut = m.direction === "out";
                      const hasText = !!m.text?.trim();
                      const hasImage = !!m.image_url;
                      return (
                        <div key={m.id} style={{ alignSelf: isOut ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                          <div style={{
                            background: isOut ? "var(--accent)" : "#fff",
                            color: isOut ? "#fff" : "var(--text)",
                            border: isOut ? "none" : "1px solid var(--border)",
                            borderRadius: 14,
                            padding: hasImage ? 4 : "8px 12px",
                            fontSize: 14,
                            lineHeight: 1.4,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            overflow: "hidden",
                          }}>
                            {hasImage && m.image_url && (
                              <img
                                src={m.image_url}
                                alt=""
                                onClick={() => setPreviewImage(m.image_url)}
                                style={{ display: "block", maxWidth: 320, maxHeight: 320, borderRadius: 11, objectFit: "cover", cursor: "zoom-in" }}
                              />
                            )}
                            {hasText && (
                              <div style={{ padding: hasImage ? "8px 8px 4px" : 0 }}>
                                {m.text}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, textAlign: isOut ? "right" : "left" }}>
                            {relTime(m.created_at)}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleReply} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
                {replyImage && (
                  <div style={{ position: "relative", alignSelf: "flex-start", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
                    <img src={replyImage} alt="" style={{ display: "block", maxHeight: 140, maxWidth: 200, objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => setReplyImage(null)}
                      title="Убрать"
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
                    >×</button>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => replyFileRef.current?.click()}
                    style={{ ...styles.smallBtn, padding: "10px 12px" }}
                    title="Прикрепить фото"
                    disabled={sending}
                  >
                    📎
                  </button>
                  <input
                    ref={replyFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={onReplyFileChange}
                  />
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={replyImage ? "Подпись (необязательно)…" : "Ответить от имени бота…"}
                    style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                    disabled={sending}
                  />
                  <button type="submit" style={styles.submit} disabled={sending || (!reply.trim() && !replyImage)}>
                    {sending ? "Отправка…" : "Отправить"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}
    </>
  );
}

function ChannelTab({ adminSecret, products }: { adminSecret: string; products: Product[] }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [missingImages, setMissingImages] = useState(0); // фото из data:base64, которые нельзя восстановить при редактировании

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [templateProductId, setTemplateProductId] = useState<string>("");

  const [usersCount, setUsersCount] = useState<number | null>(null);

  const [history, setHistory] = useState<BroadcastPost[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyBusy, setHistoryBusy] = useState(false);

  const composerRef = useRef<HTMLFormElement | null>(null);

  const loadHistory = () => {
    setHistoryLoading(true);
    getBroadcasts(adminSecret)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };
  useEffect(loadHistory, [adminSecret]);

  const refreshUsersCount = () => {
    getBotUsersCount(adminSecret)
      .then(({ count }) => setUsersCount(count))
      .catch(() => setUsersCount(null));
  };
  useEffect(refreshUsersCount, [adminSecret]);

  const addImage = (src: string) => {
    setImages((prev) => (prev.length >= MAX_CHANNEL_IMAGES ? prev : [...prev, src]));
  };
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const moveImage = (i: number, dir: -1 | 1) => {
    setImages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const remaining = MAX_CHANNEL_IMAGES - images.length;
    files.slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl === "string") addImage(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  };

  const addUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    addImage(u);
    setUrlInput("");
  };

  const applyProductTemplate = (mode: "replace" | "append") => {
    const id = parseInt(templateProductId, 10);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const t = buildProductTemplate(p);
    if (mode === "replace") {
      setText(t.text);
      setImages(t.images.slice(0, MAX_CHANNEL_IMAGES));
    } else {
      setText((prev) => (prev.trim() ? `${prev}\n\n———\n\n${t.text}` : t.text));
      setImages((prev) => [...prev, ...t.images].slice(0, MAX_CHANNEL_IMAGES));
    }
    setTemplateProductId("");
    setMessage(null);
  };
  const resetComposer = () => {
    setText("");
    setImages([]);
    setUrlInput("");
    setTemplateProductId("");
    setEditingId(null);
    setMissingImages(0);
    setMessage(null);
  };

  const startEdit = (p: BroadcastPost) => {
    const restored = (p.image_urls ?? []).filter((u) => u && u.length > 0);
    setText(p.text || "");
    setImages(restored);
    setEditingId(p.id);
    setMissingImages(Math.max(0, p.images_count - restored.length));
    setMessage(null);
    setTemplateProductId("");
    setUrlInput("");
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && images.length === 0) {
      setMessage({ kind: "err", text: "Заполни текст или добавь хотя бы одну картинку" });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      if (editingId != null) {
        const updated = await updateBroadcast(editingId, { text, image_urls: images }, adminSecret);
        setHistory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setMessage({ kind: "ok", text: `Обновлено у ${updated.sent_count} подписчик(ов)` });
      } else {
        const sent = await sendBroadcast({ text, image_urls: images }, adminSecret);
        const failedHint = sent.failed_count > 0 ? ` · ${sent.failed_count} не доставлено (заблокировали бота)` : "";
        setMessage({ kind: "ok", text: `Разослано ${sent.sent_count} подписчик(ам)${failedHint}` });
        loadHistory();
        refreshUsersCount();
      }
      resetComposer();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Ошибка рассылки" });
    } finally {
      setSending(false);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm("Удалить эту рассылку у всех подписчиков? Сообщения будут стёрты в их чатах с ботом.")) return;
    setHistoryBusy(true);
    try {
      await deleteBroadcastPost(id, adminSecret);
      setHistory((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) resetComposer();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setHistoryBusy(false);
    }
  };

  const isEditing = editingId != null;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Рассылка</h2>
          <p className="admin-page-head-sub">
            Бот пишет каждому подписчику в личку. HTML: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;a href=&quot;…&quot;&gt;</code>. До {MAX_CHANNEL_IMAGES} фото — уйдут одним альбомом. Throttle ~25 сообщ/сек.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 22, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--muted)", textTransform: "uppercase" }}>
            Подписчики бота
          </span>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {usersCount == null ? "—" : usersCount}
          </div>
          <p style={{ ...styles.hint, marginTop: 2, marginBottom: 0, fontSize: 12 }}>
            Все, кто хоть раз тапнул <code>/start</code>, оформлял заказ, добавлял в корзину или избранное. Заблокировавшие бота исключаются автоматически.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderLeft: "1px solid var(--border)" }}>
          <button type="button" onClick={refreshUsersCount} style={styles.smallBtn}>
            Обновить
          </button>
        </div>
      </div>

      <div className="channel-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)", gap: 22, alignItems: "start" }}>
        <form ref={composerRef} onSubmit={handleSubmit} style={styles.form}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>{isEditing ? `Редактирование поста #${editingId}` : "Новый пост"}</strong>
            {isEditing && (
              <button type="button" onClick={resetComposer} style={{ ...styles.smallBtn, padding: "6px 10px" }}>
                Создать новый
              </button>
            )}
          </div>

          <label style={styles.label}>Шаблоны из товаров</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <select
              value={templateProductId}
              onChange={(e) => setTemplateProductId(e.target.value)}
              style={{ ...styles.input, flex: 1, minWidth: 200, marginBottom: 0 }}
            >
              <option value="">— выбрать товар —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.brand?.trim() ? ` · ${p.brand.trim()}` : ""} · {p.price} $
                </option>
              ))}
            </select>
            <button type="button" onClick={() => applyProductTemplate("replace")} disabled={!templateProductId} style={styles.smallBtn} title="Заменить текущий пост">
              Заменить
            </button>
            <button type="button" onClick={() => applyProductTemplate("append")} disabled={!templateProductId} style={styles.smallBtn} title="Добавить ещё один товар к посту">
              + Добавить
            </button>
          </div>
          <p style={{ ...styles.hint, marginTop: -6, marginBottom: 12 }}>
            «+ Добавить» подмешивает товар к текущему тексту и фото (для подборок из нескольких товаров).
          </p>

          <label style={styles.label}>Текст поста</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Что-то тёплое для подписчиков…"
            style={{ ...styles.input, minHeight: 160, fontFamily: "inherit" }}
          />

          <label style={styles.label}>Фото ({images.length} / {MAX_CHANNEL_IMAGES})</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.smallBtn} disabled={images.length >= MAX_CHANNEL_IMAGES}>
              Загрузить с устройства
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onFileChange} />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="…или вставь URL"
              style={{ ...styles.input, flex: 1, minWidth: 200, marginBottom: 0 }}
              disabled={images.length >= MAX_CHANNEL_IMAGES}
            />
            <button type="button" onClick={addUrl} style={styles.smallBtn} disabled={!urlInput.trim() || images.length >= MAX_CHANNEL_IMAGES}>
              Добавить URL
            </button>
          </div>

          {missingImages > 0 && (
            <p style={{ ...styles.hint, color: "#c62828", marginBottom: 10 }}>
              ⚠ В этом посте {missingImages} фото были загружены файлами и не сохранились — их нельзя восстановить. Загрузи заново или сохрани без них.
            </p>
          )}

          {images.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
              {images.map((src, i) => (
                <div key={`${i}-${src.slice(0, 32)}`} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "1 / 1", background: "#f3f3f3" }}>
                  <img src={src} alt={`Фото ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                  />
                  <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 999, fontSize: 11, padding: "2px 8px", letterSpacing: 0.5 }}>{i + 1}</div>
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                    <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} title="Выше в порядке" style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>↑</button>
                    <button type="button" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} title="Ниже в порядке" style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>↓</button>
                    <button type="button" onClick={() => removeImage(i)} title="Удалить" style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#c62828", color: "#fff", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {message && (
            <p style={{ ...styles.message, color: message.kind === "ok" ? "var(--accent)" : "#c62828" }}>
              {message.text}
            </p>
          )}
          <div style={styles.formActions}>
            <button type="submit" style={styles.submit} disabled={sending || (!isEditing && !!usersCount && usersCount === 0)}>
              {sending
                ? (isEditing ? "Сохраняю…" : "Рассылаю…")
                : (isEditing
                    ? "Сохранить изменения"
                    : `Разослать ${usersCount != null && usersCount > 0 ? `(${usersCount} получ.)` : "всем"}`)}
            </button>
            {isEditing && (
              <button type="button" onClick={resetComposer} style={styles.cancelBtn}>
                Отмена
              </button>
            )}
          </div>
        </form>

        <div style={{ position: "sticky", top: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.18, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
            Превью
          </div>
          <ChannelPreview text={text} images={images} />
        </div>
      </div>

      <h3 style={{ ...styles.subtitle, marginTop: 32 }}>История рассылок ({history.length})</h3>
      {historyLoading ? (
        <p style={styles.hint}>Загрузка…</p>
      ) : history.length === 0 ? (
        <p style={styles.hint}>Ещё ничего не отправлено.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                border: editingId === p.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 10,
                alignItems: "flex-start",
                background: editingId === p.id ? "rgba(198,40,40,0.04)" : undefined,
              }}
            >
              <div style={{ width: 56, height: 56, flex: "0 0 auto", borderRadius: 8, overflow: "hidden", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 11 }}>
                {p.first_image_url ? (
                  <img src={p.first_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : p.images_count > 0 ? (
                  <span>📷 {p.images_count}</span>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 80, overflow: "hidden" }}>
                  {p.text || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>(без текста — только фото)</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>{relTime(p.created_at)}</span>
                  {p.images_count > 0 && <span>📷 {p.images_count}</span>}
                  <span>📤 {p.sent_count}</span>
                  {p.failed_count > 0 && <span style={{ color: "#c62828" }}>⚠ {p.failed_count}</span>}
                  {p.sample_message_id != null && <span>msg #{p.sample_message_id}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button type="button" onClick={() => startEdit(p)} disabled={historyBusy} style={styles.smallBtn}>
                  {editingId === p.id ? "Редактируется" : "Редактировать"}
                </button>
                <button type="button" onClick={() => handleDeletePost(p.id)} disabled={historyBusy} style={{ ...styles.smallBtn, color: "#c62828" }}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ProductsTab({
  products,
  categories,
  adminSecret,
  editingId,
  onEdit,
  onRefresh,
  message,
  setMessage,
  submitting,
  setSubmitting,
}: {
  products: Product[];
  categories: Category[];
  adminSecret: string;
  editingId: number | null;
  onEdit: (id: number | null) => void;
  onRefresh: () => void;
  message: string;
  setMessage: (m: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}) {
  const defaultCategory = categories.length > 0 ? categories[0].code : "tee";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>(["", "", "", "", ""]);
  const [category, setCategory] = useState(defaultCategory);
  const [sizes, setSizes] = useState("S,M,L,XL");

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.code === category)) {
      setCategory(categories[0].code);
    }
  }, [categories]);

  const startEdit = (p: Product) => {
    onEdit(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setPrice(String(p.price));
    const urls = (p.image_urls && p.image_urls.length > 0) ? p.image_urls : (p.image_url ? [p.image_url] : []);
    setImageUrls([...urls, "", "", "", "", ""].slice(0, 5));
    setCategory(categories.some((c) => c.code === p.category) ? p.category : defaultCategory);
    setSizes(p.sizes || "S,M,L,XL");
  };

  const cancelEdit = () => {
    onEdit(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrls(["", "", "", "", ""]);
    setCategory(defaultCategory);
    setSizes("S,M,L,XL");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) {
      setMessage("Укажите название и цену");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const urls = imageUrls.map((x) => x.trim()).filter(Boolean);
      const data = {
        store_id: 1,
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price.replace(/\s/g, "")) || 0,
        image_url: urls[0] || undefined,
        image_urls: urls.length > 0 ? urls : undefined,
        category,
        sizes: sizes.trim() || undefined,
      };
      if (editingId) {
        await updateProduct(editingId, data, adminSecret);
        setMessage("Товар обновлён");
        cancelEdit();
      } else {
        await createProduct(data, adminSecret);
        setMessage("Товар добавлен");
        cancelEdit();
      }
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить товар?")) return;
    setSubmitting(true);
    try {
      await deleteProduct(id, adminSecret);
      setMessage("Товар удалён");
      if (editingId === id) cancelEdit();
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const categoryName = (code: string) => categories.find((c) => c.code === code)?.name || code;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Товары</h2>
          <p className="admin-page-head-sub">Добавляй и редактируй карточки товаров. Первая картинка — основная и обязательная.</p>
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}

      <section className="admin-card">
        <div className="admin-card-head">
          <h3>{editingId ? `Редактирование товара #${editingId}` : "Новый товар"}</h3>
          {editingId && <span className="admin-card-head-meta">Сохрани изменения, чтобы они применились</span>}
        </div>
        <form onSubmit={handleSubmit} className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-grid">
            <label className="admin-field admin-field--full">
              <span className="admin-field-label">Название *</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Essential Tee" style={styles.input} required />
            </label>
            <label className="admin-field admin-field--full">
              <span className="admin-field-label">Описание</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...styles.input, minHeight: 64, height: "auto" }} placeholder="Краткое описание для карточки" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Цена, $ *</span>
              <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="33" style={styles.input} required />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Категория</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
                {categories.length === 0 ? (
                  <option value="tee">Футболки (загрузка…)</option>
                ) : (
                  categories.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))
                )}
              </select>
            </label>
            <label className="admin-field admin-field--full">
              <span className="admin-field-label">Размеры (через запятую)</span>
              <input type="text" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S,M,L,XL" style={styles.input} />
            </label>
            <div className="admin-field admin-field--full">
              <span className="admin-field-label">Картинки (до 5 URL)</span>
              <span className="admin-field-hint">Первая картинка станет главной — она показывается в каталоге и постах</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <input
                    key={i}
                    type="text"
                    value={imageUrls[i] ?? ""}
                    onChange={(e) => setImageUrls((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                    placeholder={i === 0 ? "https://... (обязательно)" : `Картинка ${i + 1} (необязательно)`}
                    style={styles.input}
                  />
                ))}
              </div>
            </div>
          </div>
          <div style={styles.formActions}>
            <button type="submit" disabled={submitting} style={styles.submit}>
              {submitting ? "Сохраняю…" : editingId ? "Сохранить" : "Добавить товар"}
            </button>
            {editingId && <button type="button" onClick={cancelEdit} style={styles.cancelBtn}>Отмена</button>}
          </div>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <h3>Каталог</h3>
          <span className="admin-card-head-meta">{products.length} {products.length === 1 ? "товар" : products.length > 4 || products.length === 0 ? "товаров" : "товара"}</span>
        </div>
        <div className="admin-card-body admin-card-body--flush">
          {products.length === 0 ? (
            <div className="admin-empty" style={{ borderRadius: 0, border: "none" }}>
              <p className="admin-empty-title">Каталог пуст</p>
              <p className="admin-empty-sub">Добавь первый товар через форму выше</p>
            </div>
          ) : (
            products.map((p) => (
              <div key={p.id} className="admin-list-row">
                <img src={(p.image_urls && p.image_urls[0]) || p.image_url || "https://via.placeholder.com/56"} alt="" className="admin-list-row-thumb" />
                <div style={{ minWidth: 0 }}>
                  <p className="admin-list-row-name">{p.name}</p>
                  <p className="admin-list-row-meta">
                    {categoryName(p.category)}
                    {p.sizes && <> · {p.sizes}</>}
                  </p>
                </div>
                <span className="admin-list-row-price">{p.price} $</span>
                <span className="admin-list-row-actions">
                  <button type="button" onClick={() => startEdit(p)} style={styles.smallBtn}>Изменить</button>
                  <button type="button" onClick={() => handleDelete(p.id)} style={styles.deleteBtn}>Удалить</button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function PostsTab({ adminSecret }: { adminSecret: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formCaption, setFormCaption] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImageData, setFormImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await getPosts();
      setPosts(data);
    } catch {
      setMessage("Ошибка загрузки постов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, []);

  const openCreate = () => {
    setEditingPost(null);
    setFormCaption("");
    setFormImageUrl("");
    setFormImageData(null);
    setShowForm(true);
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setFormCaption(post.caption ?? "");
    setFormImageUrl(post.image_url ?? "");
    setFormImageData(post.image_data ?? null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPost(null);
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMessage("Макс размер фото 5 МБ"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setFormImageData(reader.result as string);
      setFormImageUrl("");
    };
    reader.readAsDataURL(file);
  };

  const savePost = async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = {
        caption: formCaption.trim() || null,
        image_url: formImageData ? null : (formImageUrl.trim() || null),
        image_data: formImageData || null,
        product_id: null,
        product_url: null,
      };
      if (editingPost) {
        await updatePost(editingPost.id, data, adminSecret);
      } else {
        await createPost(data, adminSecret);
      }
      setShowForm(false);
      setEditingPost(null);
      await loadPosts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить пост?")) return;
    setBusy(true);
    try {
      await deletePost(id, adminSecret);
      await loadPosts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const previewSrc = formImageData || (formImageUrl.trim() ? formImageUrl.trim() : null);

  if (loading) return <p style={styles.hint}>Загрузка постов...</p>;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Посты</h2>
          <p className="admin-page-head-sub">Лента вкладки «Вдохновиться» в WebApp. Здесь публикуешь карточки с картинкой и подписью.</p>
        </div>
        <div className="admin-page-head-actions">
          {!showForm && (
            <button type="button" onClick={openCreate} style={styles.submit}>
              Создать пост
            </button>
          )}
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}

      {showForm && (
        <div style={styles.form}>
          <h3 style={styles.subtitle}>{editingPost ? "Редактировать пост" : "Новый пост"}</h3>

          <label style={styles.label}>
            Подпись
            <textarea
              value={formCaption}
              onChange={(e) => setFormCaption(e.target.value)}
              placeholder="Текст поста..."
              rows={3}
              style={{ ...styles.input, minHeight: 72 }}
            />
          </label>

          <label style={styles.label}>
            Картинка (URL)
            <input
              type="url"
              value={formImageUrl}
              onChange={(e) => { setFormImageUrl(e.target.value); if (e.target.value.trim()) setFormImageData(null); }}
              placeholder="https://..."
              style={styles.input}
              disabled={!!formImageData}
            />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={styles.smallBtn}
            >
              Загрузить фото
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              style={{ display: "none" }}
            />
            {formImageData && (
              <button
                type="button"
                onClick={() => setFormImageData(null)}
                style={{ ...styles.smallBtn, color: "#c62828" }}
              >
                Убрать фото
              </button>
            )}
          </div>

          {previewSrc && (
            <img
              src={previewSrc}
              alt="Превью"
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, marginTop: 4 }}
            />
          )}

          <div style={styles.formActions}>
            <button type="button" onClick={savePost} disabled={busy} style={styles.submit}>
              {busy ? "Сохранение…" : editingPost ? "Сохранить" : "Создать"}
            </button>
            <button type="button" onClick={closeForm} style={styles.cancelBtn}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        <h3 style={styles.subtitle}>Все посты ({posts.length})</h3>
        {posts.length === 0 ? (
          <p style={styles.hint}>Нет постов. Создайте первый.</p>
        ) : (
          posts.map((p) => {
            const imgSrc = p.image_data || p.image_url;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                {imgSrc ? (
                  <img src={imgSrc} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: "var(--border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>
                    нет фото
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                    {p.caption?.trim() || "— без подписи —"}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                    {new Date(p.created_at).toLocaleString("ru")} · ❤️ {p.likes_count}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => openEdit(p)} style={styles.smallBtn} disabled={busy}>
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)} style={styles.deleteBtn} disabled={busy}>
                    Удалить
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function SupportTab({ adminSecret }: { adminSecret: string }) {
  const [entries, setEntries] = useState<SupportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  // Локальные черновики на каждую запись (вопрос/ответ/порядок)
  const [drafts, setDrafts] = useState<Record<number, { question: string; answer: string; sort_order: number }>>({});

  // Форма «новая запись»
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const load = () => {
    setLoading(true);
    getSupportEntries()
      .then((rows) => {
        setEntries(rows);
        const d: Record<number, { question: string; answer: string; sort_order: number }> = {};
        for (const r of rows) {
          d[r.id] = { question: r.question, answer: r.answer, sort_order: r.sort_order };
        }
        setDrafts(d);
      })
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (id: number, patch: Partial<{ question: string; answer: string; sort_order: number }>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    if (!draft.question.trim() || !draft.answer.trim()) {
      setMessage("Вопрос и ответ не могут быть пустыми");
      return;
    }
    setBusyId(id);
    setMessage("");
    try {
      await updateSupportEntry(id, draft, adminSecret);
      setMessage("Сохранено");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить эту запись?")) return;
    setBusyId(id);
    setMessage("");
    try {
      await deleteSupportEntry(id, adminSecret);
      setMessage("Удалено");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) {
      setMessage("Заполните вопрос и ответ");
      return;
    }
    setBusyId("new");
    setMessage("");
    try {
      const maxOrder = entries.reduce((m, e) => Math.max(m, e.sort_order), 0);
      await createSupportEntry(
        { question: newQuestion.trim(), answer: newAnswer, sort_order: maxOrder + 1 },
        adminSecret
      );
      setMessage("Добавлено");
      setNewQuestion("");
      setNewAnswer("");
      load();
    } catch (e) {
      setMessage("Ошибка: " + (e instanceof Error ? e.message : ""));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p style={styles.hint}>Загрузка...</p>;

  return (
    <>
      <div className="admin-page-head">
        <div className="admin-page-head-text">
          <h2>Поддержка</h2>
          <p className="admin-page-head-sub">
            Контент страницы «Поддержка» в WebApp. Каждая запись — пара вопрос-ответ.
            Ответ поддерживает абзацы (пустая строка = новый абзац) и ссылки в формате <code>[текст](https://example.com)</code> или <code>[@юзер](@юзер)</code>.
          </p>
        </div>
      </div>
      {message && <p style={styles.message}>{message}</p>}

      <section className="admin-card">
        <div className="admin-card-head"><h3>Новая запись</h3></div>
        <form onSubmit={handleCreate} className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="admin-field">
            <span className="admin-field-label">Вопрос *</span>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="например, Как оплатить заказ?"
              style={styles.input}
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Ответ *</span>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              rows={4}
              placeholder={"Принимаем оплату на карту и наличными при доставке.\n\nДля онлайн-оплаты ссылка приходит в [@krot_eno](@krot_eno)."}
              style={{ ...styles.input, height: "auto", minHeight: 96, padding: "10px 12px" }}
            />
            <span className="admin-field-hint">
              Пустая строка между абзацами = новый абзац. Ссылки: <code>[текст](url)</code> или <code>[@user](@user)</code>.
            </span>
          </label>
          <div style={styles.formActions}>
            <button type="submit" disabled={busyId === "new"} style={styles.submit}>
              {busyId === "new" ? "Добавляю…" : "Добавить запись"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <h3>Записи</h3>
          <span className="admin-card-head-meta">{entries.length}</span>
        </div>
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {entries.length === 0 ? (
            <div className="admin-empty" style={{ borderRadius: 0, border: "none", padding: "32px 0" }}>
              <p className="admin-empty-title">Записей пока нет</p>
              <p className="admin-empty-sub">Добавь первую через форму выше</p>
            </div>
          ) : (
            entries.map((row) => {
              const draft = drafts[row.id] ?? { question: row.question, answer: row.answer, sort_order: row.sort_order };
              const dirty =
                draft.question !== row.question ||
                draft.answer !== row.answer ||
                draft.sort_order !== row.sort_order;
              const isBusy = busyId === row.id;
              return (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: dirty ? "var(--surface-2)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em" }}>
                      #{row.id}
                    </span>
                    <span style={{ flex: 1 }} />
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
                      Порядок
                      <input
                        type="number"
                        value={draft.sort_order}
                        onChange={(e) => updateDraft(row.id, { sort_order: Number(e.target.value) })}
                        style={{ ...styles.input, width: 64, height: 30, padding: "0 8px" }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={draft.question}
                    onChange={(e) => updateDraft(row.id, { question: e.target.value })}
                    placeholder="Вопрос"
                    style={{ ...styles.input, fontWeight: 600 }}
                  />
                  <textarea
                    value={draft.answer}
                    onChange={(e) => updateDraft(row.id, { answer: e.target.value })}
                    rows={4}
                    placeholder="Ответ (пустая строка = новый абзац, ссылки: [текст](url))"
                    style={{ ...styles.input, height: "auto", minHeight: 96, padding: "10px 12px" }}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleSave(row.id)}
                      disabled={isBusy || !dirty}
                      style={{ ...styles.submit, opacity: isBusy || !dirty ? 0.55 : 1 }}
                    >
                      {isBusy ? "Сохраняю…" : "Сохранить"}
                    </button>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={isBusy}
                      style={styles.deleteBtn}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" },
  authCard: { width: "100%", maxWidth: 380, padding: 32, background: "var(--surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" },
  authForm: { display: "flex", flexDirection: "column", gap: 16 },
  authError: { color: "var(--accent)", fontSize: 14 },
  title: { fontFamily: "inherit", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 24 },
  label: { fontSize: 12.5, fontWeight: 500, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 6, letterSpacing: 0 },
  input: { padding: "9px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", lineHeight: 1.4, height: 36, boxSizing: "border-box" },
  submit: { padding: "0 18px", height: 36, background: "var(--text)", border: "1px solid var(--text)", borderRadius: "var(--radius-sm)", color: "#fff", fontSize: 13.5, fontWeight: 500, cursor: "pointer", letterSpacing: "-0.005em", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 },
  sidebarFooter: { paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6, marginTop: 14 },
  logoutBtn: { padding: "0 12px", height: 32, background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", marginTop: 4 },
  checkBtn: { padding: "0 10px", height: 28, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-2)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  apiHint: { marginTop: 2, fontSize: 10.5, color: "var(--muted-soft)", letterSpacing: "0.01em", lineHeight: 1.45 },
  pageTitle: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.022em", marginBottom: 4, marginTop: 0, color: "var(--text)" },
  emptyBlock: { padding: 56, textAlign: "center", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" },
  tableWrap: { background: "var(--surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", overflow: "hidden" },
  hint: { color: "var(--muted)", fontSize: 13, lineHeight: 1.55, marginBottom: 16 },
  form: { display: "flex", flexDirection: "column", gap: 11, marginBottom: 22, padding: 20, background: "var(--surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" },
  message: { color: "var(--accent)", fontSize: 12.5, fontWeight: 500, marginBottom: 4 },
  formActions: { display: "flex", gap: 8, alignItems: "center", marginTop: 4 },
  cancelBtn: { padding: "0 14px", height: 36, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-2)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center" },
  list: { padding: 20, background: "var(--surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" },
  subtitle: { fontSize: 14, fontWeight: 600, letterSpacing: "-0.012em", marginBottom: 14, color: "var(--text)", textTransform: "none" },
  productRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" },
  productInfo: { flex: 1, minWidth: 0 },
  productActions: { display: "flex", gap: 6 },
  smallBtn: { padding: "0 10px", height: 30, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 },
  deleteBtn: { padding: "0 10px", height: 30, background: "var(--accent-soft)", border: "1px solid transparent", borderRadius: "var(--radius-sm)", color: "var(--accent)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center" },
  thumb: { width: 44, height: 44, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0, border: "1px solid var(--border)" },
  productName: { fontWeight: 600, fontSize: 13.5, letterSpacing: "-0.005em" },
  productPrice: { fontSize: 12.5, color: "var(--muted)" },
  storeDetail: { marginBottom: 24 },
  backBtn: { background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 16 },
  sectionTitle: { fontSize: 13, marginTop: 20, marginBottom: 8, fontWeight: 600 },
  productActionsRow: { display: "flex", gap: 6, marginBottom: 12 },
  modalList: { marginTop: 12, padding: 12, background: "var(--bg)", borderRadius: "var(--radius-sm)", maxHeight: 280, overflowY: "auto" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(9,9,11,0.55)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 24, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" },
  orderCard: { padding: 16, marginBottom: 10, background: "var(--surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" },
  orderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  orderId: { fontWeight: 600, fontSize: 13.5, letterSpacing: "-0.005em", fontVariantNumeric: "tabular-nums" },
  orderStatus: { fontSize: 12.5 },
  orderThumb: { maxWidth: 64, maxHeight: 64, objectFit: "cover", borderRadius: "var(--radius-sm)", display: "block", border: "1px solid var(--border)" },
  orderField: { fontSize: 13, marginBottom: 4, color: "var(--text)" },
  orderDate: { fontSize: 11.5, color: "var(--muted)", marginTop: 6, marginBottom: 10, letterSpacing: 0, fontVariantNumeric: "tabular-nums" },
  orderActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  contactLink: { color: "var(--accent)", fontSize: 12.5, textDecoration: "none", fontWeight: 500 },
  statusSelect: {
    padding: "0 10px",
    height: 30,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12.5,
    fontFamily: "inherit",
    cursor: "pointer",
    color: "var(--text-2)",
  },
  deleteOrderBtn: {
    padding: "0 10px",
    height: 28,
    background: "var(--accent-soft)",
    border: "1px solid transparent",
    borderRadius: "var(--radius-sm)",
    color: "var(--accent)",
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  deleteOrderIconBtn: {
    width: 30,
    height: 30,
    padding: 0,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--muted)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-sm)",
  },
  supportListPanel: {
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  supportThreadPanel: {
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    minHeight: 400,
  },
  chatList: { display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" },
  chatListItem: {
    display: "block",
    width: "100%",
    padding: "12px 14px",
    textAlign: "left",
    background: "none",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chatListItemActive: { background: "var(--accent)", color: "#fff" },
  chatListItemTitle: { display: "block", fontWeight: 600, fontSize: 14 },
  adminChatUnreadBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    marginLeft: 6,
    transform: "translateY(-2px)",
    verticalAlign: "middle",
    borderRadius: 9,
    background: "rgba(255,255,255,0.9)",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 700,
  },
  chatListItemMeta: { display: "block", fontSize: 12, opacity: 0.85, marginTop: 2 },
  chatListItemDate: { display: "block", fontSize: 11, opacity: 0.75, marginTop: 2 },
  supportThreadHeader: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" },
  supportPreviewRow: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8 },
  supportPreviewImg: { maxWidth: 80, maxHeight: 80, borderRadius: 8, objectFit: "cover" },
  supportPreviewRemove: { padding: "4px 10px", background: "var(--border)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 18 },
  supportInputRow: { display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end", minWidth: 0 },
  supportAttachLabel: { flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", color: "var(--accent)" },
  supportHiddenInput: { display: "none" },
  supportAttachBtn: { padding: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  supportTextarea: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    maxHeight: 160,
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.35,
    resize: "none",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  supportPlaceholder: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" },
  supportEditBlock: { width: "100%", minWidth: 0 },
  supportEditInput: { width: "100%", boxSizing: "border-box", padding: "8px 10px", marginBottom: 8, border: "1px solid rgba(255,255,255,0.5)", borderRadius: 8, background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: 14 },
  supportEditActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  supportMsgSaveBtn: { padding: "6px 12px", fontSize: 13, background: "rgba(255,255,255,0.95)", color: "var(--accent)", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" },
  supportMsgCancelBtn: { padding: "6px 12px", fontSize: 13, background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" },
  supportBubbleActions: { position: "absolute", top: 6, right: 8, display: "flex", gap: 4 },
  supportMsgIconBtn: { padding: "4px 6px", fontSize: 14, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" },
  supportBubbleImgBtn: { display: "block", padding: 0, margin: 0, marginBottom: 4, background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  supportBubbleImg: { display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8 },
  supportImageOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  supportImageExpanded: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600 },
  td: { padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 14 },
};
