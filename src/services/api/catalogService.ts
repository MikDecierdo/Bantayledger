import type { Supplier } from '../../types';
import type { CategoryRow, SupplierRow } from '../../types/database';
import { api } from './client';

export interface SupplierInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: SupplierRow['status'];
}

export const categoryService = {
  async list(businessId: string): Promise<CategoryRow[]> {
    return api.get<CategoryRow[]>(`/businesses/${businessId}/categories`);
  },

  async create(businessId: string, name: string, description?: string): Promise<CategoryRow> {
    return api.post<CategoryRow>(`/businesses/${businessId}/categories`, { name: name.trim(), description });
  },

  async remove(businessId: string, id: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/categories/${id}`);
  },
};

export const supplierService = {
  async list(businessId: string): Promise<Supplier[]> {
    return api.get<Supplier[]>(`/businesses/${businessId}/suppliers`);
  },

  async create(businessId: string, input: SupplierInput): Promise<SupplierRow> {
    return api.post<SupplierRow>(`/businesses/${businessId}/suppliers`, input);
  },

  async update(businessId: string, id: string, input: Partial<SupplierInput>): Promise<SupplierRow> {
    return api.patch<SupplierRow>(`/businesses/${businessId}/suppliers/${id}`, input);
  },

  async remove(businessId: string, id: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/suppliers/${id}`);
  },
};
