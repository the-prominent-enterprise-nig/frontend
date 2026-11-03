import { AlertTriangle } from 'lucide-react'
import type { PosExceptionSummary } from '@/src/schema/pos'
import { creditOverrideLines } from '@/src/libs/pos/credit-override'

const peso = (n: number): string =>
  n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 })

/** Which exceptions the sale carried, as a heading. */
export function exceptionTitle(e: PosExceptionSummary): string {
  const kinds = [
    e.lines.length > 0 && 'Price override',
    e.typedTerms && 'Typed installment terms',
    e.creditApplicationWaived && 'Credit application waived',
    e.creditOverride && 'Credit application overridden',
  ].filter(Boolean) as string[]
  return kinds.length ? kinds.join(' · ') : 'Exception'
}

/**
 * Scenario 71 — what was overridden on a sale and why: list price against what
 * was charged for each line, the reason and the note the cashier gave, who typed
 * it, and any typed terms or waived credit application.
 *
 * The same panel on the transaction detail, the sale's journal entry and the
 * receipt screen, so the words are the same wherever the sale is read. Nothing
 * is approved here — management reviews it at the end of the day.
 */
export default function PosExceptionPanel({
  exception,
  className = '',
}: {
  exception: PosExceptionSummary
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 ${className}`}
      data-testid="pos-exception-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-prominent-purple-900">
          <AlertTriangle size={15} className="shrink-0 text-amber-600" />
          {exceptionTitle(exception)}
        </p>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          For management review
        </span>
      </div>

      {exception.lines.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {exception.lines.map((l, i) => (
            <li
              key={i}
              data-testid="pos-exception-line"
              className="flex flex-wrap items-baseline justify-between gap-x-4 text-[13px] text-gray-800"
            >
              <span className="font-medium">
                {l.itemName}
                {l.quantity !== 1 && <span className="text-gray-500"> × {l.quantity}</span>}
              </span>
              <span className="tabular-nums">
                {l.listUnitPrice === null ? (
                  <span className="text-gray-500">No list price → </span>
                ) : (
                  <>
                    <span className="text-gray-400 line-through">{peso(l.listUnitPrice)}</span>
                    <span className="text-gray-500"> → </span>
                  </>
                )}
                <span className="font-semibold">{peso(l.unitPrice)}</span>
                {l.difference !== null && l.difference !== 0 && (
                  <span
                    className={`ml-2 text-xs font-medium ${l.difference > 0 ? 'text-red-600' : 'text-green-700'}`}
                  >
                    {l.difference > 0
                      ? `−${peso(l.difference)}`
                      : `+${peso(Math.abs(l.difference))}`}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-gray-600">Reason</dt>
        <dd className="font-medium text-gray-900" data-testid="pos-exception-reason">
          {exception.reason ?? '—'}
        </dd>
        <dt className="text-gray-600">Note</dt>
        <dd className="font-medium text-gray-900" data-testid="pos-exception-note">
          {exception.note ?? '—'}
        </dd>
        {exception.creditOverride && (
          <>
            <dt className="text-gray-600">Credit application</dt>
            <dd className="font-medium text-gray-900" data-testid="pos-exception-credit-override">
              {creditOverrideLines(exception.creditOverride).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </dd>
          </>
        )}
        {exception.overriddenBy && (
          <>
            <dt className="text-gray-600">Applied by</dt>
            <dd className="font-medium text-gray-900">{exception.overriddenBy}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
