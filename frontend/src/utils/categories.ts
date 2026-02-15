export const CATEGORY_LABELS: Record<string, string> = {
  all: "Всё",
  tee: "Футболки",
  hoodie: "Худи",
  pants: "Штаны",
  jacket: "Куртки",
  accessories: "Аксессуары",
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
