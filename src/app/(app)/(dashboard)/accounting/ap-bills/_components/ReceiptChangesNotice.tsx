'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { APBills, fmtMoney, type APBillReceiptChanges } from '@/src/libs/data/AccountingV2Data'

/**
 * "RR has been edited."
 *
 * A receiving report stays editable after the goods land — that is the point,
 * it is where a receiver's mistake gets fixed — but the AP invoice built from
 * it is a snapshot taken at receiving time, and nothing used to carry the
 * correction across. This says the receipt moved, shows what it now says, and
 * offers the two ways out.
 *
 * Silent unless the receipt was actually edited after the invoice last agreed
 * with it. A difference between the two on its own means nothing: an invoice
 * is allowed to differ from its receipt.
 */
export default function ReceiptChangesNotice({
  billId,
  onApplied,
}: {
  billId: string
  /** Re-read the invoice after it has been restated. */
  onApplied: () => void
}) {
  const router = useRouter()
  const [data, setData] = useState<APBillReceiptChanges | null>(null)
  const [busy, setBusy] = useState<'apply' | 'supersede' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    APBills.receiptChanges(billId).then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }, [billId])

  if (!data?.edited) return null

  const apply = async () => {
    setBusy('apply')
    setError(null)
    const res = await APBills.applyReceiptChanges(billId)
    setBusy(null)
    if (!res.success) {
      setError(res.message || res.error || 'Could not update this invoice.')
      return
    }
    setData({ ...data, edited: false })
    onApplied()
  }

  const supersede = async () => {
    setBusy('supersede')
    setError(null)
    const res = await APBills.supersedeFromReceipt(billId)
    setBusy(null)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not raise a new invoice.')
      return
    }
    router.push(`/accounting/ap-bills/${res.data.id}`)
  }

  const codes = data.receipts.map((r) => r.code).join(', ')

  return (
    <section className="mt-2.5 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-amber-900">
            RR has been edited{codes ? ` — ${codes}` : ''}
          </h2>
          <p className="mt-0.5 text-[12px] text-amber-800">
            The receiving report behind this invoice was corrected after the invoice was raised.
          </p>

          {data.changes.length > 0 ? (
            <table className="mt-3 text-[12.5px]">
              <thead>
                <tr className="text-amber-900">
                  <th className="pr-6 text-left font-semibold">Figure</th>
                  <th className="pr-6 text-right font-semibold">This invoice</th>
                  <th className="text-right font-semibold">The RR now</th>
                </tr>
              </thead>
              <tbody>
                {data.changes.map((c) => (
                  <tr key={c.field}>
                    <td className="pr-6 py-0.5 text-amber-900">{c.field}</td>
                    <td className="pr-6 py-0.5 text-right tabular-nums text-amber-800 line-through">
                      {fmtMoney(c.from)}
                    </td>
                    <td className="py-0.5 text-right font-semibold tabular-nums text-amber-900">
                      {fmtMoney(c.to)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* The common case. An RR edit never recomputes unitCost — that
               costed the stock and wrote the cost layers — so a corrected
               price leaves the payable exactly where it was. Worth saying,
               rather than showing an empty table. */
            <p className="mt-2 text-[12px] text-amber-800">
              Nothing the invoice bills has moved — the correction was to prices or tax codes, which
              never restate what was already costed. Accepting it just clears this notice.
            </p>
          )}

          {error && <p className="mt-2 text-[12px] font-medium text-red-700">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={apply}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {busy === 'apply' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update this invoice
            </button>
            <button
              onClick={supersede}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {busy === 'supersede' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Raise a new invoice instead
            </button>
            <span className="text-[11px] text-amber-700">
              A new invoice takes this one&rsquo;s SI number and cancels it. Not available once
              anything has been paid against it.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
