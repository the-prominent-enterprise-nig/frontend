'use client'

import { X, Paperclip, Download } from 'lucide-react'
import {
  UDS_REASON_LABELS,
  UDS_STATUS_LABELS,
  UDS_STATUS_STYLES,
  UDS_REASON_STYLES,
  UDS_ASSESSMENT_LABELS,
  UDS_ASSESSMENT_STYLES,
  type Uds,
} from '@/src/schema/inventory/uds'
import DocumentTrail from './DocumentTrail'

function formatCurrency(value?: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onEditProvider?: (uds: Uds) => void
  /** Advances the sheet to its next leg. Clicking a row is the natural way to
   *  open a UDS, and this view used to dead-end: the whole journey could only
   *  be driven from the list's own action column, which a reader who opened
   *  the sheet to understand it had already navigated away from. */
  onAdvance?: (uds: Uds) => void
}

/** What the next step actually is, named. Mirrors the list's action column so
 *  the same sheet does not offer two differently-worded versions of one
 *  button. Null once the sheet is closed, or while the unit is somewhere only
 *  its own dedicated form can move it from. */
function advanceLabel(uds: Uds): string | null {
  if (uds.status === 'completed' || uds.status === 'cancelled') return null
  if (uds.status === 'issued') return 'Send to Main'
  if (uds.status === 'in_transit') return 'Receive at Main'
  if (uds.status === 'at_provider') return null
  return 'Update status'
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 text-zinc-800">{value}</p>
    </div>
  )
}

export default function UdsDetailModal({ uds, isOpen, onClose, onEditProvider, onAdvance }: Props) {
  if (!isOpen || !uds) return null

  const nextStep = advanceLabel(uds)

  const canEditProvider =
    uds.reason === 'repair' &&
    uds.status !== 'completed' &&
    uds.status !== 'cancelled' &&
    !uds.assessment

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#17171c]">
                Unit Document Sheet
              </h2>
              <p className="mt-0.5 font-mono text-xs text-zinc-400">{uds.code}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${UDS_STATUS_STYLES[uds.status]}`}
            >
              {UDS_STATUS_LABELS[uds.status]}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${UDS_REASON_STYLES[uds.reason]}`}
            >
              {UDS_REASON_LABELS[uds.reason]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow
              label="Branch"
              value={uds.warehouse ? (uds.warehouse.branch?.name ?? uds.warehouse.name) : '—'}
            />
            <InfoRow label="Expected Return" value={formatDate(uds.expectedReturnDate)} />
            <InfoRow label="Issued" value={formatDate(uds.createdAt)} />
            <InfoRow label="Last Updated" value={formatDate(uds.updatedAt)} />
            {uds.notes && (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Notes
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-zinc-800">{uds.notes}</p>
              </div>
            )}
          </div>

          {/* Repair details */}
          {(uds.reason === 'repair' || uds.repairProvider || uds.rfsFormFile || uds.assessment) && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              {/* The branch→main StockTransfer is deliberately not repeated
                  here: it is a leg of the Document trail below, and a number
                  shown twice on one screen reads as two movements. */}
              <p className="mb-3 text-sm font-medium text-zinc-700">Repair Transfer</p>
              <div className="space-y-3 text-sm">
                {uds.reason === 'repair' && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Repair Provider
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="text-zinc-800">
                        {uds.repairProvider
                          ? `${uds.repairProvider.code} — ${uds.repairProvider.name}`
                          : '—'}
                      </p>
                      {canEditProvider && onEditProvider && (
                        <button
                          type="button"
                          onClick={() => onEditProvider(uds)}
                          className="text-xs font-medium text-prominent-purple-700 hover:underline"
                        >
                          {uds.repairProvider ? 'Change' : 'Set provider'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {uds.assessment && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Assessment
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${UDS_ASSESSMENT_STYLES[uds.assessment]}`}
                      >
                        {UDS_ASSESSMENT_LABELS[uds.assessment]}
                      </span>
                      {uds.assessment === 'repairable' && (
                        <span className="text-zinc-800">
                          {formatCurrency(uds.repairEstimatedCost)} estimated
                          {uds.repairDebitJournalEntryId && ' · debit posted'}
                        </span>
                      )}
                      {uds.assessment === 'unrepairable' && uds.writeOffAdjustmentId && (
                        <span className="text-zinc-800">written off</span>
                      )}
                      <span className="text-xs text-zinc-400">
                        assessed {formatDate(uds.assessedAt)}
                      </span>
                    </div>
                    {uds.assessmentNotes && (
                      <p className="mt-1 text-zinc-600">{uds.assessmentNotes}</p>
                    )}
                  </div>
                )}
                {uds.rfsFormFile && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      RFS Form
                    </p>
                    <a
                      href={`/api/files/${uds.rfsFormFile.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-prominent-purple-700 hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {uds.rfsFormFile.originalName}
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* The paper trail. Every number on it is free text off a document
              someone signed, and until now all five were captured at each
              step and then shown nowhere — the customer holds an RR this
              screen could not display. */}
          <DocumentTrail uds={uds} />

          {/* Units */}
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">Units ({uds.lines.length})</p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Serial
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Issue Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {uds.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-800">
                        {line.serialNumber.serialNumber}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900">{line.item.name}</p>
                        <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{line.issueReason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
          {nextStep && onAdvance && (
            <button
              type="button"
              onClick={() => onAdvance(uds)}
              className="rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b]"
            >
              {nextStep}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
