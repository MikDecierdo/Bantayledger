/**
 * Data access boundary.
 *
 * Every page reads through this module. It resolves the active business (via
 * `activeContext`) and delegates to the Laravel API backend (see `./api`).
 *
 * When there is no active business yet — signed out, or the first instant of
 * a cold start before the session resolves — every read returns *empty*, not
 * sample data. Pages render their own empty states for that.
 *
 * The function signatures are unchanged, so no page needed rewriting.
 */

import type {
  BusinessProfile,
  ExpenseCategory,
  ForecastAccuracy,
  ForecastPoint,
  WasteReason,
} from '../types';
import { getActiveBusinessId, getActiveUserId } from './activeContext';
import {
  alertService,
  businessService,
  expenseService,
  forecastService,
  productService,
  profileService,
  purchaseService,
  recommendationService,
  reportService,
  salesService,
  supplierService,
  toBusinessProfile,
  wasteService,
  type Report,
  type ReportFilters,
} from './api';
import { t } from '../i18n';

function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/* ---- What a read returns when there is no business to read from ---------- */

const EMPTY_PROFILE: BusinessProfile = {
  ownerName: '',
  firstName: '',
  role: '',
  email: '',
  phone: '',
  initials: '',
  businessName: '',
  businessType: '',
  address: '',
  currency: 'PHP',
  memberSince: '',
};

const EMPTY_SALES_OVERVIEW = {
  summary: {
    today: 0,
    todayChangePct: 0,
    yesterday: 0,
    week: 0,
    weekChangePct: 0,
    month: 0,
    monthChangePct: 0,
    transactionsToday: 0,
    averageBasket: 0,
    todayCash: 0,
    todayGCash: 0,
  },
  last7Days: [],
  last6Months: [],
  byCategory: [],
};

const EMPTY_EXPENSE_OVERVIEW = {
  summary: {
    today: 0,
    todayChangePct: 0,
    monthToDate: 0,
    monthChangePct: 0,
    largestCategory: 'Utilities' as ExpenseCategory,
    largestCategoryAmount: 0,
  },
  byCategory: [],
  last6Months: [],
};

const EMPTY_PURCHASE_OVERVIEW = {
  summary: {
    monthToDate: 0,
    monthChangePct: 0,
    pendingOrders: 0,
    pendingValue: 0,
    suppliersUsed: 0,
    averageOrderValue: 0,
  },
  last6Months: [],
};

const EMPTY_WASTE_OVERVIEW = {
  summary: {
    monthToDate: 0,
    monthChangePct: 0,
    itemsLost: 0,
    topReason: 'Expired' as WasteReason,
    wasteRatePct: 0,
  },
  byReason: [],
  last6Months: [],
};

const EMPTY_ALERT_COUNTS = { total: 0, unread: 0, critical: 0, warning: 0, info: 0 };

/** True when reads and writes are hitting the API — i.e. there's an active business. */
export function usesLiveData(): boolean {
  return getActiveBusinessId() !== null;
}

/** The active business id, or null when running on sample data. */
function live(): string | null {
  return usesLiveData() ? getActiveBusinessId() : null;
}

/* -------------------------------------------------------------------------- */

export const dataService = {
  async getProfile(): Promise<BusinessProfile> {
    const businessId = live();
    const userId = getActiveUserId();
    if (!businessId || !userId) return EMPTY_PROFILE;

    const [profile, business, role] = await Promise.all([
      profileService.get(userId),
      businessService.get(businessId),
      businessService.roleOf(businessId, userId),
    ]);

    return toBusinessProfile(profile, business, role);
  },

  /* ---- Products ---- */

  getProducts: () => {
    const businessId = live();
    return businessId ? productService.list(businessId) : resolve([]);
  },

  getProduct: (id: string) => {
    const businessId = live();
    if (businessId) return productService.get(businessId, id);
    return Promise.reject(new Error(t('Product not found')));
  },

  getStockMovement: (id: string) => {
    const businessId = live();
    if (businessId) return productService.stockMovement(businessId, id);
    return resolve([]);
  },

  getUnitSales: (id: string) => {
    const businessId = live();
    if (businessId) return productService.unitSales(businessId, id);
    return resolve([]);
  },

  /* ---- Suppliers ---- */

  getSuppliers: () => {
    const businessId = live();
    return businessId ? supplierService.list(businessId) : resolve([]);
  },

  /* ---- Sales ---- */

  getSales: () => {
    const businessId = live();
    return businessId ? salesService.list(businessId) : resolve([]);
  },

  getSalesOverview: () => {
    const businessId = live();
    if (businessId) return salesService.overview(businessId);
    return resolve(EMPTY_SALES_OVERVIEW);
  },

  /* ---- Purchases ---- */

  getPurchases: () => {
    const businessId = live();
    return businessId ? purchaseService.list(businessId) : resolve([]);
  },

  getPurchasesOverview: () => {
    const businessId = live();
    if (businessId) return purchaseService.overview(businessId);
    return resolve(EMPTY_PURCHASE_OVERVIEW);
  },

  /* ---- Expenses ---- */

  getExpenses: () => {
    const businessId = live();
    return businessId ? expenseService.list(businessId) : resolve([]);
  },

  getExpensesOverview: () => {
    const businessId = live();
    if (businessId) return expenseService.overview(businessId);
    return resolve(EMPTY_EXPENSE_OVERVIEW);
  },

  /* ---- Waste ---- */

  getWaste: () => {
    const businessId = live();
    return businessId ? wasteService.list(businessId) : resolve([]);
  },

  getWasteOverview: () => {
    const businessId = live();
    if (businessId) return wasteService.overview(businessId);
    return resolve(EMPTY_WASTE_OVERVIEW);
  },

  /* ---- Alerts and insights ---- */

  getAlerts: () => {
    const businessId = live();
    return businessId ? alertService.list(businessId) : resolve([]);
  },

  getAlertCounts: () => {
    const businessId = live();
    return businessId ? alertService.counts(businessId) : resolve(EMPTY_ALERT_COUNTS);
  },

  getInsights: () => {
    const businessId = live();
    return businessId ? recommendationService.list(businessId) : resolve([]);
  },

  explainInsight: (id: string) => {
    const businessId = live();
    return businessId
      ? recommendationService.explain(businessId, id)
      : Promise.reject(new Error(t('Sign in to use AI explanations.')));
  },

  /* ---- Forecasts ---- */

  async getForecasts() {
    const businessId = live();

    if (!businessId) {
      return resolve({
        demand: [],
        price: [],
        cost: [],
        generatedAt: null as string | null,
        accuracy: [] as ForecastAccuracy[],
        forecastVsActual: [] as ForecastPoint[],
      });
    }

    const { demand, price, cost, generatedAt } = await forecastService.all(businessId);

    return {
      demand,
      price,
      cost,
      generatedAt,
      // Accuracy compares past forecasts against what actually happened, so
      // it needs weeks of runs to exist before it means anything.
      accuracy: [] as ForecastAccuracy[],
      forecastVsActual: [] as ForecastPoint[],
    };
  },

  /**
   * Regenerates forecasts, alerts and insights. `ifStale` lets pages call
   * this on every open — the server skips the work if the last run is under
   * a day old.
   */
  refreshForecasts(ifStale = false) {
    const businessId = live();
    return businessId ? forecastService.refresh(businessId, ifStale) : resolve(null);
  },

  /* ---- Reports ---- */

  getReport(filters: ReportFilters): Promise<Report> {
    const businessId = live();
    if (businessId) return reportService.get(businessId, filters);

    return resolve({
      range: { ...filters, granularity: 'month', categoryName: null },
      summary: { revenue: 0, purchases: 0, expenses: 0, netPosition: 0, transactions: 0 },
      sales: { series: [], byCategory: [] },
      purchases: { series: [] },
      expenses: { series: [], byCategory: [] },
      inventory: { products: [], totalValue: 0 },
    });
  },

  /* ---- Dashboard ---- */

  async getDashboard() {
    const businessId = live();

    if (!businessId) {
      return resolve({
        profile: EMPTY_PROFILE,
        sales: EMPTY_SALES_OVERVIEW.summary,
        salesLast7Days: EMPTY_SALES_OVERVIEW.last7Days,
        expenses: EMPTY_EXPENSE_OVERVIEW.summary,
        expensesByCategory: EMPTY_EXPENSE_OVERVIEW.byCategory,
        products: [],
        alerts: [],
        insights: [],
        demand: [],
        price: [],
        cost: [],
        recentSales: [],
      });
    }

    // One round of parallel reads rather than a waterfall.
    const [profile, salesOverview, expenseOverview, products, alerts, insights, forecasts, recent] =
      await Promise.all([
        dataService.getProfile(),
        salesService.overview(businessId),
        expenseService.overview(businessId),
        productService.list(businessId),
        alertService.list(businessId, 20),
        recommendationService.list(businessId, 10),
        dataService.getForecasts(),
        salesService.list(businessId, 5),
      ]);

    return {
      profile,
      sales: salesOverview.summary,
      salesLast7Days: salesOverview.last7Days,
      expenses: expenseOverview.summary,
      expensesByCategory: expenseOverview.byCategory,
      products,
      alerts,
      insights,
      demand: forecasts.demand,
      price: forecasts.price,
      cost: forecasts.cost,
      recentSales: recent,
    };
  },
};

/** Convenience for write paths that need to know who is acting. */
export function currentActor() {
  return { businessId: getActiveBusinessId(), userId: getActiveUserId() };
}

export type DashboardData = Awaited<ReturnType<typeof dataService.getDashboard>>;
