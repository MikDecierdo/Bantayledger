/**
 * Barrel for the business-data services. Pages import from here rather than
 * reaching into individual files, so a future change to how a domain is
 * split across files only touches this one re-export list.
 */

export type { ProductInput } from './productService';
export type { SupplierInput } from './catalogService';
export type { SaleInput, SaleItemInput } from './salesService';
export type { PurchaseInput, PurchaseItemInput } from './purchaseService';
export type { ExpenseInput, WasteInput } from './ledgerService';
export type { Report, ReportFilters, ReportProduct } from './reportService';

export { productService } from './productService';
export { categoryService, supplierService } from './catalogService';
export { salesService } from './salesService';
export { purchaseService } from './purchaseService';
export { expenseService, wasteService } from './ledgerService';
export { profileService, businessService, toBusinessProfile } from './accountService';
export { alertService, recommendationService, forecastService } from './signalService';
export { reportService } from './reportService';
