import { useState, useEffect } from "react";
import { useTelegram } from "./hooks/useTelegram";
import { useWishlist } from "./hooks/useWishlist";
import { getProducts, getStores, getCart, getReviews, type Product, type Store } from "./api";
import { Catalog } from "./pages/Catalog";
import { Cart } from "./pages/Cart";
import { Favorites } from "./pages/Favorites";
import { ProductPage } from "./pages/ProductPage";
import { Checkout } from "./pages/Checkout";
import { Profile } from "./pages/Profile";
import { Reviews } from "./pages/Reviews";
import { StoreCatalog } from "./pages/StoreCatalog";
import { Settings } from "./pages/Settings";
import { LoadingScreen } from "./components/LoadingScreen";
import { Footer } from "./components/Footer";

type Page = "catalog" | "cart" | "product" | "checkout" | "profile" | "reviews" | "favorites" | "storeCatalog" | "settings";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [storeCatalogStore, setStoreCatalogStore] = useState<
    { id: number; name: string } | { category: string; name: string } | null
  >(null);

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

    getReviews().then((reviews) => {
      if (!cancelled && reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
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

  const openCart = () => {
    setMenuOpen(false);
    setPage("cart");
  };
  const openProfile = () => {
    setMenuOpen(false);
    setPage("profile");
  };
  const openReviews = () => {
    setMenuOpen(false);
    setPage("reviews");
  };
  const openFavorites = () => {
    setMenuOpen(false);
    setPage("favorites");
  };
  const openSettings = () => {
    setMenuOpen(false);
    setPage("settings");
  };
  const openStoreCatalog = (store: { id: number; name: string } | { category: string; name: string }) => {
    setStoreCatalogStore(store);
    setPage("storeCatalog");
  };

  const refreshCartCount = () => {
    getCart(userId || "").then((items) =>
      setCartCount(items.reduce((a, i) => a + i.quantity, 0))
    ).catch(() => {});
  };
  const openCatalog = () => {
    setPage("catalog");
    setProductId(null);
    setStoreCatalogStore(null);
  };
  const openCheckout = () => setPage("checkout");

  if (!storeReady) {
    return <LoadingScreen />;
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={styles.hamburger}
          aria-label="Меню"
        >
          ☰
        </button>
        <button onClick={openCatalog} style={styles.logo}>
          ZΞN
        </button>
        <div style={styles.headerActions}>
          <button onClick={openFavorites} style={styles.headerLink}>
            Избранное
          </button>
          <button onClick={openCart} style={styles.headerBtnWrapper}>
            <span>Корзина</span>
            {cartCount > 0 && <span style={styles.cartBadge}>{cartCount}</span>}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            style={styles.menuOverlay}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div style={styles.menu}>
            <button onClick={openProfile} style={styles.menuItem}>
              Профиль
            </button>
            <button onClick={openReviews} style={styles.menuItem}>
              Отзывы {avgRating != null ? `★ ${avgRating}` : ""}
            </button>
            <button onClick={openSettings} style={styles.menuItem}>
              Настройки
            </button>
          </div>
        </>
      )}

      <main style={styles.main}>
        {page === "catalog" && (
          <Catalog
            products={products}
            stores={stores}
            onProductClick={openProduct}
            onStoreClick={openStoreCatalog}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
          />
        )}
        {page === "storeCatalog" && storeCatalogStore && (
          <StoreCatalog
            store={storeCatalogStore}
            products={products}
            onProductClick={openProduct}
            onBack={openCatalog}
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
        {page === "settings" && <Settings onBack={openCatalog} />}
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
    padding: "12px 16px",
    paddingLeft: "max(16px, env(safe-area-inset-left))",
    paddingRight: "max(16px, env(safe-area-inset-right))",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    background: "var(--bg)",
    zIndex: 10,
  },
  hamburger: {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: "var(--text)",
    fontSize: 22,
    cursor: "pointer",
  },
  menuOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 20,
  },
  menu: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    maxWidth: "85vw",
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    zIndex: 21,
    paddingTop: "max(16px, env(safe-area-inset-top))",
    paddingLeft: "max(16px, env(safe-area-inset-left))",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  menuItem: {
    padding: "14px 20px",
    textAlign: "left",
    background: "none",
    border: "none",
    color: "var(--text)",
    fontSize: 16,
    fontFamily: "inherit",
    cursor: "pointer",
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
    paddingLeft: "max(16px, env(safe-area-inset-left))",
    paddingRight: "max(16px, env(safe-area-inset-right))",
    flex: 1,
    minWidth: 0,
  },
};

export default App;
