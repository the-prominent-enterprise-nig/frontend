import { PackageCheck, AlertTriangle, Trash2, Wrench, Repeat } from 'lucide-react'
import type { ReturnSummary } from '@/src/schema/inventory/returns'
import type { ReturnOutcome } from '../../_actions/get-returns'

/**
 * Reads both vocabularies on purpose.
 *
 * Rows written before the return document carry a ReturnCondition
 * (sellable/damaged) in this field; rows written since carry a
 * ReturnDisposition. Both will sit on this list for as long as the POS
 * void/refund path keeps writing the old shape, which is indefinitely — so
 * this is not a migration window, it is the steady state.
 */
export const CONDITION_CONFIG: Record<
  string,
  { label: string; className: string; dot: string; icon: typeof PackageCheck }
> = {
  sellable: {
    label: 'Sellable',
    className: 'bg-green-100 text-green-700',
    dot: 'bg-green-600',
    icon: PackageCheck,
  },
  damaged: {
    label: 'Damaged',
    className: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    icon: AlertTriangle,
  },
  restock: {
    label: 'Restocked',
    className: 'bg-green-100 text-green-700',
    dot: 'bg-green-600',
    icon: PackageCheck,
  },
  quarantine: {
    label: 'Quarantined',
    className: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    icon: AlertTriangle,
  },
  scrap: {
    label: 'Scrapped',
    className: 'bg-zinc-200 text-zinc-700',
    dot: 'bg-zinc-500',
    icon: Trash2,
  },
  repair: {
    label: 'For repair',
    className: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    icon: Wrench,
  },
  exchange: {
    label: 'Exchanged',
    className: 'bg-prominent-purple-100 text-prominent-purple-700',
    dot: 'bg-prominent-purple-500',
    icon: Repeat,
  },
}

/**
 * The three shapes of record this list unions, in the words the counter uses
 * for them, plus the one-line answer to "and then what happened to it".
 *
 * These are not statuses and they do not progress — a repair intake never
 * becomes a POS restock. The band reads as a pipeline because that is how the
 * work divides up, not because a row moves along it.
 */
export const OUTCOME_META: Record<
  ReturnOutcome,
  { label: string; rowLabel: string; note: string; dot: string; chip: string }
> = {
  document: {
    label: 'Return documents',
    rowLabel: 'Return document',
    note: 'raised at the counter',
    dot: 'bg-prominent-purple-500',
    chip: 'bg-prominent-purple-50 text-prominent-purple-700',
  },
  in_repair: {
    label: 'Repair intakes',
    rowLabel: 'In repair',
    note: 'out with service, no stock moved',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700',
  },
  restocked: {
    label: 'POS restocks',
    rowLabel: 'Restocked',
    note: 'back in available stock',
    dot: 'bg-green-600',
    chip: 'bg-green-50 text-green-700',
  },
}

/** Fixed order, so the band never reshuffles between fetches. */
export const OUTCOME_ORDER: ReturnOutcome[] = ['document', 'in_repair', 'restocked']

export type DispositionTally = { disposition: string; count: number }

/**
 * What became of the units on a multi-line document, in the order the lines
 * were entered.
 *
 * A document deliberately reports `condition: null` when its lines disagree —
 * there is no one answer, and inventing one would read as though the other
 * lines had been forgotten. So the row shows all of them instead, which is
 * the honest version of the same cell. Before this it showed a dash, and a
 * three-line return was indistinguishable from an unclassified one.
 */
export function tallyDispositions(ret: ReturnSummary): DispositionTally[] {
  const counts = new Map<string, number>()
  for (const line of ret.lines ?? []) {
    if (!line.disposition) continue
    counts.set(line.disposition, (counts.get(line.disposition) ?? 0) + 1)
  }
  return [...counts.entries()].map(([disposition, count]) => ({ disposition, count }))
}

export type ItemSummary = { title: string; detail: string | null; mono: boolean }

/**
 * What the Item cell says, and the identity line under it.
 *
 * The identity line carries the SKU and the serial together, because the
 * serial is the row's real name on serial-tracked goods and it no longer has
 * a column of its own — the table gave that width to Customer, which used to
 * disappear below `lg` and is asked for far more often than a SKU is.
 */
export function itemSummary(ret: ReturnSummary): ItemSummary {
  const lines = ret.lines ?? []
  if (ret.item) {
    const detail = [ret.item.sku, ret.serialNumber].filter(Boolean).join(' · ')
    return { title: ret.item.name, detail: detail || null, mono: true }
  }
  if (!lines.length) return { title: '—', detail: null, mono: false }

  const names = lines.map((l) => l.item?.name).filter((n): n is string => !!n)
  const count = ret.lineCount ?? lines.length
  return {
    title: `${count} items`,
    detail: names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ', …' : '') : null,
    mono: false,
  }
}

/**
 * Whether a document is anything other than normally posted.
 *
 * Returns null for `posted`, which is the overwhelming majority and needs no
 * badge — flagging every healthy row is how a badge stops being read.
 */
export function abnormalStatus(ret: ReturnSummary): string | null {
  if (!ret.status || ret.status === 'posted') return null
  return ret.status
}

export type ReturnStatusNote = {
  tone: 'warn' | 'info'
  title: string
  body: string
  action?: { label: string; href: string }
}

/**
 * The one thing about this return that somebody still has to know, or null.
 *
 * Deliberately silent on a healthy row. A panel that opens with a card saying
 * everything is fine teaches people to skip the card, and then the amber one
 * gets skipped with it.
 */
export function returnStatusNote(ret: ReturnSummary): ReturnStatusNote | null {
  const abnormal = abnormalStatus(ret)
  if (abnormal) {
    return {
      tone: 'warn',
      title: `This return is ${abnormal}`,
      body: 'Nothing moved in stock or in the ledger while it sits in this state.',
    }
  }
  if (ret.arInvoiceId && !ret.creditMemoNumber) {
    return {
      tone: 'warn',
      title: 'The credit did not go through',
      body:
        ret.accountingNote ??
        'The sale was on account, so a credit memo was expected against it. None was raised.',
    }
  }
  if (ret.outcome === 'in_repair') {
    return {
      tone: 'info',
      title: 'The unit is with service',
      body: `No stock moved — it is still the customer's property${
        ret.uds ? `, held on ${ret.uds.code}` : ''
      }.`,
      action: ret.uds ? { label: 'Open the custody sheet', href: '/inventory/uds' } : undefined,
    }
  }
  if (ret.accountingNote) {
    return { tone: 'info', title: 'Accounting note', body: ret.accountingNote }
  }
  return null
}

/** The custody sheets this return raised, deduplicated.
 *
 * A row carries them in one of two places and never both: a legacy single-unit
 * repair hangs the UDS off the row itself, while a return document hangs one
 * off each line sent to repair. Several repaired lines on one document share a
 * sheet only by coincidence — each line raises its own — so the list is worth
 * deduplicating but is usually as long as the repaired lines. */
export function udsRefs(ret: ReturnSummary): { id: string; code: string; status: string }[] {
  const fromLines = (ret.lines ?? []).map((l) => l.uds).filter((u) => !!u)
  const all = ret.uds ? [ret.uds, ...fromLines] : fromLines
  return [...new Map(all.map((u) => [u.id, u])).values()]
}
