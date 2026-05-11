import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useTelegram } from "./hooks/useTelegram";
import { TelegramAuth } from "./components/TelegramAuth";
import { useWishlist } from "./hooks/useWishlist";
import { getProducts, getStores, getCategories, getCart, botHeartbeat, getMaintenanceStatus, type Product, type Store, type Category, type CartItem } from "./api";
import { MaintenancePage } from "./pages/MaintenancePage";
import { Catalog } from "./pages/Catalog";
import { Cart } from "./pages/Cart";
import { Favorites } from "./pages/Favorites";
import { ProductPage } from "./pages/ProductPage";
// Checkout грузим лениво — он тянет @ton/core (~600KB). Админ-бандлу
// и обычному просмотру каталога TON-зависимости вообще не нужны.
const Checkout = lazy(() => import("./pages/Checkout").then((m) => ({ default: m.Checkout })));
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

/**
 * Deep-linking из бота. URL вида `https://app.com/#page=history` ведёт
 * сразу на нужный раздел. После прочтения хеш чистим, чтобы рефреш
 * страницы не возвращал юзера обратно. Поддержанные target-разделы
 * совпадают с inline-кнопками в боте.
 */
// Лёгкий localStorage-кэш для каталога. Гидрируем стейт из кэша мгновенно
// при загрузке, потом тихо обновляем с бэка. Без этого первая отрисовка
// видела пустой массив и Catalog мигал «ничего не найдено», пока летел
// HTTP-запрос. С кэшем возвращающийся юзер видит товары моментально.
const CACHE_PREFIX = "raw_cache_v1:";
function loadCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function saveCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {}
}

/** Результат разбора deep-link: куда отвести юзера + опционально какой
 *  пост развернуть в ленте «Вдохновиться». */
interface InitialNav {
  page: Page;
  postId?: number;
}

function readInitialNav(): InitialNav {
  if (typeof window === "undefined") return { page: "catalog" };
  const hash = window.location.hash || "";

  // 1) Telegram start_param из mini-app deep-link
  //    (t.me/<bot>/<short>?startapp=post_42 → start_param === "post_42")
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (startParam) {
    const pm = startParam.match(/^post[_-](\d+)$/i);
    if (pm) return { page: "newArrivals", postId: Number(pm[1]) };
  }

  // 2) Hash-параметр поста: #post=42 (для веб-фолбэка share-ссылок)
  const postHash = hash.match(/[#&]post=(\d+)/);
  if (postHash) {
    const id = Number(postHash[1]);
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {}
    return { page: "newArrivals", postId: id };
  }

  // 3) Существующий редирект по #page=<name>
  const m = hash.match(/[#&]page=([a-zA-Z]+)/);
  const target = m?.[1];
  const valid: Record<string, Page> = {
    catalog: "catalog",
    cart: "cart",
    favorites: "favorites",
    history: "history",
    profile: "settings",
    settings: "settings",
    inspire: "newArrivals",
    new: "newArrivals",
    custom: "customOrder",
    customOrder: "customOrder",
    support: "support",
  };
  if (target && valid[target]) {
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {}
    return { page: valid[target] };
  }
  return { page: "catalog" };
}

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
  // Luxury handbag silhouette: трапеция (Birkin/Kelly geometry) +
  // элегантная bezier-handle + clasp dot. Y-bounds (4 → 20) совпадают
  // с favorites heart (4 → 20.3), визуально центрируются одинаково.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={headerIconStyle} aria-hidden>
      <path d="M4.5 8L19.5 8L18 20H6Z" />
      <path d="M9 8C9 5.5 10.3 4 12 4C13.7 4 15 5.5 15 8" />
      <circle cx="12" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
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

  const initialNavRef = useRef<InitialNav>(readInitialNav());
  const [page, setPage] = useState<Page>(() => initialNavRef.current.page);
  const [pendingPostId, setPendingPostId] = useState<number | null>(() => initialNavRef.current.postId ?? null);
  // productId был отдельным state для conditional render ProductPage.
  // Теперь оверлей сам хранит id внутри productOverlay — отдельное
  // состояние не нужно.
  // ProductPage теперь рендерится как ОВЕРЛЕЙ (портал в body) поверх
  // текущей страницы (catalog/favorites/cart/etc.). Каталог НЕ
  // unmount-ится — он остаётся «внизу» и плавно затемняется. FLIP-
  // анимация переносит thumb-картинку в полноразмерное hero.
  // Симметрично expanded post: thumbRect — координаты тамбнейла в
  // момент клика, нужны для FLIP-open и FLIP-close-back.
  const [productOverlay, setProductOverlay] = useState<{ id: number; thumbRect: DOMRect | null } | null>(null);
  const [products, setProducts] = useState<Product[]>(() => loadCache<Product[]>("products") ?? []);
  const [stores, setStores] = useState<Store[]>(() => loadCache<Store[]>("stores") ?? []);
  const [categories, setCategories] = useState<Category[]>(() => loadCache<Category[]>("categories") ?? []);
  // Loading=true только пока кэша нет И первый запрос ещё в полёте.
  // Если кэш сработал — рисуем товары сразу, фон-обновление не показываем.
  const [productsLoading, setProductsLoading] = useState<boolean>(() => (loadCache<Product[]>("products") ?? []).length === 0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const cartCount = cartItems.reduce((a, i) => a + i.quantity, 0);
  // Кол-во избранного — только те id, что соответствуют реально
  // существующим товарам. Иначе точка-индикатор на сердечке висит,
  // даже если все wishlist-товары были удалены на бэке.
  const favoritesCount = products.filter((p) => wishlistIds.has(p.id)).length;
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  // productReturnTo больше НЕ нужен — оверлейная ProductPage не меняет
  // page, поэтому возврат «к предыдущему» — это просто закрытие оверлея.
  const [catalogSelectedCategories, setCatalogSelectedCategories] = useState<Set<string>>(() => new Set(["all"]));
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const savedScrollTopRef = useRef(0);

  // Maintenance gate: если админ включил maintenance, всем кроме allowlist
  // показываем maintenance-экран вместо приложения. checking=true пока
  // первый запрос status в полёте — чтобы не мигать на холодном старте.
  const [maintBlocked, setMaintBlocked] = useState(false);
  const [maintChecking, setMaintChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getMaintenanceStatus(userId || "")
      .then((s) => {
        if (cancelled) return;
        setMaintBlocked(s.enabled && !s.allowed);
      })
      .catch(() => {
        // Если status-эндпоинт упал — не блокируем юзера. Лучше пропустить
        // в каталог, чем показать ложный maintenance.
        if (!cancelled) setMaintBlocked(false);
      })
      .finally(() => {
        if (!cancelled) setMaintChecking(false);
      });
    // Перепроверяем при возврате во вкладку — мог поменяться статус.
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      getMaintenanceStatus(userId || "")
        .then((s) => {
          if (!cancelled) setMaintBlocked(s.enabled && !s.allowed);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);

  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  // Global focus-tracker + body-lock на input focus.
  //
  // iOS Safari (включая Telegram WebView) при focus на input делает:
  //  - auto-scroll страницы вверх чтобы input был в visual viewport
  //  - layout shift вверх → bottom-nav «всплывает» над клавиатурой
  //    + черный body bg «вылазит» под клавиатурой
  //
  // Решение: position:fixed body во время focus. Body становится
  // зафиксированным к viewport-у на сохранённой scrollY-позиции.
  // iOS не может scrollить fixed body. Layout не сдвигается.
  // Visual viewport просто shrink-ается под клавиатуру.
  // На blur восстанавливаем scrollY.
  useEffect(() => {
    const isInputEl = (t: EventTarget | null): boolean => {
      if (!t) return false;
      const el = t as HTMLElement;
      if (el.tagName === "INPUT") {
        const inp = el as HTMLInputElement;
        return inp.type !== "checkbox" && inp.type !== "radio";
      }
      return el.tagName === "TEXTAREA";
    };
    let savedScrollY = 0;
    const lockBody = () => {
      savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      // Transparent bg на body+html+.zen-app — user видит Telegram theme
      // bg через прозрачную клавиатуру. .zen-app тоже transparent потому
      // что оно ОПЕКЕЙТНО (var(--bg) inline в App.tsx) и покрывает body.
      // Без .zen-app transparent user видит только .zen-app's bg.
      document.body.style.background = "transparent";
      document.documentElement.style.background = "transparent";
      const zenApp = document.querySelector(".zen-app") as HTMLElement | null;
      if (zenApp) zenApp.style.background = "transparent";
      document.documentElement.style.overflow = "hidden";
      document.body.classList.add("zen-input-focused");
      try {
        const tg = window.Telegram?.WebApp as { expand?: () => void; disableVerticalSwipes?: () => void } | undefined;
        tg?.expand?.();
        tg?.disableVerticalSwipes?.();
      } catch {}
    };
    const unlockBody = () => {
      const scroll = savedScrollY;
      // ВСЁ atomic в одной synchronous блоке. Browser batches all DOM
      // mutations и paints единый final state — no flicker.
      // (class removal сделана раньше в Phase 1 — см. onFocusOut)
      document.documentElement.scrollTop = scroll;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.background = "";
      document.documentElement.style.background = "";
      const zenApp = document.querySelector(".zen-app") as HTMLElement | null;
      if (zenApp) zenApp.style.background = "";
      document.documentElement.style.overflow = "";
      window.scrollTo(0, scroll);
      try {
        const tg = window.Telegram?.WebApp as { enableVerticalSwipes?: () => void } | undefined;
        tg?.enableVerticalSwipes?.();
      } catch {}
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isInputEl(e.target) && !document.body.classList.contains("zen-input-focused")) {
        lockBody();
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isInputEl(e.target)) {
        (window as unknown as { __zenLastInputBlur?: number }).__zenLastInputBlur = Date.now();
        // PHASE 1: REVEAL FOOTER as soon as iOS клавиатура начала
        // закрываться. Trigger на FIRST visualViewport.resize event —
        // как только vv.height растёт = клавиатура closing.
        // Footer показывается синхронно с keyboard slide-down animation.
        let revealed = false;
        const reveal = () => {
          if (revealed) return;
          revealed = true;
          if (!isInputEl(document.activeElement)) {
            document.body.classList.remove("zen-input-focused");
          }
        };
        const vv = window.visualViewport;
        const initialVvHeight = vv?.height || 0;
        const onResize = () => {
          if (!vv) return;
          // ANY resize where height growing = keyboard closing started
          if (vv.height > initialVvHeight + 5) {
            reveal();
            vv.removeEventListener("resize", onResize);
          }
        };
        vv?.addEventListener("resize", onResize);
        // Fallback at 150ms (very short) — на случай если vv не fire-нул.
        setTimeout(() => {
          reveal();
          vv?.removeEventListener("resize", onResize);
        }, 150);
        // PHASE 2 (600ms): full unlockBody. iOS layout fully settled,
        // scroll restore без flicker.
        setTimeout(() => {
          if (!isInputEl(document.activeElement)) {
            unlockBody();
          }
        }, 600);
      }
    };
    // PRE-EMPTIVE pointerdown listener: КРИТИЧНО! Срабатывает ДО focus
    // event и ДО того как iOS успевает auto-scroll к input. Здесь:
    //  1) Сохраняем scrollY ДО любых iOS адаптаций (auto-scroll затирает)
    //  2) Блокируем body СРАЗУ (iOS не может scroll-нуть fixed body)
    //  3) Добавляем body.zen-input-focused класс (скрывает nav через CSS)
    // На focusin потом lockBody НЕ запустится повторно (проверка class).
    const onPointerDown = (e: PointerEvent) => {
      if (isInputEl(e.target) && !document.body.classList.contains("zen-input-focused")) {
        lockBody();
      }
    };
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  // VisualViewport-based listener был удалён — он управлял nav transform
  // (translateY на keyboard height), что создавало slide-up animation
  // на close клавиатуры. Nav теперь stays at bottom:0 (covered by
  // keyboard when open, visible normally). body lock prevents iOS shift.

  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then((p) => {
        if (cancelled) return;
        setProducts(p);
        saveCache("products", p);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    getStores()
      .then((s) => {
        if (cancelled) return;
        setStores(s);
        saveCache("stores", s);
      })
      .catch(console.error);
    const loadCategories = () => {
      getCategories()
        .then((cats) => {
          if (cancelled) return;
          setCategories(cats);
          saveCache("categories", cats);
        })
        .catch((e) => {
          console.error("Categories load failed:", e);
          if (cancelled) return;
          setTimeout(() => {
            getCategories()
              .then((cats) => {
                if (cancelled) return;
                setCategories(cats);
                saveCache("categories", cats);
              })
              .catch(() => {});
          }, 2000);
        });
    };
    loadCategories();

    getCart(userId || "").then((items) => {
      if (!cancelled) setCartItems(items);
    }).catch(() => {});

    if (userId) {
      const username = userName ? userName.replace(/^@/, "") : undefined;
      botHeartbeat(userId, firstName || undefined, username);
    }

    return () => { cancelled = true; };
  }, [userId, firstName, userName]);

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

  const openProduct = (id: number, _from?: Page, thumbRect: DOMRect | null = null) => {
    // ProductPage теперь рендерится как ОВЕРЛЕЙ — НЕ переключаем page.
    // Текущая страница (catalog/favorites/cart) остаётся mounted и
    // плавно затемняется через body-class. thumbRect — координаты
    // тамбнейла для FLIP-анимации.
    setProductOverlay({ id, thumbRect });
  };

  const goBackFromProduct = () => {
    // Закрытие оверлея: ProductPage сама запускает FLIP-close-анимацию
    // и потом зовёт onBack → closeProductOverlay. setPage НЕ трогаем
    // — пользователь возвращается к той же странице, на которой
    // открыл товар (catalog/favorites/cart с сохранённым скроллом).
    setProductOverlay(null);
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
    getCart(userId || "")
      .then((items) => setCartItems(items))
      .catch(() => {});
  };
  const openCatalog = () => {
    setPage("catalog");
    setProductOverlay(null);
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

  // Maintenance gate: показываем тёмный экран ВСЕМ, кто не в allowlist.
  // Во время первой проверки (maintChecking) рендерим обычное приложение
  // — это безопасный default, лучше короткая мигалка чем ложный
  // maintenance на холодном старте.
  if (!maintChecking && maintBlocked) {
    return <MaintenancePage />;
  }

  return (
    <div style={styles.appWrapper}>
    <div className="zen-app" style={styles.app}>
      <SettingsSync />
      <header style={styles.header}>
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
            {favoritesCount > 0 && <span style={styles.headerDot} aria-hidden />}
          </button>
          <button onClick={openCart} className="zen-header-icon-btn" style={styles.headerIconBtn} aria-label={t(lang, "cart")}>
            <HeaderIconCart />
            {cartCount > 0 && <span style={styles.headerDot} aria-hidden />}
          </button>
        </div>
      </header>
      <div style={styles.headerSpacer} aria-hidden />

      <main ref={mainScrollRef} className={page === "catalog" ? "zen-main--catalog" : page === "favorites" ? "zen-main--edge" : page === "newArrivals" ? "zen-main--inspire" : undefined} style={page === "support" ? { ...styles.main, paddingBottom: 0 } : styles.main}>
        <div key={page} className={page === "cart" || page === "favorites" ? "zen-page-enter" : ""} style={page === "newArrivals" ? { ...styles.mainContent, height: "100%" } : styles.mainContent}>
        {page === "catalog" && (
          <>
            <section className="zen-catalog-section" aria-label={t(lang, "catalogPreviewTitle")}>
              <Catalog
                products={products}
                productsLoading={productsLoading}
                stores={stores}
                categories={categories}
                selectedCategories={catalogSelectedCategories}
                onSelectedCategoriesChange={setCatalogSelectedCategories}
                onProductClick={(id, rect) => openProduct(id, "catalog", rect)}
                onStoreClick={() => {}}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
                hideStores
                showPriceFilter
                hiddenProductId={productOverlay?.id ?? null}
              />
            </section>
          </>
        )}
        {page === "newArrivals" && (
          <NewArrivalsPage
            userId={userId || ""}
            onBack={openCatalog}
            initialPostId={pendingPostId}
            onInitialPostHandled={() => setPendingPostId(null)}
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
        {/* ProductPage больше НЕ рендерится здесь как conditional page —
            теперь это оверлей-портал, который рендерится В САМОМ КОНЦЕ
            (см. блок ниже после <BottomNavBar>), поверх любой текущей
            страницы. Текущая страница (catalog/favorites/cart) остаётся
            mounted, плавно затемняется через body-class. */}
        {page === "cart" && (
          <Cart
            userId={userId}
            onBack={openCatalog}
            onCheckout={openCheckout}
            onCartChange={refreshCartCount}
            onProductClick={(id, rect) => openProduct(id, "cart", rect)}
          />
        )}
        {page === "checkout" && (
          <Suspense fallback={<div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>{t(lang, "loading")}</div>}>
            <Checkout
              userId={userId}
              userName={userName}
              onBack={openCart}
              onDone={openCatalog}
              onOrderSuccess={refreshCartCount}
              onCartChange={refreshCartCount}
              sellerLink={SELLER_LINK}
            />
          </Suspense>
        )}
        {page === "support" && <Support />}
        {page === "reviews" && (
          <Reviews
            userId={userId}
            firstName={firstName}
            onBack={openCatalog}
          />
        )}
        {page === "settings" && <Settings onBack={openCatalog} userId={userId} />}
        {page === "history" && (
          <History
            userId={userId}
            onBack={openCatalog}
            products={products}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
            onOpenCatalog={openCatalog}
          />
        )}
        {page === "favorites" && (
          <Favorites
            products={products}
            productsLoading={productsLoading}
            wishlistIds={wishlistIds}
            onProductClick={(id, rect) => openProduct(id, "favorites", rect)}
            onToggleWishlist={toggleWishlist}
            onBack={openCatalog}
            hiddenProductId={productOverlay?.id ?? null}
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
    {/* ProductPage как оверлей-портал: рендерится поверх любой текущей
        страницы (catalog/favorites/cart). FLIP-анимация открытия из
        thumb-rect, body-class затемняет main-страницу, fixed back-кнопка
        выше хедера. Сама ProductPage внутри управляет порталом. */}
    {productOverlay && (
      <ProductPage
        key={productOverlay.id}
        product={products.find((p) => p.id === productOverlay.id)}
        cartItems={cartItems}
        thumbRect={productOverlay.thumbRect}
        onBack={goBackFromProduct}
        onCart={openCart}
        onAddedToCart={refreshCartCount}
        userId={userId}
        inWishlist={hasInWishlist(productOverlay.id)}
        onToggleWishlist={() => toggleWishlist(productOverlay.id)}
      />
    )}
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
    // z-index управляется через CSS (.zen-app > header) — это позволяет
    // body.zen-inspire-overlay-on поднять header выше overlay-слоёв
    // (1300). Inline-стиль здесь бы перебил CSS override.
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
