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
  initialPostId?: number | null;
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

function PinIcon({ filled, size = 22 }: { filled: boolean; size?: number }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l1.5 4.2 4.5 0.6-3.3 3 0.9 4.4L12 12.4 8.4 14.7l0.9-4.4-3.3-3 4.5-0.6z" />
        <line x1="12" y1="14" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l1.5 4.2 4.5 0.6-3.3 3 0.9 4.4L12 12.4 8.4 14.7l0.9-4.4-3.3-3 4.5-0.6z" />
      <line x1="12" y1="14" x2="12" y2="22" />
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

function BackArrowIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function getPostImages(post: Post): string[] {
  if (post.images && post.images.length > 0) return post.images;
  const legacy = post.image_data || post.image_url;
  return legacy ? [legacy] : [];
}

// ── Pinterest masonry card ───────────────────────────────────────────

interface MasonryCardProps {
  post: Post;
  onOpen: (post: Post, thumbRect: DOMRect | null, src: string, photoIndex: number) => void;
}

function MasonryCard({ post, onOpen }: MasonryCardProps) {
  const images = getPostImages(post);
  const isMulti = images.length > 1;
  const [currentIdx, setCurrentIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchMoveDx = useRef(0);

  if (images.length === 0) return null;

  const handleClick = () => {
    const rect = ref.current?.getBoundingClientRect() ?? null;
    onOpen(post, rect, images[currentIdx], currentIdx);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMulti) return;
    touchStartX.current = e.touches[0].clientX;
    touchMoveDx.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMulti || touchStartX.current === null) return;
    touchMoveDx.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (!isMulti || touchStartX.current === null) {
      touchStartX.current = null;
      return;
    }
    const dx = touchMoveDx.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) {
      setCurrentIdx((prev) => {
        if (dx < 0) return Math.min(images.length - 1, prev + 1);
        return Math.max(0, prev - 1);
      });
    }
  };

  const handleClickGuarded = (e: React.MouseEvent) => {
    if (Math.abs(touchMoveDx.current) > 10) {
      e.preventDefault();
      e.stopPropagation();
      touchMoveDx.current = 0;
      return;
    }
    handleClick();
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleClickGuarded}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="zen-pin-card"
      style={cardStyles.card}
    >
      <div style={cardStyles.imageWrap}>
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            style={{
              ...cardStyles.image,
              ...(isMulti ? cardStyles.imageStacked : null),
              opacity: isMulti ? (i === currentIdx ? 1 : 0) : 1,
            }}
          />
        ))}
        {isMulti && (
          <div style={cardStyles.dotsRow} aria-hidden>
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  ...cardStyles.dot,
                  ...(i === currentIdx ? cardStyles.dotActive : null),
                }}
              />
            ))}
          </div>
        )}
      </div>
      {post.caption && (
        <div style={cardStyles.captionLine} title={post.caption}>
          {post.caption}
        </div>
      )}
    </div>
  );
}

// ── Expanded fullscreen view ─────────────────────────────────────────

interface ExpandedViewProps {
  post: Post;
  startRect: DOMRect | null;
  startSrc: string;
  startIndex: number;
  userId: string;
  lang: Lang;
  onClose: () => void;
  onPinToggle: (postId: number, newPinned: boolean, newCount: number) => void;
  onShare: (post: Post) => void;
}

function ExpandedView({ post, startRect, startSrc, startIndex, userId, lang, onClose, onPinToggle, onShare }: ExpandedViewProps) {
  const images = getPostImages(post);
  const [currentIdx, setCurrentIdx] = useState(Math.min(startIndex, images.length - 1));
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchMoveDx = useRef(0);
  const touchMoveDy = useRef(0);
  const dragDirection = useRef<"horizontal" | "vertical" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  useLayoutEffect(() => {
    const r = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("open"));
    });
    return () => cancelAnimationFrame(r);
  }, []);

  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    setPhase("closing");
    setTimeout(() => onClose(), 280);
  }, [phase, onClose]);

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

  const handlePin = async () => {
    const wasPinned = post.user_liked;
    const prevCount = post.likes_count;
    const tg = window.Telegram?.WebApp;
    tg?.HapticFeedback?.impactOccurred?.("light");
    onPinToggle(post.id, !wasPinned, wasPinned ? prevCount - 1 : prevCount + 1);
    try {
      const result = await togglePostLike(post.id, userId);
      onPinToggle(post.id, result.liked, result.likes_count);
    } catch {
      onPinToggle(post.id, wasPinned, prevCount);
    }
  };

  const handleShare = () => {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    onShare(post);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchMoveDx.current = 0;
    touchMoveDy.current = 0;
    dragDirection.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    touchMoveDx.current = dx;
    touchMoveDy.current = dy;
    if (dragDirection.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dragDirection.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (dragDirection.current === "horizontal" && images.length > 1) {
      setDragX(dx);
    } else if (dragDirection.current === "vertical" && dy > 0) {
      setDragY(dy);
    }
  };
  const onTouchEnd = () => {
    const dx = touchMoveDx.current;
    const dy = touchMoveDy.current;
    const dir = dragDirection.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchMoveDx.current = 0;
    touchMoveDy.current = 0;
    dragDirection.current = null;
    setDragX(0);

    if (dir === "horizontal" && Math.abs(dx) > 60 && images.length > 1) {
      setCurrentIdx((prev) => {
        if (dx < 0) return Math.min(images.length - 1, prev + 1);
        return Math.max(0, prev - 1);
      });
    }
    if (dir === "vertical") {
      if (dy > 100) {
        requestClose();
      } else {
        setDragY(0);
      }
    } else {
      setDragY(0);
    }
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  const sheetTransform = (() => {
    if (phase === "open") {
      return `translate3d(0, ${dragY}px, 0) scale(1)`;
    }
    if (!startRect || vw === 0) return "translate3d(0, 100%, 0) scale(0.92)";
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
        background: `rgba(var(--bg-rgb), ${0.97 * backdropOpacity})`,
        pointerEvents: phase === "closing" ? "none" : "auto",
      }}
    >
      <div
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
        <div style={expandedStyles.topBar}>
          <button
            type="button"
            onClick={requestClose}
            style={expandedStyles.backBtn}
            aria-label="Назад"
          >
            <BackArrowIcon />
          </button>
        </div>

        <div style={expandedStyles.imageArea}>
          <div style={{
            ...expandedStyles.imageTrack,
            transform: `translate3d(${-currentIdx * 100 + (dragX / Math.max(vw, 1)) * 100}%, 0, 0)`,
            transition: dragX === 0 ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}>
            {images.length > 0 ? images.map((src, i) => (
              <div key={i} style={expandedStyles.imageSlide}>
                <img
                  src={src}
                  alt=""
                  style={expandedStyles.image}
                  draggable={false}
                />
              </div>
            )) : (
              <div style={expandedStyles.imageSlide}>
                <img src={startSrc} alt="" style={expandedStyles.image} draggable={false} />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div style={expandedStyles.dotsRow} aria-hidden>
              {images.map((_, i) => (
                <span
                  key={i}
                  style={{
                    ...expandedStyles.dot,
                    ...(i === currentIdx ? expandedStyles.dotActive : null),
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action row: пин слева, шер справа */}
        <div style={expandedStyles.actionsRow}>
          <button
            type="button"
            onClick={handlePin}
            style={{
              ...expandedStyles.actionBtn,
              ...(post.user_liked ? expandedStyles.actionBtnPinned : null),
            }}
            aria-pressed={post.user_liked}
            aria-label={post.user_liked ? t(lang, "postPinned") : t(lang, "postPin")}
          >
            <PinIcon filled={post.user_liked} size={24} />
            <span style={expandedStyles.actionText}>
              {post.user_liked ? t(lang, "postPinned") : t(lang, "postPin")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            style={{ ...expandedStyles.actionBtn, marginLeft: "auto" }}
            aria-label={t(lang, "postShare")}
          >
            <ShareIcon size={24} />
          </button>
        </div>

        {post.caption && (
          <div style={expandedStyles.captionWrap}>
            <p style={expandedStyles.caption}>{post.caption}</p>
          </div>
        )}

        {post.product_url && (
          <div style={expandedStyles.productCtaWrap}>
            <a
              href={post.product_url}
              target="_blank"
              rel="noopener noreferrer"
              style={expandedStyles.productCta}
            >
              {t(lang, "postOpenProduct")} →
            </a>
          </div>
        )}
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
      <div style={{ width: "100%", height: h, background: "var(--surface-2, rgba(255,255,255,0.05))" }} />
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
  const [expanded, setExpanded] = useState<{ post: Post; rect: DOMRect | null; src: string; index: number } | null>(null);

  // Память скролла для FAB-переключателя: запоминаем позицию каждого таба
  // и восстанавливаем её при возврате. Это ключ к плавному toggle — юзер
  // не теряет место в ленте.
  const scrollMemory = useRef<Record<FilterTab, number>>({ all: 0, liked: 0 });

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

  useEffect(() => {
    if (!initialPostId || posts.length === 0) return;
    const target = posts.find((p) => p.id === initialPostId);
    if (!target) return;
    const cover = getPostImages(target)[0] ?? "";
    setExpanded({ post: target, rect: null, src: cover, index: 0 });
    onInitialPostHandled?.();
  }, [initialPostId, posts, onInitialPostHandled]);

  const handlePinToggle = useCallback(
    (postId: number, newPinned: boolean, newCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, user_liked: newPinned, likes_count: newCount }
            : p
        )
      );
      setExpanded((prev) =>
        prev && prev.post.id === postId
          ? { ...prev, post: { ...prev.post, user_liked: newPinned, likes_count: newCount } }
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
      shareUrl = `https://t.me/${bot}/${shortName}?startapp=${encodeURIComponent(startParam)}`;
    } else if (typeof window !== "undefined") {
      shareUrl = `${window.location.origin}${window.location.pathname}#post=${post.id}`;
    } else {
      shareUrl = `#post=${post.id}`;
    }

    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}` +
      (post.caption ? `&text=${encodeURIComponent(post.caption)}` : "");
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(tgShareUrl);
    } else if (tg?.openLink) {
      tg.openLink(tgShareUrl);
    } else if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ url: shareUrl, text: post.caption || undefined }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  }, []);

  const visiblePosts = useMemo(() => {
    if (tab === "liked") return posts.filter((p) => p.user_liked);
    return posts;
  }, [posts, tab]);

  const pinnedCount = useMemo(() => posts.filter((p) => p.user_liked).length, [posts]);

  // FAB-переключатель: запоминаем текущую позицию скролла для активного
  // таба, переключаемся, восстанавливаем сохранённую позицию для нового.
  const switchTab = useCallback((next: FilterTab) => {
    if (next === tab) return;
    if (typeof window !== "undefined") {
      scrollMemory.current[tab] = window.scrollY;
    }
    setTab(next);
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollMemory.current[next] ?? 0, behavior: "instant" });
    });
  }, [tab]);

  const toggleViaFab = useCallback(() => {
    const tg = window.Telegram?.WebApp;
    tg?.HapticFeedback?.selectionChanged?.();
    switchTab(tab === "all" ? "liked" : "all");
  }, [tab, switchTab]);

  return (
    <div style={pageStyles.wrap}>
      {/* Welcome bubble — компактный, всегда в шапке */}
      <div style={pageStyles.headerArea}>
        <div style={pageStyles.bubbleRow}>
          <div style={pageStyles.avatar}>R</div>
          <div style={pageStyles.bubbleMain}>
            <div style={pageStyles.bubbleTitle}>{t(lang, "postsInspireTitle")}</div>
            <div style={pageStyles.bubbleSubtitle}>{t(lang, "postsInspireSubtitle")}</div>
          </div>
        </div>
      </div>

      {/* Tabs: Всё / Пины */}
      <div style={pageStyles.tabsRow} role="tablist" aria-label="Фильтр постов">
        {(["all", "liked"] as FilterTab[]).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => switchTab(key)}
              style={{
                ...pageStyles.tabBtn,
                ...(active ? pageStyles.tabBtnActive : null),
              }}
            >
              {t(lang, key === "all" ? "postsTabAll" : "postsTabLiked")}
              {key === "liked" && pinnedCount > 0 && (
                <span style={pageStyles.tabCount}>{pinnedCount}</span>
              )}
            </button>
          );
        })}
      </div>

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
              onOpen={(p, rect, src, index) => setExpanded({ post: p, rect, src, index })}
            />
          ))}
        </div>
      )}

      {/* FAB: тoggle между Всё / Закреплённые с памятью скролла */}
      {!loading && posts.length > 0 && (
        <button
          type="button"
          onClick={toggleViaFab}
          className="zen-pin-fab"
          aria-label={tab === "all" ? t(lang, "postsFabPinned") : t(lang, "postsFabAll")}
          title={tab === "all" ? t(lang, "postsFabPinned") : t(lang, "postsFabAll")}
          style={{
            ...pageStyles.fab,
            background: tab === "liked" ? "var(--accent)" : "var(--text)",
            color: tab === "liked" ? "#fff" : "var(--bg)",
          }}
        >
          <PinIcon filled={tab === "liked"} size={22} />
          {tab === "liked" && pinnedCount > 0 && (
            <span style={pageStyles.fabBadge}>{pinnedCount}</span>
          )}
        </button>
      )}

      {expanded && (
        <ExpandedView
          post={expanded.post}
          startRect={expanded.rect}
          startSrc={expanded.src}
          startIndex={expanded.index}
          userId={userId}
          lang={lang}
          onClose={() => setExpanded(null)}
          onPinToggle={handlePinToggle}
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
    padding: "8px 4px calc(96px + env(safe-area-inset-bottom, 0px))",
  },
  headerArea: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    marginBottom: 12,
    padding: "0 6px",
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
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  bubbleSubtitle: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 3,
    lineHeight: 1.4,
  },
  tabsRow: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
    padding: "0 6px",
  },
  tabBtn: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "8px 18px",
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
  fab: {
    position: "fixed" as const,
    right: 16,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
    width: 52,
    height: 52,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.18)",
    zIndex: 900,
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
    transition: "background 0.18s ease, color 0.18s ease, transform 0.1s ease",
  },
  fabBadge: {
    position: "absolute" as const,
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 999,
    background: "#fff",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid var(--accent)",
    fontVariantNumeric: "tabular-nums",
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative" as const,
    width: "100%",
    background: "transparent",
    borderRadius: 12,
    overflow: "hidden",
    cursor: "pointer",
    breakInside: "avoid",
    WebkitTapHighlightColor: "transparent",
    transition: "transform 0.15s ease",
  },
  imageWrap: {
    position: "relative" as const,
    width: "100%",
    overflow: "hidden",
    borderRadius: 12,
    background: "rgba(0,0,0,0.04)",
  },
  image: {
    width: "100%",
    height: "auto",
    display: "block",
    objectFit: "cover" as const,
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
    pointerEvents: "none" as const,
  },
  imageStacked: {
    position: "absolute" as const,
    inset: 0,
    width: "100%",
    height: "100%",
    transition: "opacity 0.25s ease",
  },
  dotsRow: {
    position: "absolute" as const,
    bottom: 8,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 4,
    padding: "5px 8px",
    background: "rgba(0,0,0,0.32)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    borderRadius: 999,
    pointerEvents: "none",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.55)",
    transition: "background 0.15s ease, width 0.15s ease",
  },
  dotActive: {
    background: "#fff",
    width: 12,
    borderRadius: 3,
  },
  captionLine: {
    padding: "5px 4px 2px",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text)",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
};

const expandedStyles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1100,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    transition: "background 280ms ease",
  },
  sheet: {
    position: "relative" as const,
    width: "100%",
    height: "100%",
    background: "var(--bg)",
    overflow: "hidden",
    transformOrigin: "center center",
    willChange: "transform, opacity",
    display: "flex",
    flexDirection: "column" as const,
  },
  topBar: {
    position: "absolute" as const,
    top: "calc(env(safe-area-inset-top, 0px) + 12px)",
    left: 12,
    right: 12,
    zIndex: 3,
    display: "flex",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "var(--surface-elevated)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)",
  },
  // Hero-image теперь занимает всю доступную ширину карточки
  // (без огромных пустых полей сверху и снизу).
  imageArea: {
    position: "relative" as const,
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    minHeight: 0,
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
  },
  imageTrack: {
    display: "flex",
    width: "100%",
    height: "100%",
    willChange: "transform",
  },
  imageSlide: {
    flex: "0 0 100%",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  // Картинка тянется по ширине, высота по соотношению. Ограничение
  // по высоте — чтобы не вылезала за пределы видимой области, но при
  // этом маленькие квадратные пикчи всё равно выглядят крупно.
  image: {
    width: "100%",
    height: "auto",
    maxHeight: "100%",
    objectFit: "contain" as const,
    display: "block",
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
  },
  dotsRow: {
    position: "absolute" as const,
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 5,
    padding: "6px 10px",
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderRadius: 999,
    pointerEvents: "none",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.5)",
    transition: "background 0.15s ease, width 0.15s ease",
  },
  dotActive: {
    background: "#fff",
    width: 18,
    borderRadius: 3,
  },
  actionsRow: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 20px 8px",
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    color: "var(--text)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1,
    WebkitTapHighlightColor: "transparent",
    transition: "background 0.15s ease, border-color 0.15s ease, transform 0.08s ease, color 0.15s ease",
  },
  actionBtnPinned: {
    background: "var(--accent)",
    color: "#fff",
    borderColor: "var(--accent)",
  },
  actionText: {
    fontSize: 13,
    fontWeight: 600,
  },
  captionWrap: {
    flex: "0 0 auto",
    padding: "6px 20px 4px",
    maxHeight: "30dvh",
    overflowY: "auto" as const,
  },
  caption: {
    fontSize: 14,
    color: "var(--text)",
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: "pre-wrap" as const,
  },
  productCtaWrap: {
    flex: "0 0 auto",
    padding: "8px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)",
  },
  productCta: {
    display: "inline-block",
    padding: "10px 18px",
    background: "var(--text)",
    color: "var(--bg)",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 12,
    textDecoration: "none",
    letterSpacing: "0.01em",
  },
};
