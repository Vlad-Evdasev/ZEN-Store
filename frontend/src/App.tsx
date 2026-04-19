import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useTelegram } from "./hooks/useTelegram";
import { TelegramAuth } from "./components/TelegramAuth";
import { useWishlist } from "./hooks/useWishlist";
import { getProducts, getStores, getCategories, getCart, getSupportUnreadCount, type Product, type Store, type Category } from "./api";
import { Catalog } from "./pages/Catalog";
import { Cart } from "./pages/Cart";
import { Favorites } from "./pages/Favorites";
import { ProductPage } from "./pages/ProductPage";
import { Checkout } from "./pages/Checkout";
import { Support } from "./pages/Support";
import { Reviews } from "./pages/Reviews";
import { NewArrivalsPage } from "./pages/NewArrivalsPage";
import { CustomOrderPage } from "./pages/CustomOrderPage";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { BottomNavBar } from "./components/BottomNavBar";
import { HeaderArcMenu } from "./components/HeaderArcMenu";
import { SettingsSync } from "./components/SettingsSync";
import { useSettings } from "./context/SettingsContext";
import { t } from "./i18n";

type Page = "catalog" | "cart" | "product" | "checkout" | "reviews" | "favorites" | "newArrivals" | "customOrder" | "settings" | "history" | "support";

const SELLER_LINK = import.meta.env.VITE_SELLER_LINK || "";

const headerIconSize = 26;
const headerIconStyle: React.CSSProperties = { width: headerIconSize, height: headerIconSize, flexShrink: 0, color: "currentColor", display: "block" };

function HeaderIconHamburger() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={headerIconStyle} aria-hidden>
      <line x1="5" y1="7" x2="17" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="7" y1="17" x2="19" y2="17" />
    </svg>
  );
}

function HeaderIconFavorites() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={headerIconStyle} aria-hidden>
      <path d="M12 20.3s-7.5-4.6-9.3-9.2C1.4 7.6 3.6 4 7 4c2 0 3.7 1.1 5 2.8C13.3 5.1 15 4 17 4c3.4 0 5.6 3.6 4.3 7.1-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  );
}

function HeaderIconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={headerIconStyle} aria-hidden>
      <path d="M6 8h12l-.9 11.2a2 2 0 0 1-2 1.8H8.9a2 2 0 0 1-2-1.8L6 8z" />
      <path d="M6 8l1.3-2.6A2 2 0 0 1 9.1 4.3h5.8a2 2 0 0 1 1.8 1.1L18 8" />
      <path d="M9.5 11.5c.6 1.4 1.6 2 2.5 2s1.9-.6 2.5-2" />
    </svg>
  );
}

function LogoMark({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="zen-logo-mark" style={styles.logoMark} aria-label={label}>
      <span style={styles.logoMarkLetter}>R</span>
    </button>
  );
}

function App() {
  const { settings } = useSettings();
  const lang = settings.lang;
  const { userId, userName, firstName, isInTelegram, setBrowserAuth } = useTelegram();
  const { wishlistIds, toggleWishlist, hasInWishlist } = useWishlist(userId);

  const [page, setPage] = useState<Page>("catalog");
  const [productId, setProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const [productReturnTo, setProductReturnTo] = useState<Page | null>(null);
  const [catalogSelectedCategories, setCatalogSelectedCategories] = useState<Set<string>>(() => new Set(["all"]));
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const savedScrollTopRef = useRef(0);

  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  const refreshSupportUnread = useCallback(() => {
    if (!userId) return;
    getSupportUnreadCount(userId)
      .then(({ count }) => setSupportUnreadCount(Number(count) || 0))
      .catch(() => {});
  }, [userId]);

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

    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (page !== "support") return;
    refreshSupportUnread();
  }, [page, refreshSupportUnread]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(refreshSupportUnread, 25000);
    return () => clearInterval(t);
  }, [userId, refreshSupportUnread]);

  const scrollableCatalogPages: Page[] = ["catalog", "newArrivals"];
  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainScrollRef.current?.scrollTo(0, 0);
    };
    const shouldRestore = scrollableCatalogPages.includes(page) && savedScrollTopRef.current > 0;
    if (shouldRestore) {
      const saved = savedScrollTopRef.current;
      savedScrollTopRef.current = 0;
      const restore = () => {
        window.scrollTo(0, saved);
        document.documentElement.scrollTop = saved;
        document.body.scrollTop = saved;
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(restore);
      });
      setTimeout(restore, 0);
      setTimeout(restore, 100);
      return undefined;
    }
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
    const returnTo = from ?? page;
    if (scrollableCatalogPages.includes(returnTo)) {
      savedScrollTopRef.current = window.scrollY ?? document.documentElement?.scrollTop ?? document.body?.scrollTop ?? 0;
    }
    setProductId(id);
    setProductReturnTo(returnTo);
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
    <div className="zen-app" style={styles.app}>
      <SettingsSync />
      <header
        style={{
          ...styles.header,
          // Пока арк-меню открыто, убираем z-index у хедера, чтобы сбросить
          // его stacking-context. Тогда кнопка-триггер внутри сможет через
          // position: relative + z-index вылезти над оверлеем HeaderArcMenu,
          // а сам хедер (с непрозрачным фоном и прочими иконками) останется
          // под затемнением/блюром — ровно как мы хотим.
          zIndex: menuOpen ? "auto" : styles.header.zIndex,
        }}
      >
        <div style={styles.headerLeft} className="zen-header-left">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="zen-header-hamburger"
            style={{
              ...styles.hamburger,
              color: menuOpen ? "var(--accent)" : "var(--text)",
              transform: menuOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), color 350ms ease",
              // Пока меню открыто — поднимаем только саму кнопку-триггер
              // над оверлеем HeaderArcMenu (overlay = 1000). Остальные
              // элементы хедера остаются под затемнением/блюром.
              // Работает за счёт того, что хедер в этот момент без
              // собственного z-index (см. <header> выше), так что его
              // stacking-context не ограничивает эту кнопку.
              position: "relative",
              zIndex: menuOpen ? 1002 : undefined,
            }}
            aria-label="Меню"
            aria-expanded={menuOpen}
          >
            <HeaderIconHamburger />
          </button>
          <HeaderArcMenu
            open={menuOpen}
            lang={lang}
            anchorRef={hamburgerRef}
            supportUnreadCount={supportUnreadCount}
            onClose={() => setMenuOpen(false)}
            onSupport={openSupport}
            onHistory={openHistory}
            onReviews={openReviews}
            onSettings={openSettings}
          />
        </div>
        <div style={styles.headerCenter}>
          <LogoMark onClick={openCatalog} label="На главную" />
        </div>
        <div style={styles.headerRight}>
          <button onClick={openFavorites} className="zen-header-icon-btn" style={styles.headerIconBtn} aria-label={t(lang, "favorites")}>
            <HeaderIconFavorites />
            {wishlistIds.size > 0 && <span style={styles.headerDot} aria-hidden />}
          </button>
          <button onClick={openCart} className="zen-header-icon-btn" style={styles.headerIconBtn} aria-label={t(lang, "cart")}>
            <HeaderIconCart />
            {cartCount > 0 && <span style={styles.headerDot} aria-hidden />}
          </button>
        </div>
      </header>
      <div style={styles.headerSpacer} aria-hidden />

      <main ref={mainScrollRef} className={page === "catalog" ? "zen-main--catalog" : undefined} style={page === "support" ? { ...styles.main, paddingBottom: 0 } : styles.main}>
        <div key={page} className={page === "cart" || page === "favorites" ? "zen-page-enter" : ""} style={page === "newArrivals" ? { ...styles.mainContent, height: "100%" } : styles.mainContent}>
        {page === "catalog" && (
          <>
            <section className="zen-catalog-section" aria-label={t(lang, "catalogPreviewTitle")}>
              <Catalog
                products={products}
                stores={stores}
                categories={categories}
                selectedCategories={catalogSelectedCategories}
                onSelectedCategoriesChange={setCatalogSelectedCategories}
                onProductClick={(id) => openProduct(id, "catalog")}
                onStoreClick={() => {}}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
                hideStores
                showPriceFilter
              />
            </section>
          </>
        )}
        {page === "newArrivals" && (
          <NewArrivalsPage
            userId={userId || ""}
            userName={userName}
            firstName={firstName}
            onBack={openCatalog}
            onProductClick={(id) => openProduct(id, "newArrivals")}
          />
        )}
        {page === "customOrder" && (
          <CustomOrderPage
            userId={userId || ""}
            userName={userName}
            firstName={firstName}
            onBack={openCatalog}
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
        {page === "support" && (
          <Support
            userId={userId || ""}
            userName={userName}
            firstName={firstName}
            supportUnreadCount={supportUnreadCount}
            onUnreadCountChange={userId ? refreshSupportUnread : undefined}
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

      {(["catalog", "customOrder", "newArrivals", "support", "history", "settings", "reviews", "favorites", "cart"] as Page[]).includes(page) && (
        <BottomNavBar
          activeTab={
            page === "customOrder"
              ? "custom"
              : page === "newArrivals"
                ? "arrivals"
                : page === "catalog"
                  ? "catalog"
                  : "none"
          }
          onCatalog={() => setPage("catalog")}
          onCustomOrder={() => setPage("customOrder")}
          onArrivals={() => setPage("newArrivals")}
        />
      )}
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
    maxWidth: "100%",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    padding: "8px 8px",
    paddingLeft: "max(12px, env(safe-area-inset-left))",
    paddingRight: "max(12px, env(safe-area-inset-right))",
    background: "var(--header-bg)",
    zIndex: 10,
    gap: 8,
  },
  headerSpacer: {
    flexShrink: 0,
    height: 62,
  },
  headerLeft: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  headerCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  headerRight: {
    flexShrink: 0,
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  hamburger: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: "var(--text)",
    cursor: "pointer",
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1.25px solid var(--text)",
    background: "transparent",
    color: "var(--text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    pointerEvents: "auto",
    transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
  },
  logoMarkLetter: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    display: "block",
    marginTop: 1,
  },
  headerDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "var(--accent)",
    pointerEvents: "none",
  },
  headerIconBtn: {
    position: "relative",
    width: 44,
    height: 44,
    padding: 0,
    background: "none",
    border: "none",
    color: "var(--text)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
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
