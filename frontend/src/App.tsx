import { useState, useEffect } from "react";
import { useTelegram } from "./hooks/useTelegram";
import { getProducts, type Product } from "./api";
import { Catalog } from "./pages/Catalog";
import { Cart } from "./pages/Cart";
import { ProductPage } from "./pages/ProductPage";
import { Checkout } from "./pages/Checkout";
import { LoadingScreen } from "./components/LoadingScreen";

type Page = "catalog" | "cart" | "product" | "checkout";

const STORE_LOAD_TIME_MS = 2000;

function App() {
  const { userId } = useTelegram();
  const [page, setPage] = useState<Page>("catalog");
  const [productId, setProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getProducts()
      .then((p) => {
        if (!cancelled) setProducts(p);
      })
      .catch(console.error);

    const timer = setTimeout(() => {
      if (!cancelled) setStoreReady(true);
    }, STORE_LOAD_TIME_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const openProduct = (id: number) => {
    setProductId(id);
    setPage("product");
  };

  const openCart = () => setPage("cart");
  const openCatalog = () => {
    setPage("catalog");
    setProductId(null);
  };
  const openCheckout = () => setPage("checkout");

  if (!storeReady) {
    return <LoadingScreen />;
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <button onClick={openCatalog} style={styles.logo}>
          ZΞN
        </button>
        <button onClick={openCart} style={styles.cartBtn}>
          🛒 Корзина
        </button>
      </header>

      <main style={styles.main}>
        {page === "catalog" && <Catalog products={products} onProductClick={openProduct} />}
        {page === "product" && productId && (
          <ProductPage productId={productId} onBack={openCatalog} onCart={openCart} userId={userId} />
        )}
        {page === "cart" && (
          <Cart userId={userId} onBack={openCatalog} onCheckout={openCheckout} />
        )}
        {page === "checkout" && (
          <Checkout userId={userId} onBack={openCart} onDone={openCatalog} />
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "var(--bg)",
    paddingBottom: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    background: "var(--bg)",
    zIndex: 10,
  },
  logo: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    color: "var(--text)",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  cartBtn: {
    padding: "8px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
  },
  main: {
    padding: 16,
  },
};

export default App;
