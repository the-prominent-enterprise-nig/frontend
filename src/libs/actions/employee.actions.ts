'use server'

import { api } from '@/src/libs/api/client'

type EmployeeFilters = {
  search?: string
  status?: string
  limit?: number
}

export async function getEmployees(filters?: EmployeeFilters) {
  const result = await api.get('/employees', filters)

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to fetch employees',
      data: [],
      meta: { total: 0 },
    }
  }

  return {
    success: true,
    data: result.data,
    meta: {
      total: Array.isArray(result.data)
        ? result.data.length
        : ((result.data as { meta?: { total?: number }; data?: unknown[] } | undefined)?.meta
            ?.total ??
          (result.data as { data?: unknown[] } | undefined)?.data?.length ??
          0),
    },
  }
}
