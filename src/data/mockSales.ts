import type { Sale, SaleItem, SeriesPoint } from '../types';

type SampleItem = Omit<SaleItem, 'unitCost'>;
type SampleSale = Omit<Sale, 'items' | 'capital' | 'profit' | 'payments'> & { items: SampleItem[] };

const sampleSales: SampleSale[] = [
  {
    id: 's-1041',
    reference: 'SL-2026-1041',
    date: '2026-09-03',
    time: '10:42 AM',
    items: [
      { productId: 'p-01', productName: 'Cooking Oil 1L', quantity: 2, unitPrice: 72 },
      { productId: 'p-04', productName: 'Refined Sugar 1kg', quantity: 1, unitPrice: 95 },
    ],
    total: 239,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
  {
    id: 's-1040',
    reference: 'SL-2026-1040',
    date: '2026-09-03',
    time: '10:15 AM',
    items: [
      { productId: 'p-02', productName: 'Rice (Sinandomeng) 5kg', quantity: 1, unitPrice: 310 },
    ],
    total: 310,
    paymentMethod: 'GCash',
    paymentReference: null,
    cashier: 'Jenny Cruz',
  },
  {
    id: 's-1039',
    reference: 'SL-2026-1039',
    date: '2026-09-03',
    time: '09:58 AM',
    items: [
      { productId: 'p-06', productName: 'Soft Drinks 1.5L', quantity: 6, unitPrice: 35 },
      { productId: 'p-07', productName: 'Pandesal (per dozen)', quantity: 2, unitPrice: 65 },
    ],
    total: 340,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
  {
    id: 's-1038',
    reference: 'SL-2026-1038',
    date: '2026-09-03',
    time: '09:22 AM',
    items: [
      { productId: 'p-05', productName: 'Ground Coffee 250g', quantity: 2, unitPrice: 210 },
      { productId: 'p-04', productName: 'Refined Sugar 1kg', quantity: 2, unitPrice: 95 },
    ],
    total: 610,
    paymentMethod: 'GCash',
    paymentReference: null,
    cashier: 'Jenny Cruz',
  },
  {
    id: 's-1037',
    reference: 'SL-2026-1037',
    date: '2026-09-03',
    time: '08:47 AM',
    items: [
      { productId: 'p-03', productName: 'All-Purpose Flour 1kg', quantity: 4, unitPrice: 82 },
    ],
    total: 328,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
  {
    id: 's-1036',
    reference: 'SL-2026-1036',
    date: '2026-09-03',
    time: '08:12 AM',
    items: [
      { productId: 'p-07', productName: 'Pandesal (per dozen)', quantity: 5, unitPrice: 65 },
      { productId: 'p-06', productName: 'Soft Drinks 1.5L', quantity: 3, unitPrice: 35 },
    ],
    total: 430,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
  {
    id: 's-1035',
    reference: 'SL-2026-1035',
    date: '2026-09-02',
    time: '05:36 PM',
    items: [
      { productId: 'p-02', productName: 'Rice (Sinandomeng) 5kg', quantity: 2, unitPrice: 310 },
      { productId: 'p-01', productName: 'Cooking Oil 1L', quantity: 1, unitPrice: 72 },
    ],
    total: 692,
    paymentMethod: 'GCash',
    paymentReference: null,
    cashier: 'Jenny Cruz',
  },
  {
    id: 's-1034',
    reference: 'SL-2026-1034',
    date: '2026-09-02',
    time: '03:04 PM',
    items: [
      { productId: 'p-06', productName: 'Soft Drinks 1.5L', quantity: 12, unitPrice: 35 },
    ],
    total: 420,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
  {
    id: 's-1033',
    reference: 'SL-2026-1033',
    date: '2026-09-02',
    time: '11:29 AM',
    items: [
      { productId: 'p-01', productName: 'Cooking Oil 1L', quantity: 3, unitPrice: 72 },
      { productId: 'p-03', productName: 'All-Purpose Flour 1kg', quantity: 2, unitPrice: 82 },
    ],
    total: 380,
    paymentMethod: 'Card',
    paymentReference: null,
    cashier: 'Jenny Cruz',
  },
  {
    id: 's-1032',
    reference: 'SL-2026-1032',
    date: '2026-09-01',
    time: '04:51 PM',
    items: [
      { productId: 'p-05', productName: 'Ground Coffee 250g', quantity: 1, unitPrice: 210 },
      { productId: 'p-07', productName: 'Pandesal (per dozen)', quantity: 3, unitPrice: 65 },
    ],
    total: 405,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
  {
    id: 's-1031',
    reference: 'SL-2026-1031',
    date: '2026-09-01',
    time: '01:18 PM',
    items: [
      { productId: 'p-04', productName: 'Refined Sugar 1kg', quantity: 4, unitPrice: 95 },
    ],
    total: 380,
    paymentMethod: 'GCash',
    paymentReference: null,
    cashier: 'Jenny Cruz',
  },
  {
    id: 's-1030',
    reference: 'SL-2026-1030',
    date: '2026-08-31',
    time: '02:40 PM',
    items: [
      { productId: 'p-02', productName: 'Rice (Sinandomeng) 5kg', quantity: 3, unitPrice: 310 },
    ],
    total: 930,
    paymentMethod: 'Cash',
    paymentReference: null,
    cashier: 'Store Owner',
  },
];

/** Sample lines assume a 70% buying price so the profit view has numbers to show. */
export const mockSales: Sale[] = sampleSales.map((sale) => {
  const items = sale.items.map((item) => ({ ...item, unitCost: Math.round(item.unitPrice * 0.7 * 100) / 100 }));
  const capital = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) * 100) / 100;
  const payments: Sale['payments'] = [
    { method: sale.paymentMethod === 'GCash' ? 'GCash' : 'Cash', amount: sale.total, reference: sale.paymentReference },
  ];
  return { ...sale, items, capital, profit: Math.round((sale.total - capital) * 100) / 100, payments };
});

export const salesSummary = {
  today: 4250,
  todayChangePct: 8.2,
  yesterday: 3928,
  week: 26480,
  weekChangePct: 4.6,
  month: 108340,
  monthChangePct: -1.8,
  transactionsToday: 32,
  averageBasket: 133,
};

/** Last 7 days of gross sales, in PHP. */
export const salesLast7Days: SeriesPoint[] = [
  { label: 'Thu', value: 3620 },
  { label: 'Fri', value: 4180 },
  { label: 'Sat', value: 5240 },
  { label: 'Sun', value: 4890 },
  { label: 'Mon', value: 3410 },
  { label: 'Tue', value: 3928 },
  { label: 'Wed', value: 4250 },
];

/** Last 6 months of gross sales, in PHP. */
export const salesLast6Months: SeriesPoint[] = [
  { label: 'Apr', value: 96400 },
  { label: 'May', value: 101200 },
  { label: 'Jun', value: 98750 },
  { label: 'Jul', value: 110300 },
  { label: 'Aug', value: 110320 },
  { label: 'Sep', value: 108340 },
];

/** Share of revenue by product category. */
export const salesByCategory: SeriesPoint[] = [
  { label: 'Grains', value: 34200 },
  { label: 'Beverages', value: 26100 },
  { label: 'Cooking Essentials', value: 21850 },
  { label: 'Bakery', value: 15400 },
  { label: 'Baking', value: 10790 },
];
