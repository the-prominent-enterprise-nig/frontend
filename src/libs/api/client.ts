import { z } from 'zod'

// Enable debug logging with NEXT_PUBLIC_DEBUG_API=true
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_API === 'true'

// Browser calls go through the Next.js catch-all proxy at /api/* so the
// httpOnly authToken cookie is attached automatically (same-origin).
// Server-side calls hit the backend directly because Node's fetch requires
// an absolute URL. Do not collapse these into a single env var — the split
// is what makes the auth cookie flow work.
const API_BASE_URL =
  typeof window === 'undefined'
    ? (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')
    : process.env.NEXT_PUBLIC_API_URL || '/api'

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined>
  cache?: RequestCache
  /** Next.js cache tags for on-demand revalidation via revalidateTag() */
  tags?: string[]
  /** Revalidate in seconds. Setting this takes precedence over cache. */
  revalidate?: number | false
}

export interface ApiResponse<T = any> {
  data?: T
  success?: boolean
  message?: string
  error?: string
}

/**
 * Reusable API client for all HTTP methods
 * Handles query params, body, headers, and error handling
 */
export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    params,
    cache = 'no-store',
    tags,
    revalidate,
  } = options

  try {
    // Build URL with query parameters
    let url = `${API_BASE_URL}${endpoint}`

    if (params) {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value))
        }
      })
      const queryString = queryParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    // Build next cache options
    const nextOptions: NextFetchRequestConfig = {}
    if (tags?.length) nextOptions.tags = tags
    if (revalidate !== undefined) nextOptions.revalidate = revalidate

    // Auto-inject auth token and real client IP when running server-side
    let authToken: string | undefined
    let clientIp: string | undefined
    if (typeof window === 'undefined') {
      try {
        const { cookies, headers: getHeaders } = await import('next/headers')
        const cookieStore = await cookies()
        authToken = cookieStore.get('authToken')?.value
        const reqHeaders = await getHeaders()
        clientIp =
          reqHeaders.get('x-forwarded-for')?.split(',')[0].trim() ??
          reqHeaders.get('x-real-ip') ??
          undefined
      } catch (e) {
        if (DEBUG) {
          console.error('[apiClient] Failed to read server-side headers:', e)
        }
      }
    }

    // Build request options
    const requestOptions: RequestInit = {
      method,
      // Send the authToken cookie on cross-origin browser fetches. Server-side
      // requests still rely on the explicit Authorization header above.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
        ...headers,
      },
      // Use next options if tags/revalidate provided, otherwise fall back to cache
      ...(Object.keys(nextOptions).length > 0 ? { next: nextOptions } : { cache }),
      signal: AbortSignal.timeout(30_000),
    }

    // Add body for POST, PUT, PATCH
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = JSON.stringify(body)
    }

    // Make request
    const response = await fetch(url, requestOptions)

    // Handle different response statuses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      return {
        success: false,
        error: errorData.message || errorData.error || `HTTP error ${response.status}`,
        message: errorData.message || `Request failed with status ${response.status}`,
      }
    }

    // Parse response — guard against empty bodies (e.g. void endpoints)
    const text = await response.text()
    let data: any = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        // non-JSON response; leave data as null
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error)

    return {
      success: false,
      error: 'Network error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * API object with convenience methods for each HTTP verb
 */

export const api = {
  request: apiClient,
  get: async <T = any>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: Omit<ApiClientOptions, 'method' | 'params'>
  ): Promise<ApiResponse<T>> => {
    return apiClient<T>(endpoint, { ...options, method: 'GET', params })
  },
  post: async <T = any>(
    endpoint: string,
    body?: any,
    options?: Omit<ApiClientOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> => {
    return apiClient<T>(endpoint, { ...options, method: 'POST', body })
  },
  put: async <T = any>(
    endpoint: string,
    body?: any,
    options?: Omit<ApiClientOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> => {
    return apiClient<T>(endpoint, { ...options, method: 'PUT', body })
  },
  patch: async <T = any>(
    endpoint: string,
    body?: any,
    options?: Omit<ApiClientOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> => {
    return apiClient<T>(endpoint, { ...options, method: 'PATCH', body })
  },
  delete: async <T = any>(
    endpoint: string,
    options?: Omit<ApiClientOptions, 'method'>
  ): Promise<ApiResponse<T>> => {
    return apiClient<T>(endpoint, { ...options, method: 'DELETE' })
  },
}

/**
 * Generic API call with Zod validation
 * Validates both request and response data
 */
export async function apiCallWithValidation<
  TRequest extends z.ZodTypeAny,
  TResponse extends z.ZodTypeAny,
>(
  endpoint: string,
  options: ApiClientOptions & {
    requestSchema?: TRequest
    responseSchema: TResponse
  }
): Promise<ApiResponse<z.infer<TResponse>>> {
  const { requestSchema, responseSchema, body, ...restOptions } = options

  let validatedBody: any = body

  // Validate request body if schema provided
  if (requestSchema && body) {
    try {
      validatedBody = requestSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Request validation error',
          message: error.issues
            .map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', '),
        }
      }
    }
  }

  // Make API call
  const response = await apiClient(endpoint, { ...restOptions, body: validatedBody })

  if (!response.success) {
    return response
  }

  // Validate response
  try {
    const validatedData = responseSchema.parse(response.data)
    return {
      success: true,
      data: validatedData,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Response validation error:', error.issues)
      return {
        success: false,
        error: 'Response validation error',
        message: 'API returned invalid data format',
      }
    }
    return response
  }
}
