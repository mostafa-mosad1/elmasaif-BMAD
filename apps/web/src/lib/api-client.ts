export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }

  const base =
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    'http://localhost:4000';

  return `${base.replace(/\/$/, '')}/api/v1`;
}

export interface StandardErrorEnvelope {
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.statusCode;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const defaultHeaders: Record<string, string> =
    typeof FormData !== 'undefined' && options.body instanceof FormData
      ? { Accept: 'application/json' }
      : {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // sends HttpOnly cookies strictly same-origin
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorData: StandardErrorEnvelope = {};
    try {
      errorData = (await response.json()) as StandardErrorEnvelope;
    } catch {
      errorData = { message: response.statusText };
    }

    throw new ApiError(
      response.status,
      errorData.code || 'API_ERROR',
      errorData.message || 'حدث خطأ أثناء معالجة الطلب',
      errorData.details,
      errorData.requestId
    );
  }

  // If 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

apiClient.get = function <T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'GET',
  });
};

apiClient.post = function <T>(
  endpoint: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

apiClient.put = function <T>(
  endpoint: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

apiClient.patch = function <T>(
  endpoint: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

apiClient.delete = function <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'DELETE',
  });
};

/**
 * Narrows an unknown `catch` value into the standard error envelope, without `any`.
 * Use it whenever a component needs `ApiError.code` / `details` inside a `try…catch`.
 */
export function describeApiError(err: unknown): StandardErrorEnvelope {
  const failure = (err ?? {}) as { code?: unknown; message?: unknown; details?: unknown; requestId?: unknown };

  return {
    code: typeof failure.code === 'string' ? failure.code : undefined,
    message: typeof failure.message === 'string' ? failure.message : undefined,
    details: failure.details,
    requestId: typeof failure.requestId === 'string' ? failure.requestId : undefined,
  };
}

/**
 * Reads the administrator currently holding an AD-10 claim lock out of a conflict `details`
 * payload, so a second admin sees the holder's name instead of a generic error.
 */
export function readLockHolderName(details: unknown): string | null {
  const lockInfo = (details as { lockInfo?: { lockedByAdminName?: unknown } } | undefined)?.lockInfo;
  const holder = lockInfo?.lockedByAdminName;
  return typeof holder === 'string' && holder ? holder : null;
}
