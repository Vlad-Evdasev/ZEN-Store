export const CATEGORY_LABELS: Record<string, string> = {
  all: "Всё",
  tee: "Футболки",
  hoodie: "Худи",
  pants: "Штаны",
  jacket: "Куртки",
  accessories: "Аксессуары",
};

/** Если передан labels (из API), приоритет у него; иначе — статичные подписи */
export function getCategoryLabel(category: string, labels?: Record<string, string>): string {
  if (labels && labels[category]) return labels[category];
  return CATEGORY_LABELS[category] ?? category;
}
