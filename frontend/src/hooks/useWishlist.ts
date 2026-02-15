import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "zen-wishlist";

export function useWishlist(userId: string) {
  const key = `${STORAGE_KEY}-${userId}`;

  const [ids, setIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as number[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch {
      // ignore
    }
  }, [key, ids]);

  const toggle = useCallback((productId: number) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const has = useCallback(
    (productId: number) => ids.has(productId),
    [ids]
  );

  return { wishlistIds: ids, toggleWishlist: toggle, hasInWishlist: has };
}
