'use server'

import { z } from 'zod'
import { api } from '@/src/libs/api/client'
import {
  DrCustomerLookupSchema,
  DrDepartmentLookupSchema,
  type DrCustomerLookup,
  type DrDepartmentLookup,
} from '@/src/schema/inventory/delivery-receipts'

// The DR form's own lookups — /customers and /departments need accounting /
// admin permissions a Stock Controller doesn't hold.

export async function searchDrCustomers(search: string): Promise<DrCustomerLookup[]> {
  const result = await api.get('/inventory/delivery-receipts/lookups/customers', {
    search: search.trim() || undefined,
  })
  const parsed = z.array(DrCustomerLookupSchema).safeParse(result.data)
  return parsed.success ? parsed.data : []
}

export async function getDrDepartments(): Promise<DrDepartmentLookup[]> {
  const result = await api.get('/inventory/delivery-receipts/lookups/departments')
  const parsed = z.array(DrDepartmentLookupSchema).safeParse(result.data)
  return parsed.success ? parsed.data : []
}
