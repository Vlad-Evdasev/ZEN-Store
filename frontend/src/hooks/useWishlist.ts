import { useState, useEffect, useCallback, useRef } from "react";
import { getWishlist, addToWishlist, removeFromWishlist } from "../api";

const STORAGE_KEY = "zen-wishlist";
const REMOVED_KEY = "zen-wishlist-removed";
const REMOVED_TTL_MS = 60 * 60 * 1000;

function loadRecentlyRemoved(): Set<number> {
  try {
    const raw = localStorage.getItem(REMOVED_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as { id: number; ts: number }[];
    const now = Date.now();
    const valid = (data || []).filter((x) => now - x.ts < REMOVED_TTL_MS).map((x) => x.id);
    return new Set(valid);
  } catch {
    return new Set();
  }
}

function saveRecentlyRemoved(productId: number) {
  try {
    const raw = localStorage.getItem(REMOVED_KEY);
    const data: { id: number; ts: number }[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const filtered = data.filter((x) => now - x.ts < REMOVED_TTL_MS && x.id !== productId);
    filtered.push({ id: productId, ts: now });
    localStorage.setItem(REMOVED_KEY, JSON.stringify(filtered.slice(-50)));
  } catch {}
}

function removeFromRecentlyRemoved(productId: number) {
  try {
    const raw = localStorage.getItem(REMOVED_KEY);
    if (!raw) return;
    const data: { id: number; ts: number }[] = JSON.parse(raw);
    const now = Date.now();
    const filtered = data.filter((x) => x.id !== productId && now - x.ts < REMOVED_TTL_MS);
    localStorage.setItem(REMOVED_KEY, JSON.stringify(filtered));
  } catch {}
}

export function useWishlist(userId: string) {
  const [ids, setIds] = useState<Set<number>>(new Set());
  const removedRef = useRef<Set<number>>(loadRecentlyRemoved());

  const fetchWishlist = useCallback(() => {
    if (!userId) return;
    getWishlist(userId)
      .then((arr) => {
        removedRef.current = loadRecentlyRemoved();
        const filtered = arr.filter((id) => !removedRef.current.has(id));
        const next = new Set(filtered);
        setIds(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch {}
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw) as number[];
        setIds(new Set(Array.isArray(arr) ? arr : []));
      } catch {
        // ignore
      }
      return;
    }
    setIds(new Set());
    fetchWishlist();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => fetchWishlist(), 50);
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setTimeout(() => fetchWishlist(), 50);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [userId, fetchWishlist]);

  const toggle = useCallback(
    async (productId: number) => {
      if (userId) {
        let had = false;
        let nextSet: Set<number> = new Set();
        setIds((prev) => {
          had = prev.has(productId);
          nextSet = new Set(prev);
          if (had) nextSet.delete(productId);
          else nextSet.add(productId);
          return nextSet;
        });
        if (had) {
          saveRecentlyRemoved(productId);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextSet]));
          } catch {}
        }
        try {
          if (had) {
            await removeFromWishlist(userId, productId);
          } else {
            await addToWishlist(userId, productId);
            removeFromRecentlyRemoved(productId);
          }
          if (!had) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextSet]));
            } catch {}
          }
        } catch {
          setIds((prev) => {
            const next = new Set(prev);
            if (had) {
              next.add(productId);
              removeFromRecentlyRemoved(productId);
            } else next.delete(productId);
            return next;
          });
        }
      } else {
        setIds((prev) => {
          const next = new Set(prev);
          if (next.has(productId)) next.delete(productId);
          else next.add(productId);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
          } catch {}
          return next;
        });
      }
    },
    [userId]
  );

  const has = useCallback(
    (productId: number) => ids.has(productId),
    [ids]
  );

  return { wishlistIds: ids, toggleWishlist: toggle, hasInWishlist: has };
}
