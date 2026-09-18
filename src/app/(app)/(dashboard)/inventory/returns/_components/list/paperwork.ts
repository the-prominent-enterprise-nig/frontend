import type { ReturnSummary } from '@/src/schema/inventory/returns'

/**
 * One document the return should be traceable through.
 *
 * `tone` is the whole point of this file. A missing credit memo on a cash
 * return and a missing credit memo on a charge sale are the same empty field
 * and two completely different facts, and the panel used to print both as a
 * grey "None issued" — so the one that needed chasing was invisible among the
 * five that did not.
 */
export type PaperRef = {
  label: string
  /** The number itself, or, when there is none, what its absence means. */
  value: string
  /** `missing` is the only one anybody has to act on. */
  tone: 'filled' | 'n/a' | 'missing'
  href?: string
}

type RefSpec = {
  label: string
  value?: string | null
  /** What to print in place of a number, and whether to chase it. */
  absent: string
  chase?: boolean
  href?: string
}

function resolve({ label, value, absent, chase, href }: RefSpec): PaperRef {
  if (!value) return { label, value: absent, tone: chase ? 'missing' : 'n/a' }
  return { label, value, tone: 'filled', href }
}

/**
 * Every reference the return carries, in the order somebody reading it back
 * over the phone would want them: what we issued, what we credited, what it
 * was issued against.
 */
export function paperworkRefs(ret: ReturnSummary): PaperRef[] {
  const creditExpected = !!ret.arInvoiceId
  // A repair intake moves no stock, so it posts no journal. Its absence is
  // the correct outcome, not an omission.
  const movedStock = ret.outcome !== 'in_repair'

  return [
    resolve({
      label: 'Return no.',
      value: ret.returnNumber,
      absent: '—',
    }),
    resolve({
      label: 'Receiving report',
      value: ret.receivingReportNumber,
      absent: 'Not issued',
      chase: true,
    }),
    resolve({
      label: 'Credit memo',
      value: ret.creditMemoNumber,
      absent: creditExpected ? 'Not issued' : '—',
      chase: creditExpected,
      href: '/accounting/credit-memos',
    }),
    resolve({
      label: 'Journal entry',
      value: ret.journalEntryId ? 'Posted' : null,
      absent: movedStock ? 'Not posted' : '—',
      chase: movedStock,
      href: ret.journalEntryId ? `/accounting/journal-entries/${ret.journalEntryId}` : undefined,
    }),
    resolve({
      label: 'Sales invoice',
      value: ret.salesInvoiceNumber,
      absent: '—',
    }),
    resolve({
      label: 'POS transaction',
      value: ret.posTransactionNumber,
      absent: '—',
    }),
  ]
}

/** How many of them somebody still has to go and get. */
export function outstandingCount(refs: PaperRef[]): number {
  return refs.filter((r) => r.tone === 'missing').length
}
