import { can, hasRole, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS as P } from '@/src/libs/guards/inventory-permissions'
import { PROCUREMENT_PERMISSIONS as PP } from '@/src/libs/guards/procurement-permissions'

/** One end of a document: the branch it belongs to, and what to call it. */
export type ActionQueueSide = { branchId: string | null; label: string }

/** An open transfer, purchase request or purchase order, trimmed to what the queue needs. */
export type ActionQueueDocument = {
  kind: 'transfer' | 'pr' | 'po'
  id: string
  code: string
  status: string
  date: string | null
  from: ActionQueueSide | null
  to: ActionQueueSide | null
  dispatchedById: string | null
}

export type ActionQueueSource = {
  transfers: ActionQueueDocument[]
  purchaseRequests: ActionQueueDocument[]
  purchaseOrders: ActionQueueDocument[]
}

export type ActionQueueItem = {
  ruleKey: string
  verb: string
  doc: ActionQueueDocument
  href: string
  ageDays: number | null
}

export type ActionQueueGroup = { key: string; label: string; count: number }

export type ActionQueue = { total: number; groups: ActionQueueGroup[]; items: ActionQueueItem[] }

type Rule = {
  key: string
  /** Chip label, plural sense ("To receive"). */
  label: string
  /** Row verb ("Receive"). */
  verb: string
  kind: ActionQueueDocument['kind']
  statuses: string[]
  permission: string
  /** Which branch acts: the source, the destination, or anyone holding the permission. */
  side: 'from' | 'to' | 'any'
}

// Mirrors TransferDetailModal's action buttons: each status waits on one
// branch (source or destination) holding one permission.
const RULES: Rule[] = [
  {
    key: 'receive',
    label: 'To receive',
    verb: 'Receive',
    kind: 'transfer',
    statuses: ['in_transit', 'partially_received'],
    permission: P.TRANSFERS_RECEIVE,
    side: 'to',
  },
  {
    key: 'dispatch',
    label: 'To dispatch',
    verb: 'Dispatch',
    kind: 'transfer',
    statuses: ['draft'],
    permission: P.TRANSFERS_DISPATCH,
    side: 'from',
  },
  {
    key: 'accept',
    label: 'To accept',
    verb: 'Accept request',
    kind: 'transfer',
    statuses: ['requested'],
    permission: P.TRANSFERS_ACCEPT,
    side: 'from',
  },
  {
    key: 'manager',
    label: 'Manager approval',
    verb: 'Approve request',
    kind: 'transfer',
    statuses: ['pending_manager_approval'],
    permission: P.TRANSFERS_MANAGER_APPROVE,
    side: 'to',
  },
  {
    key: 'hq',
    label: 'HQ approval',
    verb: 'HQ approve',
    kind: 'transfer',
    statuses: ['pending_hq_approval'],
    permission: P.TRANSFERS_HQ_APPROVE,
    side: 'any',
  },
  {
    key: 'substitution',
    label: 'Substitutes',
    verb: 'Confirm substitute',
    kind: 'transfer',
    statuses: ['pending_substitution_confirmation'],
    permission: P.TRANSFERS_CONFIRM_SUBSTITUTION,
    side: 'to',
  },
  {
    key: 'po-receive',
    label: 'POs to receive',
    verb: 'Receive PO',
    kind: 'po',
    statuses: ['sent', 'partially_received'],
    permission: P.RECEIVE_CREATE,
    side: 'any',
  },
  {
    key: 'po-approve',
    label: 'POs to approve',
    verb: 'Approve PO',
    kind: 'po',
    statuses: ['draft'],
    permission: PP.PO_APPROVE,
    side: 'any',
  },
  {
    key: 'po-send',
    label: 'POs to send',
    verb: 'Send PO',
    kind: 'po',
    statuses: ['approved'],
    permission: PP.PO_SEND,
    side: 'any',
  },
  {
    key: 'pr-convert',
    label: 'PRs to order',
    verb: 'Raise PO',
    kind: 'pr',
    statuses: ['submitted'],
    permission: PP.PO_CREATE,
    side: 'any',
  },
]

/** Head Office (no branch) acts for every branch; a standalone warehouse only reaches its region's users. */
function inScope(me: SessionUser, side: ActionQueueSide | null): boolean {
  if (!me.branchId) return true
  return !!side && (side.branchId === me.branchId || side.branchId === null)
}

function matches(me: SessionUser, rule: Rule, doc: ActionQueueDocument): boolean {
  if (doc.kind !== rule.kind || !rule.statuses.includes(doc.status)) return false
  if (!can(me, rule.permission)) return false
  if (rule.side !== 'any' && !inScope(me, rule.side === 'from' ? doc.from : doc.to)) return false
  // The backend refuses a receive by whoever dispatched it (Business Owner exempt).
  if (rule.key === 'receive' && doc.dispatchedById === me.id) return hasRole(me, 'Business Owner')
  return true
}

function hrefOf(doc: ActionQueueDocument): string {
  if (doc.kind === 'transfer') {
    return `/inventory/stock-transaction?tab=transfers&transfer=${encodeURIComponent(doc.code)}`
  }
  if (doc.kind === 'po') return `/inventory/stock-transaction?tab=purchase-orders&po=${doc.id}`
  return '/inventory/stock-transaction?tab=purchase-orders'
}

function ageInDays(date: string | null): number | null {
  if (!date) return null
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000))
}

/** Sorts every open document into the steps waiting on this user, oldest first. */
export function buildActionQueue(me: SessionUser, source: ActionQueueSource): ActionQueue {
  const docs = [...source.transfers, ...source.purchaseRequests, ...source.purchaseOrders]
  const items: ActionQueueItem[] = []
  for (const doc of docs) {
    const rule = RULES.find((r) => matches(me, r, doc))
    if (rule) {
      items.push({
        ruleKey: rule.key,
        verb: rule.verb,
        doc,
        href: hrefOf(doc),
        ageDays: ageInDays(doc.date),
      })
    }
  }
  items.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1))
  const groups = RULES.map((r) => ({
    key: r.key,
    label: r.label,
    count: items.filter((i) => i.ruleKey === r.key).length,
  })).filter((g) => g.count > 0)
  return { total: items.length, groups, items }
}
