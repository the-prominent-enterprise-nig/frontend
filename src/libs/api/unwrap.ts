import type { ApiResponse } from '@/src/libs/api/client'

/**
 * The payload of a successful response; throws the backend's message
 * otherwise. Query functions use this so a failed call is an *error* (which
 * React Query retries, never caches and never dehydrates) rather than a
 * "successful" `{ success: false }` object.
 */
export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message ?? response.error ?? 'Request failed')
  }
  return response.data as T
}

export type Settled<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Like unwrap, but never throws: for Server Components that render their own
 * inline error for one section instead of taking the whole route down to the
 * error boundary. Safe to start without awaiting (no unhandled rejection).
 */
export async function settle<T>(call: Promise<ApiResponse<T>>): Promise<Settled<T>> {
  try {
    const response = await call
    if (!response.success) {
      return { ok: false, error: response.message ?? response.error ?? 'Request failed' }
    }
    return { ok: true, data: response.data as T }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Request failed' }
  }
}
