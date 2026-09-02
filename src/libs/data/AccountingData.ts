import { api, ApiResponse } from '@/src/libs/api/client'
import type { CustomerType, CustomerLifecycleStatus } from '@/src/schema/crm/types'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

export type NormalBalance = 'DEBIT' | 'CREDIT'

export interface Account {
  id: string
  /** Not actually returned by the backend (the real field is `number`) — kept
   * optional rather than removed since a couple of call sites already guard
   * with `number ?? code`. */
  code?: string
  number?: string
  name: string
  type: AccountType
  /** Not actually returned by the backend — there's no such column on Account.
   * Derive debit/credit from `type` instead (ASSET/EXPENSE = debit-normal,
   * LIABILITY/EQUITY/REVENUE = credit-normal) rather than reading this. */
  normalBalance?: NormalBalance
  parentId?: string | null
  description?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface GeneralLedger {
  id: string
  code: string
  name: string
  accountId?: string | null
  description?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID'
export type JournalType =
  | 'GENERAL'
  | 'SALES'
  | 'PURCHASE'
  | 'CASH_RECEIPT'
  | 'CASH_DISBURSEMENT'
  | 'ADJUSTMENT'

export interface Transaction {
  id: string
  journalEntryId?: string | null
  accountId: string
  account?: Account
  item?: string | null
  quantity?: number | null
  unitPrice?: number | null
  debit: number
  credit: number
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface JournalEntry {
  id: string
  reference?: string | null
  date: string
  description?: string | null
  journalType: JournalType
  payee?: string | null
  status: JournalEntryStatus
  sourceModule?: string | null
  sourceDocumentNo?: string | null
  sourceDocumentId?: string | null
  branchId?: string | null
  branchName?: string | null
  postedBy?: string | null
  createdBy?: string | null
  transactions: Transaction[]
  totalDebit?: number
  totalCredit?: number
  createdAt?: string
  updatedAt?: string
  postedAt?: string | null
}

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  type?: string
  [key: string]: string | number | boolean | undefined
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

/* ------------------------------------------------------------------ */
/* Accounts                                                           */
/* ------------------------------------------------------------------ */

export function getAccounts(params?: ListParams) {
  return api.get<PaginatedResponse<Account>>('/accounts', params, {
    tags: ['accounting-accounts'],
  })
}

export function getAccountById(id: string) {
  return api.get<Account>(`/accounts/${id}`, undefined, {
    tags: ['accounting-accounts', `accounting-account-${id}`],
  })
}

export function createAccount(
  data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApiResponse<Account>> {
  return api.post<Account>('/accounts', data)
}

export function updateAccount(id: string, data: Partial<Account>): Promise<ApiResponse<Account>> {
  return api.put<Account>(`/accounts/${id}`, data)
}

export function deleteAccount(id: string) {
  return api.delete(`/accounts/${id}`)
}

/* ------------------------------------------------------------------ */
/* General Ledgers                                                    */
/* ------------------------------------------------------------------ */

export function getGeneralLedgers(params?: ListParams) {
  return api.get<PaginatedResponse<GeneralLedger>>('/general-ledgers', params, {
    tags: ['accounting-general-ledgers'],
  })
}

export function getGeneralLedgerById(id: string) {
  return api.get<GeneralLedger>(`/general-ledgers/${id}`, undefined, {
    tags: ['accounting-general-ledgers', `accounting-general-ledger-${id}`],
  })
}

export function createGeneralLedger(data: Omit<GeneralLedger, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<GeneralLedger>('/general-ledgers', data)
}

export function updateGeneralLedger(id: string, data: Partial<GeneralLedger>) {
  return api.put<GeneralLedger>(`/general-ledgers/${id}`, data)
}

export function deleteGeneralLedger(id: string) {
  return api.delete(`/general-ledgers/${id}`)
}

/* ------------------------------------------------------------------ */
/* Journal Entries                                                    */
/* ------------------------------------------------------------------ */

export function getJournalEntries(params?: ListParams) {
  return api.get<PaginatedResponse<JournalEntry>>('/journal-entries', params, {
    tags: ['accounting-journal-entries'],
  })
}

export function getJournalEntryById(id: string) {
  return api.get<JournalEntry>(`/journal-entries/${id}`, undefined, {
    tags: ['accounting-journal-entries', `accounting-journal-entry-${id}`],
  })
}

export interface JournalEntryInput {
  reference?: string | null
  date: string
  description?: string | null
  journalType?: JournalType | string
  payee?: string | null
  transactions: Array<{
    accountId: string
    item?: string | null
    quantity?: number | null
    unitPrice?: number | null
    debit: number
    credit: number
    description?: string | null
  }>
}

export function createJournalEntry(data: JournalEntryInput) {
  return api.post<JournalEntry>('/journal-entries', data)
}

export function updateJournalEntry(id: string, data: Partial<JournalEntryInput>) {
  return api.patch<JournalEntry>(`/journal-entries/${id}`, data)
}

export function deleteJournalEntry(id: string) {
  return api.delete(`/journal-entries/${id}`)
}

export function postJournalEntry(id: string) {
  return api.post<JournalEntry>(`/journal-entries/${id}/post`, {})
}

export function reverseJournalEntry(id: string) {
  return api.post<JournalEntry>(`/journal-entries/${id}/reverse`, {})
}

/* ------------------------------------------------------------------ */
/* Transactions                                                       */
/* ------------------------------------------------------------------ */

export function getTransactions(params?: ListParams) {
  return api.get<PaginatedResponse<Transaction>>('/transactions', params, {
    tags: ['accounting-transactions'],
  })
}

export function getTransactionById(id: string) {
  return api.get<Transaction>(`/transactions/${id}`, undefined, {
    tags: ['accounting-transactions', `accounting-transaction-${id}`],
  })
}

/* ------------------------------------------------------------------ */
/* Suppliers / Customers                                              */
/* ------------------------------------------------------------------ */

export interface Customer {
  id: string | number
  name: string
  // Real stored name parts (developer-requested 2026-08-27) — null for a
  // customer created before these existed and never re-saved since.
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  customerCode?: string
  customerType?: CustomerType
  email?: string | null
  phone?: string | null
  address?: string | null
  barangayCode?: string | null
  notes?: string | null
  groupId?: string | null
  lifecycleStatus?: CustomerLifecycleStatus
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
  // Scenario 38 Gap 5 — informational/control tagging only, not a posting gate.
  isWithholdingAgent?: boolean
  defaultWithholdingRate?: number | null
  defaultWithholdingAtc?: string | null
}

/** Create/update sends firstName/lastName/middleName split — the backend
 * both persists these as their own columns AND joins firstName+lastName
 * into the unified `name` field (developer-requested 2026-08-27; middleName
 * has no equivalent in `name`). Reads return both `name` and the parts. */
export interface CustomerInput {
  firstName: string
  middleName?: string | null
  lastName: string
  email?: string | null
  phoneNumber?: string | null
  address?: string | null
  barangayCode?: string | null
  note?: string | null
  customerType?: CustomerType
  groupId?: string | null
  lifecycleStatus?: CustomerLifecycleStatus
  isWithholdingAgent?: boolean
  defaultWithholdingRate?: number | null
  defaultWithholdingAtc?: string | null
}

export function getCustomers(params?: ListParams) {
  return api.get<PaginatedResponse<Customer> | Customer[]>('/customers', params, {
    tags: ['accounting-customers'],
  })
}
export function getCustomerById(id: string | number) {
  return api.get<Customer>(`/customers/${id}`, undefined, {
    tags: ['accounting-customers', `accounting-customer-${id}`],
  })
}
export function createCustomer(data: Partial<CustomerInput>) {
  return api.post<Customer>('/customers', data)
}
export function updateCustomer(id: string | number, data: Partial<CustomerInput>) {
  return api.patch<Customer>(`/customers/${id}`, data)
}
export function deleteCustomer(id: string | number) {
  return api.delete(`/customers/${id}`)
}

/* ------------------------------------------------------------------ */
/* BIR Export                                                         */
/* ------------------------------------------------------------------ */

export type BirFormType = '2316' | '1601-C' | '1604-CF'

export interface BirForm {
  formType: BirFormType | string
  name: string
  description?: string
}

export interface BirGenerateInput {
  year: number
  period?: string
  month?: number
  employeeIds?: string[]
}

export interface AlphalistEntry {
  employeeId?: string
  employeeName?: string
  tin?: string
  grossCompensation?: number
  nonTaxable?: number
  taxable?: number
  taxWithheld?: number
  [key: string]: unknown
}

export function getBirForms() {
  return api.get<BirForm[]>('/bir-export/forms', undefined, {
    tags: ['accounting-bir-forms'],
  })
}

export function generateBirForm(formType: string, data: BirGenerateInput) {
  return api.post<unknown>(`/bir-export/forms/${formType}/generate`, data)
}

export function getAlphalist(year: number, type: 'regular' | 'mwe') {
  return api.get<AlphalistEntry[]>(
    '/bir-export/alphalist',
    { year, type },
    {
      tags: ['accounting-bir-alphalist'],
    }
  )
}
