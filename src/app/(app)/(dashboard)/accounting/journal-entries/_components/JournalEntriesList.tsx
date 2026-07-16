'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Undo2,
} from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { type SessionUser } from '@/src/libs/guards/permission'
import {
  getJournalEntries,
  postJournalEntry,
  deleteJournalEntry,
  reverseJournalEntry,
  type JournalEntry,
} from '@/src/libs/data/AccountingData'
import JournalEntryFormDialog from './JournalEntryFormDialog'

function statusBadge(s: string) {
  if (s === 'POSTED') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  return 'bg-amber-50 text-amber-700 border border-amber-200'
}

function formatMoney(v: number | undefined | null) {
  if (!v) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)
}

export default function JournalEntriesList({ session }: { session: SessionUser | null }) {
  const [items, setItems] = useState<JournalEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)

  const canCreate = hasPermission(session, ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_CREATE)
  const canUpdate = hasPermission(session, ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_UPDATE)
  const canDelete = hasPermission(session, ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_DELETE)
  const canPost = hasPermission(session, ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_POST)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getJournalEntries({ page, limit: 20, search: search || undefined })
    if (!res.success) {
      setError(res.error || 'Failed to load journal entries')
      setLoading(false)
      return
    }
    const d = res.data as any
    setItems(d?.items ?? [])
    setTotal(d?.total ?? 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (id: string) => {
    const n = new Set(expanded)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setExpanded(n)
  }

  const handlePost = async (id: string) => {
    if (!confirm('Post this journal entry? This cannot be undone.')) return
    const res = await postJournalEntry(id)
    if (!res.success) {
      alert(res.message || res.error || 'Post failed')
      return
    }
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this journal entry? (only DRAFT entries can be deleted)')) return
    const res = await deleteJournalEntry(id)
    if (!res.success) {
      alert(res.message || res.error || 'Delete failed')
      return
    }
    load()
  }

  const handleReverse = async (id: string) => {
    if (!confirm('Reverse this posted journal entry? This creates an opposite entry.')) return
    const res = await reverseJournalEntry(id)
    if (!res.success) {
      alert(res.message || res.error || 'Reverse failed')
      return
    }
    load()
  }

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Journal Entries</h2>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage accounting journal entries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg"
              >
                <Plus className="w-4 h-4" /> New Entry
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search reference, description, payee..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                      No journal entries found.
                    </td>
                  </tr>
                ) : (
                  items.map((entry) => {
                    const isOpen = expanded.has(entry.id)
                    const isDraft = entry.status === 'DRAFT'
                    const isPosted = entry.status === 'POSTED'
                    return (
                      <Fragment key={entry.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggle(entry.id)}
                              className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
                            >
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('en-PH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {(entry as any).reference || entry.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {entry.sourceModule ? (
                              <div>
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                                  {entry.sourceModule}
                                </span>
                                {entry.sourceDocumentNo && (
                                  <div className="text-gray-500 font-mono mt-0.5">
                                    {entry.sourceDocumentNo}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">MANUAL</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {entry.branchName ?? <span className="text-gray-400">Tenant-wide</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-800 max-w-xs truncate">
                            {entry.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {entry.journalType || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(entry.status)}`}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatMoney(entry.totalDebit)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatMoney(entry.totalCredit)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {canPost && isDraft && (
                                <button
                                  onClick={() => handlePost(entry.id)}
                                  title="Post entry"
                                  className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              {canUpdate && isDraft && (
                                <button
                                  onClick={() => setEditing(entry)}
                                  title="Edit"
                                  className="p-1.5 rounded hover:bg-purple-50 text-purple-600"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && isDraft && (
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  title="Delete"
                                  className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              {isPosted && (
                                <button
                                  onClick={() => handleReverse(entry.id)}
                                  title="Reverse posted entry"
                                  className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                                >
                                  <Undo2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={11} className="px-8 py-4">
                              {/* Transaction lines */}
                              <div>
                                <div className="text-xs text-gray-500 mb-1.5 font-medium uppercase">
                                  Transaction Lines
                                </div>
                                {!entry.transactions || entry.transactions.length === 0 ? (
                                  <div className="text-sm text-gray-400 italic">
                                    No transaction lines.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs min-w-[700px]">
                                      <thead className="text-gray-500">
                                        <tr>
                                          <th className="text-left py-1">Account</th>
                                          <th className="text-left py-1">Item</th>
                                          <th className="text-left py-1">Description</th>
                                          <th className="text-right py-1 w-16">Qty</th>
                                          <th className="text-right py-1 w-24">Unit Price</th>
                                          <th className="text-right py-1 w-24">Subtotal</th>
                                          <th className="text-right py-1 w-24">Debit</th>
                                          <th className="text-right py-1 w-24">Credit</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entry.transactions.map((t, i) => {
                                          const qty = t.quantity
                                          const unitPrice = t.unitPrice
                                          const subtotal =
                                            qty != null && unitPrice != null
                                              ? qty * unitPrice
                                              : null
                                          return (
                                            <tr
                                              key={t.id ?? i}
                                              className="border-t border-gray-200"
                                            >
                                              <td className="py-1.5">
                                                {t.account?.name ?? t.accountId}
                                              </td>
                                              <td className="py-1.5">{t.item || '—'}</td>
                                              <td className="py-1.5 text-gray-500">
                                                {t.description || '—'}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums">
                                                {qty ?? '—'}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums">
                                                {unitPrice != null ? formatMoney(unitPrice) : '—'}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums">
                                                {subtotal != null ? formatMoney(subtotal) : '—'}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums">
                                                {t.debit ? formatMoney(t.debit) : '—'}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums">
                                                {t.credit ? formatMoney(t.credit) : '—'}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                      <tfoot className="border-t border-gray-300">
                                        <tr>
                                          <td
                                            colSpan={5}
                                            className="py-1.5 text-right font-semibold text-gray-600"
                                          >
                                            Total
                                          </td>
                                          <td className="py-1.5 text-right font-bold tabular-nums">
                                            {formatMoney(
                                              entry.transactions.reduce((s, t) => {
                                                const q = t.quantity ?? 0
                                                const u = t.unitPrice ?? 0
                                                return s + q * u
                                              }, 0)
                                            )}
                                          </td>
                                          <td className="py-1.5 text-right font-bold tabular-nums">
                                            {formatMoney(entry.totalDebit)}
                                          </td>
                                          <td className="py-1.5 text-right font-bold tabular-nums">
                                            {formatMoney(entry.totalCredit)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                Showing {Math.min(page * 20, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= total}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <JournalEntryFormDialog
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
