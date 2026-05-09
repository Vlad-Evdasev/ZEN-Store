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
  deleteCustomOrderAdmin,
  getCurrencyRateAdmin,
  updateCurrencyRateAdmin,
  sendBroadcast,
  getBroadcasts,
  updateBroadcast,
  deleteBroadcastPost,
  getBotUsersCount,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  deletePostComment,
  getPostComments,
  type Product,
  type Category,
  type Order,
  type CustomOrderAdmin,
  type Post,
  type PostComment,
  type BroadcastPost,
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

/** Ссылка для открытия диалога с пользователем в Telegram */
function telegramChatLink(username?: string | null, userId?: string): string {
  if (username && String(username).trim()) {
    const u = String(username).trim().replace(/^@/, "");
    if (u) return `https://t.me/${u}`;
  }
  if (userId) return `tg://user?id=${userId}`;
  return "#";
}

type Tab = "products" | "categories" | "orders" | "customOrders" | "currencyRate" | "posts" | "channel";

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("products");
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
          <h1 style={styles.title}>Админ-панель</h1>
          <form onSubmit={handleLogin} style={styles.authForm}>
            <label style={styles.label}>
              Пароль
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Введите пароль"
                style={styles.input}
                autoComplete="current-password"
              />
            </label>
            {authError && <p style={styles.authError}>{authError}</p>}
            <button type="submit" style={styles.submit}>
              Войти
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
            Товары
          </button>
          <button type="button" onClick={() => setTabAndReset("categories")} className={`admin-nav-btn ${tab === "categories" ? "active" : ""}`}>
            Категории
          </button>
          <button type="button" onClick={() => setTabAndReset("orders")} className={`admin-nav-btn ${tab === "orders" ? "active" : ""}`}>
            Заказы
          </button>
          <button type="button" onClick={() => setTabAndReset("customOrders")} className={`admin-nav-btn ${tab === "customOrders" ? "active" : ""}`}>
            Заявки не из каталога
          </button>
          <button type="button" onClick={() => setTabAndReset("currencyRate")} className={`admin-nav-btn ${tab === "currencyRate" ? "active" : ""}`}>
            Курс валюты
          </button>
          <button type="button" onClick={() => setTabAndReset("posts")} className={`admin-nav-btn ${tab === "posts" ? "active" : ""}`}>
            Посты
          </button>
          <button type="button" onClick={() => setTabAndReset("channel")} className={`admin-nav-btn ${tab === "channel" ? "active" : ""}`}>
            Рассылка
          </button>
          <div style={{ flex: 1 }} />
          <div style={styles.sidebarFooter}>
            <button type="button" onClick={() => checkApiHealth().then(setApiStatus)} style={styles.checkBtn}>
              Проверить API
            </button>
            {apiStatus && (
              <p style={{ ...styles.apiHint, color: apiStatus.ok ? "var(--accent)" : "#c62828" }}>
                {apiStatus.ok ? "✓ API ок" : `✗ ${apiStatus.error}`}
              </p>
            )}
            <p style={styles.apiHint}>API: {API_URL}</p>
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
        <PostsTab
          products={products}
          adminSecret={adminSecret}
        />
      )}

      {tab === "channel" && (
        <ChannelTab adminSecret={adminSecret} products={products} />
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

type StatusFilter = "all" | "pending" | "in_transit" | "delivered" | "completed";

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
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Заказы</h2>
      <p style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 14 }}>Статус:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={styles.statusSelect}
        >
          <option value="all">Все</option>
          <option value="pending">Ожидает</option>
          <option value="in_transit">В пути</option>
          <option value="delivered">Доставлено</option>
          <option value="completed">Выполнен</option>
        </select>
      </p>
      {orders.length === 0 ? (
        <div style={styles.emptyBlock}>
          <p style={styles.hint}>Нет заказов</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={styles.emptyBlock}>
          <p style={styles.hint}>Нет заказов с выбранным статусом</p>
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
                <th>Действия</th>
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
                    <td style={{ fontWeight: 600 }}>#{o.id}</td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{new Date(o.created_at).toLocaleString("ru")}</td>
                    <td>{o.user_name || "—"}</td>
                    <td style={{ maxWidth: 280, fontSize: 13 }}>
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
                                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }}
                                  />
                                </button>
                              )}
                              <span>{`${i.name || "Товар"} × ${i.quantity || 1} (${i.size || "—"})`}</span>
                            </div>
                          ))
                        ) : (
                          <span>{itemsStr}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.total} $</td>
                    <td>
                      <select
                        value={o.status}
                        onChange={(e) => handleStatus(o.id, e.target.value as "pending" | "in_transit" | "delivered" | "completed")}
                        disabled={updatingId === o.id}
                        style={styles.statusSelect}
                      >
                        <option value="pending">Ожидает</option>
                        <option value="in_transit">В пути</option>
                        <option value="delivered">Доставлено</option>
                        <option value="completed">Выполнен</option>
                      </select>
                    </td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
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

  const handleStatus = async (id: number, status: "pending" | "in_transit" | "delivered" | "completed") => {
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

  const filteredList = statusFilter === "all" ? list : list.filter((c) => (c.status || "pending") === statusFilter);

  if (loading) return <p style={styles.hint}>Загрузка заявок...</p>;

  return (
    <>
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Заявки не из каталога</h2>
      <p style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 14 }}>Статус:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={styles.statusSelect}
        >
          <option value="all">Все</option>
          <option value="pending">Ожидает</option>
          <option value="in_transit">В пути</option>
          <option value="delivered">Доставлено</option>
          <option value="completed">Выполнен</option>
        </select>
      </p>
      <div style={styles.list}>
        <h3 style={styles.subtitle}>Список ({filteredList.length}{statusFilter !== "all" ? ` из ${list.length}` : ""})</h3>
        {list.length === 0 ? (
          <p style={styles.hint}>Нет заявок</p>
        ) : filteredList.length === 0 ? (
          <p style={styles.hint}>Нет заявок с выбранным статусом</p>
        ) : (
          filteredList.map((c) => (
            <div key={c.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <span style={styles.orderId}>#{c.id}</span>
                <button type="button" onClick={() => handleDelete(c.id)} style={styles.deleteOrderIconBtn} aria-label="Удалить заявку" title="Удалить">
                  <TrashIcon />
                </button>
              </div>
              <p style={styles.orderField}>👤 {c.user_name || "—"}</p>
              <p style={styles.orderField}>📱 {c.user_username || "—"}</p>
              {c.user_address && <p style={styles.orderField}>📍 {c.user_address}</p>}
              <p style={styles.orderField}>📝 {c.description || "—"}</p>
              {c.size && <p style={styles.orderField}>📐 Размер: {c.size}</p>}
              {c.image_data && (
                <p style={styles.orderField}>
                  <button
                    type="button"
                    onClick={() => setPreviewImage(c.image_data!)}
                    style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
                    title="Открыть фото в полном размере"
                  >
                    <img src={c.image_data} alt="Фото товара" style={{ maxWidth: 120, maxHeight: 120, objectFit: "cover", borderRadius: 8 }} />
                  </button>
                </p>
              )}
              <p style={styles.orderDate}>{new Date(c.created_at).toLocaleString("ru")}</p>
              <p style={styles.orderField}>
                <label style={{ marginRight: 8 }}>Статус:</label>
                <select
                  value={c.status || "pending"}
                  onChange={(e) => handleStatus(c.id, e.target.value as "pending" | "in_transit" | "delivered" | "completed")}
                  disabled={updatingId === c.id}
                  style={styles.statusSelect}
                >
                  <option value="pending">Ожидает</option>
                  <option value="in_transit">В пути</option>
                  <option value="delivered">Доставлено</option>
                  <option value="completed">Выполнен</option>
                </select>
              </p>
              <a href={telegramChatLink(c.user_username ?? null, c.user_id)} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
                Написать в Telegram
              </a>
            </div>
          ))
        )}
      </div>
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
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Категории товаров</h2>
      <p style={styles.hint}>Названия категорий отображаются в каталоге. Код (code) используется в товарах.</p>
      <form onSubmit={handleCreate} style={styles.form}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={styles.label}>
            Код (латиница)
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="hoodie"
              style={{ ...styles.input, width: 120 }}
            />
          </label>
          <label style={styles.label}>
            Название
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Худи"
              style={{ ...styles.input, width: 160 }}
            />
          </label>
          <label style={styles.label}>
            Порядок
            <input
              type="number"
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(Number(e.target.value))}
              style={{ ...styles.input, width: 72 }}
            />
          </label>
          <button type="submit" disabled={submitting} style={styles.submit}>
            Добавить категорию
          </button>
        </div>
      </form>
      <div style={styles.list}>
        <h3 style={styles.subtitle}>Список ({categories.length})</h3>
        {categories.length === 0 ? (
          <p style={styles.hint}>Нет категорий. Добавьте первую.</p>
        ) : (
          <table className="admin-table">
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
      </div>
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
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Курс валюты</h2>
      <p style={{ ...styles.hint, marginBottom: 16 }}>Курс белорусского рубля (BYN) к 1 USD. Используется для отображения цен в приложении.</p>
      <form onSubmit={handleSave} style={styles.form}>
        <label style={styles.label}>
          Курс BYN за 1 $
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="3.2"
            style={styles.input}
          />
        </label>
        <div style={styles.formActions}>
          <button type="submit" style={styles.submit} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </>
  );
}

const MAX_CHANNEL_IMAGES = 10;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildProductTemplate(p: Product): { text: string; images: string[] } {
  const lines: string[] = [];
  const head = `<b>${escapeHtml(p.name)}</b>` + (p.brand?.trim() ? ` · ${escapeHtml(p.brand.trim())}` : "");
  lines.push(head);
  if (p.description?.trim()) {
    lines.push("");
    lines.push(escapeHtml(p.description.trim()));
  }
  lines.push("");
  lines.push(`💰 <b>${p.price} $</b>`);
  if (p.sizes?.trim()) lines.push(`📐 Размеры: ${p.sizes.trim()}`);
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
      <h2 style={styles.pageTitle}>Рассылка</h2>
      <p style={{ ...styles.hint, marginBottom: 16 }}>
        Бот пишет каждому подписчику в личку. HTML: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;a href=&quot;…&quot;&gt;</code>. До {MAX_CHANNEL_IMAGES} фото — уйдут одним альбомом. Throttle ~25 сообщ/сек, чтобы не словить лимиты Telegram.
      </p>

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 22, background: "#fafafa", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong style={{ fontSize: 13, letterSpacing: 0.2 }}>Подписчики бота</strong>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {usersCount == null ? "—" : usersCount}
          </div>
          <p style={{ ...styles.hint, marginTop: 4, marginBottom: 0 }}>
            Учитываются все, кто хоть раз тапнул <code>/start</code> у бота, оформлял заказ, добавлял в корзину или избранное. Заблокировавшие бота автоматически исключаются.
          </p>
        </div>
        <button type="button" onClick={refreshUsersCount} style={styles.smallBtn}>
          Обновить
        </button>
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
  const [brand, setBrand] = useState("");
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
    setBrand(p.brand ?? "");
    setCategory(categories.some((c) => c.code === p.category) ? p.category : defaultCategory);
    setSizes(p.sizes || "S,M,L,XL");
  };

  const cancelEdit = () => {
    onEdit(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrls(["", "", "", "", ""]);
    setBrand("");
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
        brand: brand.trim() || undefined,
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

  return (
    <>
      <h2 style={styles.pageTitle}>Товары</h2>
      <p style={styles.hint}>Добавить или редактировать товар</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>Название *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Essential Tee" style={styles.input} required />
        <label style={styles.label}>Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={styles.input} />
        <label style={styles.label}>Цена ($) *</label>
        <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="33" style={styles.input} required />
        <label style={styles.label}>Картинки (до 5 URL)</label>
        {[0, 1, 2, 3, 4].map((i) => (
          <input
            key={i}
            type="text"
            value={imageUrls[i] ?? ""}
            onChange={(e) => setImageUrls((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
            placeholder={i === 0 ? "https://... (обязательно первая)" : `Картинка ${i + 1} (необязательно)`}
            style={styles.input}
          />
        ))}
        <label style={styles.label}>Бренд</label>
        <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Название бренда" style={styles.input} />
        <label style={styles.label}>Категория</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
          {categories.length === 0 ? (
            <option value="tee">Футболки (загрузка…)</option>
          ) : (
            categories.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))
          )}
        </select>
        <label style={styles.label}>Размеры</label>
        <input type="text" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S,M,L,XL" style={styles.input} />
        {message && <p style={styles.message}>{message}</p>}
        <div style={styles.formActions}>
          <button type="submit" disabled={submitting} style={styles.submit}>
            {editingId ? "Сохранить" : "Добавить товар"}
          </button>
          {editingId && <button type="button" onClick={cancelEdit} style={styles.cancelBtn}>Отмена</button>}
        </div>
      </form>

      <div style={styles.list}>
        <h3 style={styles.subtitle}>Товары в каталоге ({products.length})</h3>
        {products.map((p) => (
          <div key={p.id} style={styles.productRow}>
            <img src={(p.image_urls && p.image_urls[0]) || p.image_url || "https://via.placeholder.com/48"} alt="" style={styles.thumb} />
            <div style={styles.productInfo}>
              <p style={styles.productName}>{p.name}</p>
              <p style={styles.productPrice}>{p.price} $ · {p.brand?.trim() || "—"}</p>
            </div>
            <div style={styles.productActions}>
              <button type="button" onClick={() => startEdit(p)} style={styles.smallBtn}>Изменить</button>
              <button type="button" onClick={() => handleDelete(p.id)} style={styles.deleteBtn}>Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PostsTab({ products, adminSecret }: { products: Product[]; adminSecret: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formCaption, setFormCaption] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImageData, setFormImageData] = useState<string | null>(null);
  const [formProductId, setFormProductId] = useState<string>("");
  const [formProductUrl, setFormProductUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

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
    setFormProductId("");
    setFormProductUrl("");
    setShowForm(true);
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setFormCaption(post.caption ?? "");
    setFormImageUrl(post.image_url ?? "");
    setFormImageData(post.image_data ?? null);
    setFormProductId(post.product_id != null ? String(post.product_id) : "");
    setFormProductUrl(post.product_url ?? "");
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
        product_id: formProductId ? parseInt(formProductId, 10) : null,
        product_url: formProductUrl.trim() || null,
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

  const toggleComments = async (postId: number) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setComments([]);
      return;
    }
    setExpandedPostId(postId);
    setCommentsLoading(true);
    try {
      const data = await getPostComments(postId);
      setComments(data);
    } catch {
      setMessage("Ошибка загрузки комментариев");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!confirm("Удалить комментарий?")) return;
    try {
      await deletePostComment(postId, commentId, adminSecret);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const previewSrc = formImageData || (formImageUrl.trim() ? formImageUrl.trim() : null);

  if (loading) return <p style={styles.hint}>Загрузка постов...</p>;

  return (
    <>
      {message && <p style={styles.message}>{message}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Посты</h2>
        {!showForm && (
          <button type="button" onClick={openCreate} style={styles.submit}>
            Создать пост
          </button>
        )}
      </div>

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

          <label style={styles.label}>
            Привязка к товару
            <select
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value)}
              style={styles.input}
            >
              <option value="">Не привязан</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.brand?.trim() ? `(${p.brand.trim()})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Внешняя ссылка на товар (URL)
            <input
              type="url"
              value={formProductUrl}
              onChange={(e) => setFormProductUrl(e.target.value)}
              placeholder="https://..."
              style={styles.input}
            />
          </label>

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
            const linkedProduct = p.product_id != null ? products.find((pr) => pr.id === p.product_id) : null;
            return (
              <div key={p.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
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
                      {new Date(p.created_at).toLocaleString("ru")}
                      {linkedProduct ? ` · 🔗 ${linkedProduct.name}` : ""}
                      {p.product_url && !linkedProduct ? ` · 🔗 ссылка` : ""}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
                      ❤️ {p.likes_count} · 💬 {p.comments_count}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => toggleComments(p.id)} style={styles.smallBtn}>
                      {expandedPostId === p.id ? "Скрыть" : "Комм."}
                    </button>
                    <button type="button" onClick={() => openEdit(p)} style={styles.smallBtn} disabled={busy}>
                      Изменить
                    </button>
                    <button type="button" onClick={() => handleDelete(p.id)} style={styles.deleteBtn} disabled={busy}>
                      Удалить
                    </button>
                  </div>
                </div>
                {expandedPostId === p.id && (
                  <div style={{ padding: "8px 0 8px 72px", borderBottom: "1px solid var(--border)" }}>
                    {commentsLoading ? (
                      <p style={styles.hint}>Загрузка…</p>
                    ) : comments.length === 0 ? (
                      <p style={styles.hint}>Нет комментариев</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name || c.user_id}</span>
                            <span style={{ fontSize: 13, marginLeft: 8 }}>{c.text}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>{new Date(c.created_at).toLocaleString("ru")}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(p.id, c.id)}
                            style={styles.deleteOrderIconBtn}
                            aria-label="Удалить комментарий"
                            title="Удалить"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  authCard: { width: "100%", maxWidth: 380, padding: 32, background: "var(--surface)", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  authForm: { display: "flex", flexDirection: "column", gap: 16 },
  authError: { color: "#c62828", fontSize: 14 },
  title: { fontFamily: "Unbounded, sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 24 },
  label: { fontSize: 14, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 6 },
  input: { padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 15, fontFamily: "inherit" },
  submit: { padding: 14, background: "var(--accent)", border: "none", borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  sidebarFooter: { paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 },
  logoutBtn: { padding: "10px 14px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 13, cursor: "pointer", marginTop: 8 },
  checkBtn: { padding: "8px 12px", background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 12, cursor: "pointer" },
  apiHint: { marginTop: 2, fontSize: 11, color: "var(--muted)" },
  pageTitle: { fontSize: 22, fontWeight: 600, marginBottom: 20 },
  emptyBlock: { padding: 48, textAlign: "center", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" },
  tableWrap: { background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  hint: { color: "var(--muted)", fontSize: 14, marginBottom: 12 },
  form: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, padding: 24, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  message: { color: "var(--accent)", fontSize: 14, marginBottom: 12 },
  formActions: { display: "flex", gap: 12, alignItems: "center" },
  cancelBtn: { padding: 12, background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 14, cursor: "pointer" },
  list: { padding: 24, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  subtitle: { fontSize: 18, fontWeight: 600, marginBottom: 20 },
  productRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" },
  productInfo: { flex: 1, minWidth: 0 },
  productActions: { display: "flex", gap: 8 },
  smallBtn: { padding: "8px 14px", background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, cursor: "pointer" },
  deleteBtn: { padding: "8px 14px", background: "rgba(196, 30, 58, 0.1)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent)", fontSize: 13, cursor: "pointer" },
  thumb: { width: 48, height: 48, objectFit: "cover", borderRadius: 8 },
  productName: { fontWeight: 600 },
  productPrice: { fontSize: 14, color: "var(--muted)" },
  storeDetail: { marginBottom: 24 },
  backBtn: { background: "none", border: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer", marginBottom: 16 },
  sectionTitle: { fontSize: 14, marginTop: 20, marginBottom: 8, fontWeight: 600 },
  productActionsRow: { display: "flex", gap: 8, marginBottom: 12 },
  modalList: { marginTop: 12, padding: 12, background: "var(--bg)", borderRadius: 8, maxHeight: 280, overflowY: "auto" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "var(--surface)", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" },
  orderCard: { padding: 16, marginBottom: 12, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" },
  orderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  orderId: { fontWeight: 700, fontSize: 16 },
  orderStatus: { fontSize: 13 },
  orderThumb: { maxWidth: 64, maxHeight: 64, objectFit: "cover", borderRadius: 8, display: "block" },
  orderField: { fontSize: 14, marginBottom: 4, color: "var(--text)" },
  orderDate: { fontSize: 12, color: "var(--muted)", marginTop: 8, marginBottom: 12 },
  orderActions: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  contactLink: { color: "var(--accent)", fontSize: 13, textDecoration: "none" },
  statusSelect: {
    padding: "8px 12px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  deleteOrderBtn: {
    padding: "6px 10px",
    background: "rgba(196, 30, 58, 0.1)",
    border: "1px solid var(--accent)",
    borderRadius: 6,
    color: "var(--accent)",
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  deleteOrderIconBtn: {
    padding: 6,
    border: "none",
    background: "none",
    color: "var(--accent)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
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
