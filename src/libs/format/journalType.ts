// "CashReceiptJournal" -> "Cash Receipt" — a screen that only ever shows journal
// entries has no use for the repeated "Journal" suffix or the camel-casing.
export function formatJournalType(t: string | undefined | null): string {
  if (!t) return '—'
  return t.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s*Journal$/, '')
}

// An entry has one journal type, but a line can belong to another (an
// installment down payment is a Cash Receipt on the sale's Sales Journal
// entry), so the label names every journal the entry's lines touch:
// "Sales" or "Sales + Cash Receipt".
export function entryJournalLabel(entry: {
  journalType?: string | null
  transactions?: { journalType?: string | null }[] | null
}): string {
  const others = new Set(
    (entry.transactions ?? [])
      .map((t) => t.journalType)
      .filter((t): t is string => !!t && t !== entry.journalType)
  )
  return [formatJournalType(entry.journalType), ...[...others].map(formatJournalType)].join(' + ')
}
