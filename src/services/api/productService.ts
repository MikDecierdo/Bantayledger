import type { Product, SeriesPoint, StockMovement } from '../../types';
import { api } from './client';

export interface ProductInput {
  name: string;
  variantGroupId?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  unit: string;
  minimumStock: number;
  maximumStock?: number | null;
  reorderQuantity: number;
  costPrice: number;
  sellingPrice: number;
  openingStock?: number;
}

export const productService = {
  async list(businessId: string): Promise<Product[]> {
    return api.get<Product[]>(`/businesses/${businessId}/products`);
  },

  async get(businessId: string, productId: string): Promise<Product> {
    return api.get<Product>(`/businesses/${businessId}/products/${productId}`);
  },

  async create(businessId: string, input: ProductInput): Promise<Product> {
    return api.post<Product>(`/businesses/${businessId}/products`, input);
  },

  async update(
    businessId: string,
    productId: string,
    input: Partial<Omit<ProductInput, 'openingStock'>> & { isActive?: boolean },
  ): Promise<Product> {
    return api.patch<Product>(`/businesses/${businessId}/products/${productId}`, input);
  },

  async remove(businessId: string, productId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/products/${productId}`);
  },

  async uploadImage(businessId: string, productId: string, file: File): Promise<Product> {
    const formData = new FormData();
    formData.append('image', file);
    return api.postForm<Product>(`/businesses/${businessId}/products/${productId}/image`, formData);
  },

  async removeImage(businessId: string, productId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/products/${productId}/image`);
  },

  /**
   * The Supabase version derived businessId server-side from the product
   * row inside the adjust_stock RPC, so its signature took no businessId.
   * The REST route needs it in the path — this method isn't called from
   * any page yet (checked: no call sites in src/pages), so widening the
   * signature here doesn't break anything.
   */
  async adjustStock(businessId: string, productId: string, quantity: number, notes?: string): Promise<void> {
    await api.post(`/businesses/${businessId}/products/${productId}/adjust-stock`, { quantity, notes });
  },

  async stockMovement(businessId: string, productId: string, days = 14): Promise<StockMovement[]> {
    return api.get<StockMovement[]>(`/businesses/${businessId}/products/${productId}/stock-movement`, { days });
  },

  async unitSales(businessId: string, productId: string, days = 7): Promise<SeriesPoint[]> {
    return api.get<SeriesPoint[]>(`/businesses/${businessId}/products/${productId}/unit-sales`, { days });
  },
};

export default productService;
