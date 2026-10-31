import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api-client';

// Helper to wrap API responses for TanStack Query queries
const queryFn = <T>(fn: () => Promise<ApiResponse<T>>) => async (): Promise<T> => {
  const response = await fn();
  if (!response.success) {
    throw new Error(response.error?.message || 'Request failed');
  }
  return response.data!;
};

// For mutations, fn receives the variables and returns the API call promise
const mutationFn = <T, V>(fn: (variables: V) => Promise<ApiResponse<T>>) => async (variables: V): Promise<T> => {
  const response = await fn(variables);
  if (!response.success) {
    throw new Error(response.error?.message || 'Request failed');
  }
  return response.data!;
};

// --- Auth hooks ---
export function useLogin() {
  return useMutation({
    mutationFn: mutationFn((body: { email: string; password: string; tenantSlug: string }) =>
      apiClient.post<{ accessToken: string; user: any }>('/auth/login', body)),
  });
}

export function useRegisterTenant() {
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ accessToken: string; user: any }>('/auth/register', body)),
  });
}

// --- Products hooks ---
export function useProducts(params?: { search?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/products', {
        params: params as any,
      }),
    ),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: { sku: string; name: string; description?: string | null; baseUnit: string; sellingPrice: string; costPrice?: string | null }) =>
      apiClient.post<{ id: string; sku: string; name: string }>('/products', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// --- Sales hooks ---
export function useSales(params?: { storeId?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['sales', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/sales', {
        params: params as any,
      }),
    ),
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string; saleNumber: string }>('/sales', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useVoidSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn(({ saleId, reason }: { saleId: string; reason: string }) =>
      apiClient.post(`/sales/${saleId}/void`, { reason })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

// --- Purchasing hooks ---
export function useSuppliers(params?: { search?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/purchasing/suppliers', {
        params: params as any,
      }),
    ),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string }>('/purchasing/suppliers', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function usePurchaseOrders(params?: { storeId?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/purchasing/purchase-orders', {
        params: params as any,
      }),
    ),
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string; orderNumber: string }>('/purchasing/purchase-orders', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((orderId: string) =>
      apiClient.post(`/purchasing/purchase-orders/${orderId}/approve`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function useReceiveGoods() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string; receiptNumber: string }>('/purchasing/goods-receipts', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

// --- Cash Sessions hooks ---
export function useCashSessions(params?: { storeId?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['cash-sessions', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/cash-sessions', {
        params: params as any,
      }),
    ),
  });
}

export function useStores(params?: { search?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['stores', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/stores', {
        params: params as any,
      }),
    ),
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: { name: string; code: string; location?: string | null }) =>
      apiClient.post<{ id: string; name: string; code: string }>('/stores', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: { storeId: string; openingBalance: string }) =>
      apiClient.post<{ id: string }>('/cash-sessions/open', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn(({ sessionId, closingBalance }: { sessionId: string; closingBalance: string }) =>
      apiClient.post(`/cash-sessions/${sessionId}/close`, { closingBalance })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });
}

// --- Returns hooks ---
export function useReturns(params?: { saleId?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['returns', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/returns', {
        params: params as any,
      }),
    ),
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string; refundNumber: string }>('/returns', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

// --- Pharmacy hooks ---
export function useBatches(params?: { productId?: string }) {
  return useQuery({
    queryKey: ['batches', params],
    queryFn: queryFn(() =>
      apiClient.get<{ id: string; batchNumber: string; expiresAt: string; quantityReceived: string }[]>('/pharmacy/batches', {
        params: params as any,
      }),
    ),
  });
}

export function useExpiringBatches(params?: { days?: number }) {
  return useQuery({
    queryKey: ['expiring-batches', params],
    queryFn: queryFn(() =>
      apiClient.get<{ id: string; batchNumber: string; expiresAt: string; quantityReceived: string }[]>('/pharmacy/batches/expiring', {
        params: params as any,
      }),
    ),
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string }>('/pharmacy/batches', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-report'] });
    },
  });
}

export function useDispense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string }>('/pharmacy/dispense', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-report'] });
    },
  });
}

export function useQuarantineStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string }>('/pharmacy/quarantine', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-report'] });
    },
  });
}

export function useReleaseQuarantine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn(({ quarantineId }: { quarantineId: string }) =>
      apiClient.post<{ released: boolean }>(`/pharmacy/quarantine/${quarantineId}/release`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-report'] });
    },
  });
}

export function usePrescriptions(params?: { storeId?: string; status?: string; patientName?: string }) {
  return useQuery({
    queryKey: ['prescriptions', params],
    queryFn: queryFn(() =>
      apiClient.get<any[]>('/pharmacy/prescriptions', {
        params: params as any,
      })),
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<{ id: string; prescriptionNumber: string }>('/pharmacy/prescriptions', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}

// --- Reporting hooks ---
export function useSalesSummary(params?: { storeId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['sales-summary', params],
    queryFn: queryFn(() =>
      apiClient.get<{
        totalSales: number;
        totalRevenue: string;
        totalTax: string;
        totalDiscount: string;
        averageOrderValue: string;
        byStore: any[];
        byPaymentMethod: Record<string, string>;
        topProducts: any[];
      }>('/reports/sales-summary', {
        params: params as any,
      }),
    ),
  });
}

export function useInventoryReport(params?: { storeId?: string; lowStockThreshold?: number }) {
  return useQuery({
    queryKey: ['inventory-report', params],
    queryFn: queryFn(() =>
      apiClient.get<{
        totalItems: number;
        lowStockCount: number;
        outOfStockCount: number;
        lowStockItems: any[];
        items: any[];
      }>('/reports/inventory', {
        params: params as any,
      }),
    ),
  });
}

export function useStoreComparison(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['store-comparison', params],
    queryFn: queryFn(() =>
      apiClient.get<{
        stores: any[];
      }>('/reports/store-comparison', {
        params: params as any,
      }),
    ),
  });
}

// --- Campaign hooks ---
export function useCampaigns(params?: { status?: string; type?: string; search?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: queryFn(() =>
      apiClient.get<{ items: any[]; total: number }>('/campaigns', {
        params: params as any,
      })),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<any>('/campaigns', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn(({ id, body }: { id: string; body: any }) =>
      apiClient.patch<any>(`/campaigns/${id}`, body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((id: string) =>
      apiClient.delete<any>(`/campaigns/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useCampaignAnalytics(campaignId: string) {
  return useQuery({
    queryKey: ['campaign-analytics', campaignId],
    queryFn: queryFn(() =>
      apiClient.get<any>(`/campaigns/${campaignId}/analytics`)),
    enabled: !!campaignId,
  });
}

export function useCustomerSegments(type?: string) {
  return useQuery({
    queryKey: ['customer-segments', type],
    queryFn: queryFn(() =>
      apiClient.get<any[]>('/campaigns/segments', {
        params: type ? { type } : undefined,
      })),
  });
}

export function useCreateCustomerSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((body: any) =>
      apiClient.post<any>('/campaigns/segments', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
    },
  });
}

export function useDeleteCustomerSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn((id: string) =>
      apiClient.delete<any>(`/campaigns/segments/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
    },
  });
}

export function useAddCustomerToSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn(({ segmentId, customerId }: { segmentId: string; customerId: string }) =>
      apiClient.post<any>(`/campaigns/segments/${segmentId}/customers/${customerId}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
    },
  });
}

export function useRemoveCustomerFromSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutationFn(({ segmentId, customerId }: { segmentId: string; customerId: string }) =>
      apiClient.delete<any>(`/campaigns/segments/${segmentId}/customers/${customerId}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
    },
  });
}
