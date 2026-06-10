import {
  Supplier,
  SupplierOnboardingStatus,
  SupplierStatus,
} from '@/src/schema/procurement/suppliers/types'

export function formatStatus(s: string) {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function getStatusColor(status: SupplierStatus) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'inactive':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'blacklisted':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export function getOnboardingColor(status: SupplierOnboardingStatus) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'in_review':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'blocked':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export function formatCurrency(amount: number | null | undefined, code = 'PHP') {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(Number(amount))
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`
  }
}

export function getSupplierLine(s: Pick<Supplier, 'contactPerson' | 'email' | 'phone'>) {
  return [s.contactPerson, s.email, s.phone].filter(Boolean).join(' · ')
}
