'use client'

import Link from 'next/link'
import { X, Paperclip, Truck, Download } from 'lucide-react'
import {
  UDS_REASON_LABELS,
  UDS_STATUS_LABELS,
  UDS_STATUS_STYLES,
  UDS_REASON_STYLES,
  type Uds,
} from '@/src/schema/inventory/uds'

const TRANSFER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_transit: 'In Transit',
  received: 'Received',
  cancelled: 'Cancelled',
}

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
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
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-0.5 text-zinc-800">{value}</p>
    </div>
  )
}

export default function UdsDetailModal({ uds, isOpen, onClose }: Props) {
  if (!isOpen || !uds) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Unit Document Sheet</h2>
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

        <div className="space-y-5 px-6 py-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow
              label="Warehouse"
              value={uds.warehouse ? `${uds.warehouse.code} — ${uds.warehouse.name}` : '—'}
            />
            <InfoRow label="Expected Return" value={formatDate(uds.expectedReturnDate)} />
            <InfoRow label="Issued" value={formatDate(uds.createdAt)} />
            <InfoRow label="Last Updated" value={formatDate(uds.updatedAt)} />
            {uds.notes && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-zinc-400">Notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-zinc-800">{uds.notes}</p>
              </div>
            )}
          </div>

          {/* Repair details */}
          {(uds.repairProvider || uds.rfsFormFile || uds.linkedStockTransfer) && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="mb-3 text-sm font-medium text-zinc-700">Repair Transfer</p>
              <div className="space-y-3 text-sm">
                {uds.repairProvider && (
                  <InfoRow
                    label="Repair Provider"
                    value={`${uds.repairProvider.code} — ${uds.repairProvider.name}`}
                  />
                )}
                {uds.rfsFormFile && (
                  <div>
                    <p className="text-xs font-medium text-zinc-400">RFS Form</p>
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
                {uds.linkedStockTransfer && (
                  <div>
                    <p className="text-xs font-medium text-zinc-400">Transfer to Main</p>
                    <Link
                      href="/inventory/transfers"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-prominent-purple-700 hover:underline"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      {uds.linkedStockTransfer.transferNumber} —{' '}
                      {TRANSFER_STATUS_LABELS[uds.linkedStockTransfer.status] ??
                        uds.linkedStockTransfer.status}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

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
        <div className="flex items-center justify-end border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
