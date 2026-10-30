/**
 * TypeScript mirror of the MySQL schema (laravel-server/database/migrations/).
 *
 * Kept in step with the migrations. If you change a migration, change the
 * matching row type here — this file is what gives every service call
 * compile-time checking against the real column names.
 */

/* -------------------------------------------------------------------------- */
/* Column value aliases — document intent at the point of use.                */
/* -------------------------------------------------------------------------- */

/** numeric(14,2). Always a number, never a formatted string. */
type Money = number;
/** numeric(14,3) — fractional units (kg, litres) are supported. */
type Quantity = number;
/** ISO date, `YYYY-MM-DD`. */
type DateOnly = string;
/** ISO 8601 timestamp with timezone. */
type Timestamp = string;
type UUID = string;

export type BusinessRole = 'OWNER' | 'STAFF';
export type ProductStatus = 'healthy' | 'low' | 'critical' | 'out';
export type SupplierStatus = 'active' | 'review' | 'inactive';
export type PaymentMethod = 'Cash' | 'GCash' | 'Card' | 'Other';
export type PurchaseStatus = 'received' | 'pending' | 'cancelled';
export type MovementType = 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT' | 'RETURN';
export type WasteReasonDb = 'Expired' | 'Damaged' | 'Spoiled' | 'Spillage' | 'Customer Return';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 'Inventory' | 'Pricing' | 'Sales' | 'Supplier' | 'Expense';
export type RecommendationSeverity = 'high' | 'medium' | 'low';
export type RecommendationType = 'Inventory' | 'Pricing' | 'Purchasing' | 'Sales' | 'Waste';
export type ForecastRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                 */
/* -------------------------------------------------------------------------- */

export type ProfileRow = {
  id: UUID;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  /** When the data privacy notice was accepted (null = not yet). */
  privacy_accepted_at: Timestamp | null;
  privacy_version: string | null;
  /** Language chosen on the welcome step or in Settings. */
  language: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type BusinessRow = {
  id: UUID;
  name: string;
  business_type: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  /** One overall monthly cap on supply purchases. Null means no budget is set. Warn-only, never blocks a purchase. */
  monthly_purchase_budget: string | number | null;
  owner_user_id: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type BusinessUserRow = {
  id: UUID;
  business_id: UUID;
  user_id: UUID;
  role: BusinessRole;
  created_at: Timestamp;
};

export type CategoryRow = {
  id: UUID;
  business_id: UUID;
  name: string;
  description: string | null;
  created_at: Timestamp;
};

export type SupplierRow = {
  id: UUID;
  business_id: UUID;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: SupplierStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ProductRow = {
  id: UUID;
  variant_group_product_id: UUID | null;
  business_id: UUID;
  category_id: UUID | null;
  supplier_id: UUID | null;
  name: string;
  sku: string | null;
  description: string | null;
  image_path: string | null;
  unit: string;
  current_stock: Quantity;
  minimum_stock: Quantity;
  maximum_stock: Quantity | null;
  reorder_quantity: Quantity;
  cost_price: Money;
  selling_price: Money;
  /** Derived by trigger from current_stock vs minimum_stock. Do not write. */
  status: ProductStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type SaleRow = {
  id: UUID;
  business_id: UUID;
  user_id: UUID | null;
  reference: string | null;
  /** Maintained by trigger from sale_items. Do not write. */
  total_amount: Money;
  payment_method: PaymentMethod;
  sale_date: DateOnly;
  notes: string | null;
  created_at: Timestamp;
};

export type SaleItemRow = {
  id: UUID;
  sale_id: UUID;
  product_id: UUID;
  quantity: Quantity;
  unit_price: Money;
  /** Generated column: quantity x unit_price. Do not write. */
  subtotal: Money;
};

export type PurchaseRow = {
  id: UUID;
  business_id: UUID;
  supplier_id: UUID | null;
  user_id: UUID | null;
  reference: string | null;
  /** Maintained by trigger from purchase_items. Do not write. */
  total_amount: Money;
  status: PurchaseStatus;
  purchase_date: DateOnly;
  notes: string | null;
  created_at: Timestamp;
};

export type PurchaseItemRow = {
  id: UUID;
  purchase_id: UUID;
  product_id: UUID;
  quantity: Quantity;
  unit_cost: Money;
  /** Generated column: quantity x unit_cost. Do not write. */
  subtotal: Money;
};

export type InventoryMovementRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID;
  movement_type: MovementType;
  /** Signed: positive adds stock, negative removes it. */
  quantity: Quantity;
  reference_type: string | null;
  reference_id: UUID | null;
  notes: string | null;
  created_by_user_id: UUID | null;
  created_at: Timestamp;
};

export type ExpenseRow = {
  id: UUID;
  business_id: UUID;
  user_id: UUID | null;
  category: string;
  description: string;
  amount: Money;
  expense_date: DateOnly;
  created_at: Timestamp;
};

export type WasteRecordRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID;
  user_id: UUID | null;
  quantity: Quantity;
  reason: WasteReasonDb;
  estimated_cost: Money;
  waste_date: DateOnly;
  notes: string | null;
  created_at: Timestamp;
};

export type ForecastRunRow = {
  id: UUID;
  business_id: UUID;
  model_version: string;
  status: ForecastRunStatus;
  started_at: Timestamp;
  completed_at: Timestamp | null;
  error_message: string | null;
  created_at: Timestamp;
};

export type DemandForecastRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID;
  forecast_run_id: UUID | null;
  forecast_date: DateOnly;
  predicted_quantity: Quantity;
  lower_bound: Quantity | null;
  upper_bound: Quantity | null;
  confidence: number | null;
  model_version: string | null;
  created_at: Timestamp;
};

export type PriceForecastRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID;
  forecast_run_id: UUID | null;
  forecast_date: DateOnly;
  predicted_price: Money;
  lower_bound: Money | null;
  upper_bound: Money | null;
  confidence: number | null;
  model_version: string | null;
  created_at: Timestamp;
};

export type CostForecastRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID;
  forecast_run_id: UUID | null;
  forecast_date: DateOnly;
  forecasted_quantity: Quantity;
  forecasted_unit_price: Money;
  forecasted_total_cost: Money;
  confidence: number | null;
  model_version: string | null;
  created_at: Timestamp;
};

export type AlertRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Timestamp;
};

export type RecommendationRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID | null;
  type: RecommendationType;
  title: string;
  message: string;
  reason: string | null;
  action: string | null;
  severity: RecommendationSeverity;
  confidence: number | null;
  created_at: Timestamp;
  read_at: Timestamp | null;
};

export type CostAnomalyRow = {
  id: UUID;
  business_id: UUID;
  product_id: UUID | null;
  reference_type: string | null;
  reference_id: UUID | null;
  expected_cost: Money;
  actual_cost: Money;
  /** Generated column: actual minus expected. Do not write. */
  difference: Money;
  severity: RecommendationSeverity;
  explanation: string | null;
  created_at: Timestamp;
};

