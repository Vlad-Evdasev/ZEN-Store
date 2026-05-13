import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  getPosts,
  getRelatedPosts,
  togglePostLike,
  type Post,
} from "../api";
import { useSettings, type Lang } from "../context/SettingsContext";
import { usePostImageIdx, setPostImageIdx } from "../lib/imageIndexStore";
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
  /** Если true — thumb-картинка прячется через visibility (но место в
   *  сетке остаётся). Используется когда этот пост сейчас в полёте:
   *  открыт в ExpandedView, либо в outgoing-слое (FLIP-возврат в thumb).
   *  Без этого зритель видит «двойник» — летящую картинку И статичный
   *  thumb на её месте. */
  isHidden?: boolean;
}

function MasonryCard({ post, onOpen, isHidden = false }: MasonryCardProps) {
  const images = getPostImages(post);
  const isMulti = images.length > 1;
  // Индекс шарится через imageIndexStore с ExpandedView — при закрытии
  // FLIP-back лендится в thumb с правильной (swiped-to) картинкой.
  const currentIdx = usePostImageIdx(post.id);
  const safeIdx = Math.min(currentIdx, Math.max(images.length - 1, 0));
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchMoveDx = useRef(0);

  // Aspect-ratio берём ТОЛЬКО по первой картинке поста — все остальные
  // отображаются в том же боксе, чтобы при свайпе высота карточки не
  // прыгала.
  const firstImage = images[0];
  const cachedFirstAspect = (() => {
    if (!firstImage) return null;
    const c = loadAspectCache();
    return c[firstImage] ?? null;
  })();
  const [liveAspect, setLiveAspect] = useState<number | null>(cachedFirstAspect);

  if (images.length === 0) return null;

  const handleClick = () => {
    // На iOS click срабатывает ПОСЛЕ blur input (если был тап-вне).
    // Проверяем activeElement И timestamp последнего blur'а (см.
    // focusout-listener в App.tsx) — если input был в фокусе или
    // только что blur'нулся (<250ms), НЕ открываем пост.
    const lastBlur = (window as unknown as { __zenLastInputBlur?: number }).__zenLastInputBlur ?? 0;
    const active = document.activeElement;
    const inputFocused = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (inputFocused) {
      (active as HTMLElement).blur();
      return;
    }
    if (Date.now() - lastBlur < 250) return;
    const rect = imgRef.current?.getBoundingClientRect()
      ?? ref.current?.getBoundingClientRect()
      ?? null;
    onOpen(post, rect, images[safeIdx], safeIdx);
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
  // Круговое переключение.
  const cycle = (delta: 1 | -1) => (safeIdx + delta + images.length) % images.length;
  const onTouchEnd = () => {
    if (!isMulti || touchStartX.current === null) {
      touchStartX.current = null;
      return;
    }
    const dx = touchMoveDx.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) {
      setPostImageIdx(post.id, cycle(dx < 0 ? 1 : -1));
    }
  };
  // Horizontal trackpad swipe (на ноутбуках). Lock 400ms.
  const wheelLockedRef = useRef(false);
  const onWheel = (e: React.WheelEvent) => {
    if (!isMulti) return;
    if (wheelLockedRef.current) return;
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    if (ax <= ay || ax < 18) return;
    setPostImageIdx(post.id, cycle(e.deltaX > 0 ? 1 : -1));
    wheelLockedRef.current = true;
    window.setTimeout(() => { wheelLockedRef.current = false; }, 400);
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
    rememberAspect(images[safeIdx], ratio);
    // Aspect фиксируем ТОЛЬКО по первой картинке — все остальные
    // показываются в том же боксе.
    if (safeIdx === 0 && Math.abs((liveAspect ?? 0) - ratio) > 0.01) {
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
      onWheel={onWheel}
      className="zen-pin-card"
      style={cardStyles.card}
    >
      <div style={{ ...cardStyles.imageWrap, ...aspectStyle }}>
        <img
          ref={imgRef}
          key={safeIdx}
          src={images[safeIdx]}
          alt=""
          loading="lazy"
          onLoad={handleImgLoad}
          style={{ ...cardStyles.image, visibility: isHidden ? "hidden" : "visible" }}
        />
        {isMulti && (
          <div style={cardStyles.dotsRow} aria-hidden>
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  ...cardStyles.dot,
                  ...(i === safeIdx ? cardStyles.dotActive : null),
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
  /** Если true — компонент монтируется в phase=open (мгновенно видимый,
   *  без opening-анимации) и затем СРАЗУ начинает close-анимацию.
   *  Используется для outgoing-слоя при back-nav: предыдущий пост уже
   *  смонтирован «под низом» в open-state, а текущий рендерится сверху
   *  с автоматическим закрытием → юзер видит выезд current и СРАЗУ
   *  готовый previous под ним, без задержки. */
  forceClose?: boolean;
  /** Если true — компонент рендерится как «forward-outgoing» слой:
   *  previous expanded, который при открытии related должен анимироваться
   *  scale-up + fade-out (расталкивается и уходит). 520ms спустя
   *  размонтируется через onClose. */
  forwardOut?: boolean;
  /** related-посты приходят от parent (с кэшем по postId). Если уже
   *  закэшированы (back-nav), приходят сразу при mount — высота sheet-а
   *  корректная, scrollTop успешно восстанавливается без мигания
   *  «сверху → правильное место». */
  related: Post[];
  /** True пока parent ждёт ответ getRelatedPosts (нет записи в relatedMap
   *  для этого post.id). Используется чтобы рисовать skeleton-сетку
   *  вместо пустого пространства — иначе юзер видит «нет рекомендаций»
   *  и не понимает, что данные ещё в пути. */
  relatedLoading: boolean;
  /** id постов, чьи thumb-картинки должны быть скрыты в related-сетке
   *  (потому что они сейчас в полёте: открыты в ExpandedView или
   *  анимируются обратно в outgoing-слое). Без этого зритель видит
   *  «двойник» — летящую карточку И thumb под ней. */
  hiddenIds?: Set<number>;
  /** Регистрирует функцию закрытия в parent. Parent рендерит общую
   *  back-кнопку и зовёт эту функцию при тапе. Только активный
   *  ExpandedView (не forceClose, не forwardOut) регистрируется. */
  registerClose?: (fn: (() => void) | null) => void;
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
  phase,
}: {
  phase: "opening" | "open" | "closing";
}): React.CSSProperties {
  // ВАЖНО: НЕ анимируем element.opacity — это сделает image внутри
  // sheet полупрозрачной (CSS opacity affects children). Вместо этого
  // анимируем background-color rgba alpha. Sheet element opacity всегда 1,
  // image остаётся opaque. Только sheet bg меняется (transparent →
  // var(--bg)), что создаёт «gradual dim» эффект: контент позади sheet
  // (header, main page) виден через transparent bg в начале → постепенно
  // скрывается под opaque bg к концу анимации open.
  if (phase === "open") {
    return {
      backgroundColor: "rgba(var(--bg-rgb), 1)",
      transform: "translate3d(0, 0, 0) scale(1)",
      transition: "background-color 520ms cubic-bezier(0.45, 0, 0.55, 1)",
    };
  }
  if (phase === "opening") {
    return {
      backgroundColor: "rgba(var(--bg-rgb), 0)",
      transform: "translate3d(0, 0, 0) scale(1)",
      transition: "none",
    };
  }
  // phase = closing (main close)
  return {
    backgroundColor: "rgba(var(--bg-rgb), 0)",
    transform: "translate3d(0, 0, 0) scale(1)",
    transition: "background-color 520ms cubic-bezier(0.45, 0, 0.55, 1)",
  };
}

function ExpandedView({
  post, startRect, startSrc, startIndex, userId, lang,
  fadeOnClose, isBackNav, initialScrollTop, forceClose, forwardOut, related, relatedLoading, hiddenIds, registerClose,
  onStartClose, onClose, onPinToggle, onShare, onOpenRelated,
}: ExpandedViewProps) {
  const images = getPostImages(post);
  // Шарим currentIdx через imageIndexStore с MasonryCard — при закрытии
  // FLIP-back лендится в thumb с правильной картинкой.
  const storeIdx = usePostImageIdx(post.id);
  const currentIdx = Math.min(storeIdx, Math.max(images.length - 1, 0));
  const setCurrentIdx = (next: number | ((prev: number) => number)) => {
    const value = typeof next === "function" ? (next as (p: number) => number)(currentIdx) : next;
    setPostImageIdx(post.id, value);
  };
  // На mount синхронизируем store с явным startIndex (если он отличается
  // от текущего сохранённого) — открытие пост через deep-link / share
  // должно начинаться с указанной картинки.
  useEffect(() => {
    const target = Math.min(startIndex, Math.max(images.length - 1, 0));
    if (target !== storeIdx) setPostImageIdx(post.id, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Aspect-ratio первой картинки — все остальные в посте показываются
  // в боксе первой (cover-crop). При свайпе высота не дёргается.
  // Если aspect ещё не в кэше — preload-им первую картинку через
  // new Image() и сохраняем aspect в state + cache.
  const firstImage = images[0];
  const cachedFirstAspect = firstImage ? (loadAspectCache()[firstImage] ?? null) : null;
  const [firstImageAspect, setFirstImageAspect] = useState<number | null>(cachedFirstAspect);
  useEffect(() => {
    if (firstImageAspect || !firstImage) return;
    const im = new window.Image();
    let cancelled = false;
    im.onload = () => {
      if (cancelled) return;
      if (im.naturalWidth && im.naturalHeight) {
        const r = im.naturalWidth / im.naturalHeight;
        rememberAspect(firstImage, r);
        setFirstImageAspect(r);
      }
    };
    im.src = firstImage;
    return () => { cancelled = true; };
  }, [firstImage, firstImageAspect]);
  // Initial phase:
  //  - forceClose: mounts visible (open), затем useEffect ниже сразу
  //    переключает на closing — outgoing-слой при back-nav.
  //  - forwardOut: previous expanded при открытии related. Mounts visible
  //    (open), CSS-класс zen-sheet-forward-out делает scale-up fade-out.
  //  - isBackNav: мгновенно видимый (open), без opening-fade — previous
  //    уже отрендерен под текущим, ждёт пока outgoing уедет.
  //  - default: opening (fade-in / FLIP до open).
  const [phase, setPhase] = useState<"opening" | "open" | "closing">(
    forceClose || forwardOut || isBackNav ? "open" : "opening"
  );
  // ContentReady — управляет видимостью НЕ-image частей (back button,
  // actions, caption, related). Image у нас «звезда» — анимируется FLIP-ом.
  // Всё остальное должно появляться ПОСЛЕ того как image открылся,
  // и пропадать СРАЗУ когда юзер закрывает (не fade-out с image).
  //  - forceClose (outgoing): false — только image видна, content скрыт
  //  - forwardOut: true — previous был полностью открыт, контент видим
  //    пока он расталкивается scale-up
  //  - isBackNav (previous возвращается): true — content уже был виден
  //  - main open: false initial, true после FLIP (520ms)
  const [contentReady, setContentReady] = useState<boolean>(
    forceClose ? false : (isBackNav || forwardOut || false)
  );
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchMoveDx = useRef(0);
  const touchMoveDy = useRef(0);
  const dragDirection = useRef<"horizontal" | "vertical" | null>(null);
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

  // Через 520ms после mount (когда FLIP-open анимация завершилась)
  // показываем не-image содержимое (back button, actions, caption,
  // related). Применяется только при «обычном» открытии — для outgoing,
  // forwardOut и back-nav оно либо ВСЕГДА false (outgoing), либо ВСЕГДА
  // true изначально (forwardOut/back-nav уже видели previous post).
  useEffect(() => {
    if (forceClose || isBackNav || forwardOut) return;
    const t = setTimeout(() => setContentReady(true), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // forwardOut: previous expanded при открытии related. 520ms anim
  // (CSS scale-up fade-out), затем onClose() размонтирует.
  useEffect(() => {
    if (!forwardOut) return;
    const t = setTimeout(() => onClose(), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // forceClose: outgoing-слой при back-nav. Image FLIP-возвращается в
  // startRect (thumb в related-сетке предыдущего поста), параллельно
  // sheet bg плавно fades to transparent (через CSS class
  // zen-sheet-force-close). По завершении 520ms onClose() размонтирует.
  // Под выезжающим уже виден previous expanded в phase=open.
  useLayoutEffect(() => {
    if (!forceClose) return;
    const img = imageRef.current;
    if (img && startRect) {
      const apply = () => {
        const final = img.getBoundingClientRect();
        if (final.width === 0 || final.height === 0) return;
        const dx = startRect.left - final.left;
        const dy = startRect.top - final.top;
        const sx = startRect.width / Math.max(final.width, 1);
        const sy = startRect.height / Math.max(final.height, 1);
        img.style.transformOrigin = "top left";
        img.style.transition = "transform 520ms cubic-bezier(0.45, 0, 0.55, 1)";
        img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      };
      if (img.complete && img.naturalWidth > 0) {
        apply();
      } else {
        const onLoad = () => { img.removeEventListener("load", onLoad); apply(); };
        img.addEventListener("load", onLoad);
        setTimeout(apply, 60);
      }
    }
    const t = setTimeout(() => onClose(), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FLIP-open: при наличии thumb-rect картинка стартует в его координатах,
  // CSS-transition плавно переносит её в финальные размеры.
  // Пропускаем эту логику если phase уже стартует в "open" (isBackNav,
  // forceClose, forwardOut) — там никакой opening-анимации не нужно.
  useLayoutEffect(() => {
    if (forceClose || isBackNav || forwardOut) return; // mount уже в phase=open
    const img = imageRef.current;
    if (!img || !startRect) {
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
      // ease-in-out 520ms — картинка плавно ускоряется в начале и
      // мягко тормозит в конце, как настоящий «приближение».
      img.style.transition = "transform 520ms cubic-bezier(0.45, 0, 0.55, 1)";
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
    onStartClose();
    // Прячем content МГНОВЕННО (back btn, description, related).
    // Видимой остаётся только image — она FLIP-анимируется обратно
    // в thumb-rect. Юзер видит «карточка-фото уезжает», без сопровождения.
    setContentReady(false);

    if (fadeOnClose) {
      // BACK-NAV: НЕ запускаем локальную close-анимацию. Иначе current
      // ExpandedView начинает фейдиться, через 220ms unmount-ится, а
      // outgoing-слой mount-ится с opacity 1 → юзер видит «скачок»
      // opacity от ~0.58 к 1.0. Вместо этого зовём onClose() сразу —
      // parent монтирует outgoing-слой с CSS keyframe-анимацией, и
      // переход current → outgoing неразличим (одинаковый контент).
      onClose();
      return;
    }

    // MAIN FINAL CLOSE (stack=0): FLIP-close с image-морфом обратно в
    // thumb-rect + sheet/backdrop fade-out 520ms ease-in-out.
    const img = imageRef.current;
    if (img && startRect) {
      const final = img.getBoundingClientRect();
      const dx = startRect.left - final.left;
      const dy = startRect.top - final.top;
      const sx = startRect.width / Math.max(final.width, 1);
      const sy = startRect.height / Math.max(final.height, 1);
      img.style.transformOrigin = "top left";
      img.style.transition = "transform 520ms cubic-bezier(0.45, 0, 0.55, 1)";
      img.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    }
    setPhase("closing");
    setTimeout(onClose, 520);
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

  // Регистрируем requestClose в parent (для общей back-кнопки).
  // Только активный ExpandedView — не outgoing (forceClose) и не
  // forwardOut. Эти не должны управлять back-кнопкой.
  useEffect(() => {
    if (forceClose || forwardOut || !registerClose) return;
    registerClose(requestClose);
    return () => registerClose(null);
  }, [registerClose, requestClose, forceClose, forwardOut]);

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
    // ВЕРТИКАЛЬНЫЙ pull-to-close отключён — пост закрывается ТОЛЬКО
    // по кнопке назад. Скролл выше начала контента — нормальный native
    // overscroll-bounce без сворачивания диалога.
  };
  const onTouchEnd = () => {
    const dx = touchMoveDx.current;
    const dir = dragDirection.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchMoveDx.current = 0;
    touchMoveDy.current = 0;
    dragDirection.current = null;

    // Только horizontal-swipe для переключения фоток в multi-image посте.
    // Vertical больше не закрывает диалог (см. onTouchMove выше).
    // Круговое переключение: с последней → первая, с первой → последняя.
    if (dir === "horizontal" && Math.abs(dx) > 60 && images.length > 1) {
      setCurrentIdx((prev) => (prev + (dx < 0 ? 1 : -1) + images.length) % images.length);
    }
  };
  // Horizontal trackpad swipe для desktop. Lock 400ms между переключениями.
  const wheelLockedRef = useRef(false);
  const onWheel = (e: React.WheelEvent) => {
    if (images.length <= 1) return;
    if (wheelLockedRef.current) return;
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    if (ax <= ay || ax < 18) return;
    setCurrentIdx((prev) => (prev + (e.deltaX > 0 ? 1 : -1) + images.length) % images.length);
    wheelLockedRef.current = true;
    window.setTimeout(() => { wheelLockedRef.current = false; }, 400);
  };

  // Backdrop теперь НЕ используется как дим-слой (это делает sheet bg).
  // Pull-to-close убран — backdrop просто 0 при opening/closing/forceClose,
  // 1 в open. Может быть удалён в дальнейшем рефакторинге.
  const backdropOpacity = forceClose
    ? 0
    : (phase === "opening" || phase === "closing")
      ? 0
      : 1;

  // Back-кнопка теперь рендерится в PARENT (NewArrivalsPage) — это
  // позволяет ей оставаться видимой ВО ВРЕМЯ навигации между постами
  // (forward к related или back через стек). Раньше каждый ExpandedView
  // имел свою back-кнопку, привязанную к contentReady, и при пере-
  // mount-е она пропадала на 520ms.

  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      style={{
        ...expandedStyles.root,
        background: `rgba(var(--bg-rgb), ${0.4 * backdropOpacity})`,
        pointerEvents: phase === "closing" ? "none" : "auto",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        // Три CSS-keyframe-варианта (бьют inline computeSheetAnim):
        //  - forceClose:                sheet bg fade-out (image отдельно JS-FLIP)
        //  - forwardOut:                scale 1→1.08 + opacity 1→0 (previous уходит)
        //  - isBackNav && phase!==closing: scale 1.08→1 + opacity 0→1
        //                               (previous возвращается)
        // Дефолт + isBackNav в closing: inline transition через
        // computeSheetAnim (обычный FLIP-close).
        className={
          forceClose ? "zen-sheet-force-close"
            : forwardOut ? "zen-sheet-forward-out"
            : (isBackNav && phase !== "closing") ? "zen-sheet-back-in"
            : undefined
        }
        style={
          (forceClose || forwardOut || (isBackNav && phase !== "closing"))
            ? expandedStyles.sheet
            : { ...expandedStyles.sheet, ...computeSheetAnim({ phase }) }
        }
      >
        {/* contentStyle: показываем не-image элементы ТОЛЬКО когда image
            полностью открылся (после FLIP). На close прячем мгновенно
            (transition: 0s) — содержимое не «уезжает» вместе с image.
            На open плавно появляются (220ms ease-out). */}
        {(() => {
          const contentStyle: React.CSSProperties = {
            opacity: contentReady ? 1 : 0,
            transition: contentReady
              ? "opacity 240ms cubic-bezier(0.4, 0, 0.2, 1)"
              : "opacity 0s",
            pointerEvents: contentReady ? "auto" : "none",
          };
          return (
            <>
              {/* Back-кнопка портируется в body отдельно — ниже после
                  закрытия sheet. Здесь не рендерим, чтобы она не
                  попадала в стек ExpandedView (z-index 1100) и не
                  оказалась под хедером (z-index 1300 при overlay). */}

              <div
                style={expandedStyles.imageArea}
                onWheel={onWheel}
              >
                <img
                  ref={imageRef}
                  key={currentIdx}
                  src={images[currentIdx] ?? startSrc}
                  alt=""
                  loading="eager"
                  decoding="sync"
                  style={{
                    ...expandedStyles.image,
                    // Все картинки в посте показываются в боксе первой
                    // (cover crop). Высота не «прыгает» при свайпе.
                    ...(firstImageAspect ? { aspectRatio: `${firstImageAspect}`, height: "auto", objectFit: "cover" as const } : null),
                  }}
                  draggable={false}
                />
                {images.length > 1 && (
                  <div style={{ ...expandedStyles.dotsRow, ...contentStyle }} aria-hidden>
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

              <div style={{ ...expandedStyles.actionsRow, ...contentStyle }}>
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
                <div style={{ ...expandedStyles.captionWrap, ...contentStyle }}>
                  <p style={expandedStyles.caption}>{post.caption}</p>
                </div>
              )}

              {post.product_url && (
                <div style={{ ...expandedStyles.productCtaWrap, ...contentStyle }}>
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

              {related.length > 0 ? (
                <div style={{ ...expandedStyles.relatedWrap, ...contentStyle }}>
                  <PinMasonry
                    items={related.map((rp) => (
                      <MasonryCard
                        key={rp.id}
                        post={rp}
                        isHidden={hiddenIds?.has(rp.id) ?? false}
                        onOpen={(p, rect, src, idx) => onOpenRelated(p, rect, src, idx, sheetRef.current?.scrollTop ?? 0)}
                      />
                    ))}
                  />
                </div>
              ) : relatedLoading ? (
                // Skeleton-сетка пока ждём ответ getRelatedPosts. Без неё
                // юзер видит чистое пустое пространство под caption-ом и
                // думает «рекомендаций нет, всё сломалось». 6 placeholder'ов
                // достаточно чтобы заполнить экран сразу после FLIP-open
                // и дать sheet-у нужную overflow-высоту для скролла.
                <div style={{ ...expandedStyles.relatedWrap, ...contentStyle }}>
                  <PinMasonry
                    items={Array.from({ length: 6 }, (_, i) => (
                      <SkeletonCard key={`sk-${i}`} index={i} />
                    ))}
                  />
                </div>
              ) : null}
            </>
          );
        })()}
      </div>
    </div>
    </>
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
  // Outgoing layer для back-nav: текущий пост рендерится поверх
  // previous-а (который уже мгновенно виден в phase=open), анимируется
  // close, потом размонтируется. Это убирает «задержку» появления
  // предыдущего поста — он виден с первого кадра, под выезжающим.
  const [outgoingItem, setOutgoingItem] = useState<ExpandedItem | null>(null);
  // Forward-outgoing layer: previous expanded когда юзер тапает related-
  // карточку. Сохраняем тот пост и рендерим в отдельном портале с
  // CSS-анимацией scale-up + fade-out (как .zen-app > main при первичном
  // открытии). 520ms потом размонтируется. Эффект «контент расталкивается
  // и уходит» симметричный главному page-open.
  const [forwardOutgoingItem, setForwardOutgoingItem] = useState<ExpandedItem | null>(null);
  // Common back-кнопка живёт на уровне NewArrivalsPage — это даёт
  // плавный «не пропадает» между переходами по постам (forward/back-
  // nav). Раньше каждый ExpandedView имел свою back-кнопку, привязанную
  // к contentReady, и при пере-mount-е она пропадала на 520ms.
  const closeRequestRef = useRef<(() => void) | null>(null);
  const [backBtnVisible, setBackBtnVisible] = useState(false);
  useEffect(() => {
    if (!expanded) {
      setBackBtnVisible(false);
      return;
    }
    // Первый раз показываем back-btn ПОСЛЕ FLIP-open (520ms).
    // Дальше — пока есть expanded, она остаётся видимой.
    if (!backBtnVisible) {
      const tm = setTimeout(() => setBackBtnVisible(true), 520);
      return () => clearTimeout(tm);
    }
    return undefined;
  }, [expanded, backBtnVisible]);
  // Кэш related-постов по id поста. Когда юзер закрывает related-пост и
  // возвращается к предыдущему через стек — related для него уже здесь
  // (фетчили при первом открытии), и ExpandedView мгновенно рендерится
  // с правильной высотой → scrollTop восстанавливается без мигания
  // «сверху → правильное место».
  const [relatedMap, setRelatedMap] = useState<Record<number, Post[]>>({});

  const scrollMemory = useRef<Record<FilterTab, number>>({ all: 0, liked: 0 });

  // Префетч related для текущего expanded (если ещё не в кэше).
  // НЕ отменяем in-flight запрос на close: иначе если юзер закрыл пост
  // раньше, чем сервер ответил (медленный cold-start, плохая сеть), результат
  // выкидывался и кэш для этого id оставался пустым — при повторном
  // открытии тапа related не было, и нужен был ещё один re-open чтобы
  // запустить fresh fetch. Теперь дожидаемся ответа и кладём в кэш всегда,
  // даже если карточка уже закрыта — повторный open получит related мгновенно.
  // setRelatedMap через функциональный апдейт, чтобы race двух параллельных
  // fetch'ей для одного id не затирал друг друга.
  useEffect(() => {
    if (!expanded) return;
    const postId = expanded.post.id;
    if (relatedMap[postId]) return;
    getRelatedPosts(postId, userId)
      .then((r) => setRelatedMap((m) => (m[postId] ? m : { ...m, [postId]: r })))
      .catch(() => {});
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
  //
  // ДВА КЛАССА с РАЗНЫМ ЖИЗНЕННЫМ ЦИКЛОМ:
  //  - zen-inspire-overlay-on: применяет dim + scale(1.08) к main-странице.
  //    Снимается СРАЗУ при клике close (через handleStartClose), чтобы
  //    main-страница начинала расправляться параллельно с close-анимацией.
  //  - zen-inspire-header-up: поднимает z-index хедера до 1300 (выше
  //    ExpandedView root 1100). Снимается ТОЛЬКО когда expanded
  //    становится null (после 520ms close-анимации). Это гарантирует
  //    что image при FLIP-close идёт ПОД хедером, а не наслаивается.
  useEffect(() => {
    if (expanded) {
      document.body.classList.add("zen-inspire-overlay-on");
      document.body.classList.add("zen-inspire-header-up");
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.classList.remove("zen-inspire-overlay-on");
        document.body.classList.remove("zen-inspire-header-up");
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
    // А также рендерится как forward-outgoing слой (scale-up + fade-out)
    // — чтобы юзер увидел эффект «расталкивания» карточек, аналогичный
    // главному page-open. Через 520ms forward-out размонтируется.
    if (expanded) {
      setForwardOutgoingItem({ ...expanded, scrollTop: currentScrollTop });
    }
    setStack((prev) => (expanded ? [...prev, { ...expanded, scrollTop: currentScrollTop }] : prev));
    setExpanded({ post, rect, src, index });
  }, [expanded]);

  // Callback из ExpandedView в момент тапа close — раньше чем стартует
  // FLIP-close-анимация. Снимаем ТОЛЬКО dim-класс (zen-inspire-overlay-on)
  // при финальном закрытии (стек пуст), чтобы фон-страница начала
  // расправляться параллельно с диалогом. Класс zen-inspire-header-up
  // НЕ снимаем — он должен жить до фактического unmount-а ExpandedView
  // (через useEffect cleanup), иначе image при FLIP-close на ~520ms
  // оказывается ВЫШЕ хедера (z-index хедера падает до 10 vs root 1100).
  // Для back-nav (стек не пуст) оба класса остаются — previous expanded
  // сейчас покажется.
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
      // Back-nav: текущий expanded уезжает в outgoing-слой (рендерится
      // поверх, ловит close-анимацию), previous становится новым
      // expanded ПРЯМО СЕЙЧАС — мгновенно видим под outgoing.
      // Сохраняем last.rect — он нужен для финального FLIP-close, когда
      // юзер потом закроет этот previous пост (он должен вернуться к
      // своему оригинальному thumb-rect в main-сетке).
      const next = prev.slice(0, -1);
      const last = prev[prev.length - 1];
      setOutgoingItem(expanded);
      setExpanded({ ...last, isBackNav: true });
      // Outgoing размонтируется сам через onClose (forceClose useEffect).
      return next;
    });
  }, [expanded]);

  const visiblePosts = useMemo(() => {
    if (tab === "liked") return posts.filter((p) => p.user_liked);
    return posts;
  }, [posts, tab]);

  // Set id-ов постов, которые сейчас в полёте (открытые / уезжающие).
  // Их thumb-картинки в сетках (main + related) скрываются на время
  // анимации, чтобы не было «двойника» рядом с летящей картинкой.
  const hiddenPostIds = useMemo(() => {
    const s = new Set<number>();
    if (expanded) s.add(expanded.post.id);
    if (outgoingItem) s.add(outgoingItem.post.id);
    if (forwardOutgoingItem) s.add(forwardOutgoingItem.post.id);
    return s;
  }, [expanded, outgoingItem, forwardOutgoingItem]);

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
              isHidden={hiddenPostIds.has(post.id)}
              onOpen={openInitial}
            />
          ))}
        />
      )}

      {portalTarget && fabNode && createPortal(fabNode, portalTarget)}

      {/* Forward-outgoing layer: previous expanded когда юзер тапает
          related-карточку. Рендерится ПОД main expanded (zIndex 1050 <
          1100), анимируется scale-up + fade-out (zen-sheet-forward-out
          CSS-класс). 520ms потом размонтируется. */}
      {portalTarget && forwardOutgoingItem && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1050, pointerEvents: "none" }}>
          <ExpandedView
            key={`forward-out:${forwardOutgoingItem.post.id}`}
            post={forwardOutgoingItem.post}
            startRect={null}
            startSrc={forwardOutgoingItem.src}
            startIndex={forwardOutgoingItem.index}
            userId={userId}
            lang={lang}
            fadeOnClose={false}
            isBackNav={false}
            forwardOut={true}
            related={relatedMap[forwardOutgoingItem.post.id] ?? []}
            relatedLoading={relatedMap[forwardOutgoingItem.post.id] === undefined}
            hiddenIds={hiddenPostIds}
            onStartClose={() => {}}
            initialScrollTop={forwardOutgoingItem.scrollTop}
            onClose={() => setForwardOutgoingItem(null)}
            onPinToggle={() => {}}
            onShare={() => {}}
            onOpenRelated={() => {}}
          />
        </div>,
        portalTarget
      )}

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
          relatedLoading={relatedMap[expanded.post.id] === undefined}
          hiddenIds={hiddenPostIds}
          registerClose={(fn) => { closeRequestRef.current = fn; }}
          onStartClose={handleStartClose}
          initialScrollTop={expanded.scrollTop}
          onClose={closeExpanded}
          onPinToggle={handlePinToggle}
          onShare={handleShare}
          onOpenRelated={openRelated}
        />,
        portalTarget
      )}

      {/* Общая back-кнопка для всех состояний expanded (включая
          forward/back-nav). Рендерится одним порталом, между навигациями
          не unmount-ится — stays visible all the time.
          На ФИНАЛЬНОМ close (stack=0 → expanded станет null через 520ms)
          скрываем кнопку МГНОВЕННО, иначе она торчит во время сворачивания
          поста. На back-nav (stack>0) НЕ скрываем — будет показывать
          previous-пост, она нужна. */}
      {portalTarget && backBtnVisible && createPortal(
        <button
          type="button"
          onClick={() => {
            if (stack.length === 0) {
              setBackBtnVisible(false);
            }
            closeRequestRef.current?.();
          }}
          style={expandedStyles.backBtnFloating}
          aria-label="Назад"
        >
          <BackArrowIcon size={20} />
        </button>,
        portalTarget
      )}

      {/* Outgoing layer: outgoing-пост рендерится поверх expanded (zIndex
          выше). Forced close — image FLIP-возвращается в свой thumb-rect
          (тот же, с которого он открывался в related-сетке). Под ним
          уже виден previous в phase=open, никакой задержки. */}
      {portalTarget && outgoingItem && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1200, pointerEvents: "none" }}>
          <ExpandedView
            key={`outgoing:${outgoingItem.post.id}`}
            post={outgoingItem.post}
            startRect={outgoingItem.rect}
            startSrc={outgoingItem.src}
            startIndex={outgoingItem.index}
            userId={userId}
            lang={lang}
            fadeOnClose={true}
            isBackNav={false}
            forceClose={true}
            related={relatedMap[outgoingItem.post.id] ?? []}
            relatedLoading={relatedMap[outgoingItem.post.id] === undefined}
            hiddenIds={hiddenPostIds}
            onStartClose={() => {}}
            initialScrollTop={outgoingItem.scrollTop}
            onClose={() => setOutgoingItem(null)}
            onPinToggle={() => {}}
            onShare={() => {}}
            onOpenRelated={() => {}}
          />
        </div>,
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
    // touch-action: pan-y — освобождает горизонтальный жест для swipe.
    touchAction: "pan-y" as const,
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
    // background задаётся через computeSheetAnim для main, и через
    // CSS keyframe для outgoing. Изначально opaque для forceClose-пути,
    // которому inline background не приходит.
    backgroundColor: "rgba(var(--bg-rgb), 1)",
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
    display: "flex",
    flexDirection: "column" as const,
    overscrollBehavior: "contain" as const,
  },
  // Back-кнопка в отдельном портале с z-index выше хедера (1300).
  // Имеет собственный stacking-context (через position:fixed + z-index),
  // не зависит от ExpandedView root (z-index 1100). animation для
  // плавного появления при contentReady.
  //
  // Позиционирование: НАД фотографией, в её верхнем-левом углу
  // (top: safe + 76 = imageArea padding-top + 12px inset; left: 24).
  // Раньше была на top: safe + 12 — пересекалась с хедер-кнопкой
  // burger, блокировала клики по action-menu хедера.
  backBtnFloating: {
    position: "fixed" as const,
    top: "calc(env(safe-area-inset-top, 0px) + 76px)",
    left: 24,
    zIndex: 1400,
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.55)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.32)",
    animation: "zen-back-btn-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
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
