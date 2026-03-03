import { useRef, useEffect } from "react";
import { StoreCard } from "./StoreCard";
import type { Store } from "../api";

const FALLBACK_STORES: { id: string; name: string; category: string; image: string; desc: string }[] = [
  { id: "tee", name: "Футболки", category: "tee", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", desc: "Базовые и оверсайз" },
  { id: "hoodie", name: "Худи", category: "hoodie", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", desc: "Худи и свитшоты" },
  { id: "pants", name: "Штаны", category: "pants", image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400", desc: "Карго и классика" },
  { id: "jacket", name: "Верхняя одежда", category: "jacket", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", desc: "Куртки и аксессуары" },
];

type DisplayStore =
  | { id: number; name: string; image: string; desc: string; isReal: true }
  | { id: string; name: string; image: string; desc: string; isReal: false; category: string };

interface StoresCarouselProps {
  stores: Store[];
  onStoreClick: (store: { id: number; name: string } | { category: string; name: string }) => void;
}

export function StoresCarousel({ stores, onStoreClick }: StoresCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAutoScrollRef = useRef(0);

  const displayStores: DisplayStore[] =
    stores.length > 0
      ? stores.map((s) => ({
          id: s.id,
          name: s.name,
          image: s.image_url || "",
          desc: s.description || "",
          isReal: true as const,
        }))
      : FALLBACK_STORES.map((s) => ({
          id: s.id,
          name: s.name,
          image: s.image,
          desc: s.desc,
          isReal: false as const,
          category: s.category,
        }));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || displayStores.length === 0) return;
    const scrollStep = 1.65;
    const handleScroll = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      if (el.scrollLeft < 5) {
        lastAutoScrollRef.current = Date.now();
        el.scrollLeft = half - 5;
      } else if (el.scrollLeft > half - 5) {
        lastAutoScrollRef.current = Date.now();
        el.scrollLeft = 5;
      }
    };
    let rafId = 0;
    const step = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) {
        rafId = requestAnimationFrame(step);
        return;
      }
      lastAutoScrollRef.current = Date.now();
      el.scrollLeft += scrollStep;
      if (el.scrollLeft >= half - 1) el.scrollLeft = 0;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
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
      >
        {[...displayStores, ...displayStores].map((s, i) => (
          <StoreCard
            key={`${String(s.id)}-${i}`}
            store={{
              id: typeof s.id === "number" ? s.id : 0,
              name: s.name,
              image_url: s.image,
              description: s.desc,
            }}
            onClick={() => handleStoreClick(s)}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
    marginTop: 24,
    marginBottom: 16,
  },
  scrollArea: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    WebkitOverflowScrolling: "touch",
  },
};
