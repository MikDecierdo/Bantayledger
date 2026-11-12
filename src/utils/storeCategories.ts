/**
 * Ready-made categories for a sari-sari store. They appear in the Category
 * dropdown next to the store's own; picking one the store does not have yet
 * creates it on the spot, so the owner rarely has to type a category.
 */
export const STORE_CATEGORIES = [
  'Baby Care',
  'Biscuits & Bread',
  'Candies & Sweets',
  'Canned Goods',
  'Cigarettes',
  'Coffee & Milk',
  'Condiments & Sauces',
  'Cooking Oil',
  'Eggs',
  'Frozen Goods',
  'Household Items',
  'Ice & Ice Candy',
  'Juices & Water',
  'Kitchen Use',
  'Laundry & Cleaning',
  'Liquor',
  'Medicines',
  'Noodles',
  'Rice & Grains',
  'School Supplies',
  'Snacks',
  'Soft Drinks',
  'Spices',
  'Sugar & Salt',
  'Toiletries',
] as const;

/** The option value of a ready-made category not yet saved in the store. */
export const PRESET_CATEGORY_PREFIX = '__preset__:';

/**
 * The store's own categories plus every ready-made one it doesn't already have
 * (matched by name, ignoring case), in alphabetical order.
 */
export function categoryOptions(own: { id: string; name: string }[]): { value: string; label: string }[] {
  const ownNames = new Set(own.map((c) => c.name.trim().toLowerCase()));
  return [
    ...own.map((c) => ({ value: c.id, label: c.name })),
    ...STORE_CATEGORIES.filter((n) => !ownNames.has(n.toLowerCase())).map((n) => ({ value: PRESET_CATEGORY_PREFIX + n, label: n })),
  ].sort((a, b) => a.label.localeCompare(b.label));
}

/** True for a ready-made category name (any letter case). These cannot be deleted. */
export function isPresetCategory(name: string | undefined | null): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n !== '' && STORE_CATEGORIES.some((c) => c.toLowerCase() === n);
}
