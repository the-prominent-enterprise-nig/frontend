import { queryOptions } from '@tanstack/react-query'
import { api } from '@/src/libs/api/client'
import { unwrap } from '@/src/libs/api/unwrap'
import type { EmployeeListResponse } from '@/src/schema/accounting/employees'

export type EmployeeListParams = {
  search?: string
  status?: string
  branchId?: string
  page?: number
}

/**
 * One definition of "the employees list" for both sides: the page prefetches it
 * on the server (so the first paint already has rows) and the client hook runs
 * the same options for searching and refetching. `api` talks to the backend
 * directly on the server and through the `/api` proxy in the browser, so no
 * Server Action is involved in reading.
 */
export const employeeQueries = {
  all: ['accounting-employees'] as const,
  list: (params: EmployeeListParams = {}) =>
    queryOptions({
      queryKey: [...employeeQueries.all, params] as const,
      queryFn: async () =>
        unwrap(await api.get<EmployeeListResponse>('/accounting/employees', params)),
      staleTime: 30 * 1000,
    }),
}
