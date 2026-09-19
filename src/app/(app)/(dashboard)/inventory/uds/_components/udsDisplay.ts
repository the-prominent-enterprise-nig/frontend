import { Truck, Clock, PackageCheck, CheckCircle2, XCircle, Wrench, Ban } from 'lucide-react'
import type { UdsStatus, UdsAssessment, UdsReason } from '@/src/schema/inventory/uds'

/**
 * How each status looks wherever it appears.
 *
 * `badge` is the tinted pill used in the table; `tone` is the saturated
 * version the band's icons need — deliberately stronger, because it sits on
 * white rather than on its own tint. `note` is what the status means in one
 * line, which the band has room for and the pill does not.
 */
export const STATUS_CONFIG: Record<
  UdsStatus,
  { badge: string; tone: string; note: string; icon: React.ElementType }
> = {
  issued: {
    badge: 'bg-blue-100 text-blue-700',
    tone: 'text-blue-600',
    note: 'raised, still at the branch',
    icon: Clock,
  },
  in_transit: {
    badge: 'bg-yellow-100 text-yellow-700',
    tone: 'text-yellow-600',
    note: 'on the way to main',
    icon: Truck,
  },
  received: {
    badge: 'bg-purple-100 text-purple-700',
    tone: 'text-purple-600',
    note: 'at main, awaiting assessment',
    icon: PackageCheck,
  },
  at_provider: {
    badge: 'bg-amber-100 text-amber-700',
    tone: 'text-amber-600',
    note: 'with the service centre',
    icon: Wrench,
  },
  repaired: {
    badge: 'bg-teal-100 text-teal-700',
    tone: 'text-teal-600',
    note: 'back, waiting to close',
    icon: PackageCheck,
  },
  completed: {
    badge: 'bg-green-100 text-green-700',
    tone: 'text-green-600',
    note: 'closed out',
    icon: CheckCircle2,
  },
  cancelled: {
    badge: 'bg-zinc-100 text-zinc-500',
    tone: 'text-zinc-400',
    note: 'called off',
    icon: XCircle,
  },
}

/**
 * The journey, in order. `cancelled` is deliberately absent: it is not a stage
 * a unit passes through, and a permanent tile for it would take a sixth of the
 * band to report a number that is usually zero. The band appends it only when
 * there is something to show.
 */
export const PIPELINE_STATUSES: UdsStatus[] = [
  'issued',
  'in_transit',
  'received',
  'at_provider',
  'repaired',
  'completed',
]

export const ASSESSMENT_CONFIG: Record<UdsAssessment, { color: string; icon: React.ElementType }> =
  {
    repairable: { color: 'bg-green-100 text-green-700', icon: Wrench },
    unrepairable: { color: 'bg-red-100 text-red-700', icon: Ban },
  }

export const REASON_DOT: Record<UdsReason, string> = {
  repair: 'bg-red-500',
  maintenance: 'bg-orange-500',
  quality_check: 'bg-yellow-500',
  pull_out: 'bg-purple-500',
  loan: 'bg-blue-500',
}

// Mirrors TransferList's own STATUS_CONFIG colors (not exported from there) —
// kept minimal since this is just an inline reference badge, not the transfers
// module's own status UI.
export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_transit: 'In Transit',
  received: 'Received',
  cancelled: 'Cancelled',
}
