'use server'

import { api } from '@/src/libs/api/client'
import type { CreditApplicationListResponse } from '@/src/schema/credit/applications'

type Params = {
  page?: number
  limit?: number
  status?: string
  branchId?: string
  applicantCustomerId?: string
  /** Scenario 17 Part 6 — only return applications not yet consumed by a POS sale */
  unconsumed?: boolean
  /** Scenario 29 POS-02 — only return applications checkout can actually use
   * (approved or partially_approved). Use instead of status='approved'. */
  checkoutEligible?: boolean
}

export async function getCreditApplications(params: Params = {}) {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    status: params.status,
    branchId: params.branchId,
    applicantCustomerId: params.applicantCustomerId,
    unconsumed: params.unconsumed,
    checkoutEligible: params.checkoutEligible,
  }

  return api.get<CreditApplicationListResponse>('/credit/applications', query)
}
