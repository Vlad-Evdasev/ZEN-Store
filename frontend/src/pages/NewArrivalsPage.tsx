import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import {
  getPosts,
  togglePostLike,
  type Post,
} from "../api";
import { useSettings, type Lang } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewArrivalsPageProps {
  userId: string;
  onBack: () => void;
  /** Если задан — открыть указанный пост сразу при маунте. Прокидывается
   *  из App.tsx, который читает deep-link (start_param бота / URL #post=N). */
  initialPostId?: number | null;
  /** Зовётся когда initialPostId успешно открыт — родитель может сбросить
   *  его в null, чтобы повторный визит на вкладку не открывал тот же пост. */
  onInitialPostHandled?: () => void;
}

// Микрокэш постов в localStorage — показываем последний снимок мгновенно,
// потом тихо обновляем с бэка. Скелетон видят только новые юзеры.
const POSTS_CACHE_KEY = "raw_cache_v1:posts";
function readPostsCache(): Post[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POSTS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Post[]) : null;
  } catch {
    return null;
  }
}
function writePostsCache(posts: Post[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(posts)); } catch {}
}

// ── Иконки ──────────────────────────────────────────────────────────

function HeartIcon({ filled, size = 22 }: { filled: boolean; size?: number }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CloseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function formatPostDate(dateStr: string, lang: Lang): string {
  const months: Record<string, string[]> = {
    ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };
  const d = new Date(dateStr);
  const day = d.getDate();
  const monthArr = months[lang] ?? months.ru;
  return `${day} ${monthArr[d.getMonth()]}`;
}

// Извлекаем images-массив из поста, поддерживая legacy single-image поля.
function getPostImages(post: Post): string[] {
  if (post.images && post.images.length > 0) return post.images;
  const legacy = post.image_data || post.image_url;
  return legacy ? [legacy] : [];
}

// ── Pinterest masonry card ───────────────────────────────────────────
// Никаких overlay-кнопок: чистая плитка с фото и (если мульти) счётчиком
// «1/3» в углу. Всё остальное — лайк, поделиться, caption — в expanded view.

interface MasonryCardProps {
  post: Post;
  onOpen: (post: Post, thumbRect: DOMRect | null, src: string) => void;
}

function MasonryCard({ post, onOpen }: MasonryCardProps) {
  const images = getPostImages(post);
  const cover = images[0];
  const ref = useRef<HTMLDivElement>(null);

  if (!cover) return null;

  const handleClick = () => {
    const rect = ref.current?.getBoundingClientRect() ?? null;
    onOpen(post, rect, cover);
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      className="zen-pin-card"
      style={cardStyles.card}
    >
      <img src={cover} alt="" style={cardStyles.image} loading="lazy" />
      {images.length > 1 && (
        <span style={cardStyles.multiBadge} aria-label={`${images.length} фото`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <rect x="8" y="3" width="13" height="13" rx="2" />
            <path d="M16 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3" />
          </svg>
          {images.length}
        </span>
      )}
    </div>
  );
}

// ── Expanded post view ───────────────────────────────────────────────
// Pinterest-style: карточка «выезжает» из своего thumb-положения в
// полноэкранный sheet. Pull-down закрывает.

interface ExpandedViewProps {
  post: Post;
  startRect: DOMRect | null;
  startSrc: string;
  userId: string;
  lang: Lang;
  onClose: () => void;
  onLikeToggle: (postId: number, newLiked: boolean, newCount: number) => void;
  onShare: (post: Post) => void;
}

function ExpandedView({ post, startRect, startSrc, userId, lang, onClose, onLikeToggle, onShare }: ExpandedViewProps) {
  const images = getPostImages(post);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragActive = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Анимация открытия: при первом маунте размещаем thumb-картинку в её
  // исходных экранных координатах, затем на следующем кадре «отпускаем» —
  // CSS transition сам её переносит в финальное состояние (полный экран).
  useLayoutEffect(() => {
    const r = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("open"));
    });
    return () => cancelAnimationFrame(r);
  }, []);

  // Закрытие: меняем фазу на "closing" → CSS возвращает картинку к
  // её исходному thumb-rect, потом окончательно демонтируем компонент.
  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    setPhase("closing");
    const TIMEOUT = 280;
    setTimeout(() => onClose(), TIMEOUT);
  }, [phase, onClose]);

  // Esc + блокировка скролла body пока открыто
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  // Лайк с оптимистичным апдейтом + хаптик-фидбек.
  const handleLike = async () => {
    const wasLiked = post.user_liked;
    const prevCount = post.likes_count;
    const tg = window.Telegram?.WebApp;
    tg?.HapticFeedback?.impactOccurred?.("light");
    onLikeToggle(post.id, !wasLiked, wasLiked ? prevCount - 1 : prevCount + 1);
    try {
      const result = await togglePostLike(post.id, userId);
      onLikeToggle(post.id, result.liked, result.likes_count);
    } catch {
      onLikeToggle(post.id, wasLiked, prevCount);
    }
  };

  const handleShare = () => {
    const tg = window.Telegram?.WebApp;
    tg?.HapticFeedback?.selectionChanged?.();
    onShare(post);
  };

  // Pull-to-close: тянем sheet вниз, при превышении порога — закрываем.
  const onTouchStart = (e: React.TouchEvent) => {
    // Только если касание началось у верхней части sheet и нет горизонтального
    // свайпа (для свайпа фоток мы используем стрелки/тап на края).
    if ((sheetRef.current?.scrollTop ?? 0) > 0) return;
    dragStartY.current = e.touches[0].clientY;
    dragActive.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragActive.current || dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    dragActive.current = false;
    if (dragY > 100) {
      requestClose();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  };

  // Размеры экрана для целевой геометрии.
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  // Хитрая часть: для opening/closing phase мы хотим, чтобы sheet
  // визуально «вырастал» из позиции thumb. Делаем это через transform.
  const sheetTransform = (() => {
    if (phase === "open") {
      return `translate3d(0, ${dragY}px, 0) scale(1)`;
    }
    if (!startRect || vw === 0) return "translate3d(0, 100%, 0) scale(0.92)";
    // Считаем translate так, чтобы центр sheet оказался в центре thumb.
    const targetCx = startRect.left + startRect.width / 2;
    const targetCy = startRect.top + startRect.height / 2;
    const sheetCx = vw / 2;
    const sheetCy = vh / 2;
    const dx = targetCx - sheetCx;
    const dy = targetCy - sheetCy;
    const scale = Math.max(0.18, startRect.width / vw);
    return `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
  })();

  const backdropOpacity = phase === "open" ? 1 - Math.min(0.6, dragY / 400) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        ...expandedStyles.root,
        background: `rgba(0, 0, 0, ${0.78 * backdropOpacity})`,
        backdropFilter: phase === "open" ? `blur(${12 * backdropOpacity}px)` : "blur(0px)",
        WebkitBackdropFilter: phase === "open" ? `blur(${12 * backdropOpacity}px)` : "blur(0px)",
        pointerEvents: phase === "closing" ? "none" : "auto",
      }}
      onClick={requestClose}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          ...expandedStyles.sheet,
          transform: sheetTransform,
          opacity: phase === "opening" ? 0.4 : 1,
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
        }}
      >
        {/* Drag-handle — визуальная подсказка что можно тянуть вниз */}
        <div style={expandedStyles.dragHandle} aria-hidden />

        {/* Hero image */}
        <div style={expandedStyles.imageWrap}>
          <img
            src={images[currentIdx] ?? startSrc}
            alt=""
            style={expandedStyles.image}
          />
          {images.length > 1 && (
            <>
              <span style={expandedStyles.counter}>
                {currentIdx + 1} / {images.length}
              </span>
              {currentIdx > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCurrentIdx((p) => Math.max(0, p - 1)); }}
                  style={{ ...expandedStyles.nav, left: 12 }}
                  aria-label="Предыдущее"
                >‹</button>
              )}
              {currentIdx < images.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCurrentIdx((p) => Math.min(images.length - 1, p + 1)); }}
                  style={{ ...expandedStyles.nav, right: 12 }}
                  aria-label="Следующее"
                >›</button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={requestClose}
            style={expandedStyles.closeBtn}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Action bar */}
        <div style={expandedStyles.body}>
          <div style={expandedStyles.actionsRow}>
            <button
              type="button"
              onClick={handleLike}
              style={{
                ...expandedStyles.actionBtn,
                ...(post.user_liked ? expandedStyles.actionBtnActive : null),
              }}
              aria-pressed={post.user_liked}
              aria-label={t(lang, "postLike")}
            >
              <HeartIcon filled={post.user_liked} />
              <span style={expandedStyles.actionLabel}>
                {post.likes_count > 0 ? post.likes_count : t(lang, "postLike")}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={expandedStyles.actionBtn}
              aria-label={t(lang, "postShare")}
            >
              <ShareIcon />
              <span style={expandedStyles.actionLabel}>{t(lang, "postShare")}</span>
            </button>
            <span style={expandedStyles.dateInline}>
              {formatPostDate(post.created_at, lang)}
            </span>
          </div>

          {post.caption && (
            <p style={expandedStyles.caption}>{post.caption}</p>
          )}

          {post.product_url && (
            <a
              href={post.product_url}
              target="_blank"
              rel="noopener noreferrer"
              style={expandedStyles.productCta}
            >
              {t(lang, "postOpenProduct")} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────

const SKELETON_HEIGHTS = [220, 160, 280, 180, 240, 200] as const;

function SkeletonCard({ index = 0 }: { index?: number }) {
  const h = SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length];
  return (
    <div className="zen-pin-card" style={{ ...cardStyles.card, padding: 0 }}>
      <div style={{ ...cardStyles.image, height: h, background: "var(--surface-2, rgba(255,255,255,0.05))" }} />
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

type FilterTab = "all" | "liked";

export function NewArrivalsPage({
  userId,
  initialPostId,
  onInitialPostHandled,
}: Omit<NewArrivalsPageProps, "onBack"> & { onBack?: NewArrivalsPageProps["onBack"] }) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [posts, setPosts] = useState<Post[]>(() => readPostsCache() ?? []);
  const [loading, setLoading] = useState<boolean>(() => (readPostsCache() ?? []).length === 0);
  const [tab, setTab] = useState<FilterTab>("all");
  const [expanded, setExpanded] = useState<{ post: Post; rect: DOMRect | null; src: string } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPosts(userId)
      .then((data) => {
        if (cancelled) return;
        setPosts(data);
        writePostsCache(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Deep link: открыть нужный пост сразу как только он подгрузится.
  useEffect(() => {
    if (!initialPostId || posts.length === 0) return;
    const target = posts.find((p) => p.id === initialPostId);
    if (!target) return;
    const cover = getPostImages(target)[0] ?? "";
    setExpanded({ post: target, rect: null, src: cover });
    onInitialPostHandled?.();
  }, [initialPostId, posts, onInitialPostHandled]);

  const handleLikeToggle = useCallback(
    (postId: number, newLiked: boolean, newCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, user_liked: newLiked, likes_count: newCount }
            : p
        )
      );
      // Если в expanded открыт этот же пост — обновляем и его state.
      setExpanded((prev) =>
        prev && prev.post.id === postId
          ? { ...prev, post: { ...prev.post, user_liked: newLiked, likes_count: newCount } }
          : prev
      );
    },
    []
  );

  const handleShare = useCallback((post: Post) => {
    const tg = window.Telegram?.WebApp;
    const bot = (import.meta.env.VITE_BOT_USERNAME || "").replace(/^@/, "");
    const shortName = import.meta.env.VITE_WEBAPP_SHORT_NAME || "";
    const startParam = `post_${post.id}`;

    let shareUrl: string;
    if (bot && shortName) {
      // Каноничная Mini-App ссылка: t.me/<bot>/<short>?startapp=post_42.
      // Telegram у получателя сам откроет наш WebApp, а мы прочитаем
      // start_param и автоматически развернём этот пост.
      shareUrl = `https://t.me/${bot}/${shortName}?startapp=${encodeURIComponent(startParam)}`;
    } else if (typeof window !== "undefined") {
      // Фолбэк — обычный web-URL с hash, для браузера/тестов.
      shareUrl = `${window.location.origin}${window.location.pathname}#post=${post.id}`;
    } else {
      shareUrl = `#post=${post.id}`;
    }

    const shareText = post.caption
      ? `${post.caption}\n\n${shareUrl}`
      : shareUrl;

    // Открываем родной Telegram share — пикер контактов с пред-заполненным
    // текстом + ссылка-превью. Это самый «нативный» путь внутри клиента.
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}` +
      (post.caption ? `&text=${encodeURIComponent(post.caption)}` : "");
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(tgShareUrl);
    } else if (tg?.openLink) {
      tg.openLink(tgShareUrl);
    } else if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ url: shareUrl, text: post.caption || undefined }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
  }, []);

  const visiblePosts = useMemo(() => {
    if (tab === "liked") return posts.filter((p) => p.user_liked);
    return posts;
  }, [posts, tab]);

  return (
    <div style={pageStyles.wrap}>
      {/* Header bubble (приветственный) */}
      <div style={pageStyles.headerArea}>
        <div style={pageStyles.bubbleRow}>
          <div style={pageStyles.avatar}>R</div>
          <div style={pageStyles.bubbleMain}>
            <div style={pageStyles.bubbleTitle}>{t(lang, "postsInspireTitle")}</div>
            <div style={pageStyles.bubbleSubtitle}>{t(lang, "postsInspireSubtitle")}</div>
          </div>
        </div>
      </div>

      {/* Tabs: Все / Лайки */}
      <div style={pageStyles.tabsRow} role="tablist" aria-label="Фильтр постов">
        {(["all", "liked"] as FilterTab[]).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(key)}
              style={{
                ...pageStyles.tabBtn,
                ...(active ? pageStyles.tabBtnActive : null),
              }}
            >
              {t(lang, key === "all" ? "postsTabAll" : "postsTabLiked")}
              {key === "liked" && posts.some((p) => p.user_liked) && (
                <span style={pageStyles.tabCount}>
                  {posts.filter((p) => p.user_liked).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Лента */}
      {loading && (
        <div className="zen-pin-grid">
          <SkeletonCard index={0} />
          <SkeletonCard index={1} />
          <SkeletonCard index={2} />
          <SkeletonCard index={3} />
          <SkeletonCard index={4} />
          <SkeletonCard index={5} />
        </div>
      )}

      {!loading && tab === "liked" && visiblePosts.length === 0 && (
        <div style={pageStyles.empty}>
          <p style={pageStyles.emptyTitle}>{t(lang, "postsLikedEmpty")}</p>
          <p style={pageStyles.emptyHint}>{t(lang, "postsLikedEmptyHint")}</p>
        </div>
      )}

      {!loading && visiblePosts.length > 0 && (
        <div className="zen-pin-grid">
          {visiblePosts.map((post) => (
            <MasonryCard
              key={post.id}
              post={post}
              onOpen={(p, rect, src) => setExpanded({ post: p, rect, src })}
            />
          ))}
        </div>
      )}

      {expanded && (
        <ExpandedView
          post={expanded.post}
          startRect={expanded.rect}
          startSrc={expanded.src}
          userId={userId}
          lang={lang}
          onClose={() => setExpanded(null)}
          onLikeToggle={handleLikeToggle}
          onShare={handleShare}
        />
      )}
    </div>
  );
}

// ── Стили ────────────────────────────────────────────────────────────

const pageStyles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "8px 10px calc(96px + env(safe-area-inset-bottom, 0px))",
  },
  headerArea: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    marginBottom: 14,
  },
  bubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    flexShrink: 0,
    marginBottom: 0,
  },
  bubbleMain: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 13px",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  bubbleTitle: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  bubbleSubtitle: {
    fontSize: 12.5,
    color: "var(--muted)",
    marginTop: 4,
    lineHeight: 1.4,
  },
  tabsRow: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
    padding: "0 2px",
  },
  tabBtn: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--muted)",
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
    WebkitTapHighlightColor: "transparent",
  },
  tabBtnActive: {
    background: "var(--text)",
    color: "var(--bg)",
    borderColor: "var(--text)",
  },
  tabCount: {
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    opacity: 0.85,
  },
  empty: {
    textAlign: "center" as const,
    padding: "60px 20px",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 13,
    color: "var(--muted)",
    lineHeight: 1.45,
    maxWidth: 280,
    margin: "0 auto",
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative" as const,
    width: "100%",
    background: "var(--surface)",
    borderRadius: 14,
    overflow: "hidden",
    cursor: "pointer",
    breakInside: "avoid",
    WebkitTapHighlightColor: "transparent",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  },
  image: {
    width: "100%",
    height: "auto",
    display: "block",
    objectFit: "cover" as const,
  },
  multiBadge: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    padding: "4px 8px 4px 6px",
    background: "rgba(0, 0, 0, 0.6)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
    borderRadius: 999,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    pointerEvents: "none",
  },
};

const expandedStyles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1100,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    transition: "background 280ms ease, backdrop-filter 280ms ease",
  },
  sheet: {
    position: "relative" as const,
    width: "min(100%, 560px)",
    maxHeight: "92dvh",
    background: "var(--bg)",
    borderRadius: "20px 20px 0 0",
    overflow: "hidden auto",
    boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.35)",
    transformOrigin: "center center",
    willChange: "transform, opacity",
    overscrollBehavior: "contain" as const,
  },
  dragHandle: {
    position: "absolute" as const,
    top: 8,
    left: "50%",
    transform: "translateX(-50%)",
    width: 40,
    height: 4,
    borderRadius: 2,
    background: "rgba(255, 255, 255, 0.35)",
    zIndex: 2,
    pointerEvents: "none",
  },
  imageWrap: {
    position: "relative" as const,
    width: "100%",
    background: "#0a0a08",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 280,
    maxHeight: "70dvh",
  },
  image: {
    width: "100%",
    height: "auto",
    maxHeight: "70dvh",
    objectFit: "contain" as const,
    display: "block",
  },
  counter: {
    position: "absolute" as const,
    top: 14,
    left: 14,
    padding: "5px 11px",
    background: "rgba(0, 0, 0, 0.65)",
    color: "#fff",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    borderRadius: 999,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    pointerEvents: "none",
  },
  nav: {
    position: "absolute" as const,
    top: "50%",
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#1a1a1a",
    border: "none",
    fontSize: 24,
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    paddingBottom: 2,
  },
  closeBtn: {
    position: "absolute" as const,
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.55)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: "16px 18px 24px",
  },
  actionsRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    color: "var(--text)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
    WebkitTapHighlightColor: "transparent",
    transition: "background 0.15s ease, border-color 0.15s ease, transform 0.08s ease",
  },
  actionBtnActive: {
    color: "#ef4444",
    borderColor: "rgba(239, 68, 68, 0.35)",
    background: "rgba(239, 68, 68, 0.08)",
  },
  actionLabel: {
    fontVariantNumeric: "tabular-nums",
  },
  dateInline: {
    marginLeft: "auto",
    fontSize: 12,
    color: "var(--muted)",
  },
  caption: {
    fontSize: 14,
    color: "var(--text)",
    lineHeight: 1.5,
    margin: "0 0 12px",
    whiteSpace: "pre-wrap" as const,
  },
  productCta: {
    display: "inline-block",
    padding: "10px 16px",
    background: "var(--text)",
    color: "var(--bg)",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 12,
    textDecoration: "none",
    letterSpacing: "0.01em",
  },
};
