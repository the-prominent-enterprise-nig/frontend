// How one supplier reads on the Suppliers screen: the two statuses it carries,
// what its onboarding is still missing, and the shorthand the list and the
// detail both print.
//
// These live together because the list row, the detail header and the form all
// describe the same supplier — a second hand-rolled copy of "is this one
// ready" is how a row and the panel it opens end up disagreeing.

import type {
  SupplierDetail,
  SupplierListItem,
  SUPPLIER_ONBOARDING_STATUSES,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
} from '@/src/schema/inventory/suppliers'

export type OnboardingStatus = (typeof SUPPLIER_ONBOARDING_STATUSES)[number]
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]
export type SupplierType = (typeof SUPPLIER_TYPES)[number]

/** Whether a supplier may be picked on new paperwork at all. Onboarding is a
 * separate question — an approved supplier that has been switched off is still
 * approved, it is just no longer offered. */
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

/** How far through onboarding the supplier is. Only `approved` means the
 * buying team has signed it off; the rest all read as unfinished. */
export const ONBOARDING_META: Record<
  OnboardingStatus,
  { label: string; chip: string; headline: string; hint: string }
> = {
  pending: {
    label: 'Pending',
    chip: 'bg-[#fdf3e7] text-[#8a4b06]',
    headline: 'Pending onboarding',
    hint: 'Nobody has looked at this supplier yet',
  },
  in_review: {
    label: 'In review',
    chip: 'bg-[#fdf3e7] text-[#8a4b06]',
    headline: 'In review',
    hint: 'Being checked before the buying team may use it',
  },
  approved: {
    label: 'Approved',
    chip: 'bg-[#e7f5ef] text-[#0b6644]',
    headline: 'Approved',
    hint: 'Signed off — purchase orders may be raised against it',
  },
  blocked: {
    label: 'Blocked',
    chip: 'bg-[#fdeceb] text-[#b42318]',
    headline: 'Blocked — no new purchase orders',
    hint: 'Somebody stopped this onboarding',
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

/** 12% or nothing: whether receiving from this supplier backs out claimable
 * Input VAT, or carries the goods at the full quoted price. */
export function vatLabel(vat: SupplierDetail['defaultInputVat']): string {
  return vat === 'none' ? 'None' : '12%'
}

/** What is held back from the payment and remitted to the BIR. */
export function withholdingLabel(
  withholding: SupplierDetail['defaultWithholding'],
  atc?: string | null
): string {
  if (withholding === 'none') return 'None'
  return atc?.trim() ? `1% · ${atc.trim()}` : '1% · no ATC'
}

export function fmtCreditLimit(creditLimit: number | null | undefined): string {
  if (creditLimit == null || creditLimit === 0) return 'None'
  return `₱${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(creditLimit)}`
}

/** One thing onboarding needs on file. Nothing here blocks approval — a gap
 * is named so whoever approves knows what they are waving through, because
 * each one costs somebody downstream: no TIN stalls the BIR filing, no bank
 * account stalls the payment. */
export type ReadinessCheck = {
  key: 'taxId' | 'bank' | 'contact' | 'terms'
  label: string
  ok: boolean
  /** What is on file, or what its absence costs. */
  note: string
}

export function readinessChecks(supplier: SupplierDetail): ReadinessCheck[] {
  const banks = supplier.bankAccounts ?? []
  const contact = supplier.contactPerson?.trim()
  const taxId = supplier.taxId?.trim()
  const terms = supplier.paymentTerms?.trim()

  return [
    {
      key: 'taxId',
      label: 'Tax ID on file',
      ok: !!taxId,
      note: taxId || 'Needed for the BIR filings',
    },
    {
      key: 'bank',
      label: 'Bank account',
      ok: banks.length > 0,
      note: banks.length ? `${banks.length} on file` : 'Payments cannot be released without one',
    },
    {
      key: 'contact',
      label: 'Contact person',
      ok: !!contact,
      note: contact || 'Nobody to chase on a late delivery',
    },
    {
      key: 'terms',
      label: 'Buying terms',
      ok: !!terms,
      note: terms ? termsLabel(terms) : 'Every PO would fall back to a default',
    },
  ]
}

/** The one verb offered on an unfinished onboarding, and what it writes. */
export function nextOnboardingStep(
  status: OnboardingStatus
): { next: OnboardingStatus; label: string; tone: 'purple' | 'green' } | null {
  switch (status) {
    case 'pending':
      return { next: 'in_review', label: 'Send for review', tone: 'purple' }
    case 'in_review':
      return { next: 'approved', label: 'Approve supplier', tone: 'green' }
    case 'blocked':
      return { next: 'in_review', label: 'Reopen onboarding', tone: 'purple' }
    case 'approved':
      return null
  }
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
