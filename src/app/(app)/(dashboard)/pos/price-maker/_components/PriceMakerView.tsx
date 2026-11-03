'use client'

import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { priceMakerSchema, type PriceMakerInput } from '@/src/schema/pos/price-maker'
import { getPriceMaker } from '../_actions/get-price-maker'

function peso(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

// Kept as text so a field can be cleared and retyped; the schema coerces.
type FormState = Record<keyof PriceMakerInput, string>

const INITIAL: FormState = {
  listedCashPrice: '0',
  downPayment: '0',
  termMonths: '12',
  miFactor: '0',
}

const inputClass =
  'w-full max-w-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500'

export function PriceMakerView() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const setField = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const parsed = useMemo(() => priceMakerSchema.safeParse(form), [form])
  const parsedKey = parsed.success ? JSON.stringify(parsed.data) : null

  // Worked out as the figures are typed, a beat after the last keystroke.
  const [settledKey, setSettledKey] = useState<string | null>(parsedKey)
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(parsedKey), 250)
    return () => clearTimeout(timer)
  }, [parsedKey])
  const input = useMemo(
    () => (settledKey ? (JSON.parse(settledKey) as PriceMakerInput) : null),
    [settledKey]
  )

  const { data: result, error } = useQuery({
    queryKey: ['pos-price-maker', input],
    queryFn: async () => {
      const res = await getPriceMaker(input as PriceMakerInput)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to compute the price')
      return res.data
    },
    enabled: input !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const problems = parsed.success ? [] : parsed.error.issues.map((i) => i.message)

  return (
    <div className="min-h-full bg-zinc-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-prominent-purple-900">Price Maker</h1>
        <p className="mt-1 text-sm text-gray-500">
          Preview installment financing terms — no account is created.
        </p>
      </div>

      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-2">
        <section aria-labelledby="price-maker-inputs">
          <h2
            id="price-maker-inputs"
            className="border-b border-gray-200 pb-2 text-sm font-semibold text-prominent-purple-900"
          >
            Terms
          </h2>

          <Field id="pricemaker-listedCashPrice" label="Listed cash price (₱)">
            <input
              id="pricemaker-listedCashPrice"
              type="number"
              step="0.01"
              min="0"
              value={form.listedCashPrice}
              onChange={(e) => setField('listedCashPrice', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="pricemaker-downPayment" label="Down payment (₱)">
            <input
              id="pricemaker-downPayment"
              type="number"
              step="0.01"
              min="0"
              value={form.downPayment}
              onChange={(e) => setField('downPayment', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="pricemaker-termMonths" label="Term (months, 1-12)">
            <input
              id="pricemaker-termMonths"
              type="number"
              min={1}
              max={12}
              value={form.termMonths}
              onChange={(e) => setField('termMonths', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="pricemaker-miFactor" label="MI factor">
            <input
              id="pricemaker-miFactor"
              type="number"
              step="0.0001"
              min="0"
              value={form.miFactor}
              onChange={(e) => setField('miFactor', e.target.value)}
              placeholder="0.0954"
              className={inputClass}
            />
          </Field>

          {problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-red-600">
              {problems.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="price-maker-result">
          <h2
            id="price-maker-result"
            className="border-b border-gray-200 pb-2 text-sm font-semibold text-prominent-purple-900"
          >
            Financing terms
          </h2>

          {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
          {!result && !error && (
            <p className="mt-3 text-sm text-gray-400">Enter values to preview financing terms.</p>
          )}
          {result && (
            <dl>
              <Row label="Amount financed" value={peso(result.amountFinanced)} />
              <Row label="Monthly installment" value={peso(result.monthlyInstallment)} />
              <Row label="PNV (total installments)" value={peso(result.pnv)} />
              <Row label="Total price" value={peso(result.totalPrice)} />
              <Row label="Interest differential" value={peso(result.interestDifferential)} />
              <Row label="PPD" value={peso(result.ppd)} />
            </dl>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-gray-100 py-3 sm:grid-cols-[13rem_1fr]">
      <label htmlFor={id} className="text-[13px] font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-gray-100 py-3">
      <dt className="text-[13px] text-gray-500">{label}</dt>
      <dd className="text-right text-base font-semibold text-gray-900">{value}</dd>
    </div>
  )
}
