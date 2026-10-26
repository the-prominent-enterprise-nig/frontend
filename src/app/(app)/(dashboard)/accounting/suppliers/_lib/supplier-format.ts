// How one supplier reads on the Suppliers screen: its status, and the
// shorthand the list and the detail both print.
//
// These live together because the list row, the detail header and the form all
// describe the same supplier — a second hand-rolled copy of "is this one
// ready" is how a row and the panel it opens end up disagreeing.

import type {
  SupplierDetail,
  SupplierListItem,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
} from '@/src/schema/inventory/suppliers'
import type { TaxCodeOption } from '@/src/libs/data/AccountingV2Data'
import { ewtOptionLabel, NO_WITHHOLDING_CODE, supplierEwtCode } from '@/src/libs/tax/ewt'
import {
  SUPPLIER_VAT_STATUS_LABEL,
  defaultInputVatCode,
  inputVatShortName,
  supplierVatStatus,
} from '@/src/libs/tax/input-vat'

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]
export type SupplierType = (typeof SUPPLIER_TYPES)[number]

/** Whether a supplier may be picked on new paperwork at all. */
export const STATUS_META: Record<
  SupplierStatus,
  { label: string; chip: string; dot: string; hint: string }
> = {
  active: {
    label: 'Active',
    chip: 'bg-[#e7f5ef] text-[#0b6644]',
    dot: 'bg-[#0f7b52]',
    hint: 'Offered on new purchase orders and receiving reports',
  },
  inactive: {
    label: 'Inactive',
    chip: 'bg-[#f1f1f4] text-[#5b5b6b]',
    dot: 'bg-[#a3a3b2]',
    hint: 'Hidden from new documents — its history stays',
  },
  blacklisted: {
    label: 'Blacklisted',
    chip: 'bg-[#fdeceb] text-[#b42318]',
    dot: 'bg-[#d9544c]',
    hint: 'Barred outright — nothing new may be raised against it',
  },
}

export const TYPE_LABELS: Record<SupplierType, string> = {
  SUPPLIER: 'Supplier',
  CONTRACTOR: 'Contractor',
  CONSULTANT: 'Consultant',
  OFFICER: 'Officer',
  EMPLOYEE: 'Employee',
  CONSTRUCTION: 'Construction',
  FOUNDER: 'Founder',
  OTHER: 'Other',
}

export function typeLabel(type: SupplierType | null | undefined): string {
  return type ? TYPE_LABELS[type] : TYPE_LABELS.SUPPLIER
}

/** The terms most suppliers are on, offered in the form. Free text on the
 * server, so whatever a supplier already holds is kept — see termsOptions. */
const COMMON_PAYMENT_TERMS: { value: string; label: string }[] = [
  { value: 'Net 15', label: '15 days' },
  { value: 'Net 30', label: '30 days' },
  { value: 'Net 45', label: '45 days' },
  { value: 'Net 60', label: '60 days' },
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'Prepaid', label: 'Paid in advance' },
]

/** "Net 30" is how it is stored and how it prints on a PO; "30 days" is how a
 * buyer says it. Anything the client typed by hand prints as typed. */
export function termsLabel(paymentTerms: string | null | undefined): string {
  if (!paymentTerms) return 'Not set'
  const known = COMMON_PAYMENT_TERMS.find(
    (t) => t.value.toLowerCase() === paymentTerms.toLowerCase()
  )
  return known ? known.label : paymentTerms
}

/** The terms dropdown, with the supplier's own value folded in when it is not
 * one of the common six — picking through this list must never silently
 * rewrite terms somebody negotiated. */
export function termsOptions(
  current: string | null | undefined
): { value: string; label: string }[] {
  const base = [...COMMON_PAYMENT_TERMS]
  const value = current?.trim()
  if (value && !base.some((t) => t.value.toLowerCase() === value.toLowerCase())) {
    base.unshift({ value, label: `${value} (on file)` })
  }
  return base
}

export const CURRENCY_OPTIONS = ['PHP', 'USD', 'EUR', 'JPY', 'CNY'].map((c) => ({
  value: c,
  label: c,
}))

/** The supplier's VAT status ("VAT-registered", "PEZA"…). The older 12% / none
 * flag only says whether receiving backs out input VAT; the status says why. */
export function vatStatusLabel(
  supplier: Pick<SupplierDetail, 'vatStatus' | 'defaultInputVat'>
): string {
  return SUPPLIER_VAT_STATUS_LABEL[supplierVatStatus(supplier)]
}

/** What a purchase from this supplier starts as: "VATable", "Non-VAT"… */
export function vatStartsAsLabel(
  supplier: Pick<SupplierDetail, 'vatStatus' | 'defaultInputVat'>
): string {
  return inputVatShortName(defaultInputVatCode(supplierVatStatus(supplier)))
}

/** What is held back from the payment and remitted to the BIR: the supplier's
 * EWT code and the ATC on file for it ("EWT-RENT-5 · WC100"). */
export function withholdingLabel(
  supplier: Pick<
    SupplierDetail,
    'defaultWithholding' | 'defaultWithholdingTaxCode' | 'alphanumericTaxCode'
  >
): string {
  const code = supplierEwtCode(supplier)
  if (code === NO_WITHHOLDING_CODE) return 'None'
  const atc = supplier.alphanumericTaxCode?.trim()
  return atc ? `${code} · ${atc}` : `${code} · no ATC`
}

/** The supplier's EWT code with what the master calls it and its rate today —
 * "EWT-RENT-5 — Real Property Rent (5%)". The bare code until the master loads. */
export function withholdingCodeLabel(
  supplier: Pick<SupplierDetail, 'defaultWithholding' | 'defaultWithholdingTaxCode'>,
  options: readonly TaxCodeOption[]
): string {
  const code = supplierEwtCode(supplier)
  const option = options.find((o) => o.code === code)
  return option ? ewtOptionLabel(option) : code
}

export function fmtCreditLimit(creditLimit: number | null | undefined): string {
  if (creditLimit == null || creditLimit === 0) return 'None'
  return `₱${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(creditLimit)}`
}

/** "SUP-0037 · VSTECS Phils., Inc. · TIN 004-521-778-000" — the detail
 * header's second line. A missing TIN is said out loud rather than left off. */
export function supplierSubline(supplier: SupplierDetail): string {
  return [
    supplier.code,
    supplier.legalName?.trim() || supplier.name,
    supplier.taxId?.trim() ? `TIN ${supplier.taxId.trim()}` : 'no TIN on file',
  ].join(' · ')
}

/** What a list row says under the name: what kind of payee it is, the terms
 * it buys on, and who to call. */
export function rowMeta(supplier: SupplierListItem): string {
  return [
    typeLabel(supplier.type),
    termsLabel(supplier.paymentTerms),
    supplier.contactPerson?.trim() || 'no contact on file',
  ].join(' · ')
}
