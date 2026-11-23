import { auth } from './firebase';

async function buildAuthHeaders(requireToken: boolean = false): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore token acquisition error unless strictly required
    }
  } else if (requireToken) {
    throw new Error('Authentication required');
  }

  return headers;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    requireAuth?: boolean;
  } = {}
): Promise<T> {
  const headers = await buildAuthHeaders(Boolean(options.requireAuth));
  const response = await fetch(endpoint, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

/**
 * Best-effort non-blocking synchronization helper so frontend workflows persist
 * cleanly in Cloud SQL alongside existing client state.
 */
export async function syncToSqlApi(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<void> {
  try {
    await apiRequest(endpoint, { method, body, requireAuth: false });
  } catch (err) {
    console.warn(`SQL sync notice [${method} ${endpoint}]:`, err);
  }
}
