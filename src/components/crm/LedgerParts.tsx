'use client'

import type { ElementType, ReactNode } from 'react'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { useMe } from '@/src/hooks/useMe'
import { LEDGER_NOTE_LABELS } from '@/src/libs/format/ledgerNote'
import { ledgerRefHref } from '@/src/libs/format/ledgerRef'
import type { InstallmentLedgerRow, LedgerNote, LedgerRefLink } from '@/src/schema/crm/types'

// Same recipe as the Sale / Bill / Penalty / Payment tags beside it
// (ExistingAccountLedger's PILL): a pale fill, no outline.
const NOTE_STYLES: Record<LedgerNote, string> = {
  repair: 'bg-prominent-purple-100 text-prominent-purple-700',
  return: 'bg-indigo-50 text-indigo-700',
  paused: 'bg-gray-100 text-ink-muted',
  repossess: 'bg-red-50 text-red-700',
  cm: 'bg-teal-50 text-teal-700',
}

/** A ledger row's Ref — a link that opens its document in a new tab when the
 * server says which one and this user may open it, plain text otherwise. */
export function LedgerRef({
  value,
  link,
  fallback = '',
}: {
  value: string
  link?: LedgerRefLink
  fallback?: string
}): ReactNode {
  const { data: me } = useMe()
  const href = value && link ? ledgerRefHref(link, me ?? null) : null
  if (!href) return value || fallback
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in a new tab"
      data-testid="ledger-ref-link"
      className="text-prominent-purple-700 underline-offset-2 hover:underline"
    >
      {value}
    </a>
  )
}

/** The Repair / Return note beside a ledger row's description. */
export function LedgerNotePill({ note }: { note?: LedgerNote }): ReactNode {
  if (!note) return null
  return (
    <span
      data-testid={`ledger-note-${note}`}
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${NOTE_STYLES[note]}`}
    >
      {LEDGER_NOTE_LABELS[note]}
    </span>
  )
}

// The pieces both customer-ledger views are drawn from — the single plan's
// paper-form ledger (InstallmentLedgerBody) and the whole-customer one
// (CustomerLedgerView) — so the two read as one page. Same look as the
// installment account page: white cards with an icon heading, a pale band of
// headline figures, and text sized and contrasted for easy reading.

// The app's shared card recipe (DashboardWidgetWrapper's CARD_SHADOW_RESTING):
// a soft layered shadow that reads as depth without going heavy.
export const LEDGER_CARD =
  'rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(29,15,56,0.03),0_8px_24px_-8px_rgba(29,15,56,0.08)]'

/** A secondary action in the ledger header. */
export const LEDGER_ACTION =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50'

/** A titled card — an icon, a heading, and its content. */
export function LedgerCard({
  title,
  icon: Icon,
  className = '',
  children,
}: {
  title: string
  icon: ElementType
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`${LEDGER_CARD} p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-prominent-purple-100 text-prominent-purple-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-[14px] font-semibold text-prominent-purple-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

/** The ledger's header card: who it is and what can be done to it, over a pale
 * band of the figures that matter most. */
export function LedgerHero({
  header,
  figures,
}: {
  header: ReactNode
  /** `negative` shows the figure in red, as the Due column shows a negative
   * due (Scenario 84, CL-07: an advance payment). */
  figures: { label: string; value: string; accent?: boolean; negative?: boolean }[]
}) {
  return (
    <div className={`${LEDGER_CARD} overflow-hidden`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        {header}
      </header>
      <div
        className={`grid grid-cols-2 gap-x-6 gap-y-3 border-t border-prominent-purple-100 bg-prominent-purple-50 px-5 py-3 sm:grid-cols-3 lg:gap-x-0 lg:divide-x lg:divide-prominent-purple-200 ${
          figures.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
        }`}
      >
        {figures.map((f) => (
          <div key={f.label} className="lg:px-5 lg:first:pl-0">
            <p className="text-[12px] text-gray-600">{f.label}</p>
            <p
              className={`mt-0.5 text-xl font-semibold tracking-tight ${
                f.negative
                  ? 'text-red-600'
                  : f.accent
                    ? 'text-prominent-orange-800'
                    : 'text-prominent-purple-900'
              }`}
            >
              {f.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Labelled values: each label over its value, `columns` to a row. */
export function LedgerFields({
  fields,
  columns = 2,
}: {
  fields: { label: string; value: ReactNode }[]
  columns?: 2 | 3 | 4 | 6
}) {
  const cols =
    columns === 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      : columns === 4
        ? 'grid-cols-2 lg:grid-cols-4'
        : columns === 3
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-2'
  return (
    <dl className={`grid gap-x-5 gap-y-2.5 ${cols}`}>
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="text-[12px] text-gray-600">{f.label}</dt>
          <dd className="text-[13px] font-medium text-prominent-purple-900">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The Date / Ref / Inst. / Description / Debit / Credit / Due / Outstanding
 * table — one row per ledger event, with the debit and credit totals at the
 * foot (a display-only row is shown but never added in).
 *
 * `showScheme` adds a Scheme column after Description — each sale's Price Use
 * (WIP, SSC, …) or "Price Override" — on the sale's own row, blank on the
 * rest. The all-purchases ledger has no header to carry a Scheme, so its
 * table does; a single plan's ledger shows it in its Sale card instead. */
export function LedgerTable({
  rows,
  showScheme = false,
}: {
  rows: InstallmentLedgerRow[]
  showScheme?: boolean
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No ledger activity yet.</p>
  }
  const sum = (pick: (r: InstallmentLedgerRow) => number) =>
    rows.filter((r) => !r.displayOnly).reduce((total, r) => total + pick(r), 0)
  const schemeColumn = showScheme && rows.some((r) => r.scheme)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-gray-50 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-600">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Ref</th>
            <th className="px-3 py-2 text-right">Inst.</th>
            <th className="px-3 py-2">Description</th>
            {schemeColumn && <th className="px-3 py-2">Scheme</th>}
            <th className="px-3 py-2 text-right">Debit</th>
            <th className="px-3 py-2 text-right">Credit</th>
            <th className="px-3 py-2 text-right">Due</th>
            <th className="px-3 py-2 text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{fmtDate(row.date)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[13px] text-gray-600">
                <LedgerRef value={row.ref} link={row.refLink} />
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right text-gray-600">
                {row.instLabel ?? (row.inst > 0 ? row.inst : '—')}
              </td>
              <td className="px-3 py-1.5 font-medium text-prominent-purple-900">
                <span className="flex items-start gap-2">
                  <LedgerNotePill note={row.note} />
                  <span className="min-w-0">{row.description}</span>
                </span>
              </td>
              {schemeColumn && (
                <td className="whitespace-nowrap px-3 py-1.5 text-gray-800">{row.scheme ?? ''}</td>
              )}
              <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-800">
                {row.debit > 0 ? fmtMoney(row.debit) : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-800">
                {row.credit > 0 ? fmtMoney(row.credit) : '—'}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                  row.due < 0 ? 'text-red-600' : 'text-gray-800'
                }`}
              >
                {fmtMoney(row.due)}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-prominent-purple-900">
                {fmtMoney(row.outstanding)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-prominent-purple-100 bg-prominent-purple-50 font-semibold text-prominent-purple-900">
            <td className="px-3 py-2" colSpan={schemeColumn ? 5 : 4}>
              Total
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {fmtMoney(sum((r) => r.debit))}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {fmtMoney(sum((r) => r.credit))}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const BANNER_STYLES = {
  repossess: 'border-red-200 bg-red-50 text-red-800',
  return: 'border-indigo-200 bg-indigo-50 text-indigo-900',
} as const

/** One banner per repossessed or returned unit, read off the ledger's own
 * rows — the Repossess / Return row and the CM rows that follow it on the
 * same RR — so it can never say something the table doesn't. */
export function LedgerEventBanners({ rows }: { rows: InstallmentLedgerRow[] }): ReactNode {
  const banners = rows.flatMap((row) =>
    row.note === 'repossess' || row.note === 'return'
      ? [
          {
            key: `${row.note}-${row.ref}-${row.date}`,
            note: row.note,
            text: bannerText(row, rows),
          },
        ]
      : []
  )
  if (banners.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      {banners.map((b) => (
        <div
          key={b.key}
          role="status"
          data-testid={`ledger-banner-${b.note}`}
          className={`rounded-2xl border px-5 py-3 text-[13px] leading-relaxed ${BANNER_STYLES[b.note]}`}
        >
          {b.text}
        </div>
      ))}
    </div>
  )
}

/** What the banner says for one Repossess / Return row. */
function bannerText(row: InstallmentLedgerRow, rows: InstallmentLedgerRow[]): string {
  const when = `${fmtDate(row.date)} (${row.ref})`
  const memos = rows.filter((r) => r.note === 'cm' && r.ref === row.ref)
  if (row.note === 'return') return returnBannerText(row, memos, when)
  const outstanding = rows[rows.length - 1]?.outstanding ?? 0
  const credited = memos.map((m) => `${memoName(m.description)} of ${fmtMoney(m.credit)}`)
  const memoSentence = credited.length
    ? ` The ${joinAnd(credited)} ${credited.length === 1 ? 'was' : 'were'} credited through ${
        credited.length === 1 ? 'a credit memo' : `${credited.length} credit memos`
      } when the RR was encoded.`
    : ''
  const closing = ` Outstanding is now ${fmtMoney(outstanding)}, so billing and penalties have stopped.`
  return `Unit repossessed on ${when}.${memoSentence}${closing}`
}

/** "Repo cost · auto-posted from RR-…" → "repo cost". */
function memoName(description: string): string {
  const name = description.split(' · ')[0]
  return name.startsWith('ID') ? 'installment difference' : name.toLowerCase()
}

function joinAnd(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five']
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n)

/** The return banner — the client's SALES RETURN mockup wording, full or
 * partial (the row says "(1 of 20) · … · account stays active"). */
function returnBannerText(
  row: InstallmentLedgerRow,
  memos: InstallmentLedgerRow[],
  when: string
): string {
  const partial = row.description.match(
    /^Unit returned \((\d+) of (\d+)\) · (.*) · account stays active$/
  )
  const units = partial ? partial[3] : row.description.replace(/^Unit returned( · )?/, '')
  if (memos.length === 0) return `Unit returned on ${when}${units ? ` · ${units}` : ''}.`
  const after = memos[memos.length - 1].outstanding
  const memoCount = `${countWord(memos.length)} credit memo${memos.length === 1 ? '' : 's'}`
  if (partial) {
    const [returned, total] = [Number(partial[1]), Number(partial[2])]
    const kept = total - returned
    return `${countWord(returned)} unit${returned === 1 ? '' : 's'} (${units}) ${
      returned === 1 ? 'was' : 'were'
    } returned on ${when}. The account stays active and the other ${kept} unit${
      kept === 1 ? '' : 's'
    } keep billing. ${memoCount} for ${returned === 1 ? 'that unit' : 'those units'} ${
      memos.length === 1 ? 'was' : 'were'
    } posted automatically, so outstanding drops from ${fmtMoney(row.outstanding)} to ${fmtMoney(
      after
    )}.`
  }
  const names = memos.map((m) => returnMemoName(m.description))
  return `Unit returned on ${when}. ${memoCount} ${
    memos.length === 1 ? 'was' : 'were'
  } posted automatically when the RR was encoded: ${joinAnd(names)}. Outstanding is now ${fmtMoney(
    after
  )}, so billing and penalties have stopped.`
}

/** "Sales return, input tax · auto-posted …" → "sales return for input tax". */
function returnMemoName(description: string): string {
  const name = description.split(' · ')[0]
  if (name.startsWith('ID')) return 'the ID balance'
  return name.replace(/^Sales return, /, 'sales return for ')
}
