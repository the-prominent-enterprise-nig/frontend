import { api, ApiResponse } from '@/src/libs/api/client'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

export type NormalBalance = 'DEBIT' | 'CREDIT'

export interface Account {
  id: string
  code: string
  number?: string
  name: string
  type: AccountType
  normalBalance: NormalBalance
  parentId?: string | null
  currencyId?: string | null
  description?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Currency {
  id: string
  code: string
  name: string
  // Backend fields (Prisma model)
  rate?: number
  mainCurrency?: boolean
  visibility?: boolean
  // Legacy aliases — kept so existing components that read these still compile
  symbol?: string | null
  exchangeRate?: number | null
  isBase?: boolean
  isActive?: boolean
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
  currencyId?: string | null
  sourceModule?: string | null
  sourceDocumentNo?: string | null
  sourceDocumentId?: string | null
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
/* Currencies                                                         */
/* ------------------------------------------------------------------ */

export function getCurrencies(params?: ListParams) {
  return api.get<PaginatedResponse<Currency>>('/currencies', params, {
    tags: ['accounting-currencies'],
  })
}

export function getCurrencyById(id: string) {
  return api.get<Currency>(`/currencies/${id}`, undefined, {
    tags: ['accounting-currencies', `accounting-currency-${id}`],
  })
}

export function createCurrency(data: Omit<Currency, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<Currency>('/currencies', data)
}

export function updateCurrency(id: string, data: Partial<Currency>) {
  return api.patch<Currency>(`/currencies/${id}`, data)
}

export function deleteCurrency(id: string) {
  return api.delete(`/currencies/${id}`)
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
  currencyId?: string | null
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
/* Vendors / Suppliers / Customers                                    */
/* ------------------------------------------------------------------ */

export type VendorType =
  | 'CONTRACTOR'
  | 'SUPPLIER'
  | 'OFFICER'
  | 'CONSULTANT'
  | 'EMPLOYEE'
  | 'CONSTRUCTION'
  | 'FOUNDER'
  | 'OTHER'

export const VENDOR_TYPES: VendorType[] = [
  'CONTRACTOR',
  'SUPPLIER',
  'OFFICER',
  'CONSULTANT',
  'EMPLOYEE',
  'CONSTRUCTION',
  'FOUNDER',
  'OTHER',
]

export interface Vendor {
  id: string | number
  name: string
  contactPerson?: string | null
  contactNumber?: string | null
  email?: string | null
  address?: string | null
  bankAccount?: string | null
  taxIdNumber?: string | null
  type: VendorType
  alphanumericTaxCode?: string | null
  taxRate?: string | null
  businessType?: string | null
  visibility?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Supplier {
  id: string | number
  name: string
  contactPerson?: string | null
  contactNumber?: string | null
  email?: string | null
  address?: string | null
  bankAccount?: string | null
  taxIdNumber?: string | null
  visibility?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Customer {
  id: string | number
  name: string
  customerCode?: string
  email?: string | null
  phone?: string | null
  billingAddress?: string | null
  notes?: string | null
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

/** Create/update accepts firstName/lastName split — the backend joins them
 * into the unified `name` field server-side; reads always return `name`. */
export interface CustomerInput {
  firstName: string
  lastName: string
  email?: string | null
  phoneNumber?: string | null
  address?: string | null
  note?: string | null
}

export function getVendors(params?: ListParams) {
  return api.get<PaginatedResponse<Vendor> | Vendor[]>('/vendors', params, {
    tags: ['accounting-vendors'],
  })
}
export function getVendorById(id: string | number) {
  return api.get<Vendor>(`/vendors/${id}`, undefined, {
    tags: ['accounting-vendors', `accounting-vendor-${id}`],
  })
}
export function createVendor(data: Partial<Vendor>) {
  return api.post<Vendor>('/vendors', data)
}
export function updateVendor(id: string | number, data: Partial<Vendor>) {
  return api.patch<Vendor>(`/vendors/${id}`, data)
}
export function deleteVendor(id: string | number) {
  return api.delete(`/vendors/${id}`)
}

export function getSuppliers(params?: ListParams) {
  return api.get<PaginatedResponse<Supplier> | Supplier[]>('/suppliers', params, {
    tags: ['accounting-suppliers'],
  })
}
export function getSupplierById(id: string | number) {
  return api.get<Supplier>(`/suppliers/${id}`, undefined, {
    tags: ['accounting-suppliers', `accounting-supplier-${id}`],
  })
}
export function createSupplier(data: Partial<Supplier>) {
  return api.post<Supplier>('/suppliers', data)
}
export function updateSupplier(id: string | number, data: Partial<Supplier>) {
  return api.patch<Supplier>(`/suppliers/${id}`, data)
}
export function deleteSupplier(id: string | number) {
  return api.delete(`/suppliers/${id}`)
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
/* Tax                                                                */
/* ------------------------------------------------------------------ */

export interface TaxConfiguration {
  id: string | number
  name: string
  taxType?: string | null
  rate?: number | string | null
  effectiveDate?: string | null
  endDate?: string | null
  isActive?: boolean
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface EmployeeTaxInfo {
  id?: string | number
  employeeId: string
  tin?: string | null
  rdoCode?: string | null
  taxStatus?: string | null
  exemptions?: number | null
  withholdingExempt?: boolean | null
  sssNumber?: string | null
  philhealthNumber?: string | null
  pagibigNumber?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TaxRecord {
  id: string | number
  employeeId?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  taxableIncome?: number | null
  taxDue?: number | null
  taxWithheld?: number | null
  taxType?: string | null
  status?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TaxCalculationInput {
  employeeId: string
  grossPay: number
  periodStart?: string
  periodEnd?: string
}

export interface TaxCalculationResult {
  grossPay: number
  taxableIncome: number
  withholdingTax: number
  sssContribution?: number
  philhealthContribution?: number
  pagibigContribution?: number
  netPay: number
  breakdown?: Record<string, number>
}

export function getTaxConfigurations(params?: ListParams) {
  return api.get<TaxConfiguration[] | PaginatedResponse<TaxConfiguration>>(
    '/tax/configurations',
    params,
    { tags: ['accounting-tax-configurations'] }
  )
}
export function getActiveTaxConfigurations() {
  return api.get<TaxConfiguration[]>('/tax/configurations/active', undefined, {
    tags: ['accounting-tax-configurations'],
  })
}
export function createTaxConfiguration(data: Partial<TaxConfiguration>) {
  return api.post<TaxConfiguration>('/tax/configurations', data)
}
export function updateTaxConfiguration(id: string | number, data: Partial<TaxConfiguration>) {
  return api.patch<TaxConfiguration>(`/tax/configurations/${id}`, data)
}
export function deleteTaxConfiguration(id: string | number) {
  return api.delete(`/tax/configurations/${id}`)
}

export function getEmployeeTaxInfo(employeeId: string) {
  return api.get<EmployeeTaxInfo>(`/tax/employee-info/${employeeId}`, undefined, {
    tags: ['accounting-employee-tax-info', `accounting-employee-tax-${employeeId}`],
  })
}
export function createEmployeeTaxInfo(employeeId: string, data: Partial<EmployeeTaxInfo>) {
  return api.post<EmployeeTaxInfo>(`/tax/employee-info/${employeeId}`, data)
}
export function updateEmployeeTaxInfo(employeeId: string, data: Partial<EmployeeTaxInfo>) {
  return api.patch<EmployeeTaxInfo>(`/tax/employee-info/${employeeId}`, data)
}

export function getTaxRecords(params?: ListParams) {
  return api.get<TaxRecord[] | PaginatedResponse<TaxRecord>>('/tax/records', params, {
    tags: ['accounting-tax-records'],
  })
}
export function createTaxRecord(data: Partial<TaxRecord>) {
  return api.post<TaxRecord>('/tax/records', data)
}

export function calculateTax(data: TaxCalculationInput) {
  return api.post<TaxCalculationResult>('/tax/calculate', data)
}

/* ------------------------------------------------------------------ */
/* Tax Rates                                                          */
/* ------------------------------------------------------------------ */

export type TaxRateType = 'vat' | 'vat_exempt' | 'zero_rated' | 'withholding'

export const TAX_RATE_TYPES: { value: TaxRateType; label: string }[] = [
  { value: 'vat', label: 'VAT' },
  { value: 'vat_exempt', label: 'VAT Exempt' },
  { value: 'zero_rated', label: 'Zero Rated' },
  { value: 'withholding', label: 'Withholding' },
]

export interface TaxRate {
  id: string
  name: string
  rate: number
  type: TaxRateType
  glAccountId?: string | null
  glAccount?: Account | null
  isDefault: boolean
  isActive: boolean
  _count?: { items: number }
  createdAt?: string
  updatedAt?: string
}

export interface TaxRateInput {
  name: string
  rate: number
  type: TaxRateType
  glAccountId?: string | null
}

export function getTaxRates() {
  return api.get<TaxRate[]>('/accounting/tax-rates', undefined, {
    tags: ['accounting-tax-rates'],
  })
}

export function createTaxRate(data: TaxRateInput) {
  return api.post<TaxRate>('/accounting/tax-rates', data)
}

export function updateTaxRate(id: string, data: Partial<TaxRateInput>) {
  return api.patch<TaxRate>(`/accounting/tax-rates/${id}`, data)
}

export function setDefaultTaxRate(id: string) {
  return api.post<TaxRate>(`/accounting/tax-rates/${id}/set-default`, {})
}

export function clearDefaultTaxRate(id: string) {
  return api.post<TaxRate>(`/accounting/tax-rates/${id}/unset-default`, {})
}

export function deleteTaxRate(id: string) {
  return api.delete(`/accounting/tax-rates/${id}`)
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
