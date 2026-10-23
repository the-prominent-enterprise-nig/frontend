import { api } from './client'
import type { CustomerFilters } from './crm'
import type {
  Customer,
  DuplicateCheckResult,
  CoMaker,
  PaginatedResponse,
} from '@/src/schema/crm/types'
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CoMakerFormValues,
} from '@/src/schema/crm/customer'

/**
 * POS-scoped customers API.
 *
 * Same records as `customersApi`, same Customer table, same CustomerService
 * on the backend — only the route prefix and the permission differ. It
 * exists so a cashier can run the whole counter workflow (find a customer,
 * add a walk-in, correct a phone number, attach a co-maker) while holding
 * NO crm:* permission at all (2026-09-19 review request). Nothing is copied
 * or synced between the two: a customer added at the till is a CRM customer
 * the instant it is saved, and vice versa.
 *
 * Deliberately narrower than `customersApi` — no 360, ledger, merge,
 * delete, or dashboard summaries. POS has no use for them, and keeping the
 * surface small is the whole point of giving POS its own permissions
 * instead of handing a cashier CRM's.
 */
export const posCustomersApi = {
  list: (filters?: CustomerFilters) =>
    api.get<PaginatedResponse<Customer>>('/pos/customers', filters, {
      tags: ['pos:customers'],
    }),
  get: (id: string) => api.get<Customer>(`/pos/customers/${id}`),
  create: (body: CreateCustomerInput) => api.post<Customer>('/pos/customers', body),
  checkDuplicate: (params: { email?: string; phone?: string }) =>
    api.get<DuplicateCheckResult>('/pos/customers/check-duplicate', params),
  update: (id: string, body: UpdateCustomerInput) =>
    api.patch<Customer>(`/pos/customers/${id}`, body),
  // Single-row co-maker writes, mirroring customersApi's: unlike `update`'s
  // coMakers[] array (which replaces the whole set and reassigns every id),
  // these only ever touch one co-maker, so a Credit Application's coMakerId
  // stays linked.
  addCoMaker: (customerId: string, body: CoMakerFormValues) =>
    api.post<CoMaker>(`/pos/customers/${customerId}/co-makers`, body),
  updateCoMaker: (customerId: string, coMakerId: string, body: Partial<CoMakerFormValues>) =>
    api.patch<CoMaker>(`/pos/customers/${customerId}/co-makers/${coMakerId}`, body),
}
