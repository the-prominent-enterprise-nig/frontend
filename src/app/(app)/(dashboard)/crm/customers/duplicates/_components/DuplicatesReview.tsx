'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitMerge, X } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import type { DuplicatePair } from '@/src/schema/crm/types'
import MergeCustomerModal from './MergeCustomerModal'

export default function DuplicatesReview() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState<string | null>(null)
  const [comparing, setComparing] = useState<DuplicatePair | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const res = await customersApi.listDuplicates()
    if (res.success && res.data) setPairs(res.data)
    else setError(res.error ?? 'Failed to load duplicate customers')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function onDismiss(pair: DuplicatePair) {
    const key = `${pair.customerA.id}:${pair.customerB.id}`
    setDismissing(key)
    const res = await customersApi.dismissDuplicate(pair.customerA.id, pair.customerB.id)
    setDismissing(null)
    if (res.success) {
      setPairs((prev) =>
        prev.filter(
          (p) => !(p.customerA.id === pair.customerA.id && p.customerB.id === pair.customerB.id)
        )
      )
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/crm/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">Duplicate Customers</h1>
      <p className="mt-1 text-sm text-gray-500">
        Records sharing the same email or phone — review and merge, or dismiss if they&apos;re
        genuinely different people.
      </p>

      <div className="mt-6 space-y-3">
        {loading && <p className="py-10 text-center text-gray-400">Loading…</p>}
        {!loading && error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {!loading && !error && pairs.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
            No potential duplicates right now.
          </div>
        )}

        {!loading &&
          !error &&
          pairs.map((pair) => {
            const key = `${pair.customerA.id}:${pair.customerB.id}`
            return (
              <div
                key={key}
                data-testid={`duplicate-pair-${[pair.customerA.id, pair.customerB.id].sort().join('-')}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    Same {pair.matchedField}
                  </span>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{pair.customerA.name}</span>
                    <span className="mx-1.5 text-gray-400">·</span>
                    <span className="font-mono text-[11px] text-gray-500">
                      {pair.customerA.customerCode}
                    </span>
                  </div>
                  <span className="text-gray-300">vs</span>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{pair.customerB.name}</span>
                    <span className="mx-1.5 text-gray-400">·</span>
                    <span className="font-mono text-[11px] text-gray-500">
                      {pair.customerB.customerCode}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDismiss(pair)}
                    disabled={dismissing === key}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Not a duplicate
                  </button>
                  <button
                    onClick={() => setComparing(pair)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-prominent-orange-700"
                  >
                    <GitMerge className="h-3.5 w-3.5" />
                    Compare & Merge
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      <MergeCustomerModal
        open={comparing !== null}
        onClose={() => setComparing(null)}
        onMerged={load}
        customerAId={comparing?.customerA.id ?? ''}
        customerBId={comparing?.customerB.id ?? ''}
      />
    </div>
  )
}
