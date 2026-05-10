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

// Классический канцелярский пушпин — outline и filled варианты.
function PinIcon({ filled, size = 26 }: { filled: boolean; size?: number }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16 2H8a1 1 0 0 0-.7 1.7L8 4.4V11l-2.3 2.3A1 1 0 0 0 6.4 15H11v6a1 1 0 0 0 2 0v-6h4.6a1 1 0 0 0 .7-1.7L16 11V4.4l.7-.7A1 1 0 0 0 16 2Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 3H8l1.5 1.5V11l-2 2v1.5h9V13l-2-2V4.5L16 3Z" />
      <line x1="12" y1="14.5" x2="12" y2="21" />
    </svg>
  );
}

function ShareIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function BackArrowIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  const imgRef = useRef<HTMLImageElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchMoveDx = useRef(0);

  if (images.length === 0) return null;

  const handleClick = () => {
    // Берём rect самой картинки (не всей карточки) — анимация морфит
    // именно изображение, а не carrier-блок.
    const rect = imgRef.current?.getBoundingClientRect()
      ?? ref.current?.getBoundingClientRect()
      ?? null;
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
        <img
          ref={imgRef}
          key={currentIdx}
          src={images[currentIdx]}
          alt=""
          loading="lazy"
          style={cardStyles.image}
        />
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
// FLIP-анимация: при открытии картинка стартует в координатах thumb-а
// (через инверсный transform), затем плавно «расправляется» до своих
// финальных размеров на экране. На закрытии — обратная анимация.

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
  const [currentIdx, setCurrentIdx] = useState(Math.min(startIndex, Math.max(images.length - 1, 0)));
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchMoveDx = useRef(0);
  const touchMoveDy = useRef(0);
  const dragDirection = useRef<"horizontal" | "vertical" | null>(null);
  const [dragY, setDragY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Для optimistic-пина с защитой от race-condition.
  const reqVersion = useRef(0);

  // FLIP: измеряем где картинка ХОЧЕТ оказаться, считаем дельту до
  // thumb-а, накладываем её через transform мгновенно, потом отпускаем
  // — CSS-transition сам анимирует transform → identity.
  useLayoutEffect(() => {
    const img = imageRef.current;
    if (!img || !startRect) {
      // Если rect-а нет (deep-link, без thumb-а) — просто фейдим.
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
      return;
    }
    const apply = () => {
      const final = img.getBoundingClientRect();
      if (final.width === 0 || final.height === 0) return;
      const dx = startRect.left - final.left;
      const dy = startRect.top - final.top;
      const sx = startRect.width / final.width;
      const sy = startRect.height / final.height;
      img.style.transformOrigin = "top left";
      img.style.transition = "none";
      img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      // Force reflow перед очисткой transition + transform = identity.
      void img.offsetWidth;
      img.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
      img.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
      requestAnimationFrame(() => setPhase("open"));
    };
    if (img.complete && img.naturalWidth > 0) {
      apply();
    } else {
      // Картинка ещё грузится — ждём, иначе getBoundingClientRect даст
      // 0×0 и анимация сорвётся.
      const onLoad = () => {
        img.removeEventListener("load", onLoad);
        apply();
      };
      img.addEventListener("load", onLoad);
      // Запасной таймаут на случай, если картинка кешированная и
      // load уже отстрелил между маунтом и addEventListener.
      const t = setTimeout(apply, 50);
      return () => { img.removeEventListener("load", onLoad); clearTimeout(t); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    const img = imageRef.current;
    if (!img || !startRect) {
      setPhase("closing");
      setTimeout(onClose, 240);
      return;
    }
    // Обратная FLIP: считаем текущую позицию картинки, целевая — thumb.
    const final = img.getBoundingClientRect();
    const dx = startRect.left - final.left;
    const dy = startRect.top - final.top;
    const sx = startRect.width / Math.max(final.width, 1);
    const sy = startRect.height / Math.max(final.height, 1);
    img.style.transformOrigin = "top left";
    img.style.transition = "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)";
    img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    setPhase("closing");
    setTimeout(onClose, 280);
  }, [phase, onClose, startRect]);

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

  // Пин с защитой от race condition. Каждый вызов получает новую версию;
  // при возврате с сети применяем ответ, только если версия не устарела.
  // Это решает баг «при быстрых нажатиях пин ломается» — даже если
  // ответы приходят не в том порядке, оптимистичный стейт остаётся
  // консистентным.
  const handlePin = async () => {
    const myVersion = ++reqVersion.current;
    const wasPinned = post.user_liked;
    const prevCount = post.likes_count;
    const newPinned = !wasPinned;

    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    onPinToggle(post.id, newPinned, wasPinned ? prevCount - 1 : prevCount + 1);

    try {
      const result = await togglePostLike(post.id, userId);
      if (myVersion === reqVersion.current) {
        onPinToggle(post.id, result.liked, result.likes_count);
      }
    } catch {
      if (myVersion === reqVersion.current) {
        onPinToggle(post.id, wasPinned, prevCount);
      }
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
    if (dragDirection.current === "vertical" && dy > 0 && (sheetRef.current?.scrollTop ?? 0) <= 0) {
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

    if (dir === "horizontal" && Math.abs(dx) > 60 && images.length > 1) {
      setCurrentIdx((prev) => {
        if (dx < 0) return Math.min(images.length - 1, prev + 1);
        return Math.max(0, prev - 1);
      });
    }
    if (dir === "vertical" && dy > 100 && (sheetRef.current?.scrollTop ?? 0) <= 0) {
      requestClose();
    } else {
      setDragY(0);
    }
  };

  // Для closing — sheet/backdrop тоже фейдятся вместе с обратной FLIP.
  const backdropOpacity = phase === "closing" ? 0 : (phase === "open" ? Math.max(0.3, 1 - dragY / 500) : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        ...expandedStyles.root,
        background: `rgba(var(--bg-rgb), ${0.98 * backdropOpacity})`,
        pointerEvents: phase === "closing" ? "none" : "auto",
        transition: "background 280ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          ...expandedStyles.sheet,
          transform: `translate3d(0, ${dragY}px, 0)`,
          opacity: phase === "closing" ? 0 : (phase === "open" ? 1 : 0),
          transition: phase === "open"
            ? (dragY === 0 ? "opacity 320ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)" : "none")
            : "opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          // На фазе opening/closing UI-элементы (кроме картинки) скрыты,
          // чтобы не перекрывать FLIP-анимацию.
          visibility: phase === "opening" ? "hidden" : "visible",
        }}
      >
        <button
          type="button"
          onClick={requestClose}
          style={expandedStyles.backBtn}
          aria-label="Назад"
        >
          <BackArrowIcon size={20} />
        </button>

        <div style={expandedStyles.imageArea}>
          <img
            ref={imageRef}
            key={currentIdx}
            src={images[currentIdx] ?? startSrc}
            alt=""
            style={expandedStyles.image}
            draggable={false}
          />
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

        {/* Action row: голые иконки, без круглых кнопок-бэкграундов.
            Пин в активном состоянии — заполненный в accent. */}
        <div style={expandedStyles.actionsRow}>
          <button
            type="button"
            onClick={handlePin}
            style={{
              ...expandedStyles.iconBtn,
              color: post.user_liked ? "var(--accent)" : "var(--text)",
            }}
            aria-pressed={post.user_liked}
            aria-label={post.user_liked ? t(lang, "postPinned") : t(lang, "postPin")}
          >
            <PinIcon filled={post.user_liked} size={28} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            style={{ ...expandedStyles.iconBtn, marginLeft: "auto" }}
            aria-label={t(lang, "postShare")}
          >
            <ShareIcon size={26} />
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

      {/* Floating image для FLIP — вынесен поверх sheet, чтобы анимация
          не перекрывалась загрузкой / paint-ом sheet содержимого.
          Видим только во время opening/closing — потом скрыт. */}
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
    const startParam = `post_${post.id}`;

    let shareUrl: string;
    if (bot) {
      shareUrl = `https://t.me/${bot}?start=${encodeURIComponent(startParam)}`;
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
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    switchTab(tab === "all" ? "liked" : "all");
  }, [tab, switchTab]);

  return (
    <div style={pageStyles.wrap} className="zen-inspire-page">
      {/* Welcome bubble — компактный, всегда сверху */}
      <div style={pageStyles.headerArea}>
        <div style={pageStyles.bubbleRow}>
          <div style={pageStyles.avatar}>R</div>
          <div style={pageStyles.bubbleMain}>
            <div style={pageStyles.bubbleTitle}>{t(lang, "postsInspireTitle")}</div>
            <div style={pageStyles.bubbleSubtitle}>{t(lang, "postsInspireSubtitle")}</div>
          </div>
        </div>
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
    width: "100%",
    padding: "8px 0 calc(96px + env(safe-area-inset-bottom, 0px))",
  },
  headerArea: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    marginBottom: 10,
    padding: "0 8px",
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
  },
  sheet: {
    position: "relative" as const,
    width: "100%",
    height: "100%",
    background: "var(--bg)",
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
    willChange: "transform, opacity",
    display: "flex",
    flexDirection: "column" as const,
    overscrollBehavior: "contain" as const,
  },
  backBtn: {
    position: "fixed" as const,
    top: "calc(env(safe-area-inset-top, 0px) + 12px)",
    left: 12,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(var(--bg-rgb), 0.78)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.22)",
  },
  imageArea: {
    position: "relative" as const,
    width: "100%",
    background: "rgba(0,0,0,0.04)",
    flex: "0 0 auto",
  },
  image: {
    width: "100%",
    height: "auto",
    display: "block",
    objectFit: "contain" as const,
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
    willChange: "transform",
  },
  dotsRow: {
    position: "absolute" as const,
    bottom: 14,
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
    background: "rgba(255,255,255,0.55)",
    transition: "background 0.15s ease, width 0.15s ease",
  },
  dotActive: {
    background: "#fff",
    width: 18,
    borderRadius: 3,
  },
  // Action row: голые иконки без круглых кнопок-фонов.
  actionsRow: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 20px 6px",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    padding: 6,
    margin: -6,
    color: "var(--text)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
    transition: "color 0.15s ease, transform 0.08s ease",
  },
  captionWrap: {
    flex: "0 0 auto",
    padding: "8px 20px 4px",
  },
  caption: {
    fontSize: 14.5,
    color: "var(--text)",
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: "pre-wrap" as const,
  },
  productCtaWrap: {
    flex: "0 0 auto",
    padding: "10px 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
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
