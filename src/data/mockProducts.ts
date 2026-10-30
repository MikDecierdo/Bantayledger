import type { Product, StockMovement } from '../types';

export const mockProducts: Product[] = [
  {
    id: 'p-01',
    name: 'Cooking Oil 1L',
    sku: 'CO-1000',
    category: 'Cooking Essentials',
    unit: 'bottles',
    currentStock: 12,
    minimumStock: 25,
    reorderQuantity: 36,
    supplierId: 'sup-01',
    costPrice: 55,
    sellingPrice: 72,
    status: 'critical',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 5,
    lastRestockedAt: '2026-08-28',
    updatedAt: '2026-09-03',
  },
  {
    id: 'p-02',
    name: 'Rice (Sinandomeng) 5kg',
    sku: 'RC-5000',
    category: 'Grains',
    unit: 'sacks',
    currentStock: 18,
    minimumStock: 10,
    reorderQuantity: 20,
    supplierId: 'sup-02',
    costPrice: 265,
    sellingPrice: 310,
    status: 'healthy',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 2.4,
    lastRestockedAt: '2026-08-30',
    updatedAt: '2026-09-03',
  },
  {
    id: 'p-03',
    name: 'All-Purpose Flour 1kg',
    sku: 'FL-1000',
    category: 'Baking',
    unit: 'packs',
    currentStock: 21,
    minimumStock: 24,
    reorderQuantity: 40,
    supplierId: 'sup-03',
    costPrice: 62,
    sellingPrice: 82,
    status: 'low',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 3.1,
    lastRestockedAt: '2026-09-01',
    updatedAt: '2026-09-03',
  },
  {
    id: 'p-04',
    name: 'Refined Sugar 1kg',
    sku: 'SG-1000',
    category: 'Cooking Essentials',
    unit: 'packs',
    currentStock: 34,
    minimumStock: 20,
    reorderQuantity: 30,
    supplierId: 'sup-01',
    costPrice: 74,
    sellingPrice: 95,
    status: 'healthy',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 2.8,
    lastRestockedAt: '2026-08-28',
    updatedAt: '2026-09-02',
  },
  {
    id: 'p-05',
    name: 'Ground Coffee 250g',
    sku: 'CF-0250',
    category: 'Beverages',
    unit: 'packs',
    currentStock: 8,
    minimumStock: 12,
    reorderQuantity: 24,
    supplierId: 'sup-05',
    costPrice: 165,
    sellingPrice: 210,
    status: 'low',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 1.6,
    lastRestockedAt: '2026-08-22',
    updatedAt: '2026-09-03',
  },
  {
    id: 'p-06',
    name: 'Soft Drinks 1.5L',
    sku: 'SD-1500',
    category: 'Beverages',
    unit: 'bottles',
    currentStock: 96,
    minimumStock: 30,
    reorderQuantity: 48,
    supplierId: 'sup-04',
    costPrice: 21,
    sellingPrice: 35,
    status: 'healthy',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 6.2,
    lastRestockedAt: '2026-08-26',
    updatedAt: '2026-09-03',
  },
  {
    id: 'p-07',
    name: 'Pandesal (per dozen)',
    sku: 'PD-0012',
    category: 'Bakery',
    unit: 'dozens',
    currentStock: 0,
    minimumStock: 8,
    reorderQuantity: 15,
    supplierId: 'sup-03',
    costPrice: 48,
    sellingPrice: 65,
    status: 'out',
    imageUrl: null,
    variantGroupId: null,
    isActive: true,
    averageDailyDemand: 9.4,
    lastRestockedAt: '2026-09-02',
    updatedAt: '2026-09-03',
  },
];

export const getProductById = (id: string) =>
  mockProducts.find((p) => p.id === id);

/** 14-day stock movement history, keyed by product id. */
export const mockStockMovements: Record<string, StockMovement[]> = {
  'p-01': [
    { date: 'Aug 21', stock: 44, in: 0, out: 6 },
    { date: 'Aug 22', stock: 39, in: 0, out: 5 },
    { date: 'Aug 23', stock: 35, in: 0, out: 4 },
    { date: 'Aug 24', stock: 29, in: 0, out: 6 },
    { date: 'Aug 25', stock: 24, in: 0, out: 5 },
    { date: 'Aug 26', stock: 20, in: 0, out: 4 },
    { date: 'Aug 27', stock: 14, in: 0, out: 6 },
    { date: 'Aug 28', stock: 44, in: 36, out: 6 },
    { date: 'Aug 29', stock: 39, in: 0, out: 5 },
    { date: 'Aug 30', stock: 33, in: 0, out: 6 },
    { date: 'Aug 31', stock: 28, in: 0, out: 5 },
    { date: 'Sep 01', stock: 22, in: 0, out: 6 },
    { date: 'Sep 02', stock: 17, in: 0, out: 5 },
    { date: 'Sep 03', stock: 12, in: 0, out: 5 },
  ],
};

/** Fallback generator so every product has a plausible movement history. */
export function stockMovementFor(product: Product): StockMovement[] {
  const cached = mockStockMovements[product.id];
  if (cached) return cached;

  const labels = [
    'Aug 21', 'Aug 22', 'Aug 23', 'Aug 24', 'Aug 25', 'Aug 26', 'Aug 27',
    'Aug 28', 'Aug 29', 'Aug 30', 'Aug 31', 'Sep 01', 'Sep 02', 'Sep 03',
  ];
  const demand = product.averageDailyDemand;
  let stock = product.currentStock + demand * 13;
  const restockDay = 7;

  return labels.map((date, i) => {
    const out = Math.max(0, Math.round(demand + (i % 3) - 1));
    const incoming = i === restockDay ? product.reorderQuantity : 0;
    stock = Math.max(0, stock - out + incoming);
    return { date, stock: Math.round(stock), in: incoming, out };
  });
}

/** 7-day unit sales history used on the product detail page. */
export function unitSalesFor(product: Product) {
  const labels = ['Aug 28', 'Aug 29', 'Aug 30', 'Aug 31', 'Sep 01', 'Sep 02', 'Sep 03'];
  const base = product.averageDailyDemand;
  const shape = [0.9, 1.05, 1.2, 0.85, 1.0, 1.25, 1.1];
  return labels.map((label, i) => ({
    label,
    value: Math.max(0, Math.round(base * shape[i])),
  }));
}
