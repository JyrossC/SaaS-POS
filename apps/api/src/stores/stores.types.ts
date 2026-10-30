export interface CreateStoreInput {
  name: string;
  code: string;
  location?: string | null;
}

export interface UpdateStoreInput {
  name?: string;
  code?: string;
  location?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ListStoresInput {
  search?: string;
  page: number;
  pageSize: number;
  status?: 'ACTIVE' | 'INACTIVE';
}
