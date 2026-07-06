'use client'

import { useEffect, useState } from 'react'
import { Receipt, ChevronDown, Loader2 } from 'lucide-react'
import { useBranches } from '../_hooks/usePos'
import { getBranchReceiptFooter } from '../_actions/branch-receipt-footer'
import { BranchReceiptFooterSection } from '@/src/components/settings/BranchReceiptFooterSection'

export default function ReceiptFooterSettingsPage() {
  const { data: branchesData, isLoading: branchesLoading } = useBranches()
  const branches = branchesData?.data ?? []

  const [branchId, setBranchId] = useState('')
  const [footerText, setFooterText] = useState<string | null>(null)
  const [loadingFooter, setLoadingFooter] = useState(false)

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0].id)
    }
  }, [branches, branchId])

  useEffect(() => {
    if (!branchId) return
    setLoadingFooter(true)
    getBranchReceiptFooter(branchId).then((res) => {
      setFooterText(res.success ? (res.data?.data.footerText ?? null) : null)
      setLoadingFooter(false)
    })
  }, [branchId])

  const selectedBranch = branches.find((b) => b.id === branchId)

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Receipt size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receipt Footer</h1>
            <p className="text-sm text-gray-500">
              Set a custom footer message per branch on printed and digital receipts.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Branch</label>
          <div className="relative mb-5 max-w-sm">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={branchesLoading}
              className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300 disabled:opacity-50"
            >
              {branchesLoading && <option>Loading branches…</option>}
              {!branchesLoading && branches.length === 0 && <option>No branches found</option>}
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

          {loadingFooter || !selectedBranch ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-purple-500" />
            </div>
          ) : (
            <BranchReceiptFooterSection
              key={selectedBranch.id}
              branchId={selectedBranch.id}
              branchName={selectedBranch.name}
              initialFooterText={footerText}
              readOnly={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}
