/// <reference types="vite/client" />

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown[] };
  meta?: { page: number; limit: number; total: number };
}

export interface ApiRequestOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
}

export class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<ApiResponse<T>> {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${baseUrl}${normalizedPath}`);

    // Serialize query parameters
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

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
      return {
        success: false,
        error:
          typeof nestedError === 'object' && nestedError !== null
            ? (nestedError as ApiResponse<T>['error'])
            : {
                code: typeof nestedError === 'string' ? nestedError : `HTTP_${response.status}`,
                message:
                  typeof errorBody.message === 'string'
                    ? errorBody.message
                    : `Request failed with status ${response.status}`,
              },
      };
    }

    // Normalize response: if the API already wraps in { success, data }, use it.
    // Otherwise wrap the raw body as { success: true, data: rawData }.
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

  get<T>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return this.request<T>('POST', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const apiClient = new ApiClient();
