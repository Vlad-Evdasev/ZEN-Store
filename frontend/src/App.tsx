import { useState, useEffect, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import { useTelegram } from "./hooks/useTelegram";
import { TelegramAuth } from "./components/TelegramAuth";
import { useWishlist } from "./hooks/useWishlist";
import { getProducts, getStores, getCategories, getCart, getReviews, getSupportUnreadCount, type Product, type Store, type Category } from "./api";
import { Catalog } from "./pages/Catalog";
import { StoresCarousel } from "./components/StoresCarousel";
import { NewArrivalsSection } from "./components/NewArrivalsSection";
import { Cart } from "./pages/Cart";
import { Favorites } from "./pages/Favorites";
import { ProductPage } from "./pages/ProductPage";
import { Checkout } from "./pages/Checkout";
import { Profile } from "./pages/Profile";
import { DeliveryTerms } from "./pages/DeliveryTerms";
import { Support } from "./pages/Support";
import { Reviews } from "./pages/Reviews";
import { StoreCatalog } from "./pages/StoreCatalog";
import { StoreWelcome } from "./pages/StoreWelcome";
import { NewArrivalsPage } from "./pages/NewArrivalsPage";
import { CustomOrderPage } from "./pages/CustomOrderPage";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { Footer } from "./components/Footer";
import { SettingsSync } from "./components/SettingsSync";
import { useSettings } from "./context/SettingsContext";
import { t } from "./i18n";

type Page = "catalog" | "cart" | "product" | "checkout" | "profile" | "reviews" | "favorites" | "storeCatalog" | "newArrivals" | "settings" | "history" | "deliveryTerms" | "support";

const SELLER_LINK = import.meta.env.VITE_SELLER_LINK || "";

const iconSize = 22;
const iconStyle: React.CSSProperties = { width: iconSize, height: iconSize, flexShrink: 0, color: "currentColor" };

function MenuIconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle} aria-hidden>
      <circle cx="12" cy="8" r="2.5" />
      <path d="M5 20v-2a5 5 0 0 1 10 0v2" />
    </svg>
  );
}
function MenuIconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle} aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
function MenuIconReviews() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle} aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function MenuIconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5.64 5.64l1.41 1.41m11.32 11.32l1.41 1.41M5.64 18.36l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  );
}
function MenuIconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle} aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

const headerIconSize = 22;
const headerIconStyle: React.CSSProperties = { width: headerIconSize, height: headerIconSize, flexShrink: 0, color: "currentColor", display: "block" };
const headerIconCartSize = 25;
const headerIconCartStyle: React.CSSProperties = { width: headerIconCartSize, height: headerIconCartSize, flexShrink: 0, color: "currentColor", display: "block" };

function HeaderIconFavorites() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={headerIconStyle} aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function HeaderIconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={headerIconCartStyle} aria-hidden>
      <path d="M5 8h14l-1.2 9.6a1.5 1.5 0 01-1.5 1.2H7.7a1.5 1.5 0 01-1.5-1.2L5 8z" />
      <path d="M9 8V5a3 3 0 016 0v3" />
    </svg>
  );
}

function App() {
  const { settings } = useSettings();
  const lang = settings.lang;
  const { userId, userName, firstName, isInTelegram, setBrowserAuth } = useTelegram();
  const { wishlistIds, toggleWishlist, hasInWishlist } = useWishlist(userId);
  const DEFAULT_WELCOME_STORE: { category: string; name: string } = { category: "all", name: "RAW" };

  const [page, setPage] = useState<Page>("storeCatalog");
  const [productId, setProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [storeCatalogStore, setStoreCatalogStore] = useState<
    { id: number; name: string } | { category: string; name: string } | null
  >(DEFAULT_WELCOME_STORE);
  type StoreCatalogView = "welcome" | "catalog" | "customOrder";
  const [storeCatalogView, setStoreCatalogView] = useState<StoreCatalogView>("welcome");
  const [productReturnTo, setProductReturnTo] = useState<Page | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const newArrivals = useMemo(
    () =>
      products
        .filter((p) => p.new_arrival_sort_order != null)
        .sort((a, b) => (a.new_arrival_sort_order ?? 0) - (b.new_arrival_sort_order ?? 0)),
    [products]
  );

  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getProducts().then((p) => { if (!cancelled) setProducts(p); }).catch(console.error);
    getStores().then((s) => { if (!cancelled) setStores(s); }).catch(console.error);
    const loadCategories = () => {
      getCategories()
        .then((cats) => { if (!cancelled) setCategories(cats); })
        .catch((e) => {
          console.error("Categories load failed:", e);
          if (cancelled) return;
          setTimeout(() => {
            getCategories()
              .then((cats) => { if (!cancelled) setCategories(cats); })
              .catch(() => {});
          }, 2000);
        });
    };
    loadCategories();

    getCart(userId || "").then((items) => {
      if (!cancelled) setCartCount(items.reduce((a, i) => a + i.quantity, 0));
    }).catch(() => {});

    if (userId) {
      getSupportUnreadCount(userId).then(({ count }) => {
        if (!cancelled) setSupportUnreadCount(Number(count) || 0);
      }).catch(() => {});
    }

    getReviews().then((reviews) => {
      if (!cancelled && reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if ((page !== "profile" && page !== "support") || !userId) return;
    getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {});
  }, [page, userId]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(() => {
      getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {});
    }, 25000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    if (page !== "product") return;
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainScrollRef.current?.scrollTo(0, 0);
    };
    scrollToTop();
    const t1 = setTimeout(scrollToTop, 0);
    const t2 = setTimeout(scrollToTop, 50);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTop);
    });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimationFrame(raf);
    };
  }, [page]);

  const openProduct = (id: number, from?: Page) => {
    setProductId(id);
    setProductReturnTo(from ?? page);
    setPage("product");
    flushSync(() => {});
    mainScrollRef.current?.scrollTo(0, 0);
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo(0, 0);
    });
  };

  const goBackFromProduct = () => {
    if (productReturnTo) {
      setPage(productReturnTo);
      setProductReturnTo(null);
    } else {
      setPage("catalog");
    }
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
    setStoreCatalogView("catalog");
    setPage("storeCatalog");
  };
  const openNewArrivals = () => setPage("newArrivals");
  const openDeliveryTerms = () => {
    setMenuOpen(false);
    setPage("deliveryTerms");
  };
  const openSupport = () => {
    setMenuOpen(false);
    setPage("support");
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
    setStoreCatalogView("welcome");
  };

  const goToWelcome = () => {
    setMenuOpen(false);
    setPage("storeCatalog");
    setStoreCatalogStore(DEFAULT_WELCOME_STORE);
    setStoreCatalogView("welcome");
  };

  const isDefaultWelcomeStore =
    storeCatalogStore &&
    "category" in storeCatalogStore &&
    storeCatalogStore.category === DEFAULT_WELCOME_STORE.category;
  const isInitialWelcomeScreen = page === "storeCatalog" && storeCatalogView === "welcome" && isDefaultWelcomeStore;
  const isCustomOrderForm = page === "storeCatalog" && storeCatalogView === "customOrder";
  const hideHeader = isInitialWelcomeScreen || isCustomOrderForm;
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
    <div className="zen-app" style={styles.app}>
      <SettingsSync />
      {!hideHeader && (
        <>
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
                RAW
              </button>
            </div>
            <div style={styles.headerRight}>
              <button onClick={openFavorites} style={styles.headerIconBtn} aria-label={t(lang, "favorites")}>
                <HeaderIconFavorites />
                <span style={{ ...styles.favBadge, ...styles.headerBadgePos, visibility: wishlistIds.size > 0 ? "visible" : "hidden" }}>{wishlistIds.size || "0"}</span>
              </button>
              <button onClick={openCart} style={styles.headerIconBtnCart} aria-label={t(lang, "cart")}>
                <HeaderIconCart />
                <span style={{ ...styles.cartBadge, ...styles.headerBadgePos, visibility: cartCount > 0 ? "visible" : "hidden" }}>{cartCount || "0"}</span>
              </button>
            </div>
          </header>
          <div style={styles.headerSpacer} aria-hidden />
        </>
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
              <span style={styles.menuItemContent}>
                <MenuIconProfile />
                <span>{t(lang, "profile")}</span>
              </span>
            </button>
            <button onClick={openHistory} className="zen-menu-item" style={styles.menuItem}>
              <span style={styles.menuItemContent}>
                <MenuIconHistory />
                <span>{t(lang, "history")}</span>
              </span>
            </button>
            <button onClick={openReviews} className="zen-menu-item" style={styles.menuItem}>
              <span style={styles.menuItemContent}>
                <MenuIconReviews />
                <span>{t(lang, "reviews")}{avgRating != null ? ` ★ ${avgRating}` : ""}</span>
              </span>
            </button>
            <button onClick={openSettings} className="zen-menu-item" style={styles.menuItem}>
              <span style={styles.menuItemContent}>
                <MenuIconSettings />
                <span>{t(lang, "settings")}</span>
              </span>
            </button>
            <div style={styles.menuSpacer} aria-hidden />
            <button onClick={goToWelcome} type="button" className="zen-menu-item" style={styles.menuWelcomeItem}>
              <span style={styles.menuItemContent}>
                <MenuIconHome />
                <span>{t(lang, "menuToWelcome")}</span>
              </span>
            </button>
          </div>
        </>
      )}

      <main ref={mainScrollRef} style={page === "support" ? { ...styles.main, paddingBottom: 0 } : styles.main}>
        <div key={page} className={page === "cart" || page === "favorites" ? "zen-page-enter" : ""} style={styles.mainContent}>
        {page === "catalog" && (
          <>
            <NewArrivalsSection
              products={newArrivals}
              onProductClick={(id) => openProduct(id, "catalog")}
              onViewAll={openNewArrivals}
              wishlistIds={wishlistIds}
              onToggleWishlist={toggleWishlist}
            />
            <StoresCarousel stores={stores} categories={categories} onStoreClick={openStoreCatalog} compact />
            <Catalog
            products={products}
            stores={stores}
            categories={categories}
            onProductClick={openProduct}
            onStoreClick={openStoreCatalog}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
            hideStores
          />
          </>
        )}
        {page === "storeCatalog" && storeCatalogStore && (
          <>
            {storeCatalogView === "welcome" && (
              <StoreWelcome
                store={storeCatalogStore}
                categoryLabels={categories.length > 0 ? Object.fromEntries(categories.map((c) => [c.code, c.name])) : undefined}
                showBack={!isDefaultWelcomeStore}
                onBack={openCatalog}
                onGoToCatalog={isDefaultWelcomeStore ? openCatalog : () => setStoreCatalogView("catalog")}
                onCustomOrder={() => setStoreCatalogView("customOrder")}
              />
            )}
            {storeCatalogView === "catalog" && (
              <StoreCatalog
                store={storeCatalogStore}
                products={products}
                categoryLabels={categories.length > 0 ? Object.fromEntries(categories.map((c) => [c.code, c.name])) : undefined}
                onProductClick={openProduct}
                onBack={openCatalog}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
              />
            )}
            {storeCatalogView === "customOrder" && (
              <CustomOrderPage
                userId={userId || ""}
                userName={userName}
                firstName={firstName}
                onBack={() => setStoreCatalogView("welcome")}
              />
            )}
          </>
        )}
        {page === "newArrivals" && (
          <NewArrivalsPage
            products={newArrivals}
            onBack={openCatalog}
            onProductClick={(id) => openProduct(id, "newArrivals")}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
          />
        )}
        {page === "product" && productId && (
          <ProductPage
            product={products.find((p) => p.id === productId)}
            onBack={goBackFromProduct}
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
            onBack={openCatalog}
            onCheckout={openCheckout}
            onCartChange={refreshCartCount}
            onProductClick={(id) => openProduct(id, "cart")}
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
            supportUnreadCount={supportUnreadCount}
          />
        )}
        {page === "deliveryTerms" && (
          <DeliveryTerms onBack={openProfile} />
        )}
        {page === "support" && (
          <Support
            userId={userId || ""}
            userName={userName}
            firstName={firstName}
            onBack={openProfile}
            onUnreadCountChange={userId ? () => getSupportUnreadCount(userId).then(({ count }) => setSupportUnreadCount(Number(count) || 0)).catch(() => {}) : undefined}
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
        {page === "history" && <History userId={userId} onBack={openCatalog} onProductClick={(id) => openProduct(id, "history")} />}
        {page === "favorites" && (
          <Favorites
            products={products}
            wishlistIds={wishlistIds}
            onProductClick={(id) => openProduct(id, "favorites")}
            onToggleWishlist={toggleWishlist}
            onBack={openCatalog}
          />
        )}
        </div>
      </main>

      {page !== "support" && <Footer />}
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
    minHeight: "100dvh",
    display: "flex",
    justifyContent: "center",
    background: "var(--bg)",
  },
  app: {
    width: "100%",
    maxWidth: 480,
    overflowX: "hidden" as const,
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg)",
  },
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    maxWidth: 480,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    paddingLeft: "max(12px, env(safe-area-inset-left))",
    paddingRight: "max(12px, env(safe-area-inset-right))",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg)",
    zIndex: 10,
    gap: 8,
  },
  headerSpacer: {
    flexShrink: 0,
    height: 56,
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
    transform: "translateX(-8px)",
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
    paddingLeft: "max(10px, env(safe-area-inset-left))",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  menuItem: {
    padding: "14px 12px 14px 10px",
    textAlign: "left",
    background: "none",
    border: "none",
    color: "var(--text)",
    fontSize: 16,
    fontFamily: "inherit",
    cursor: "pointer",
    width: "100%",
  },
  menuItemContent: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  menuSpacer: {
    flex: 1,
    minHeight: 0,
  },
  menuWelcomeItem: {
    padding: "14px 12px 14px 10px",
    textAlign: "left",
    background: "none",
    border: "none",
    color: "#b91c1c",
    fontSize: 16,
    fontFamily: "inherit",
    cursor: "pointer",
    width: "100%",
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
  headerIconBtn: {
    position: "relative",
    padding: 8,
    background: "none",
    border: "none",
    color: "var(--text)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  headerIconBtnCart: {
    position: "relative",
    padding: 8,
    background: "none",
    border: "none",
    color: "var(--accent)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  headerLinkWithBadge: {
    position: "relative",
    paddingLeft: 10,
    paddingRight: 18,
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
    marginLeft: 4,
  },
  headerBadgePos: {
    position: "absolute",
    right: -2,
    top: 2,
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
    paddingLeft: 10,
    paddingRight: 18,
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
    overflowY: "visible",
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
