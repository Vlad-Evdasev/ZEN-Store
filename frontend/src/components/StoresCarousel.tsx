import { useRef, useEffect } from "react";
import { StoreCard } from "./StoreCard";
import type { Store, Category } from "../api";

/** Картинка и описание по умолчанию для категорий из API (для известных кодов) */
const FALLBACK_BY_CODE: Record<string, { image: string; desc: string }> = {
  tee: { image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", desc: "Базовые и оверсайз" },
  hoodie: { image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", desc: "Худи и свитшоты" },
  pants: { image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", desc: "Карго и классика" },
  jacket: { image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", desc: "Куртки и аксессуары" },
  accessories: { image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400", desc: "Аксессуары" },
};
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400";
const DEFAULT_CATEGORY_DESC = "";

type DisplayStore =
  | { id: number; name: string; image: string; desc: string; isReal: true }
  | { id: string; name: string; image: string; desc: string; isReal: false; category: string };

interface StoresCarouselProps {
  stores: Store[];
  categories?: Category[];
  onStoreClick: (store: { id: number; name: string } | { category: string; name: string }) => void;
  /** Уменьшенные карточки (70%) */
  compact?: boolean;
}

export function StoresCarousel({ stores, categories = [], onStoreClick, compact }: StoresCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const marqueePausedRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const lastAutoScrollRef = useRef(0);
  const isSeamJumpRef = useRef(false);
  const userScrollingRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const touchActiveRef = useRef(false);
  const lastTouchRecenterRef = useRef(0);
  const touchRecenterRafRef = useRef(0);
  const COPIES = 9;
  const CENTER_OFFSET = Math.floor(COPIES / 2);

  const realStores: DisplayStore[] =
    stores.length > 0
      ? stores.map((s) => ({
          id: s.id,
          name: s.name,
          image: s.image_url || "",
          desc: s.description || "",
          isReal: true as const,
        }))
      : [];

  const categoryTiles: DisplayStore[] =
    realStores.length === 0
      ? categories.length > 0
        ? categories.map((c) => {
            const fallback = FALLBACK_BY_CODE[c.code];
            return {
              id: c.code,
              name: c.name,
              image: fallback?.image ?? DEFAULT_CATEGORY_IMAGE,
              desc: fallback?.desc ?? DEFAULT_CATEGORY_DESC,
              isReal: false as const,
              category: c.code,
            };
          })
        : (() => {
            const entries = Object.entries(FALLBACK_BY_CODE);
            const names: Record<string, string> = { tee: "Футболки", hoodie: "Худи", pants: "Штаны", jacket: "Куртки", accessories: "Аксессуары" };
            return entries.map(([code, { image, desc }]) => ({
              id: code,
              name: names[code] ?? code,
              image,
              desc,
              isReal: false as const,
              category: code,
            }));
          })()
      : [];

  const displayStores: DisplayStore[] = realStores.length > 0 ? realStores : categoryTiles;

  const pauseOnUserStart = () => {
    marqueePausedRef.current = true;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = null;
  };

  const resumeAfterUserEnd = () => {
    userScrollingRef.current = false;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => {
      marqueePausedRef.current = false;
      pauseTimeoutRef.current = null;
    }, 1500);
  };

  const doSeamJumpIfAtEdge = () => {
    const el = scrollRef.current;
    if (!el || displayStores.length === 0) return;
    const total = el.scrollWidth;
    const copyWidth = total / COPIES;
    if (copyWidth <= 0) return;
    const left = el.scrollLeft;
    if (left < copyWidth) {
      programmaticScrollRef.current = true;
      el.scrollLeft = left + CENTER_OFFSET * copyWidth;
    } else if (left > (COPIES - 1) * copyWidth) {
      programmaticScrollRef.current = true;
      el.scrollLeft = left - CENTER_OFFSET * copyWidth;
    }
  };

  const startTouchRecenterLoop = () => {
    const loop = () => {
      if (!touchActiveRef.current) return;
      const el = scrollRef.current;
      if (el && displayStores.length > 0) {
        const total = el.scrollWidth;
        const copyWidth = total / COPIES;
        if (copyWidth > 0) {
          const left = el.scrollLeft;
          const now = Date.now();
          if (left < copyWidth || left > (COPIES - 1) * copyWidth) {
            if (now - lastTouchRecenterRef.current >= 32) {
              lastTouchRecenterRef.current = now;
              programmaticScrollRef.current = true;
              if (left < copyWidth) el.scrollLeft = left + CENTER_OFFSET * copyWidth;
              else el.scrollLeft = left - CENTER_OFFSET * copyWidth;
            }
          }
        }
      }
      touchRecenterRafRef.current = requestAnimationFrame(loop);
    };
    touchRecenterRafRef.current = requestAnimationFrame(loop);
  };

  const onTouchMoveRecenter = () => {
    const el = scrollRef.current;
    if (!el || displayStores.length === 0) return;
    const total = el.scrollWidth;
    const copyWidth = total / COPIES;
    if (copyWidth <= 0) return;
    const left = el.scrollLeft;
    const now = Date.now();
    if (now - lastTouchRecenterRef.current < 32) return;
    if (left < copyWidth) {
      lastTouchRecenterRef.current = now;
      programmaticScrollRef.current = true;
      el.scrollLeft = left + CENTER_OFFSET * copyWidth;
    } else if (left > (COPIES - 1) * copyWidth) {
      lastTouchRecenterRef.current = now;
      programmaticScrollRef.current = true;
      el.scrollLeft = left - CENTER_OFFSET * copyWidth;
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || displayStores.length === 0) return;
    const scrollStep = 1.65;
    const handleScroll = () => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      const total = el.scrollWidth;
      const copyWidth = total / COPIES;
      if (copyWidth <= 0) return;
      const left = el.scrollLeft;
      if (left < copyWidth) {
        if (Date.now() - lastAutoScrollRef.current < 80) return;
        lastAutoScrollRef.current = Date.now();
        isSeamJumpRef.current = true;
        programmaticScrollRef.current = true;
        el.scrollLeft = left + CENTER_OFFSET * copyWidth;
        return;
      }
      if (left > (COPIES - 1) * copyWidth) {
        if (Date.now() - lastAutoScrollRef.current < 80) return;
        lastAutoScrollRef.current = Date.now();
        isSeamJumpRef.current = true;
        programmaticScrollRef.current = true;
        el.scrollLeft = left - CENTER_OFFSET * copyWidth;
        return;
      }
      if (isSeamJumpRef.current) {
        isSeamJumpRef.current = false;
      }
    };
    let rafId = 0;
    const step = () => {
      if (marqueePausedRef.current) {
        rafId = requestAnimationFrame(step);
        return;
      }
      const total = el.scrollWidth;
      const copyWidth = total / COPIES;
      if (copyWidth <= 0) {
        rafId = requestAnimationFrame(step);
        return;
      }
      lastAutoScrollRef.current = Date.now();
      programmaticScrollRef.current = true;
      el.scrollLeft += scrollStep;
      if (el.scrollLeft >= (COPIES - 1) * copyWidth - 1) {
        isSeamJumpRef.current = true;
        el.scrollLeft = CENTER_OFFSET * copyWidth;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    el.addEventListener("scroll", handleScroll, { passive: true });
    requestAnimationFrame(() => {
      const target = scrollRef.current;
      if (target && target.scrollWidth > 0) {
        const cw = target.scrollWidth / COPIES;
        programmaticScrollRef.current = true;
        target.scrollLeft = CENTER_OFFSET * cw;
      }
    });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, [displayStores.length]);

  const handleStoreClick = (item: DisplayStore) => {
    if (item.isReal && typeof item.id === "number") {
      onStoreClick({ id: item.id, name: item.name });
    } else if (!item.isReal && item.category) {
      onStoreClick({ category: item.category, name: item.name });
    }
  };

  if (displayStores.length === 0) return null;

  return (
    <div style={styles.wrap}>
      <div
        ref={scrollRef}
        style={styles.scrollArea}
        className="hide-scrollbar"
        onTouchStart={() => {
          touchActiveRef.current = true;
          userScrollingRef.current = true;
          pauseOnUserStart();
          startTouchRecenterLoop();
        }}
        onTouchMove={onTouchMoveRecenter}
        onTouchEnd={() => {
          touchActiveRef.current = false;
          if (touchRecenterRafRef.current) {
            cancelAnimationFrame(touchRecenterRafRef.current);
            touchRecenterRafRef.current = 0;
          }
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              doSeamJumpIfAtEdge();
              resumeAfterUserEnd();
            });
          });
        }}
        onMouseDown={() => { userScrollingRef.current = true; pauseOnUserStart(); }}
        onMouseUp={() => resumeAfterUserEnd()}
        onMouseLeave={() => resumeAfterUserEnd()}
        onWheel={(e) => {
          if (e.deltaX !== 0) {
            pauseOnUserStart();
            if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
            pauseTimeoutRef.current = window.setTimeout(() => {
              marqueePausedRef.current = false;
              pauseTimeoutRef.current = null;
            }, 1500);
          }
        }}
      >
        {Array.from({ length: COPIES }, () => displayStores).flat().map((s, i) => (
          <StoreCard
            key={`${String(s.id)}-${i}`}
            store={{
              id: typeof s.id === "number" ? s.id : 0,
              name: s.name,
              image_url: s.image,
              description: s.desc,
            }}
            onClick={() => handleStoreClick(s)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100%",
    marginTop: 0,
    marginBottom: 16,
  },
  scrollArea: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 12,
    paddingLeft: 0,
    paddingRight: 0,
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-x",
    minWidth: 0,
  },
};
