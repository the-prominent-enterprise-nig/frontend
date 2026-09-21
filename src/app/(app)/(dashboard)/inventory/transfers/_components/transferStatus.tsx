'use client'

import {
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Inbox,
  Hourglass,
  Ban,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'
import type { TransferStatus } from '@/src/schema/inventory/transfers'

// Shared by the Transfers list and the Item 360 drawer's Transfers tab
// (Scenario 56), so a transfer's status reads the same in both places.
// This screen follows the Stock Transfers design's own #5b21b6 palette — the
// same system the Purchase Orders screens use, which is why the badge spec and
// colour values come from procurementTokens.
// `tone` is the saturated per-status colour the design uses for the KPI tile
// and pill icons — deliberately stronger than the badge's text colour, which
// has to stay readable on its own tinted background.
export const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; badge: string; tone: string; icon: React.ElementType }
> = {
  requested: {
    label: 'Requested',
    badge: 'bg-[#f1ebfb] text-[#3f1490]',
    tone: 'text-[#7c4fd1]',
    icon: Inbox,
  },
  draft: {
    label: 'Accepted',
    badge: 'bg-[#eaf0fb] text-[#1f4b99]',
    tone: 'text-[#3b74cc]',
    icon: Clock,
  },
  in_transit: {
    label: 'In Transit',
    badge: 'bg-[#fdf3e7] text-[#8a4b06]',
    tone: 'text-[#d18b1d]',
    icon: Truck,
  },
  received: {
    label: 'Received',
    badge: 'bg-[#e7f5ef] text-[#0b6644]',
    tone: 'text-[#0f7b52]',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-[#fdeceb] text-[#b42318]',
    tone: 'text-[#d9544c]',
    icon: Ban,
  },
  pending_manager_approval: {
    label: 'Pending',
    badge: 'bg-[#f1f1f4] text-[#3d3d4a]',
    tone: 'text-[#5b5b6b]',
    icon: UserCheck,
  },
  pending_hq_approval: {
    label: 'Pending HQ Approval',
    badge: 'bg-[#fdf3e7] text-[#8a4b06]',
    tone: 'text-[#d18b1d]',
    icon: Hourglass,
  },
  partially_received: {
    label: 'Partially Received',
    badge: 'bg-[#fdf3e7] text-[#8a4b06]',
    tone: 'text-[#d18b1d]',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-[#f6f6f8] text-[#5b5b6b]',
    tone: 'text-[#8b8b9b]',
    icon: XCircle,
  },
}

// Each branch has exactly one warehouse, so a transfer's fromWarehouse/
// toWarehouse is really a branch — display the branch's own name rather than
// the warehouse's auto-generated "{branch} Warehouse" name.
export function branchLabel(
  wh: { name: string; branch?: { name: string } | null } | null | undefined
): string {
  return wh?.branch?.name ?? wh?.name ?? '—'
}

export function StatusChip({ status }: { status: TransferStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-[9px] py-[3px] text-[11.5px] font-medium ${cfg.badge}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  )
}
