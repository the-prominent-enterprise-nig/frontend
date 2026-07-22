'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Banknote, Pencil } from 'lucide-react'
import { collectorsApi } from '@/src/libs/api/crm'
import RecordRemittanceModal from '@/src/components/crm/RecordRemittanceModal'
import type { CollectorDetail as CollectorDetailType } from '@/src/schema/crm/types'

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-blue-50 text-blue-700 ring-blue-200',
  C: 'bg-amber-50 text-amber-700 ring-amber-200',
  D: 'bg-red-50 text-red-700 ring-red-200',
}

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return <span className="text-gray-400">—</span>
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {category}
    </span>
  )
}

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function CollectorDetail({
  id,
  canEdit,
  canRemit,
}: {
  id: string
  canEdit: boolean
  canRemit: boolean
}) {
  const [collector, setCollector] = useState<CollectorDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [remitOpen, setRemitOpen] = useState(false)

  function reload() {
    collectorsApi.get(id).then((res) => {
      if (res.success && res.data) setCollector(res.data)
    })
  }

  useEffect(() => {
    collectorsApi.get(id).then((res) => {
      if (res.success && res.data) setCollector(res.data)
      else setError(res.error ?? 'Collector not found')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading collector…</div>
    )
  }

  if (error || !collector) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/crm/collectors"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to collectors
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const totalRemitted = collector.remittances.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/crm/collectors"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to collectors
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{collector.name}</h1>
          <div className="mt-1 text-sm text-gray-500">
            {collector.stubNumber} · {collector.branch?.name ?? 'Unassigned branch'} · Status:{' '}
            <span className="font-medium">{collector.status}</span>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {canRemit && (
            <button
              onClick={() => setRemitOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 sm:flex-none"
            >
              <Banknote className="h-4 w-4" />
              Record remittance
            </button>
          )}
          {canEdit && (
            <Link
              href={`/crm/collectors/${id}/edit`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-1">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Summary</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Assigned accounts" value={String(collector.installmentAccounts.length)} />
            <Row label="Total remitted" value={peso(totalRemitted)} />
            <Row
              label="Last remittance"
              value={
                collector.remittances[0]
                  ? new Date(collector.remittances[0].remittedAt).toLocaleDateString()
                  : '—'
              }
            />
          </dl>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Assigned accounts</h2>
          {collector.installmentAccounts.length === 0 && (
            <p className="py-6 text-center text-[13px] text-gray-400">
              No installment accounts assigned yet.
            </p>
          )}
          {collector.installmentAccounts.length > 0 && (
            <>
              {/* Mobile: cards */}
              <ul className="space-y-2 sm:hidden">
                {collector.installmentAccounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-gray-900">{a.accountNumber}</div>
                      <div className="text-[12px] text-gray-500">
                        {a.classification ?? '—'} · {a.agingBucket ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={a.category} />
                      <span className="text-[13px] font-medium tabular-nums text-gray-900">
                        {peso(a.currentBalance)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-2 pr-4">Account #</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Classification</th>
                      <th className="py-2 pr-4">Aging</th>
                      <th className="py-2 pr-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {collector.installmentAccounts.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{a.accountNumber}</td>
                        <td className="py-2.5 pr-4">
                          <CategoryBadge category={a.category} />
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">{a.classification ?? '—'}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{a.agingBucket ?? '—'}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-gray-900">
                          {peso(a.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Remittance history</h2>
        {collector.remittances.length === 0 && (
          <p className="py-4 text-center text-[13px] text-gray-400">No remittances recorded yet.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {collector.remittances.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] text-gray-800">
                  {r.reference || 'Remittance'}
                  {r.notes ? <span className="text-gray-500"> — {r.notes}</span> : null}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-gray-500">
                  <span>{new Date(r.remittedAt).toLocaleString()}</span>
                  {r.collectionBatch && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {r.collectionBatch}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-900">
                {peso(r.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <RecordRemittanceModal
        open={remitOpen}
        onClose={() => setRemitOpen(false)}
        onRecorded={reload}
        collectorId={id}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  )
}
