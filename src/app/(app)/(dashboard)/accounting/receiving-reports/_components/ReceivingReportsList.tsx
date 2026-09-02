'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Printer, RefreshCw, X } from 'lucide-react'
import { Reports, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { printReceivingReportDocument } from '@/src/libs/print/printInventoryDocument'
import ReceivingReportSheet, { type ReceivingReportDocument } from './ReceivingReportSheet'

interface ReceivingReportRow {
  id: string
  code: string
  supplier?: { name: string } | null
  warehouse?: { name: string } | null
  receivedAt: string
  total: number
  journalEntryId?: string | null
  matchedBill?: { billNumber: string; status: string } | null
}

export default function ReceivingReportsList() {
  const [rows, setRows] = useState<ReceivingReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Clicking a row opens the formatted document inline — the same letterhead
  // sheet buildReceivingReportHtml() prints, rendered as real markup rather
  // than an iframe of the print HTML, so it matches the Purchase Invoice and
  // AR Invoice detail pages — and the user can read it before deciding to
  // print, instead of a click immediately opening a print-ready popup.
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    row: ReceivingReportRow
    doc: ReceivingReportDocument
  } | null>(null)

  const openPreview = useCallback(async (row: ReceivingReportRow) => {
    setPreviewingId(row.id)
    try {
      const res = await Reports.receivingReportDocument(row.id)
      if (res.data) setPreview({ row, doc: res.data as ReceivingReportDocument })
    } finally {
      setPreviewingId(null)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await Reports.receivingReports()
    setRows(Array.isArray(res.data) ? res.data : [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.code?.toLowerCase().includes(q) ||
      r.supplier?.name?.toLowerCase().includes(q) ||
      r.warehouse?.name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-prominent-purple-900">Receiving Reports</h2>
          <p className="text-sm text-gray-500">
            Every goods receipt, matched or not, with GL posting and AP invoice matching status.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by receipt #, supplier, or warehouse…"
        className="w-full max-w-sm mb-4 px-3 py-2 text-sm border border-gray-200 rounded-lg"
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Receipt #</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Warehouse</th>
              <th className="px-3 py-2 text-left">Received</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-center">GL Posted</th>
              <th className="px-3 py-2 text-left">Matched Bill</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-8">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-8">
                  {rows.length === 0 ? 'No receiving reports.' : 'No matches for that search.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openPreview(r)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">{r.supplier?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.warehouse?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.receivedAt)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(r.total)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${r.journalEntryId ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {r.journalEntryId ? 'Posted' : 'Not posted'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.matchedBill ? `${r.matchedBill.billNumber} (${r.matchedBill.status})` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {previewingId === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-prominent-purple-900">
                Receiving Report Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printReceivingReportDocument(preview.doc)}
                  className="flex items-center gap-1.5 rounded-lg bg-prominent-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-prominent-orange-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Download
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
              {/* Record data the paper document doesn't carry — kept outside
                  the sheet so the sheet itself stays a faithful preview of
                  what prints. */}
              <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${preview.row.journalEntryId ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {preview.row.journalEntryId ? 'GL POSTED' : 'NOT POSTED'}
                </span>
                <span>Warehouse {preview.row.warehouse?.name ?? '—'}</span>
                <span>
                  {preview.row.matchedBill
                    ? `Matched bill ${preview.row.matchedBill.billNumber} · ${preview.row.matchedBill.status}`
                    : 'No matched bill'}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200">
                <ReceivingReportSheet doc={preview.doc} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
