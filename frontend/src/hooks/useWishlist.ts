import { useState, useEffect, useCallback, useRef } from "react";
import { getWishlist, addToWishlist, removeFromWishlist } from "../api";

const STORAGE_KEY = "zen-wishlist";

export function useWishlist(userId: string) {
  const [ids, setIds] = useState<Set<number>>(new Set());
  // Зеркало стейта в ref-е — нужно для toggle, чтобы он видел СВЕЖУЮ
  // версию набора, а не stale-closure (без этого при быстром тыке
  // несколько раз кнопка читала старый ids и слала тот же запрос).
  const idsRef = useRef<Set<number>>(new Set());
  // Per-product счётчик «версий» запроса. При получении ответа сравниваем
  // с актуальным — если значение успело поменяться (юзер ещё раз тапнул),
  // ответ игнорируем, чтобы не перетереть оптимистичное состояние.
  const reqVersion = useRef<Map<number, number>>(new Map());

  const refresh = useCallback(() => {
    if (!userId) return;
    getWishlist(userId)
      .then((arr) => {
        const fresh = new Set(arr);
        idsRef.current = fresh;
        setIds(fresh);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw) as number[];
        const set = new Set(Array.isArray(arr) ? arr : []);
        idsRef.current = set;
        setIds(set);
      } catch {
        // ignore
      }
      return;
    }
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") setTimeout(refresh, 0);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setTimeout(refresh, 0);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [userId, refresh]);

  const toggle = useCallback(
    async (productId: number) => {
      if (!userId) {
        // Гость — храним только локально.
        const next = new Set(idsRef.current);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        idsRef.current = next;
        setIds(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch {}
        return;
      }

      const had = idsRef.current.has(productId);

      // Бамп версии запроса для этого продукта. Все ответы на старые
      // версии будут проигнорированы при возврате с сети.
      const myVersion = (reqVersion.current.get(productId) ?? 0) + 1;
      reqVersion.current.set(productId, myVersion);

      // Оптимистичный апдейт: меняем ref+state синхронно.
      const next = new Set(idsRef.current);
      if (had) next.delete(productId);
      else next.add(productId);
      idsRef.current = next;
      setIds(next);

      try {
        if (had) await removeFromWishlist(userId, productId);
        else await addToWishlist(userId, productId);
        // НЕ дёргаем refresh — он фетчит весь список и может перетереть
        // оптимистичное состояние следующего in-flight запроса. Доверяем
        // оптимистичному стейту; refresh случается на visibilitychange.
      } catch {
        // Откатываем ТОЛЬКО если это всё ещё актуальный запрос.
        // Если юзер успел тапнуть ещё — версия больше моей, не трогаем.
        if (reqVersion.current.get(productId) === myVersion) {
          const rollback = new Set(idsRef.current);
          if (had) rollback.add(productId);
          else rollback.delete(productId);
          idsRef.current = rollback;
          setIds(rollback);
        }
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
