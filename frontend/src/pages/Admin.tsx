import { useState, useEffect } from "react";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createStore,
  updateStore,
  deleteStore,
  getProducts,
  getStores,
  verifyAdmin,
  checkApiHealth,
  type Product,
  type Store,
} from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Tab = "products" | "stores";

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
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
      <div style={styles.wrap}>
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
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={styles.title}>Админ-панель</h1>
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

      <div style={styles.tabs}>
        <button
          type="button"
          onClick={() => { setTab("products"); setEditingStoreId(null); setEditingProductId(null); }}
          style={{ ...styles.tabBtn, ...(tab === "products" ? styles.tabActive : {}) }}
        >
          Товары
        </button>
        <button
          type="button"
          onClick={() => { setTab("stores"); setEditingStoreId(null); setEditingProductId(null); }}
          style={{ ...styles.tabBtn, ...(tab === "stores" ? styles.tabActive : {}) }}
        >
          Магазины
        </button>
      </div>

      {tab === "products" && (
        <ProductsTab
          products={products}
          stores={stores}
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

      {tab === "stores" && (
        <StoresTab
          products={products}
          stores={stores}
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

      <div style={styles.apiSection}>
        <button type="button" onClick={() => checkApiHealth().then(setApiStatus)} style={styles.checkBtn}>
          Проверить API
        </button>
        {apiStatus && (
          <p style={{ ...styles.apiHint, color: apiStatus.ok ? "var(--accent)" : "#e63950" }}>
            {apiStatus.ok ? `✓ API (${apiStatus.url})` : `✗ ${apiStatus.error}`}
          </p>
        )}
        <p style={styles.apiHint}>API: {API_URL}</p>
      </div>
    </div>
  );
}

function ProductsTab({
  products,
  stores,
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
  adminSecret: string;
  editingId: number | null;
  onEdit: (id: number | null) => void;
  onRefresh: () => void;
  message: string;
  setMessage: (m: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("tee");
  const [storeId, setStoreId] = useState(1);
  const [sizes, setSizes] = useState("S,M,L,XL");

  const startEdit = (p: Product) => {
    onEdit(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setPrice(String(p.price));
    setImageUrl(p.image_url || "");
    setStoreId(p.store_id ?? 1);
    setCategory(p.category || "tee");
    setSizes(p.sizes || "S,M,L,XL");
  };

  const cancelEdit = () => {
    onEdit(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setStoreId(1);
    setCategory("tee");
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
      const data = {
        store_id: storeId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price.replace(/\s/g, "")) || 0,
        image_url: imageUrl.trim() || undefined,
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
      <p style={styles.hint}>Добавить или редактировать товар</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>Название *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Essential Tee" style={styles.input} required />
        <label style={styles.label}>Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={styles.input} />
        <label style={styles.label}>Цена (₽) *</label>
        <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2990" style={styles.input} required />
        <label style={styles.label}>URL картинки</label>
        <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." style={styles.input} />
        <label style={styles.label}>Магазин</label>
        <select value={storeId} onChange={(e) => setStoreId(Number(e.target.value))} style={styles.input}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <label style={styles.label}>Категория</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
          <option value="tee">Футболки</option>
          <option value="hoodie">Худи</option>
          <option value="pants">Штаны</option>
          <option value="jacket">Куртки</option>
          <option value="accessories">Аксессуары</option>
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
            <img src={p.image_url || "https://via.placeholder.com/48"} alt="" style={styles.thumb} />
            <div style={styles.productInfo}>
              <p style={styles.productName}>{p.name}</p>
              <p style={styles.productPrice}>{p.price} ₽ · {stores.find(s => s.id === (p.store_id ?? 1))?.name || "—"}</p>
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
                  <img src={p.image_url || "https://via.placeholder.com/40"} alt="" style={{ ...styles.thumb, width: 40, height: 40 }} />
                  <div style={styles.productInfo}>
                    <p style={styles.productName}>{p.name}</p>
                    <p style={styles.productPrice}>{p.price} ₽</p>
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
              <img src={p.image_url || "https://via.placeholder.com/48"} alt="" style={styles.thumb} />
              <div style={styles.productInfo}>
                <p style={styles.productName}>{p.name}</p>
                <p style={styles.productPrice}>{p.price} ₽</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
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
  adminSecret,
  onClose,
  onSaved,
  setSubmitting,
  setMessage,
}: {
  storeId: number;
  stores: Store[];
  adminSecret: string;
  onClose: () => void;
  onSaved: () => void;
  setSubmitting: (v: boolean) => void;
  setMessage: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("tee");
  const [sizes, setSizes] = useState("S,M,L,XL");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) return;
    setSubmitting(true);
    try {
      await createProduct({
        store_id: storeId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price.replace(/\s/g, "")) || 0,
        image_url: imageUrl.trim() || undefined,
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
          <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена (₽) *" style={styles.input} required />
          <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL картинки" style={styles.input} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
            <option value="tee">Футболки</option>
            <option value="hoodie">Худи</option>
            <option value="pants">Штаны</option>
            <option value="jacket">Куртки</option>
            <option value="accessories">Аксессуары</option>
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
  wrap: { maxWidth: 480, margin: "0 auto", padding: 24, minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontFamily: "Unbounded, sans-serif", fontSize: 24 },
  logoutBtn: { padding: "8px 14px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 13, cursor: "pointer" },
  tabs: { display: "flex", gap: 8, marginBottom: 20 },
  tabBtn: { padding: "10px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 14, cursor: "pointer" },
  tabActive: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  hint: { color: "var(--muted)", fontSize: 14, marginBottom: 12 },
  form: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, padding: 20, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" },
  label: { fontSize: 14, color: "var(--muted)" },
  input: { padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 15, fontFamily: "inherit" },
  message: { color: "var(--accent)", fontSize: 14, marginBottom: 12 },
  submit: { padding: 14, background: "var(--accent)", border: "none", borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  formActions: { display: "flex", gap: 12, alignItems: "center" },
  cancelBtn: { padding: 14, background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 15, cursor: "pointer" },
  list: { padding: 20, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" },
  subtitle: { fontSize: 16, marginBottom: 16 },
  productRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" },
  productInfo: { flex: 1 },
  productActions: { display: "flex", gap: 8 },
  smallBtn: { padding: "6px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 12, cursor: "pointer" },
  deleteBtn: { padding: "6px 10px", background: "rgba(196, 30, 58, 0.2)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent)", fontSize: 12, cursor: "pointer" },
  thumb: { width: 48, height: 48, objectFit: "cover", borderRadius: 8 },
  productName: { fontWeight: 600 },
  productPrice: { fontSize: 14, color: "var(--accent)" },
  apiSection: { marginTop: 24 },
  checkBtn: { padding: "8px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, cursor: "pointer", marginBottom: 8 },
  apiHint: { marginTop: 4, fontSize: 12, color: "var(--muted)" },
  storeDetail: { marginBottom: 24 },
  backBtn: { background: "none", border: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer", marginBottom: 16 },
  sectionTitle: { fontSize: 14, marginTop: 20, marginBottom: 8 },
  productActionsRow: { display: "flex", gap: 8, marginBottom: 12 },
  modalList: { marginTop: 12, padding: 12, background: "var(--bg)", borderRadius: 8, maxHeight: 200, overflowY: "auto" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "var(--surface)", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto" },
};
