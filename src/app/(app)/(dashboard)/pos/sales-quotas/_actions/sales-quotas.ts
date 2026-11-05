'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { canManageSalesQuotas } from '@/src/libs/guards/permission'
import { SaveSalesQuotasSchema, type SalesQuotaYear } from '@/src/schema/pos/sales-quotas'

/**
 * Scenario 85 Part 4 — the Sales Quotas grid. Page-local plain server actions
 * with their own session check, `safeParse`, then `api.*` — the POS
 * convention. Business Owner only (canManageSalesQuotas); the backend
 * enforces the same rule.
 */

async function forbidden(): Promise<ApiResponse<never> | null> {
  const session = await getSessionIfAvailable()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!canManageSalesQuotas(session)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'Only the Business Owner can set sales quotas',
    }
  }
  return null
}

export async function getSalesQuotas(year: number): Promise<ApiResponse<SalesQuotaYear>> {
  const denied = await forbidden()
  if (denied) return denied
  return api.get<SalesQuotaYear>('/pos/sales-quotas', { year }, { tags: ['pos-sales-quotas'] })
}

export async function saveSalesQuotas(
  input: unknown
): Promise<ApiResponse<{ saved: number; cleared: number }>> {
  const denied = await forbidden()
  if (denied) return denied

  const parsed = SaveSalesQuotasSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues[0]?.message ?? 'Check the amounts entered',
    }
  }
  const { year, entries } = parsed.data
  return api.put<{ saved: number; cleared: number }>(`/pos/sales-quotas/${year}`, { entries })
}
