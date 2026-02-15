import { useState, useEffect } from "react";
import { useTelegram } from "./hooks/useTelegram";
import { useWishlist } from "./hooks/useWishlist";
import { getProducts, getStores, getCart, type Product, type Store } from "./api";
import { Catalog } from "./pages/Catalog";
import { Cart } from "./pages/Cart";
import { Favorites } from "./pages/Favorites";
import { ProductPage } from "./pages/ProductPage";
import { Checkout } from "./pages/Checkout";
import { Profile } from "./pages/Profile";
import { Reviews } from "./pages/Reviews";
import { LoadingScreen } from "./components/LoadingScreen";
import { Footer } from "./components/Footer";

type Page = "catalog" | "cart" | "product" | "checkout" | "profile" | "reviews" | "favorites";

const STORE_LOAD_TIME_MS = 2000;

function App() {
  const { userId, userName, firstName } = useTelegram();
  const { wishlistIds, toggleWishlist, hasInWishlist } = useWishlist(userId);
  const [page, setPage] = useState<Page>("catalog");
  const [productId, setProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeReady, setStoreReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getProducts().then((p) => {
        if (!cancelled) setProducts(p);
      }),
      getStores().then((s) => {
        if (!cancelled) setStores(s);
      }),
    ]).catch(console.error);

    const timer = setTimeout(() => {
      if (!cancelled) setStoreReady(true);
    }, STORE_LOAD_TIME_MS);

    getCart(userId || "").then((items) => {
      if (!cancelled) setCartCount(items.reduce((a, i) => a + i.quantity, 0));
    }).catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId]);

  const openProduct = (id: number) => {
    setProductId(id);
    setPage("product");
  };

  const openCart = () => setPage("cart");
  const openProfile = () => setPage("profile");
  const openReviews = () => setPage("reviews");
  const openFavorites = () => setPage("favorites");

  const refreshCartCount = () => {
    getCart(userId || "").then((items) =>
      setCartCount(items.reduce((a, i) => a + i.quantity, 0))
    ).catch(() => {});
  };
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
        <div style={styles.headerActions}>
          <button onClick={openReviews} style={styles.headerLink}>
            Отзывы
          </button>
          <button onClick={openFavorites} style={styles.headerLink}>
            Избранное
          </button>
          <button onClick={openProfile} style={styles.headerLink}>
            Профиль
          </button>
          <button onClick={openCart} style={styles.headerBtnWrapper}>
            <span>Корзина</span>
            {cartCount > 0 && <span style={styles.cartBadge}>{cartCount}</span>}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {page === "catalog" && (
          <Catalog
            products={products}
            stores={stores}
            onProductClick={openProduct}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
          />
        )}
        {page === "product" && productId && (
          <ProductPage
            product={products.find((p) => p.id === productId)}
            onBack={openCatalog}
            onCart={openCart}
            onAddedToCart={refreshCartCount}
            userId={userId}
            inWishlist={hasInWishlist(productId)}
            onToggleWishlist={() => toggleWishlist(productId)}
          />
        )}
        {page === "cart" && (
          <Cart
            userId={userId}
            onBack={openCatalog}
            onCheckout={openCheckout}
            onCartChange={refreshCartCount}
          />
        )}
        {page === "checkout" && (
          <Checkout userId={userId} onBack={openCart} onDone={openCatalog} />
        )}
        {page === "profile" && (
          <Profile
            userName={userName}
            firstName={firstName}
            onBack={openCatalog}
            onOpenFavorites={openFavorites}
            onOpenReviews={openReviews}
          />
        )}
        {page === "reviews" && (
          <Reviews
            userId={userId}
            firstName={firstName}
            onBack={openCatalog}
          />
        )}
        {page === "favorites" && (
          <Favorites
            products={products}
            wishlistIds={wishlistIds}
            onProductClick={openProduct}
            onToggleWishlist={toggleWishlist}
            onBack={openCatalog}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg)",
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
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text)",
    background: "none",
    border: "none",
    cursor: "pointer",
    letterSpacing: "-0.02em",
  },
  headerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  headerLink: {
    padding: "8px 12px",
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
  },
  headerBtnWrapper: {
    position: "relative",
    padding: "10px 16px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  cartBadge: {
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    borderRadius: 9,
    background: "#fff",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    padding: 16,
    flex: 1,
  },
};

export default App;
