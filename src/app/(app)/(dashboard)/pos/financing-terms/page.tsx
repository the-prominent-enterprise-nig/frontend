'use client'

import { useState } from 'react'
import { HandCoins, Plus, X, ChevronDown } from 'lucide-react'
import {
  useFinancingTerms,
  useCreateFinancingTerm,
  useUpdateFinancingTerm,
  useBranches,
} from '../_hooks/usePos'
import type { CreateFinancingTermInput, FinancingTerm } from '@/src/schema/pos'
import { Skeleton } from '@/src/components/ui/Skeleton'

export default function FinancingTermsPage() {
  const { data, isLoading } = useFinancingTerms()
  const createMutation = useCreateFinancingTerm()
  const updateMutation = useUpdateFinancingTerm()

  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  const terms: FinancingTerm[] = data?.data ?? []

  async function handleCreate(input: CreateFinancingTermInput) {
    setError('')
    const res = await createMutation.mutateAsync(input)
    if (!res.success) {
      setError(res.error ?? 'Failed to create financing term')
      return
    }
    setShowCreate(false)
  }

  async function toggleActive(term: FinancingTerm) {
    setError('')
    const res = await updateMutation.mutateAsync({
      id: term.id,
      input: { isActive: !term.isActive },
    })
    if (!res.success) {
      setError(res.error ?? 'Failed to update financing term')
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900">Financing Terms</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure the installment terms (months + markup) cashiers can offer at checkout.
            </p>
          </div>
          <button
            onClick={() => {
              setError('')
              setShowCreate(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            <Plus size={14} />
            New Term
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="divide-y divide-gray-100 p-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="ml-auto h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : terms.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <HandCoins size={40} />
              <p className="text-sm">No financing terms configured yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-sm text-purple-600 hover:underline"
              >
                Create the first term
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Scope
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Term
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Factor Rate
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Notes
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {terms.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      {t.branch ? (
                        <span className="font-medium text-gray-800">{t.branch.name}</span>
                      ) : (
                        <span className="italic text-gray-500">Tenant-wide</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{t.termMonths} months</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {t.factorRate.toFixed(2)}x
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{t.notes ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        disabled={updateMutation.isPending}
                        onClick={() => toggleActive(t)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {t.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateFinancingTermModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
        />
      )}
    </div>
  )
}

function CreateFinancingTermModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void
  onSubmit: (input: CreateFinancingTermInput) => Promise<void>
  isSubmitting: boolean
}) {
  const { data: branchesData, isLoading: branchesLoading } = useBranches()
  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>

  const [branchId, setBranchId] = useState('')
  const [termMonths, setTermMonths] = useState(12)
  const [factorRate, setFactorRate] = useState(1.15)
  const [notes, setNotes] = useState('')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-prominent-purple-900">
              New Financing Term
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Branch{' '}
                <span className="font-normal text-gray-400">(leave empty for tenant-wide)</span>
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={branchesLoading}
                >
                  <option value="">{branchesLoading ? 'Loading branches…' : 'Tenant-wide'}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Term (months)
              </label>
              <input
                type="number"
                min={1}
                value={termMonths}
                onChange={(e) => setTermMonths(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. 12"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Factor Rate{' '}
                <span className="font-normal text-gray-400">
                  (e.g. 1.15 = 15% total markup over the term)
                </span>
              </label>
              <input
                type="number"
                min={1}
                step="0.01"
                value={factorRate}
                onChange={(e) => setFactorRate(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. 1.15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Notes <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="Any notes about this term..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSubmit({
                  branchId: branchId || undefined,
                  termMonths,
                  factorRate,
                  notes: notes || undefined,
                })
              }
              disabled={isSubmitting || termMonths < 1 || factorRate <= 0}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create Term'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
