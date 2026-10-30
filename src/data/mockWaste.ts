import type { SeriesPoint, WasteReason, WasteRecord } from '../types';

export const mockWaste: WasteRecord[] = [
  {
    id: 'w-812',
    date: '2026-09-03',
    productId: 'p-07',
    productName: 'Pandesal (per dozen)',
    quantity: 2,
    unit: 'dozens',
    reason: 'Expired',
    estimatedCost: 96,
    recordedBy: 'Jenny Cruz',
  },
  {
    id: 'w-811',
    date: '2026-09-02',
    productId: 'p-06',
    productName: 'Soft Drinks 1.5L',
    quantity: 3,
    unit: 'bottles',
    reason: 'Damaged',
    estimatedCost: 63,
    recordedBy: 'Store Owner',
  },
  {
    id: 'w-810',
    date: '2026-09-01',
    productId: 'p-07',
    productName: 'Pandesal (per dozen)',
    quantity: 3,
    unit: 'dozens',
    reason: 'Expired',
    estimatedCost: 144,
    recordedBy: 'Jenny Cruz',
  },
  {
    id: 'w-809',
    date: '2026-08-30',
    productId: 'p-01',
    productName: 'Cooking Oil 1L',
    quantity: 1,
    unit: 'bottles',
    reason: 'Spillage',
    estimatedCost: 55,
    recordedBy: 'Store Owner',
  },
  {
    id: 'w-808',
    date: '2026-08-28',
    productId: 'p-03',
    productName: 'All-Purpose Flour 1kg',
    quantity: 2,
    unit: 'packs',
    reason: 'Spoiled',
    estimatedCost: 124,
    recordedBy: 'Jenny Cruz',
  },
  {
    id: 'w-807',
    date: '2026-08-26',
    productId: 'p-04',
    productName: 'Refined Sugar 1kg',
    quantity: 1,
    unit: 'packs',
    reason: 'Damaged',
    estimatedCost: 74,
    recordedBy: 'Store Owner',
  },
];

export const wasteSummary = {
  monthToDate: 303,
  monthChangePct: -12.4,
  itemsLost: 8,
  topReason: 'Expired' as WasteReason,
  wasteRatePct: 1.6,
};

export const wasteByReason: SeriesPoint[] = [
  { label: 'Expired', value: 240 },
  { label: 'Damaged', value: 137 },
  { label: 'Spoiled', value: 124 },
  { label: 'Spillage', value: 55 },
];

export const wasteLast6Months: SeriesPoint[] = [
  { label: 'Apr', value: 620 },
  { label: 'May', value: 540 },
  { label: 'Jun', value: 710 },
  { label: 'Jul', value: 480 },
  { label: 'Aug', value: 556 },
  { label: 'Sep', value: 303 },
];

export const wasteReasons: WasteReason[] = [
  'Expired',
  'Damaged',
  'Spoiled',
  'Spillage',
  'Customer Return',
];
