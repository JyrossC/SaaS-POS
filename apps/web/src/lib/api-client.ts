/// <reference types="vite/client" />

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    status?: number;
  };
  meta?: { page: number; limit: number; total: number };
}

export interface ApiErrorDetail {
  field?: string;
  message?: string;
}

export interface ApiRequestOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
}

export class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshRequestPromise: Promise<ApiResponse<unknown>> | null = null;

  constructor(
    private readonly refreshPath = '/auth/refresh',
    private readonly expiredEventName = 'tenant-auth-expired',
  ) {}

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private normalizedPath(path: string) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private authHeaders(headers: Record<string, string>) {
    return {
      ...headers,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private expireSession() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(this.expiredEventName));
    }
  }

  private withRefreshLock<T>(operation: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request<Promise<T>>(
        `saas-pos-refresh:${this.refreshPath}`,
        operation,
      ).then((result) => result);
    }
    return operation();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<ApiResponse<T>> {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const normalizedPath = this.normalizedPath(path);
    const url = new URL(`${baseUrl}${normalizedPath}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const requestHeaders = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    };
    const execute = () => fetch(url.toString(), {
      method,
      headers: this.authHeaders(requestHeaders),
      credentials: 'include',
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });

    const normalizedRefreshPath = this.normalizedPath(this.refreshPath);
    let response = normalizedPath === normalizedRefreshPath
      ? await this.withRefreshLock(execute)
      : await execute();
    const shouldRefresh =
      response.status === 401 &&
      Boolean(this.token) &&
      normalizedPath !== normalizedRefreshPath;
    let refreshed = false;
    if (shouldRefresh) {
      refreshed = await this.refreshAccessToken();
      if (refreshed) response = await execute();
    }
    if (response.status === 401 && this.token && (!shouldRefresh || refreshed)) {
      this.expireSession();
    }

    const responseText = await response.text();
    let rawData: unknown = null;
    if (responseText) {
      try {
        rawData = JSON.parse(responseText);
      } catch {
        rawData = { message: responseText };
      }
    }

    if (!response.ok) {
      const errorBody =
        typeof rawData === 'object' && rawData !== null
          ? (rawData as Record<string, unknown>)
          : {};
      const nestedError = errorBody.error;
      const nestedErrorBody =
        typeof nestedError === 'object' && nestedError !== null
          ? (nestedError as Record<string, unknown>)
          : {};
      const errorDetails = Array.isArray(errorBody.details)
        ? errorBody.details as ApiErrorDetail[]
        : Array.isArray(nestedErrorBody.details)
          ? nestedErrorBody.details as ApiErrorDetail[]
          : undefined;
      return {
        success: false,
        error:
          typeof nestedError === 'object' && nestedError !== null
            ? {
                ...(nestedError as NonNullable<ApiResponse<T>['error']>),
                details: errorDetails,
                status: response.status,
              }
            : {
                code:
                  typeof errorBody.code === 'string'
                    ? errorBody.code
                    : typeof nestedError === 'string'
                      ? nestedError
                      : `HTTP_${response.status}`,
                message:
                  typeof errorBody.message === 'string'
                    ? errorBody.message
                    : `Request failed with status ${response.status}`,
                details: errorDetails,
                status: response.status,
              },
      };
    }

    if (
      typeof rawData === 'object' &&
      rawData !== null &&
      'success' in rawData &&
      typeof (rawData as Record<string, unknown>).success === 'boolean'
    ) {
      return rawData as ApiResponse<T>;
    }
    return { success: true, data: rawData as T };
  }

  async getBlob(path: string): Promise<Blob> {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}${this.normalizedPath(path)}`;
    const execute = () => fetch(url, {
      headers: this.authHeaders({}),
      credentials: 'include',
    });

    let response = await execute();
    const shouldRefresh = response.status === 401 && Boolean(this.token);
    const refreshed = shouldRefresh && await this.refreshAccessToken();
    if (refreshed) response = await execute();
    if (response.status === 401 && this.token && (!shouldRefresh || refreshed)) {
      this.expireSession();
    }
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const body = await response.json() as { message?: unknown };
        if (typeof body.message === 'string') message = body.message;
      } catch {
        // Keep the HTTP status message when the server does not return JSON.
      }
      throw new Error(message);
    }
    return response.blob();
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshPromise) {
      const baseUrl = API_BASE_URL.replace(/\/+$/, '');
      const path = `${baseUrl}${this.normalizedPath(this.refreshPath)}`;
      this.refreshPromise = this.withRefreshLock(() => fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }))
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 401) this.expireSession();
            return false;
          }
          const result = await response.json() as { accessToken?: unknown };
          if (typeof result.accessToken !== 'string' || !result.accessToken) {
            this.expireSession();
            return false;
          }
          this.setToken(result.accessToken);
          return true;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  get<T>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    if (
      this.normalizedPath(path) === this.normalizedPath(this.refreshPath) &&
      body === undefined &&
      !options
    ) {
      if (!this.refreshRequestPromise) {
        this.refreshRequestPromise = this.request<T>('POST', path)
          .finally(() => {
            this.refreshRequestPromise = null;
          });
      }
      return this.refreshRequestPromise as Promise<ApiResponse<T>>;
    }
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const apiClient = new ApiClient();
