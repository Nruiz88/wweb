/**
 * Slugify a string for use in public URLs (e.g. a business's public agenda
 * link). Lowercases, removes accents and non-alphanumeric characters,
 * collapses spaces into single hyphens.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}