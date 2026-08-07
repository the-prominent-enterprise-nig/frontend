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
}

export async function getCreditApplications(params: Params = {}) {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    status: params.status,
    branchId: params.branchId,
    applicantCustomerId: params.applicantCustomerId,
    unconsumed: params.unconsumed,
  }

  return api.get<CreditApplicationListResponse>('/credit/applications', query)
}
