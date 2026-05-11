import { useEffect, useState } from "react";

// Module-level store, который синкает индекс выбранной картинки между
// thumb-карточкой и её expanded-overlay'ем. Без этого юзер свайпит на
// картинку N в expanded, закрывает — FLIP-back лендится в thumb, у
// которого показана картинка 0 → визуальный «прыжок» на оригинал.
// Решение: и thumb, и expanded читают/пишут общий store по id сущности.

type Store = {
  map: Map<number, number>;
  listeners: Map<number, Set<() => void>>;
};

function createStore(): Store {
  return { map: new Map(), listeners: new Map() };
}

function getIdx(store: Store, id: number): number {
  return store.map.get(id) ?? 0;
}

function setIdx(store: Store, id: number, idx: number): void {
  if (store.map.get(id) === idx) return;
  store.map.set(id, idx);
  store.listeners.get(id)?.forEach((fn) => fn());
}

function useIdx(store: Store, id: number | null | undefined): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (id == null) return;
    const fn = () => force((x) => x + 1);
    let set = store.listeners.get(id);
    if (!set) {
      set = new Set();
      store.listeners.set(id, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) store.listeners.delete(id);
    };
  }, [id]);
  return id == null ? 0 : getIdx(store, id);
}

const productStore = createStore();
const postStore = createStore();

export const getProductImageIdx = (id: number): number => getIdx(productStore, id);
export const setProductImageIdx = (id: number, idx: number): void => setIdx(productStore, id, idx);
export const useProductImageIdx = (id: number | null | undefined): number => useIdx(productStore, id);

export const getPostImageIdx = (id: number): number => getIdx(postStore, id);
export const setPostImageIdx = (id: number, idx: number): void => setIdx(postStore, id, idx);
export const usePostImageIdx = (id: number | null | undefined): number => useIdx(postStore, id);
