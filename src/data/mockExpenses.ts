import type { Expense, ExpenseCategory, SeriesPoint } from '../types';

export const mockExpenses: Expense[] = [
  {
    id: 'e-3061',
    date: '2026-09-03',
    category: 'Utilities',
    description: 'Meralco electricity — August billing',
    amount: 4820,
    paidBy: 'Store Owner',
  },
  {
    id: 'e-3060',
    date: '2026-09-03',
    category: 'Transport',
    description: 'Delivery tricycle fuel and fare',
    amount: 380,
    paidBy: 'Jenny Cruz',
  },
  {
    id: 'e-3059',
    date: '2026-09-02',
    category: 'Supplies',
    description: 'Plastic bags and receipt rolls',
    amount: 650,
    paidBy: 'Store Owner',
  },
  {
    id: 'e-3058',
    date: '2026-09-01',
    category: 'Rent',
    description: 'Store rent — September',
    amount: 12000,
    paidBy: 'Store Owner',
  },
  {
    id: 'e-3057',
    date: '2026-09-01',
    category: 'Salaries',
    description: 'Store helper wage — first half',
    amount: 6500,
    paidBy: 'Store Owner',
  },
  {
    id: 'e-3056',
    date: '2026-08-31',
    category: 'Utilities',
    description: 'Manila Water — August billing',
    amount: 720,
    paidBy: 'Store Owner',
  },
  {
    id: 'e-3055',
    date: '2026-08-29',
    category: 'Maintenance',
    description: 'Chiller cleaning and servicing',
    amount: 1500,
    paidBy: 'Jenny Cruz',
  },
  {
    id: 'e-3054',
    date: '2026-08-27',
    category: 'Permits',
    description: 'Barangay business clearance renewal',
    amount: 900,
    paidBy: 'Store Owner',
  },
];

export const expenseSummary = {
  today: 1850,
  todayChangePct: -3.4,
  monthToDate: 27470,
  monthChangePct: 2.7,
  largestCategory: 'Rent' as ExpenseCategory,
  largestCategoryAmount: 12000,
};

export const expensesByCategory: SeriesPoint[] = [
  { label: 'Rent', value: 12000 },
  { label: 'Salaries', value: 6500 },
  { label: 'Utilities', value: 5540 },
  { label: 'Maintenance', value: 1500 },
  { label: 'Permits', value: 900 },
  { label: 'Supplies', value: 650 },
  { label: 'Transport', value: 380 },
];

export const expensesLast6Months: SeriesPoint[] = [
  { label: 'Apr', value: 25600 },
  { label: 'May', value: 26400 },
  { label: 'Jun', value: 25980 },
  { label: 'Jul', value: 28100 },
  { label: 'Aug', value: 26740 },
  { label: 'Sep', value: 27470 },
];

export const expenseCategories: ExpenseCategory[] = [
  'Utilities',
  'Rent',
  'Salaries',
  'Transport',
  'Supplies',
  'Permits',
  'Maintenance',
];
