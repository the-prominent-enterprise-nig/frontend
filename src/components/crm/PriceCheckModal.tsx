'use client'

import { useEffect, useState } from 'react'
import { X, Calculator } from 'lucide-react'
import { priceCheckApi } from '@/src/libs/api/crm'
import { priceCheckSchema, type PriceCheckInput } from '@/src/schema/crm/installment-account'
import type { PriceCheckResult } from '@/src/schema/crm/installment-account'

function peso(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function PriceCheckModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<PriceCheckInput>({
    listedCashPrice: 0,
    downPayment: 0,
    termMonths: 12,
    miFactor: 0,
  })
  const [result, setResult] = useState<PriceCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const setField = <K extends keyof PriceCheckInput>(key: K, value: PriceCheckInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const parsed = priceCheckSchema.safeParse(form)
  const validInput = parsed.success ? parsed.data : null

  useEffect(() => {
    if (!validInput) return
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const res = await priceCheckApi.check(validInput)
      setLoading(false)
      if (res.success && res.data) setResult(res.data)
      else setError(res.error ?? 'Failed to compute price')
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(validInput)])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Calculator className="h-5 w-5 text-prominent-orange-600" />
            Installment price checker
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Preview financing terms — no account is created.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">
              Listed cash price (₱)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.listedCashPrice}
              onChange={(e) => setField('listedCashPrice', Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Down payment (₱)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.downPayment}
              onChange={(e) => setField('downPayment', Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">
              Term (months, 1-12)
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={form.termMonths}
              onChange={(e) => setField('termMonths', Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">MI factor</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.miFactor}
              onChange={(e) => setField('miFactor', Number(e.target.value))}
              placeholder="0.0954"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          {loading && <p className="text-sm text-gray-400">Calculating…</p>}
          {!loading && validInput && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !(validInput && result) && (
            <p className="text-sm text-gray-400">Enter values above to preview financing terms.</p>
          )}
          {!loading && validInput && result && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <Row label="Amount financed" value={peso(result.amountFinanced)} />
              <Row label="Monthly installment" value={peso(result.monthlyInstallment)} />
              <Row label="PNV (total installments)" value={peso(result.pnv)} />
              <Row label="Total price" value={peso(result.totalPrice)} />
              <Row label="Interest differential" value={peso(result.interestDifferential)} />
              <Row label="PPD" value={peso(result.ppd)} />
            </dl>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
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
