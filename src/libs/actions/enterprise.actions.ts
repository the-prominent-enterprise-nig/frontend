'use server'

import { api } from '@/src/libs/api/client'

export interface EnterpriseSummary {
  employeeCount: number
  userCount: number
}

export interface BusinessProfile {
  companyLegalName: string | null
  companyTradingName: string | null
  contactPerson: string | null
  mobileNumber: string | null
  fiscalYearStartMonth: number
  requireHqApprovalForTransfers: boolean
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

export async function getBusinessProfile(): Promise<{
  success: boolean
  data?: BusinessProfile
  error?: string
}> {
  const result = await api.get<BusinessProfile>('/enterprise/profile')
  if (!result.success) return { success: false, error: result.error }
  return { success: true, data: result.data }
}

export async function updateBusinessProfile(body: Partial<BusinessProfile>): Promise<{
  success: boolean
  data?: BusinessProfile
  error?: string
}> {
  const result = await api.patch<BusinessProfile>('/enterprise/profile', body)
  if (!result.success) return { success: false, error: result.error }
  return { success: true, data: result.data }
}
