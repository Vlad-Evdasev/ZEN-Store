import { useState, useEffect } from "react";
import { createProduct, getProducts, getStores, verifyAdmin, checkApiHealth, type Product, type Store } from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("tee");
  const [storeId, setStoreId] = useState(1);
  const [sizes, setSizes] = useState("S,M,L,XL");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) {
      setMessage("Укажите название и цену");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await createProduct(
        {
        store_id: storeId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price.replace(/\s/g, "")) || 0,
        image_url: imageUrl.trim() || undefined,
        category,
        sizes: sizes.trim() || undefined,
      },
        adminSecret
      );
      setMessage("Товар добавлен!");
      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось добавить";
      setMessage("Ошибка: " + msg + (msg.includes("fetch") ? " Проверь VITE_API_URL на Vercel." : ""));
    } finally {
      setSubmitting(false);
    }
  };

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
          }}
          style={styles.logoutBtn}
        >
          Выйти
        </button>
      </div>
      <p style={styles.hint}>Добавление товаров в каталог</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Название *
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Essential Tee"
            style={styles.input}
            required
          />
        </label>
        <label style={styles.label}>
          Описание
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание товара"
            rows={2}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Цена (₽) *
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2990"
            style={styles.input}
            required
          />
        </label>
        <label style={styles.label}>
          URL картинки
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            style={styles.input}
          />
          <span style={styles.hintSmall}>
            Используй ссылку на картинку (https://). Не вставляй base64.
          </span>
        </label>
        <label style={styles.label}>
          Магазин
          <select
            value={storeId}
            onChange={(e) => setStoreId(Number(e.target.value))}
            style={styles.input}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {stores.length === 0 && <option value={1}>Футболки</option>}
          </select>
        </label>
        <label style={styles.label}>
          Категория
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={styles.input}
          >
            <option value="tee">Футболки</option>
            <option value="hoodie">Худи</option>
            <option value="pants">Штаны</option>
            <option value="jacket">Куртки</option>
            <option value="accessories">Аксессуары</option>
          </select>
        </label>
        <label style={styles.label}>
          Размеры
          <input
            type="text"
            value={sizes}
            onChange={(e) => setSizes(e.target.value)}
            placeholder="S,M,L,XL"
            style={styles.input}
          />
        </label>
        {message && <p style={styles.message}>{message}</p>}
        <button type="submit" disabled={submitting} style={styles.submit}>
          {submitting ? "Добавляю..." : "Добавить товар"}
        </button>
      </form>

      <div style={styles.list}>
        <h3 style={styles.subtitle}>Товары в каталоге ({products.length})</h3>
        {products.map((p) => (
          <div key={p.id} style={styles.productRow}>
            <img
              src={p.image_url || "https://via.placeholder.com/48"}
              alt=""
              style={styles.thumb}
            />
            <div>
              <p style={styles.productName}>{p.name}</p>
              <p style={styles.productPrice}>{p.price} ₽</p>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.apiSection}>
        <button
          type="button"
          onClick={() => checkApiHealth().then(setApiStatus)}
          style={styles.checkBtn}
        >
          Проверить API
        </button>
        {apiStatus && (
          <p style={{ ...styles.apiHint, color: apiStatus.ok ? "var(--accent)" : "#e63950" }}>
            {apiStatus.ok ? `✓ API доступен (${apiStatus.url})` : `✗ Ошибка: ${apiStatus.error} | URL: ${apiStatus.url}`}
          </p>
        )}
        <p style={styles.apiHint}>API: {API_URL}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 480,
    margin: "0 auto",
    padding: 24,
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 24,
  },
  logoutBtn: {
    padding: "8px 14px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--muted)",
    fontSize: 13,
    cursor: "pointer",
  },
  hint: {
    color: "var(--muted)",
    fontSize: 14,
    marginBottom: 24,
  },
  authForm: {
    maxWidth: 320,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 24,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  authError: {
    color: "var(--accent)",
    fontSize: 14,
  },
  hintSmall: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 4,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginBottom: 32,
    padding: 20,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    color: "var(--muted)",
  },
  input: {
    padding: 12,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 15,
    fontFamily: "inherit",
  },
  message: {
    color: "var(--accent)",
    fontSize: 14,
  },
  submit: {
    padding: 14,
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  list: {
    padding: 20,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  productRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  thumb: {
    width: 48,
    height: 48,
    objectFit: "cover",
    borderRadius: 8,
  },
  productName: { fontWeight: 600 },
  productPrice: { fontSize: 14, color: "var(--accent)" },
  apiSection: { marginTop: 24 },
  checkBtn: {
    padding: "8px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 8,
  },
  apiHint: {
    marginTop: 4,
    fontSize: 12,
    color: "var(--muted)",
  },
};
