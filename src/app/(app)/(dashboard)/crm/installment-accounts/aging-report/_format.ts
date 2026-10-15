import type { AgingBucket } from '@/src/schema/crm/types'

// Same badge convention the inventory aging report already uses.
export const BUCKET_STYLES: Record<AgingBucket, string> = {
  current: 'bg-green-100 text-green-700',
  '1_30': 'bg-yellow-100 text-yellow-700',
  '31_60': 'bg-orange-100 text-orange-700',
  '61_90': 'bg-red-100 text-red-700',
  '90_plus': 'bg-red-200 text-red-800',
}

export function fmt(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
