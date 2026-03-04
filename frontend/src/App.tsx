import { useState, useEffect } from "react";
import { useTelegram } from "./hooks/useTelegram";
import { TelegramAuth } from "./components/TelegramAuth";
import { useWishlist } from "./hooks/useWishlist";
import { getProducts, getStores, getCart, getReviews, type Product, type Store } from "./api";
import { Catalog } from "./pages/Catalog";
import { StoresCarousel } from "./components/StoresCarousel";
import { Cart } from "./pages/Cart";
import { Favorites } from "./pages/Favorites";
import { ProductPage } from "./pages/ProductPage";
import { Checkout } from "./pages/Checkout";
import { Profile } from "./pages/Profile";
import { DeliveryTerms } from "./pages/DeliveryTerms";
import { Reviews } from "./pages/Reviews";
import { StoreCatalog } from "./pages/StoreCatalog";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { Footer } from "./components/Footer";
import { SettingsSync } from "./components/SettingsSync";
import { useSettings } from "./context/SettingsContext";
import { t } from "./i18n";

type Page = "catalog" | "cart" | "product" | "checkout" | "profile" | "reviews" | "favorites" | "storeCatalog" | "settings" | "history" | "deliveryTerms";

const SELLER_LINK = import.meta.env.VITE_SELLER_LINK || "";

function App() {
  const { settings } = useSettings();
  const lang = settings.lang;
  const { userId, userName, firstName, isInTelegram, setBrowserAuth } = useTelegram();
  const { wishlistIds, toggleWishlist, hasInWishlist } = useWishlist(userId);
  const [page, setPage] = useState<Page>("catalog");
  const [productId, setProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [storeCatalogStore, setStoreCatalogStore] = useState<
    { id: number; name: string } | { category: string; name: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    getProducts().then((p) => { if (!cancelled) setProducts(p); }).catch(console.error);
    getStores().then((s) => { if (!cancelled) setStores(s); }).catch(console.error);

    getCart(userId || "").then((items) => {
      if (!cancelled) setCartCount(items.reduce((a, i) => a + i.quantity, 0));
    }).catch(() => {});

    getReviews().then((reviews) => {
      if (!cancelled && reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    }).catch(() => {});

    return () => { cancelled = true; };
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
  const openHistory = () => {
    setMenuOpen(false);
    setPage("history");
  };
  const openStoreCatalog = (store: { id: number; name: string } | { category: string; name: string }) => {
    setStoreCatalogStore(store);
    setPage("storeCatalog");
  };
  const openDeliveryTerms = () => {
    setMenuOpen(false);
    setPage("deliveryTerms");
  };
  const openSupport = () => {
    setMenuOpen(false);
    window.open(SELLER_LINK || "https://t.me/ZenStoreBot", "_blank");
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

  const needsAuth = !isInTelegram && !userId;
  if (needsAuth) {
    return (
      <div style={styles.authWrapper}>
        <div style={styles.authCard}>
          <TelegramAuth onAuth={setBrowserAuth} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appWrapper}>
    <div style={styles.app} className="zen-app">
      <SettingsSync />
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={styles.hamburger}
            aria-label="Меню"
          >
            ☰
          </button>
        </div>
        <div style={styles.headerCenter}>
          <button onClick={openCatalog} style={styles.logo} aria-label="На главную">
            ZΞN
          </button>
        </div>
        <div style={styles.headerRight}>
          <button onClick={openFavorites} style={styles.headerLinkWithBadge}>
            <span style={styles.headerBtnLabel}>{t(lang, "favorites")}</span>
            <span style={{ ...styles.favBadge, ...styles.headerBadgePos, visibility: wishlistIds.size > 0 ? "visible" : "hidden" }}>{wishlistIds.size || "0"}</span>
          </button>
          <button onClick={openCart} style={styles.headerBtnWrapper}>
            <span style={styles.headerBtnLabel}>{t(lang, "cart")}</span>
            <span style={{ ...styles.cartBadge, ...styles.headerBadgePos, visibility: cartCount > 0 ? "visible" : "hidden" }}>{cartCount || "0"}</span>
          </button>
        </div>
      </header>

      {page === "catalog" && (
        <StoresCarousel stores={stores} onStoreClick={openStoreCatalog} />
      )}

      {menuOpen && (
        <>
          <div
            className="zen-menu-overlay"
            style={styles.menuOverlay}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="zen-menu-panel" style={styles.menu}>
            <button onClick={openProfile} className="zen-menu-item" style={styles.menuItem}>
              {t(lang, "profile")}
            </button>
            <button onClick={openHistory} className="zen-menu-item" style={styles.menuItem}>
              {t(lang, "history")}
            </button>
            <button onClick={openReviews} className="zen-menu-item" style={styles.menuItem}>
              {t(lang, "reviews")} {avgRating != null ? `★ ${avgRating}` : ""}
            </button>
            <div style={styles.menuSpacer} aria-hidden />
            <button onClick={openSettings} className="zen-menu-item zen-menu-item-last" style={styles.menuItem}>
              {t(lang, "settings")}
            </button>
          </div>
        </>
      )}

      <main style={styles.main}>
        <div key={page} className={page === "cart" || page === "favorites" ? "zen-page-enter" : ""} style={styles.mainContent}>
        {page === "catalog" && (
          <Catalog
            products={products}
            stores={stores}
            onProductClick={openProduct}
            onStoreClick={openStoreCatalog}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
            hideStores
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
            userName={firstName}
            inWishlist={hasInWishlist(productId)}
            onToggleWishlist={() => toggleWishlist(productId)}
          />
        )}
        {page === "cart" && (
          <Cart
            userId={userId}
            userName={userName}
            firstName={firstName}
            onBack={openCatalog}
            onCheckout={openCheckout}
            onCartChange={refreshCartCount}
          />
        )}
        {page === "checkout" && (
          <Checkout
            userId={userId}
            userName={userName}
            onBack={openCart}
            onDone={openCatalog}
            onOrderSuccess={refreshCartCount}
            sellerLink={SELLER_LINK}
          />
        )}
        {page === "profile" && (
          <Profile
            userName={userName}
            firstName={firstName}
            onBack={openCatalog}
            onOpenDeliveryTerms={openDeliveryTerms}
            onOpenSupport={openSupport}
          />
        )}
        {page === "deliveryTerms" && (
          <DeliveryTerms onBack={openProfile} />
        )}
        {page === "reviews" && (
          <Reviews
            userId={userId}
            firstName={firstName}
            onBack={openCatalog}
          />
        )}
        {page === "settings" && <Settings onBack={openCatalog} />}
        {page === "history" && <History userId={userId} onBack={openCatalog} onProductClick={openProduct} />}
        {page === "favorites" && (
          <Favorites
            products={products}
            wishlistIds={wishlistIds}
            onProductClick={openProduct}
            onToggleWishlist={toggleWishlist}
            onBack={openCatalog}
          />
        )}
        </div>
      </main>

      <Footer />
    </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authWrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: 24,
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
  },
  appWrapper: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background: "var(--bg)",
  },
  app: {
    width: "100%",
    maxWidth: 480,
    overflowX: "hidden" as const,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    position: "sticky",
    padding: "10px 12px",
    paddingLeft: "max(12px, env(safe-area-inset-left))",
    paddingRight: "max(12px, env(safe-area-inset-right))",
    borderBottom: "1px solid var(--border)",
    top: 0,
    background: "var(--bg)",
    zIndex: 10,
    gap: 8,
  },
  headerLeft: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  headerRight: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
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
    borderRadius: 8,
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
  menuSpacer: {
    flex: 1,
    minHeight: 0,
  },
  logo: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text)",
    background: "none",
    border: "none",
    cursor: "pointer",
    letterSpacing: "-0.02em",
    padding: "6px 8px",
  },
  headerLink: {
    padding: "8px 10px",
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
  },
  headerLinkWithBadge: {
    position: "relative",
    paddingLeft: 14,
    paddingRight: 22,
    paddingTop: 8,
    paddingBottom: 8,
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    minHeight: 40,
  },
  headerBtnLabel: {
    display: "block",
    /* сдвиг вправо на половину разницы padding, чтобы надпись по центру кнопки */
    marginLeft: 4,
  },
  headerBadgePos: {
    position: "absolute",
    right: 4,
    top: 4,
  },
  favBadge: {
    minWidth: 16,
    height: 14,
    padding: "0 3px",
    borderRadius: 7,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnWrapper: {
    position: "relative",
    paddingLeft: 14,
    paddingRight: 22,
    paddingTop: 8,
    paddingBottom: 8,
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  cartBadge: {
    minWidth: 16,
    height: 14,
    padding: "0 3px",
    borderRadius: 7,
    background: "#fff",
    color: "var(--accent)",
    fontSize: 10,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    overflowX: "hidden",
    padding: "16px",
    paddingLeft: "max(16px, env(safe-area-inset-left))",
    paddingRight: "max(16px, env(safe-area-inset-right))",
    flex: 1,
    minWidth: 0,
  },
  mainContent: {
    minWidth: 0,
  },
};

export default App;
