import { useState, useEffect, useRef } from "react";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createStore,
  updateStore,
  deleteStore,
  getProducts,
  getStores,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  verifyAdmin,
  checkApiHealth,
  getOrdersAdmin,
  getCustomOrdersAdmin,
  updateOrderStatus,
  getSupportChatsAdmin,
  getSupportMessagesAdmin,
  sendSupportMessageAdmin,
  updateSupportMessageAdmin,
  deleteSupportMessageAdmin,
  type Product,
  type Store,
  type Category,
  type Order,
  type CustomOrderAdmin,
  type SupportChat,
  type SupportMessage,
} from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Tab = "products" | "stores" | "categories" | "orders" | "customOrders" | "support";

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showAddProductToStore, setShowAddProductToStore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; url: string; error?: string } | null>(null);

  const refresh = () => {
    getProducts().then(setProducts).catch(console.error);
    getStores().then(setStores).catch(console.error);
    getCategories().then(setCategories).catch(console.error);
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
    setEditingStoreId(null);
    setEditingProductId(null);
  };

  return (
    <div className="zen-admin">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">ZEN Admin</div>
          <button type="button" onClick={() => setTabAndReset("products")} className={`admin-nav-btn ${tab === "products" ? "active" : ""}`}>
            Товары
          </button>
          <button type="button" onClick={() => setTabAndReset("stores")} className={`admin-nav-btn ${tab === "stores" ? "active" : ""}`}>
            Магазины
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
          <button type="button" onClick={() => setTabAndReset("support")} className={`admin-nav-btn ${tab === "support" ? "active" : ""}`}>
            Поддержка
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
                setEditingStoreId(null);
                setEditingProductId(null);
              }}
              style={styles.logoutBtn}
            >
              Выйти
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <div className="admin-content">
      {tab === "products" && (
        <ProductsTab
          products={products}
          stores={stores}
          categories={categories}
          adminSecret={adminSecret}
          editingId={editingProductId}
          onEdit={setEditingProductId}
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

      {tab === "support" && (
        <SupportTab adminSecret={adminSecret} />
      )}

      {tab === "stores" && (
        <StoresTab
          products={products}
          stores={stores}
          categories={categories}
          adminSecret={adminSecret}
          editingStoreId={editingStoreId}
          setEditingStoreId={setEditingStoreId}
          showAddProductToStore={showAddProductToStore}
          setShowAddProductToStore={setShowAddProductToStore}
          onRefresh={refresh}
          message={message}
          setMessage={setMessage}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}

          </div>
        </main>
      </div>
    </div>
  );
}

function OrdersTab({ adminSecret }: { adminSecret: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

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

  if (loading) return <p style={styles.hint}>Загрузка заказов...</p>;

  return (
    <>
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Заказы</h2>
      {orders.length === 0 ? (
        <div style={styles.emptyBlock}>
          <p style={styles.hint}>Нет заказов</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Товары</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                let items: { name?: string; size?: string; quantity?: number; image_url?: string | null }[] = [];
                try {
                  items = typeof o.items === "string" ? JSON.parse(o.items) : o.items;
                } catch {}
                const itemsStr = Array.isArray(items)
                  ? items.map((i) => `${i.name || "Товар"} × ${i.quantity || 1} (${i.size || "—"})`).join(", ")
                  : String(o.items);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.id}</td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{new Date(o.created_at).toLocaleString("ru")}</td>
                    <td>{o.user_name || "—"}</td>
                    <td>{o.user_phone || "—"}</td>
                    <td style={{ maxWidth: 200, fontSize: 13 }}>{itemsStr}</td>
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
                      <a href={`tg://user?id=${o.user_id}`} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
                        Telegram
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CustomOrdersTab({ adminSecret }: { adminSecret: string }) {
  const [list, setList] = useState<CustomOrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  if (loading) return <p style={styles.hint}>Загрузка заявок...</p>;

  return (
    <>
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Заявки не из каталога</h2>
      <div style={styles.list}>
        <h3 style={styles.subtitle}>Список ({list.length})</h3>
        {list.length === 0 ? (
          <p style={styles.hint}>Нет заявок</p>
        ) : (
          list.map((c) => (
            <div key={c.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <span style={styles.orderId}>#{c.id}</span>
              </div>
              <p style={styles.orderField}>👤 {c.user_name || "—"}</p>
              <p style={styles.orderField}>📱 {c.user_username || "—"}</p>
              {c.user_address && <p style={styles.orderField}>📍 {c.user_address}</p>}
              <p style={styles.orderField}>📝 {c.description || "—"}</p>
              {c.size && <p style={styles.orderField}>📐 Размер: {c.size}</p>}
              {c.image_data && (
                <p style={styles.orderField}>
                  <img src={c.image_data} alt="" style={{ maxWidth: 120, maxHeight: 120, objectFit: "cover", borderRadius: 8 }} />
                </p>
              )}
              <p style={styles.orderDate}>{new Date(c.created_at).toLocaleString("ru")}</p>
              <a href={`tg://user?id=${c.user_id}`} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
                Написать в Telegram
              </a>
            </div>
          ))
        )}
      </div>
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

function SupportTab({ adminSecret }: { adminSecret: string }) {
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const ADMIN_INPUT_MIN_H = 40;
  const ADMIN_INPUT_MAX_H = 160;

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, selectedChatId]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const h = el.scrollHeight;
    el.style.height = Math.max(ADMIN_INPUT_MIN_H, Math.min(h, ADMIN_INPUT_MAX_H)) + "px";
  }, [input]);

  useEffect(() => {
    if (!adminSecret) return;
    setLoading(true);
    getSupportChatsAdmin(adminSecret)
      .then(setChats)
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setLoading(false));
  }, [adminSecret]);

  useEffect(() => {
    if (!adminSecret || !selectedChatId) return;
    setMessagesLoading(true);
    getSupportMessagesAdmin(selectedChatId, adminSecret)
      .then(setMessages)
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setMessagesLoading(false));
  }, [adminSecret, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || !adminSecret) return;
    const t = setInterval(() => {
      getSupportMessagesAdmin(selectedChatId, adminSecret).then(setMessages).catch(() => {});
      getSupportChatsAdmin(adminSecret).then((list) => {
        setChats(list);
        if (!list.some((c) => c.id === selectedChatId)) setSelectedChatId(null);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [selectedChatId, adminSecret]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || selectedChatId == null || sending) return;
    setSending(true);
    setMessage("");
    sendSupportMessageAdmin(selectedChatId, adminSecret, { text })
      .then((msg) => {
        setMessages((prev) => [...prev, msg]);
        setInput("");
      })
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setSending(false));
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return s;
    }
  };

  const handleUpdateMessage = () => {
    if (selectedChatId == null || editingMessageId == null) return;
    const text = editingMessageText.trim();
    if (!text) return;
    setSending(true);
    setMessage("");
    updateSupportMessageAdmin(selectedChatId, editingMessageId, adminSecret, { text })
      .then((updated) => {
        setMessages((prev) => prev.map((x) => (x.id === editingMessageId ? updated : x)));
        setEditingMessageId(null);
        setEditingMessageText("");
      })
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setSending(false));
  };

  const handleDeleteMessage = (messageId: number) => {
    if (selectedChatId == null || !confirm("Удалить сообщение?")) return;
    setSending(true);
    setMessage("");
    deleteSupportMessageAdmin(selectedChatId, messageId, adminSecret)
      .then(() => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (editingMessageId === messageId) {
          setEditingMessageId(null);
          setEditingMessageText("");
        }
      })
      .catch((e) => setMessage("Ошибка: " + (e instanceof Error ? e.message : "")))
      .finally(() => setSending(false));
  };

  if (loading) return <p style={styles.hint}>Загрузка чатов...</p>;

  const chat = selectedChatId != null ? chats.find((c) => c.id === selectedChatId) : null;

  return (
    <>
      {message && <p style={styles.message}>{message}</p>}
      <h2 style={styles.pageTitle}>Поддержка</h2>
      <div className="admin-support-layout">
        <div style={styles.supportListPanel}>
          <h3 style={styles.subtitle}>Чаты ({chats.length})</h3>
          {chats.length === 0 ? (
            <p style={styles.hint}>Нет чатов. Когда пользователь создаст чат из приложения, он появится здесь.</p>
          ) : (
            <div style={styles.chatList}>
              {chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChatId(c.id)}
                  style={{
                    ...styles.chatListItem,
                    ...(selectedChatId === c.id ? styles.chatListItemActive : {}),
                  }}
                >
                  <span style={styles.chatListItemTitle}>{c.title?.trim() || `Чат #${c.id}`}</span>
                  <span style={styles.chatListItemMeta}>{c.user_name || c.user_username || "—"}</span>
                  <span style={styles.chatListItemDate}>{formatDate(c.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={styles.supportThreadPanel}>
          {chat ? (
            <>
              <div style={styles.supportThreadHeader}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{chat.title?.trim() || `Чат #${chat.id}`}</h3>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{chat.user_name || chat.user_username || chat.user_id}</span>
              </div>
              <div ref={messagesScrollRef} style={supportThreadStyle}>
                {messagesLoading && messages.length === 0 ? (
                  <p style={styles.hint}>Загрузка сообщений...</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        ...supportBubbleStyle,
                        ...(m.sender_type === "admin" ? supportBubbleAdminStyle : supportBubbleUserStyle),
                        position: "relative",
                      }}
                    >
                      {editingMessageId === m.id && m.sender_type === "admin" ? (
                        <div style={styles.supportEditBlock}>
                          <input
                            type="text"
                            value={editingMessageText}
                            onChange={(e) => setEditingMessageText(e.target.value)}
                            style={styles.supportEditInput}
                            autoFocus
                          />
                          <div style={styles.supportEditActions}>
                            <button type="button" onClick={handleUpdateMessage} disabled={sending} style={styles.supportMsgSaveBtn}>
                              Сохранить
                            </button>
                            <button type="button" onClick={() => { setEditingMessageId(null); setEditingMessageText(""); }} style={styles.supportMsgCancelBtn}>
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {m.sender_type === "admin" && (
                            <div style={styles.supportBubbleActions}>
                              <button type="button" onClick={() => { setEditingMessageId(m.id); setEditingMessageText(m.text || ""); }} style={styles.supportMsgIconBtn} title="Изменить">
                                ✎
                              </button>
                              <button type="button" onClick={() => handleDeleteMessage(m.id)} disabled={sending} style={styles.supportMsgIconBtn} title="Удалить">
                                ×
                              </button>
                            </div>
                          )}
                          {m.image_url && (
                            <button type="button" onClick={() => setExpandedImageUrl(m.image_url)} style={styles.supportBubbleImgBtn}>
                              <img src={m.image_url} alt="" style={styles.supportBubbleImg} />
                            </button>
                          )}
                          {m.text ? <span style={{ display: "block", fontSize: 14, paddingRight: m.sender_type === "admin" ? 48 : 0, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{m.text}</span> : null}
                          <span style={{ display: "block", fontSize: 11, opacity: 0.8, marginTop: 4 }}>{formatDate(m.created_at)}</span>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div style={styles.supportInputRow}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Сообщение..."
                  style={styles.supportTextarea}
                  rows={1}
                  disabled={sending}
                />
                <button type="button" onClick={handleSend} style={styles.submit} disabled={sending || !input.trim()}>
                  Отправить
                </button>
              </div>
              {expandedImageUrl && (
                <div style={styles.supportImageOverlay} onClick={() => setExpandedImageUrl(null)}>
                  <img src={expandedImageUrl} alt="" style={styles.supportImageExpanded} onClick={(e) => e.stopPropagation()} />
                </div>
              )}
            </>
          ) : (
            <div style={styles.supportPlaceholder}>
              <p style={styles.hint}>Выберите чат слева</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const supportThreadStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 280,
  maxHeight: 420,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 16,
  background: "var(--surface-elevated)",
  borderRadius: 12,
  border: "1px solid var(--border)",
};
const supportBubbleStyle: React.CSSProperties = {
  maxWidth: "85%",
  padding: "10px 14px",
  borderRadius: 12,
  alignSelf: "flex-start",
};
const supportBubbleAdminStyle: React.CSSProperties = { ...supportBubbleStyle, background: "var(--accent)", color: "#fff", alignSelf: "flex-end" };
const supportBubbleUserStyle: React.CSSProperties = { ...supportBubbleStyle, background: "var(--border)", color: "var(--text)" };

function ProductsTab({
  products,
  stores,
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
  stores: Store[];
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
  const [storeId, setStoreId] = useState(1);
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
    setStoreId(p.store_id ?? 1);
    setCategory(categories.some((c) => c.code === p.category) ? p.category : defaultCategory);
    setSizes(p.sizes || "S,M,L,XL");
  };

  const cancelEdit = () => {
    onEdit(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrls(["", "", "", "", ""]);
    setStoreId(1);
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
        store_id: storeId,
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
        <label style={styles.label}>Магазин</label>
        <select value={storeId} onChange={(e) => setStoreId(Number(e.target.value))} style={styles.input}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
              <p style={styles.productPrice}>{p.price} $ · {stores.find(s => s.id === (p.store_id ?? 1))?.name || "—"}</p>
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

function StoresTab({
  products,
  stores,
  categories,
  adminSecret,
  editingStoreId,
  setEditingStoreId,
  showAddProductToStore,
  setShowAddProductToStore,
  onRefresh,
  message,
  setMessage,
  submitting,
  setSubmitting,
}: {
  products: Product[];
  stores: Store[];
  categories: Category[];
  adminSecret: string;
  editingStoreId: number | null;
  setEditingStoreId: (id: number | null) => void;
  showAddProductToStore: number | null;
  setShowAddProductToStore: (id: number | null) => void;
  onRefresh: () => void;
  message: string;
  setMessage: (m: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}) {
  const editingStore = stores.find((s) => s.id === editingStoreId);
  const storeProducts = editingStoreId ? products.filter((p) => (p.store_id ?? 1) === editingStoreId) : [];
  const otherProducts = editingStoreId ? products.filter((p) => (p.store_id ?? 1) !== editingStoreId) : products;

  const [storeName, setStoreName] = useState("");
  const [storeImage, setStoreImage] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreImage, setNewStoreImage] = useState("");
  const [newStoreDesc, setNewStoreDesc] = useState("");
  const [productFormStoreId, setProductFormStoreId] = useState<number | null>(null);

  useEffect(() => {
    if (editingStore) {
      setStoreName(editingStore.name);
      setStoreImage(editingStore.image_url || "");
      setStoreDesc(editingStore.description || "");
    }
  }, [editingStore]);

  const startEditStore = (s: Store) => {
    setEditingStoreId(s.id);
    setStoreName(s.name);
    setStoreImage(s.image_url || "");
    setStoreDesc(s.description || "");
  };

  const handleSaveStore = async () => {
    if (!editingStoreId || !storeName.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      await updateStore(editingStoreId, { name: storeName.trim(), image_url: storeImage.trim() || undefined, description: storeDesc.trim() || undefined }, adminSecret);
      setMessage("Магазин обновлён");
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      await createStore({ name: newStoreName.trim(), image_url: newStoreImage.trim() || undefined, description: newStoreDesc.trim() || undefined }, adminSecret);
      setMessage("Магазин создан");
      setNewStoreName("");
      setNewStoreImage("");
      setNewStoreDesc("");
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStore = async (id: number) => {
    if (!confirm("Удалить магазин? Товары будут переназначены в первый магазин.")) return;
    setSubmitting(true);
    try {
      await deleteStore(id, adminSecret);
      setEditingStoreId(null);
      setMessage("Магазин удалён");
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignProduct = async (productId: number, toStoreId: number) => {
    setSubmitting(true);
    setMessage("");
    try {
      await updateProduct(productId, { store_id: toStoreId }, adminSecret);
      setMessage("Товар добавлен в магазин");
      setShowAddProductToStore(null);
      onRefresh();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {editingStoreId && editingStore ? (
        <div style={styles.storeDetail}>
          <button type="button" onClick={() => setEditingStoreId(null)} style={styles.backBtn}>← К списку магазинов</button>
          <h3 style={styles.subtitle}>{editingStore.name}</h3>
          <div style={styles.form}>
            <label style={styles.label}>Название</label>
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} style={styles.input} />
            <label style={styles.label}>URL картинки</label>
            <input type="text" value={storeImage} onChange={(e) => setStoreImage(e.target.value)} placeholder="https://..." style={styles.input} />
            <label style={styles.label}>Описание</label>
            <input type="text" value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} style={styles.input} />
            <div style={styles.formActions}>
              <button type="button" onClick={handleSaveStore} disabled={submitting} style={styles.submit}>Сохранить</button>
              <button type="button" onClick={() => handleDeleteStore(editingStoreId)} style={styles.deleteBtn}>Удалить магазин</button>
            </div>
          </div>

          <h4 style={styles.sectionTitle}>Товары в магазине ({storeProducts.length})</h4>
          <div style={styles.productActionsRow}>
            <button type="button" onClick={() => setProductFormStoreId(editingStoreId)} style={styles.smallBtn}>
              + Создать новый товар
            </button>
            <button type="button" onClick={() => setShowAddProductToStore(showAddProductToStore === editingStoreId ? null : editingStoreId)} style={styles.smallBtn}>
              + Добавить существующий
            </button>
          </div>

          {showAddProductToStore === editingStoreId && otherProducts.length > 0 && (
            <div style={styles.modalList}>
              {otherProducts.map((p) => (
                <div key={p.id} style={styles.productRow}>
                  <img src={(p.image_urls && p.image_urls[0]) || p.image_url || "https://via.placeholder.com/40"} alt="" style={{ ...styles.thumb, width: 40, height: 40 }} />
                  <div style={styles.productInfo}>
                    <p style={styles.productName}>{p.name}</p>
                    <p style={styles.productPrice}>{p.price} $</p>
                  </div>
                  <button type="button" onClick={() => handleAssignProduct(p.id, editingStoreId)} style={styles.smallBtn}>Добавить</button>
                </div>
              ))}
            </div>
          )}

          {showAddProductToStore === editingStoreId && otherProducts.length === 0 && (
            <p style={styles.hint}>Все товары уже в этом магазине</p>
          )}

          {storeProducts.map((p) => (
            <div key={p.id} style={styles.productRow}>
              <img src={(p.image_urls && p.image_urls[0]) || p.image_url || "https://via.placeholder.com/48"} alt="" style={styles.thumb} />
              <div style={styles.productInfo}>
                <p style={styles.productName}>{p.name}</p>
                <p style={styles.productPrice}>{p.price} $</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <h2 style={styles.pageTitle}>Магазины</h2>
          <p style={styles.hint}>Добавить магазин</p>
          <div style={styles.form}>
            <input type="text" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} placeholder="Название магазина" style={styles.input} />
            <input type="text" value={newStoreImage} onChange={(e) => setNewStoreImage(e.target.value)} placeholder="URL картинки" style={styles.input} />
            <input type="text" value={newStoreDesc} onChange={(e) => setNewStoreDesc(e.target.value)} placeholder="Описание" style={styles.input} />
            <button type="button" onClick={handleAddStore} disabled={submitting} style={styles.submit}>Создать магазин</button>
          </div>

          <div style={styles.list}>
            <h3 style={styles.subtitle}>Магазины ({stores.length})</h3>
            {stores.map((s) => (
              <div key={s.id} style={styles.productRow}>
                <img src={s.image_url || "https://via.placeholder.com/48"} alt="" style={styles.thumb} />
                <div style={styles.productInfo}>
                  <p style={styles.productName}>{s.name}</p>
                  <p style={styles.productPrice}>{products.filter(p => (p.store_id ?? 1) === s.id).length} товаров</p>
                </div>
                <div style={styles.productActions}>
                  <button type="button" onClick={() => startEditStore(s)} style={styles.smallBtn}>Изменить</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {productFormStoreId && (
        <ProductFormModal
          storeId={productFormStoreId}
          stores={stores}
          categories={categories}
          adminSecret={adminSecret}
          onClose={() => setProductFormStoreId(null)}
          onSaved={() => {
            setProductFormStoreId(null);
            setMessage("Товар создан");
            onRefresh();
          }}
          setSubmitting={setSubmitting}
          setMessage={setMessage}
        />
      )}

      {message && <p style={styles.message}>{message}</p>}
    </>
  );
}

function ProductFormModal({
  storeId,
  stores,
  categories,
  adminSecret,
  onClose,
  onSaved,
  setSubmitting,
  setMessage,
}: {
  storeId: number;
  stores: Store[];
  categories: Category[];
  adminSecret: string;
  onClose: () => void;
  onSaved: () => void;
  setSubmitting: (v: boolean) => void;
  setMessage: (m: string) => void;
}) {
  const defaultCat = categories.length > 0 ? categories[0].code : "tee";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>(["", "", "", "", ""]);
  const [category, setCategory] = useState(defaultCat);
  const [sizes, setSizes] = useState("S,M,L,XL");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) return;
    setSubmitting(true);
    try {
      const urls = imageUrls.map((x) => x.trim()).filter(Boolean);
      await createProduct({
        store_id: storeId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price.replace(/\s/g, "")) || 0,
        image_url: urls[0] || undefined,
        image_urls: urls.length > 0 ? urls : undefined,
        category,
        sizes: sizes.trim() || undefined,
      }, adminSecret);
      onSaved();
    } catch (err) {
      setMessage("Ошибка: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h4 style={styles.subtitle}>Новый товар в {stores.find(s => s.id === storeId)?.name}</h4>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название *" style={styles.input} required />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" rows={2} style={styles.input} />
          <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена ($) *" style={styles.input} required />
          <label style={styles.label}>Картинки (до 5 URL)</label>
          {[0, 1, 2, 3, 4].map((i) => (
            <input
              key={i}
              type="text"
              value={imageUrls[i] ?? ""}
              onChange={(e) => setImageUrls((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
              placeholder={i === 0 ? "https://... (первая)" : `Картинка ${i + 1}`}
              style={styles.input}
            />
          ))}
          <label style={styles.label}>Категория</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <input type="text" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="Размеры" style={styles.input} />
          <div style={styles.formActions}>
            <button type="submit" style={styles.submit}>Создать</button>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
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
  chatListItemMeta: { display: "block", fontSize: 12, opacity: 0.85, marginTop: 2 },
  chatListItemDate: { display: "block", fontSize: 11, opacity: 0.75, marginTop: 2 },
  supportThreadHeader: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" },
  supportInputRow: { display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end" },
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
};
