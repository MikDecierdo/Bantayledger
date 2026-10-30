import type { Alert } from '../types';

export const mockAlerts: Alert[] = [
  {
    id: 'a-01',
    severity: 'critical',
    level: 'HIGH',
    title: 'Cooking Oil may run out in about 3 days',
    detail:
      'Only 12 bottles remain against an average demand of 5 bottles per day. The next delivery is not yet scheduled.',
    productId: 'p-01',
    category: 'Inventory',
    createdAt: '2026-09-03T07:10:00',
    read: false,
  },
  {
    id: 'a-02',
    severity: 'critical',
    level: 'HIGH',
    title: 'Pandesal is out of stock',
    detail:
      'Stock reached zero this morning while daily demand averages 9 dozens. A pending order has not yet been received.',
    productId: 'p-07',
    category: 'Inventory',
    createdAt: '2026-09-03T06:45:00',
    read: false,
  },
  {
    id: 'a-03',
    severity: 'warning',
    level: 'MEDIUM',
    title: 'Flour supplier price is increasing',
    detail:
      'Masaganang Bakeshop Supplies raised unit price by 4.8% over three months. Forecast suggests ₱65–₱67 by December.',
    productId: 'p-03',
    category: 'Pricing',
    createdAt: '2026-09-03T06:30:00',
    read: false,
  },
  {
    id: 'a-04',
    severity: 'warning',
    level: 'MEDIUM',
    title: 'Ground Coffee is below minimum stock',
    detail:
      '8 packs on hand against a minimum of 12. Lead time from Kape Ilocos Roasters averages 4 days.',
    productId: 'p-05',
    category: 'Inventory',
    createdAt: '2026-09-02T16:20:00',
    read: true,
  },
  {
    id: 'a-05',
    severity: 'info',
    level: 'WATCH',
    title: 'Soft Drinks may be overstocked',
    detail:
      '96 bottles on hand covers roughly 15 days of demand. Consider holding the next order to free up cash.',
    productId: 'p-06',
    category: 'Inventory',
    createdAt: '2026-09-02T14:05:00',
    read: true,
  },
  {
    id: 'a-06',
    severity: 'warning',
    level: 'MEDIUM',
    title: 'Golden Harvest Trading is under price review',
    detail:
      'Two of their products moved up in price this quarter. Comparing quotes from another supplier may be worthwhile.',
    category: 'Supplier',
    createdAt: '2026-09-02T09:40:00',
    read: true,
  },
  {
    id: 'a-07',
    severity: 'info',
    level: 'WATCH',
    title: 'Utilities expense is trending above average',
    detail:
      'August electricity was ₱4,820, about 11% higher than the six-month average of ₱4,340.',
    category: 'Expense',
    createdAt: '2026-09-01T08:00:00',
    read: true,
  },
];

export const alertCounts = {
  total: mockAlerts.length,
  unread: mockAlerts.filter((a) => !a.read).length,
  critical: mockAlerts.filter((a) => a.severity === 'critical').length,
  warning: mockAlerts.filter((a) => a.severity === 'warning').length,
  info: mockAlerts.filter((a) => a.severity === 'info').length,
};
