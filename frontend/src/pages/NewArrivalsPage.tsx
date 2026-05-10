import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  getPosts,
  getRelatedPosts,
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

// Микрокэш постов в localStorage.
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

// Кэш aspect-ratio по URL картинки — нужно чтобы при первом рендере
// плитки сразу знали свою высоту, и масонри-сетка не «дёргала» соседей
// когда фото подгружаются. Запоминаем в localStorage, чтобы при втором
// заходе вообще не было shift-а.
const ASPECT_CACHE_KEY = "raw_cache_v1:post_aspects";
type AspectCache = Record<string, number>;
let aspectCacheMem: AspectCache | null = null;
function loadAspectCache(): AspectCache {
  if (aspectCacheMem) return aspectCacheMem;
  if (typeof window === "undefined") { aspectCacheMem = {}; return aspectCacheMem; }
  try {
    const raw = window.localStorage.getItem(ASPECT_CACHE_KEY);
    aspectCacheMem = raw ? (JSON.parse(raw) as AspectCache) : {};
  } catch {
    aspectCacheMem = {};
  }
  return aspectCacheMem!;
}
function persistAspectCache() {
  if (typeof window === "undefined" || !aspectCacheMem) return;
  try { window.localStorage.setItem(ASPECT_CACHE_KEY, JSON.stringify(aspectCacheMem)); } catch {}
}
function rememberAspect(url: string, ratio: number) {
  const c = loadAspectCache();
  c[url] = ratio;
  // Дебаунс записи через тики — чтобы не лупить localStorage на каждом
  // onLoad. Простой setTimeout-долбёжки достаточно.
  persistAspectScheduled();
}
let persistTimer: number | null = null;
function persistAspectScheduled() {
  if (typeof window === "undefined") return;
  if (persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistAspectCache();
    persistTimer = null;
  }, 500);
}

// ── Иконки ──────────────────────────────────────────────────────────

function PinIcon({ active = false, size = 26 }: { active?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 3H8l1.5 1.5V11l-2 2v1.5h9V13l-2-2V4.5L16 3Z" />
      <line x1="12" y1="14.5" x2="12" y2="21" />
    </svg>
  );
}

function ShareIcon({ size = 22 }: { size?: number }) {
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

  // Берём cached aspect-ratio для текущей картинки, чтобы placeholder
  // имел правильную высоту с первого рендера. Если кэша нет — дефолт 3:4.
  const cachedAspect = (() => {
    const cur = images[currentIdx];
    if (!cur) return null;
    const c = loadAspectCache();
    return c[cur] ?? null;
  })();
  const [liveAspect, setLiveAspect] = useState<number | null>(cachedAspect);

  // При смене currentIdx (мульти-фото) обновляем aspect из кэша.
  useEffect(() => {
    const cur = images[currentIdx];
    if (!cur) return;
    const c = loadAspectCache();
    if (c[cur] && c[cur] !== liveAspect) setLiveAspect(c[cur]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  if (images.length === 0) return null;

  const handleClick = () => {
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

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    rememberAspect(images[currentIdx], ratio);
    if (Math.abs((liveAspect ?? 0) - ratio) > 0.01) {
      setLiveAspect(ratio);
    }
  };

  // Поставлю aspect-ratio через CSS — браузер сам резервирует высоту
  // под картинку до её загрузки, и сетка не дёргается.
  const aspectStyle = liveAspect ? { aspectRatio: `${liveAspect}` } : { aspectRatio: "3 / 4" };

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
      <div style={{ ...cardStyles.imageWrap, ...aspectStyle }}>
        <img
          ref={imgRef}
          key={currentIdx}
          src={images[currentIdx]}
          alt=""
          loading="lazy"
          onLoad={handleImgLoad}
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

// ── Expanded fullscreen view (FLIP, scrollable, synced animations) ──

interface ExpandedViewProps {
  post: Post;
  startRect: DOMRect | null;
  startSrc: string;
  startIndex: number;
  userId: string;
  lang: Lang;
  /** Если true — на закрытии используем простой fade без FLIP (для back-nav
   *  в стеке: открыли related → возвращаемся к предыдущему посту, у которого
   *  thumb уже не виден на экране). */
  fadeOnClose: boolean;
  /** True если этот ExpandedView появляется в результате back-nav из
   *  стека (юзер закрыл related → возвращается к предыдущему посту).
   *  Тогда incoming-анимация — zoom-in fade, без FLIP. */
  isBackNav: boolean;
  initialScrollTop?: number;
  /** related-посты приходят от parent (с кэшем по postId). Если уже
   *  закэшированы (back-nav), приходят сразу при mount — высота sheet-а
   *  корректная, scrollTop успешно восстанавливается без мигания
   *  «сверху → правильное место». */
  related: Post[];
  /** Вызывается СРАЗУ когда юзер тапает close — раньше чем стартует
   *  FLIP-close. Parent в ответ снимает body-class (если это финальное
   *  закрытие), чтобы фоновая страница начала un-zoom-иться параллельно
   *  с закрытием диалога, а не после. */
  onStartClose: () => void;
  onClose: () => void;
  onPinToggle: (postId: number, newPinned: boolean, newCount: number) => void;
  onShare: (post: Post) => void;
  onOpenRelated: (post: Post, thumbRect: DOMRect | null, src: string, photoIndex: number, currentScrollTop: number) => void;
}

// Считаем CSS для sheet в зависимости от фазы. Три enter-режима:
//   - flip: классический FLIP открытия, sheet просто фейдится 0→1 (картинка
//     внутри морфится из thumb-rect → fullscreen).
//   - zoom: back-nav incoming — sheet появляется со scale(1.04) + opacity 0
//     и плавно подтягивается к scale 1 + opacity 1. Аккуратный «всплыв»
//     предыдущего поста после закрытия related.
//   - fade: deep-link / без thumb-а — просто fade-in.
// Два exit-режима:
//   - !fadeOnClose (FLIP-close): sheet фейдится, картинка внутри морфится
//     обратно в thumb-rect (см. requestClose).
//   - fadeOnClose (back-nav out): sheet «уезжает вниз» translateY(60) +
//     opacity 0. Снизу появляется уже распакованный предыдущий expanded.
function computeSheetAnim({
  phase, dragY, fadeOnClose, enterAnim,
}: {
  phase: "opening" | "open" | "closing";
  dragY: number;
  fadeOnClose: boolean;
  enterAnim: "flip" | "zoom" | "fade";
}): React.CSSProperties {
  // Тайминги. Main open/close = 460ms (плавно).
  // Back-nav: close 220ms с заметным scale-down + slide (выглядит как
  // «фотография уезжает в стопку»), open 180ms быстрый fade-in.
  // Суммарно back-nav ≈400ms — субъективно snappy.
  if (phase === "open") {
    const isZoom = enterAnim === "zoom";
    const dur = isZoom ? 180 : 460;
    return {
      opacity: 1,
      transform: `translate3d(0, ${dragY}px, 0) scale(1)`,
      transition: dragY === 0
        ? `opacity ${dur}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${dur}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : "none",
    };
  }
  if (phase === "opening") {
    // Back-nav incoming: scale 0.96 «всплыв» снизу — эстетически
    // зеркалит squeeze close (scale 0.88 уезжает → scale 0.96 приходит).
    if (enterAnim === "zoom") {
      return { opacity: 0, transform: "translate3d(0, 0, 0) scale(0.96)", transition: "none" };
    }
    return { opacity: 0, transform: "translate3d(0, 0, 0) scale(1)", transition: "none" };
  }
  // phase = closing
  if (fadeOnClose) {
    // Back-nav close — выраженный «squeeze»: scale 0.88 + translateY 60
    // + opacity 0. Картинка заметно сжимается и уезжает вниз —
    // визуально «красиво» и явно отделено от просто fade-out.
    return {
      opacity: 0,
      transform: "translate3d(0, 60px, 0) scale(0.88)",
      transition: "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
    };
  }
  return {
    opacity: 0,
    transform: `translate3d(0, ${dragY}px, 0) scale(1)`,
    transition: "opacity 460ms cubic-bezier(0.22, 1, 0.36, 1)",
  };
}

function ExpandedView({
  post, startRect, startSrc, startIndex, userId, lang,
  fadeOnClose, isBackNav, initialScrollTop, related,
  onStartClose, onClose, onPinToggle, onShare, onOpenRelated,
}: ExpandedViewProps) {
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

  // Флаг: успешно ли восстановили scrollTop. После того как related-сетка
  // загрузилась и DOM рендерит её полную высоту, можно скроллить — иначе
  // sheet.scrollTop = X обрезается до 0 (нет ещё нужной высоты контента).
  const scrollRestoredRef = useRef(false);
  useLayoutEffect(() => {
    if (scrollRestoredRef.current) return;
    if (!initialScrollTop || !sheetRef.current) return;
    const sheet = sheetRef.current;
    const maxScroll = sheet.scrollHeight - sheet.clientHeight;
    if (maxScroll >= initialScrollTop) {
      sheet.scrollTop = initialScrollTop;
      scrollRestoredRef.current = true;
    }
    // Если контент ещё не дорос — useLayoutEffect перезапустится при
    // следующем изменении related (deps), и попробует снова.
  }, [related, initialScrollTop]);

  const reqVersion = useRef(0);

  // FLIP-open: при наличии thumb-rect картинка стартует в его координатах,
  // CSS-transition плавно переносит её в финальные размеры.
  useLayoutEffect(() => {
    const img = imageRef.current;
    if (!img || !startRect) {
      // Один RAF: рендер с phase=opening успевает paint, потом сразу
      // меняем на open и CSS-transition стартует. Два RAF добавляли
      // ~16мс задержки, которая для back-nav была ощутима как «лаг».
      requestAnimationFrame(() => setPhase("open"));
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
      void img.offsetWidth;
      img.style.transition = "transform 460ms cubic-bezier(0.22, 1, 0.36, 1)";
      img.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
      setPhase("open");
    };
    if (img.complete && img.naturalWidth > 0) {
      apply();
    } else {
      const onLoad = () => {
        img.removeEventListener("load", onLoad);
        apply();
      };
      img.addEventListener("load", onLoad);
      const t = setTimeout(apply, 60);
      return () => { img.removeEventListener("load", onLoad); clearTimeout(t); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // body-class теперь управляется в parent (NewArrivalsPage) — это
  // позволяет избежать мерцания при back-nav через стек, когда ExpandedView
  // быстро unmount-mount с новым ключом. scrollTop восстанавливаем ниже,
  // после загрузки related-сетки.

  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    // Сигналим parent-у: parent при финальном закрытии (стек пуст) снимет
    // body-class СРАЗУ → фон-страница начнёт расправляться параллельно с
    // FLIP-close, а не после.
    onStartClose();

    const img = imageRef.current;
    if (img && startRect && !fadeOnClose) {
      // FLIP-close: картинка плавно возвращается в координаты thumb-а.
      // Используем только при финальном закрытии (стек пуст) — на back-nav
      // используется slide-down + fade у sheet-а (см. ниже).
      const final = img.getBoundingClientRect();
      const dx = startRect.left - final.left;
      const dy = startRect.top - final.top;
      const sx = startRect.width / Math.max(final.width, 1);
      const sy = startRect.height / Math.max(final.height, 1);
      img.style.transformOrigin = "top left";
      img.style.transition = "transform 460ms cubic-bezier(0.4, 0, 0.2, 1)";
      img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    }
    setPhase("closing");
    // Main FLIP-close 460ms, back-nav squeeze 220ms.
    setTimeout(onClose, fadeOnClose ? 220 : 460);
  }, [phase, onClose, onStartClose, startRect, fadeOnClose]);

  useEffect(() => {
    // body.overflow управляется в parent (NewArrivalsPage) — здесь только
    // обработчик Esc для закрытия диалога.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose]);

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

  const backdropOpacity = phase === "closing" ? 0 : (phase === "open" ? Math.max(0.3, 1 - dragY / 500) : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        ...expandedStyles.root,
        background: `rgba(var(--bg-rgb), ${0.98 * backdropOpacity})`,
        pointerEvents: phase === "closing" ? "none" : "auto",
        transition: "background 460ms cubic-bezier(0.4, 0, 0.2, 1)",
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
          ...computeSheetAnim({ phase, dragY, fadeOnClose, enterAnim: startRect ? "flip" : (isBackNav ? "zoom" : "fade") }),
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
            loading="eager"
            decoding="sync"
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
            <PinIcon active={post.user_liked} size={28} />
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

        {/* Related grid: тот же масонри-сетка что и на главной, без заголовка. */}
        {related.length > 0 && (
          <div style={expandedStyles.relatedWrap}>
            <PinMasonry
              items={related.map((rp) => (
                <MasonryCard
                  key={rp.id}
                  post={rp}
                  onOpen={(p, rect, src, idx) => onOpenRelated(p, rect, src, idx, sheetRef.current?.scrollTop ?? 0)}
                />
              ))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 2-колоночный масонри-grid. Распределяем элементы по индексам:
// чётные → левая колонка, нечётные → правая. Это даёт ВЫРОВНЕННЫЙ
// первый ряд (карточки 0 и 1 на одной Y-линии), что не гарантировал
// предыдущий CSS-columns layout.
function PinMasonry({ items }: { items: React.ReactNode[] }) {
  const left: React.ReactNode[] = [];
  const right: React.ReactNode[] = [];
  items.forEach((it, i) => (i % 2 === 0 ? left : right).push(it));
  return (
    <div className="zen-pin-grid">
      <div className="zen-pin-col">{left}</div>
      <div className="zen-pin-col">{right}</div>
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

interface ExpandedItem {
  post: Post;
  rect: DOMRect | null;
  src: string;
  index: number;
  /** Позиция скролла внутри expanded sheet, чтобы восстановить при
   *  возврате через стек. */
  scrollTop?: number;
  /** True если этот item открывается как back-nav из стека (а не вперёд).
   *  Влияет только на incoming-анимацию sheet-а: zoom вместо fade. */
  isBackNav?: boolean;
}

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

  // Текущий открытый пост + стек предыдущих (для back-навигации по
  // related-цепочке). Тап на related ПИХАЕТ текущий в стек и заменяет
  // expanded на новый. Тап на close из expanded: если стек не пуст —
  // ПОПАЕТ предыдущий, иначе закрывает всё.
  const [expanded, setExpanded] = useState<ExpandedItem | null>(null);
  const [stack, setStack] = useState<ExpandedItem[]>([]);
  // Кэш related-постов по id поста. Когда юзер закрывает related-пост и
  // возвращается к предыдущему через стек — related для него уже здесь
  // (фетчили при первом открытии), и ExpandedView мгновенно рендерится
  // с правильной высотой → scrollTop восстанавливается без мигания
  // «сверху → правильное место».
  const [relatedMap, setRelatedMap] = useState<Record<number, Post[]>>({});

  const scrollMemory = useRef<Record<FilterTab, number>>({ all: 0, liked: 0 });

  // Префетч related для текущего expanded (если ещё не в кэше).
  useEffect(() => {
    if (!expanded) return;
    if (relatedMap[expanded.post.id]) return;
    let cancelled = false;
    getRelatedPosts(expanded.post.id, userId).then((r) => {
      if (cancelled) return;
      setRelatedMap((m) => ({ ...m, [expanded.post.id]: r }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [expanded, userId, relatedMap]);

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
    setStack([]);
    onInitialPostHandled?.();
  }, [initialPostId, posts, onInitialPostHandled]);

  // Body-class + overflow управляем ОТСЮДА (parent), а не из ExpandedView.
  // Так при back-nav через стек (когда expanded быстро меняется на
  // предыдущий, не становясь null) фоновая страница НЕ мигает между
  // scale(0.94) и scale(1) — класс не снимается ни на миг.
  useEffect(() => {
    if (expanded) {
      document.body.classList.add("zen-inspire-overlay-on");
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.classList.remove("zen-inspire-overlay-on");
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [expanded === null]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // И в стеке тоже синхронизируем — на случай, если юзер вернётся
      // к предыдущему посту, чтобы он отражал актуальное состояние пина.
      setStack((prev) =>
        prev.map((it) =>
          it.post.id === postId
            ? { ...it, post: { ...it.post, user_liked: newPinned, likes_count: newCount } }
            : it
        )
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

  const openInitial = useCallback((post: Post, rect: DOMRect | null, src: string, index: number) => {
    // Чистый «первый» open — стек обнуляем.
    setStack([]);
    setExpanded({ post, rect, src, index });
  }, []);

  const openRelated = useCallback((post: Post, rect: DOMRect | null, src: string, index: number, currentScrollTop: number) => {
    // Текущий expanded уходит в стек ВМЕСТЕ с его scrollTop — чтобы при
    // возврате через стек юзер оказался на том же месте, а не сверху.
    setStack((prev) => (expanded ? [...prev, { ...expanded, scrollTop: currentScrollTop }] : prev));
    setExpanded({ post, rect, src, index });
  }, [expanded]);

  // Callback из ExpandedView в момент тапа close — раньше чем стартует
  // FLIP-close-анимация. Снимаем body-class СРАЗУ при финальном закрытии
  // (стек пуст), чтобы фон-страница начала расправляться параллельно с
  // диалогом. Для back-nav (стек не пуст) ничего не делаем — класс
  // должен оставаться, потому что предыдущий expanded сейчас покажется.
  const handleStartClose = useCallback(() => {
    if (stack.length === 0) {
      document.body.classList.remove("zen-inspire-overlay-on");
    }
  }, [stack.length]);

  const closeExpanded = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) {
        // Финальное закрытие — снимаем expanded.
        setExpanded(null);
        return prev;
      }
      // Back-nav — попаем последний.
      const next = prev.slice(0, -1);
      const last = prev[prev.length - 1];
      // rect=null чтобы новый expanded НЕ пытался сделать FLIP из
      // мёртвого related-thumb-а. isBackNav=true → красивая zoom-in
      // анимация sheet-а. scrollTop сохранён в push-момент.
      setExpanded({ ...last, rect: null, isBackNav: true });
      return next;
    });
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

  // FAB и ExpandedView — портируем в document.body, чтобы они не были
  // потомками .zen-inspire-page (на котором transform-родитель создаёт
  // containing-block для position: fixed). Без этого FAB прилипал к
  // странице, а sheet внутри expanded ловил неправильную scrollTop.
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  const fabNode = (!loading && posts.length > 0) ? (
    <button
      type="button"
      onClick={toggleViaFab}
      className="zen-pin-fab"
      aria-label={tab === "all" ? t(lang, "postsFabPinned") : t(lang, "postsFabAll")}
      title={tab === "all" ? t(lang, "postsFabPinned") : t(lang, "postsFabAll")}
      style={{
        ...pageStyles.fab,
        background: "var(--surface)",
        color: tab === "liked" ? "var(--accent)" : "var(--text)",
        borderColor: tab === "liked" ? "var(--accent)" : "var(--border)",
      }}
    >
      <PinIcon active={tab === "liked"} size={22} />
      {tab === "liked" && pinnedCount > 0 && (
        <span style={pageStyles.fabBadge}>{pinnedCount}</span>
      )}
    </button>
  ) : null;

  return (
    <div style={pageStyles.wrap} className="zen-inspire-page">
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
        <PinMasonry
          items={[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} index={i} />)}
        />
      )}

      {!loading && tab === "liked" && visiblePosts.length === 0 && (
        <div style={pageStyles.empty}>
          <p style={pageStyles.emptyTitle}>{t(lang, "postsLikedEmpty")}</p>
          <p style={pageStyles.emptyHint}>{t(lang, "postsLikedEmptyHint")}</p>
        </div>
      )}

      {!loading && visiblePosts.length > 0 && (
        <PinMasonry
          items={visiblePosts.map((post) => (
            <MasonryCard
              key={post.id}
              post={post}
              onOpen={openInitial}
            />
          ))}
        />
      )}

      {portalTarget && fabNode && createPortal(fabNode, portalTarget)}

      {portalTarget && expanded && createPortal(
        <ExpandedView
          key={expanded.post.id + ":" + stack.length}
          post={expanded.post}
          startRect={expanded.rect}
          startSrc={expanded.src}
          startIndex={expanded.index}
          userId={userId}
          lang={lang}
          fadeOnClose={stack.length > 0}
          isBackNav={!!expanded.isBackNav}
          related={relatedMap[expanded.post.id] ?? []}
          onStartClose={handleStartClose}
          initialScrollTop={expanded.scrollTop}
          onClose={closeExpanded}
          onPinToggle={handlePinToggle}
          onShare={handleShare}
          onOpenRelated={openRelated}
        />,
        portalTarget
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
    border: "1.5px solid var(--border)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.12)",
    zIndex: 900,
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
    transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.1s ease",
  },
  fabBadge: {
    position: "absolute" as const,
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 999,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid var(--bg)",
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
  // ВАЖНО: aspect-ratio задаётся inline в MasonryCard через aspectStyle,
  // тут только базовые свойства.
  imageWrap: {
    position: "relative" as const,
    width: "100%",
    overflow: "hidden",
    borderRadius: 12,
    background: "rgba(0,0,0,0.04)",
  },
  // Картинка тянется на весь wrap; так как у wrap зафиксирован
  // aspect-ratio, высота резервируется до загрузки картинки.
  image: {
    width: "100%",
    height: "100%",
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
  // Картинка живёт внутри подложки с safe-area-top и padding по бокам.
  // Сама картинка скруглена — выглядит как полноразмерная Pinterest-карточка,
  // а не «застрявший на весь экран full-bleed». Места под back-кнопку
  // даём через padding-top.
  imageArea: {
    position: "relative" as const,
    width: "100%",
    flex: "0 0 auto",
    padding: "calc(env(safe-area-inset-top, 0px) + 64px) 12px 0",
  },
  image: {
    width: "100%",
    height: "auto",
    display: "block",
    objectFit: "contain" as const,
    borderRadius: 18,
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
    // box-shadow убран — он вызывал per-frame repaint при FLIP-трансформации
    // и анимация дёргалась. Image-only с border-radius уже выглядит как
    // полноценная карточка, тень избыточна.
    // will-change подсказывает браузеру композитить картинку на GPU-слое
    // → плавная анимация transform без перерасчётов на CPU.
    willChange: "transform",
    imageRendering: "auto" as const,
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
    padding: "10px 20px 18px",
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
  // Related-сетка снизу: padding-bottom большой, чтобы последние плитки
  // не упирались в край экрана. + бордер сверху для визуального разделения.
  relatedWrap: {
    flex: "0 0 auto",
    padding: "24px 4px calc(env(safe-area-inset-bottom, 0px) + 80px)",
    marginTop: 8,
  },
};
