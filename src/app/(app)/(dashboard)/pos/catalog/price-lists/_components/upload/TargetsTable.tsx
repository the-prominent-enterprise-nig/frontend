'use client'

import { MONO } from '@/src/libs/design/plex'
import { STATUS_LABELS, statusTone } from '../../_lib/price-list-format'
import type { PriceListImportTarget } from '@/src/schema/inventory/price-lists/import'

/** Where each price use in the file goes — shown before anything is saved so
 * a wrong destination is caught at the preview. */
export function TargetsTable({ targets }: { targets: PriceListImportTarget[] }) {
  if (targets.length === 0) return null
  return (
    <section className="rounded-xl border border-[#e4e4e9] bg-white">
      <div className="border-b border-[#eeeef1] px-4 py-3">
        <h3 className="text-sm font-semibold text-prominent-purple-900">Where it goes</h3>
        <p className="text-xs text-[#5b5b6b]">
          Each row goes to the company-wide price list for its PRICE USE.
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-[#5b5b6b]">
          <tr className="border-b border-[#eeeef1]">
            <th className="px-4 py-2 font-semibold">Price use</th>
            <th className="px-4 py-2 font-semibold">Price list</th>
            <th className="px-4 py-2 text-right font-semibold">Add</th>
            <th className="px-4 py-2 text-right font-semibold">Update</th>
            <th className="px-4 py-2 font-semibold">After upload</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => (
            <TargetRow key={t.listId} target={t} />
          ))}
        </tbody>
      </table>
    </section>
  )
}

function TargetRow({ target: t }: { target: PriceListImportTarget }) {
  const before = statusTone(t.listStatus)
  const changes = t.listStatusAfter !== t.listStatus
  return (
    <tr className="border-b border-[#f4f4f6] align-top last:border-0">
      <td className="px-4 py-2">
        <span className="inline-flex rounded-md bg-[#f0e9fc] px-2 py-0.5 text-xs font-medium text-[#3f1490]">
          {t.priceUse}
        </span>
      </td>
      <td className="px-4 py-2">
        <div className="font-medium text-prominent-purple-900">{t.listName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5b5b6b]">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${before.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${before.dot}`} />
            {STATUS_LABELS[t.listStatus] ?? t.listStatus}
          </span>
          {t.candidateLists > 1 && (
            <span className="text-[#8a4b06]">
              {t.candidateLists} editable lists for this price use — live first, then highest
              priority
            </span>
          )}
        </div>
        {t.blockedReason && <p className="mt-1 text-xs text-[#8f1c14]">{t.blockedReason}</p>}
      </td>
      <td className={`${MONO} px-4 py-2 text-right text-xs`}>{t.toCreate.toLocaleString()}</td>
      <td className={`${MONO} px-4 py-2 text-right text-xs`}>{t.toUpdate.toLocaleString()}</td>
      <td className="px-4 py-2 text-xs text-[#5b5b6b]">
        {changes
          ? `${STATUS_LABELS[t.listStatusAfter] ?? t.listStatusAfter} — needs re-approval`
          : (STATUS_LABELS[t.listStatusAfter] ?? t.listStatusAfter)}
      </td>
    </tr>
  )
}
