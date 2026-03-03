import { useState, useEffect, useCallback } from "react";
import { getWishlist, addToWishlist, removeFromWishlist } from "../api";

const STORAGE_KEY = "zen-wishlist";

export function useWishlist(userId: string) {
  const [ids, setIds] = useState<Set<number>>(new Set());

  const fetchWishlist = useCallback(() => {
    if (!userId) return;
    getWishlist(userId)
      .then((arr) => {
        const next = new Set(arr);
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
    fetchWishlist();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchWishlist();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
        try {
          if (had) await removeFromWishlist(userId, productId);
          else await addToWishlist(userId, productId);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextSet]));
          } catch {}
        } catch {
          setIds((prev) => {
            const next = new Set(prev);
            if (had) next.add(productId);
            else next.delete(productId);
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
