'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { type SessionUser } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { Currency, deleteCurrency, getCurrencies } from '@/src/libs/data/AccountingData'
import { showToast } from '@/src/components/ui/toast'
import { ListShell } from '../../_shared/ListShell'
import { ConfirmDialog } from '../../_shared/Modal'
import { CurrencyFormModal } from './CurrencyFormModal'

export function CurrenciesList({ session }: { session: SessionUser | null }) {
  const [items, setItems] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; currency?: Currency | null }>({
    open: false,
  })
  const [confirmDelete, setConfirmDelete] = useState<Currency | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canCreate = hasPermission(session, ACCOUNTING_PERMISSIONS.CURRENCY_CREATE)
  const canUpdate = hasPermission(session, ACCOUNTING_PERMISSIONS.CURRENCY_UPDATE)
  const canDelete = hasPermission(session, ACCOUNTING_PERMISSIONS.CURRENCY_DELETE)

  const load = useCallback(async () => {
    setFetching(true)
    const res = await getCurrencies({ search: search || undefined, limit: 100 })
    if (res.success && res.data) {
      const it = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
      setItems(it as Currency[])
    } else {
      showToast({ status: 'error', title: 'Failed to load currencies', description: res.message })
    }
    setLoading(false)
    setFetching(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await deleteCurrency(confirmDelete.id)
    setDeleting(false)
    if (res.success) {
      showToast({ status: 'success', title: 'Currency deleted' })
      setConfirmDelete(null)
      load()
    } else {
      showToast({ status: 'error', title: 'Delete failed', description: res.message })
    }
  }

  return (
    <>
      <ListShell
        title="Currencies"
        description="Currencies usable across journal entries and reports"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search code or name..."
        canAdd={canCreate}
        addLabel="Add Currency"
        onAdd={() => setModal({ open: true, currency: null })}
        onRefresh={load}
        isFetching={fetching}
      >
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Status</th>
                {(canUpdate || canDelete) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No currencies found.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-3 text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">{c.rate ?? c.exchangeRate ?? '—'}</td>
                    <td className="px-4 py-3">{(c.mainCurrency ?? c.isBase) ? 'Yes' : ''}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          (c.visibility ?? c.isActive)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {(c.visibility ?? c.isActive) ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => setModal({ open: true, currency: c })}
                              className="rounded p-1.5 text-gray-500 hover:bg-prominent-purple-50 hover:text-prominent-purple-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(c)}
                              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </ListShell>

      {modal.open && (
        <CurrencyFormModal
          currency={modal.currency ?? null}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false })
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete currency"
        message={`Delete currency "${confirmDelete?.name}"?`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
