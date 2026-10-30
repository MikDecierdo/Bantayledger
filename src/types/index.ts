/**
 * Domain models for BantayLedger AI.
 *
 * These shapes are what the UI consumes. When a real backend is introduced,
 * only `src/data/*` and `src/services/*` need to change — components stay put.
 */

export type StockStatus = 'healthy' | 'low' | 'critical' | 'out';

export type TrendDirection = 'up' | 'down' | 'flat';

export type Severity = 'critical' | 'warning' | 'info';

export type ProductCategory =
  | 'Cooking Essentials'
  | 'Grains'
  | 'Baking'
  | 'Beverages'
  | 'Bakery'
  | 'Household';

export interface Product {
  id: string;
  variantGroupId: string | null;
  /** A disabled product stays in Inventory but can't be sold and is left out of alerts and forecasts. */
  isActive: boolean;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: string;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  supplierId: string;
  costPrice: number;
  sellingPrice: number;
  status: StockStatus;
  imageUrl: string | null;
  averageDailyDemand: number;
  lastRestockedAt: string;
  updatedAt: string;
}

export interface StockMovement {
  date: string;
  stock: number;
  in: number;
  out: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  /** Map position picked for the address; null when only text was entered. */
  latitude: number | null;
  longitude: number | null;
  productIds: string[];
  averageUnitPrice: number;
  priceTrend: TrendDirection;
  priceChangePct: number;
  reliabilityScore: number;
  status: 'active' | 'review' | 'inactive';
  lastOrderedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  reference: string;
  date: string;
  time: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'Cash' | 'GCash' | 'Card';
  /** Last 4 digits of the GCash reference number; null for other payment methods and older sales. */
  paymentReference: string | null;
  cashier: string;
}

export interface Purchase {
  id: string;
  /**
   * The purchase header's id — distinct from `id`, which is the line-item
   * id (the API returns one row per item, carrying the header's reference
   * and status). Status changes and deletion act on the header, so they
   * need this, not `id`.
   */
  purchaseId: string;
  reference: string;
  date: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  status: 'received' | 'pending' | 'cancelled';
}

export type ExpenseCategory =
  | 'Utilities'
  | 'Rent'
  | 'Salaries'
  | 'Transport'
  | 'Supplies'
  | 'Permits'
  | 'Maintenance';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidBy: string;
}

export type WasteReason =
  | 'Expired'
  | 'Damaged'
  | 'Spoiled'
  | 'Spillage'
  | 'Customer Return';

export interface WasteRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  reason: WasteReason;
  estimatedCost: number;
  recordedBy: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface ForecastPoint {
  label: string;
  actual?: number;
  forecast?: number;
  low?: number;
  high?: number;
}

export interface DemandForecast {
  productId: string;
  productName: string;
  unit: string;
  horizonDays: number;
  currentStock: number;
  averageDailyDemand: number;
  forecastQuantity: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  daysOfCover: number;
  series: ForecastPoint[];
}

export interface PriceForecast {
  productId: string;
  productName: string;
  currentPrice: number;
  estimatedLow: number;
  estimatedHigh: number;
  estimatedAverage: number;
  trend: TrendDirection;
  changePct: number;
  supplierName: string;
  series: ForecastPoint[];
}

export interface PurchasingCostForecast {
  productId: string;
  productName: string;
  unit: string;
  forecastDemand: number;
  estimatedUnitPrice: number;
  estimatedCost: number;
  previousCost: number;
  difference: number;
  differencePct: number;
}

export interface ForecastAccuracy {
  metric: string;
  value: number;
  target: number;
  description: string;
}

export interface Alert {
  id: string;
  severity: Severity;
  level: 'HIGH' | 'MEDIUM' | 'WATCH';
  title: string;
  detail: string;
  productId?: string;
  category: 'Inventory' | 'Pricing' | 'Sales' | 'Supplier' | 'Expense';
  createdAt: string;
  read: boolean;
}

export interface AiInsight {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  recommendedAction: string;
  impact: 'high' | 'medium' | 'low';
  category: 'Inventory' | 'Pricing' | 'Purchasing' | 'Sales' | 'Waste';
  /** Special insight families, e.g. "trending" for top sellers. */
  topic?: string | null;
  productId?: string;
  supportingData: { label: string; value: string }[];
  confidence: number;
  generatedAt: string;
  /** True when the server can write an AI explanation for this insight. */
  aiEnabled?: boolean;
}

export interface BusinessProfile {
  ownerName: string;
  firstName: string;
  role: string;
  email: string;
  phone: string;
  initials: string;
  businessName: string;
  businessType: string;
  address: string;
  currency: string;
  memberSince: string;
}
