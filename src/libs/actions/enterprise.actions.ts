'use server'

import { api } from '@/src/libs/api/client'

export interface EnterpriseSummary {
  employeeCount: number
  userCount: number
  pendingLeaveCount: number
  enabledModules: string[]
}

export async function getEnterpriseSummary(): Promise<{
  success: boolean
  data?: EnterpriseSummary
  error?: string
}> {
  const result = await api.get<EnterpriseSummary>('/enterprise/summary')
  if (!result.success) return { success: false, error: result.error }
  return { success: true, data: result.data }
}
