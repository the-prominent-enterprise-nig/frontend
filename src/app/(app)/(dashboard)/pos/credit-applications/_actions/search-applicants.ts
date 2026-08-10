'use server'

import { customersApi } from '@/src/libs/api/crm'
import type { Customer } from '@/src/schema/crm/types'
import type { ApiResponse } from '@/src/libs/api/client'
import { searchCustomers } from '../../_actions/pos-actions'

// POS-scoped search (name-or-phone, minimal fields) — not /crm/customers,
// which needs crm:customers:read that a Cashier role isn't granted. Same
// reasoning as searchCustomers() in pos/_actions/pos-actions.ts, which this
// delegates to directly rather than duplicating the fetch.
export async function searchApplicantCustomers(q: string) {
  return searchCustomers(q)
}

export async function getApplicantCustomer(id: string): Promise<ApiResponse<Customer>> {
  return customersApi.get(id)
}
