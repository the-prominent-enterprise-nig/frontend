'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { installmentAccountsApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../../_actions/get-branches'
import CustomerPicker from '@/src/components/crm/CustomerPicker'
import {
  createInstallmentAccountSchema,
  type CreateInstallmentAccountInput,
} from '@/src/schema/crm/installment-account'

const initial: CreateInstallmentAccountInput = {
  accountNumber: '',
  customerId: '',
  branchId: '',
  collectorId: '',
  listedCashPrice: 0,
  downPayment: 0,
  termMonths: 12,
  miFactor: 0,
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function peso(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function NewInstallmentAccountForm() {
  const router = useRouter()
  const [form, setForm] = useState<CreateInstallmentAccountInput>(initial)
  const [customerLabel, setCustomerLabel] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Scenario 24 Part 4 — area-based collector suggestion. Only pre-fills the
  // Collector field once, right when a customer is picked — the effect below
  // is keyed solely on customerId, so it never re-fires (and can't clobber a
  // manual override) unless the customer itself changes again.
  const [suggestedCollectorId, setSuggestedCollectorId] = useState<string | null>(null)
  const [suggestionReason, setSuggestionReason] = useState<string | null>(null)

  const setField = <K extends keyof CreateInstallmentAccountInput>(
    key: K,
    value: CreateInstallmentAccountInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
    collectorsApi.list({ limit: 200 }).then((res) => {
      if (res.success && res.data) setCollectors(res.data.data)
    })
  }, [])

  useEffect(() => {
    if (!form.customerId) {
      setSuggestedCollectorId(null)
      setSuggestionReason(null)
      return
    }
    let cancelled = false
    installmentAccountsApi.suggestCollector(form.customerId).then((res) => {
      if (cancelled) return
      const collectorId = res.success ? (res.data?.collectorId ?? null) : null
      setSuggestedCollectorId(collectorId)
      setSuggestionReason(res.success ? (res.data?.reason ?? null) : null)
      if (collectorId) setField('collectorId', collectorId)
    })
    return () => {
      cancelled = true
    }
  }, [form.customerId])

  const preview = useMemo(() => {
    const lcp = Number(form.listedCashPrice) || 0
    const dp = Number(form.downPayment) || 0
    const term = Number(form.termMonths) || 0
    const factor = Number(form.miFactor) || 0
    const amountFinanced = round2(lcp - dp)
    const monthlyInstallment = round2(amountFinanced * factor)
    const pnv = round2(monthlyInstallment * term)
    const totalPrice = round2(pnv + dp)
    const interestDifferential = round2(totalPrice - lcp)
    return { amountFinanced, monthlyInstallment, pnv, totalPrice, interestDifferential }
  }, [form.listedCashPrice, form.downPayment, form.termMonths, form.miFactor])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = createInstallmentAccountSchema.safeParse(form)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await installmentAccountsApi.create(parsed.data)
    setSubmitting(false)
    if (res.success && res.data) {
      router.push(`/crm/installment-accounts/${res.data.id}`)
    } else {
      setServerError(res.error ?? 'Failed to create installment account')
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/crm/installment-accounts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to installment accounts
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">New Installment Account</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set up the financing terms for a customer&apos;s installment purchase.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Account number *"
              error={errors.accountNumber}
              value={form.accountNumber}
              onChange={(v) => setField('accountNumber', v)}
              placeholder="IA-0001"
            />
            <div>
              <label htmlFor="termMonths" className="block text-[13px] font-medium text-gray-700">
                Term (months) *
              </label>
              <input
                id="termMonths"
                type="number"
                min={1}
                max={12}
                value={form.termMonths}
                onChange={(e) => setField('termMonths', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.termMonths && (
                <p className="mt-1 text-[12px] text-red-600">{errors.termMonths}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="customerId" className="block text-[13px] font-medium text-gray-700">
              Customer *
            </label>
            <CustomerPicker
              id="customerId"
              value={form.customerId}
              selectedLabel={customerLabel}
              onChange={(id, label) => {
                setField('customerId', id)
                setCustomerLabel(label)
              }}
              error={errors.customerId}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="branchId" className="block text-[13px] font-medium text-gray-700">
                Branch
              </label>
              <select
                id="branchId"
                value={form.branchId ?? ''}
                onChange={(e) => setField('branchId', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="collectorId" className="block text-[13px] font-medium text-gray-700">
                Collector
              </label>
              <select
                id="collectorId"
                value={form.collectorId ?? ''}
                onChange={(e) => setField('collectorId', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.stubNumber} — {c.name}
                    {c.id === suggestedCollectorId ? ' — suggested' : ''}
                  </option>
                ))}
              </select>
              {suggestedCollectorId === null && suggestionReason === 'no_coverage_match' && (
                <p className="mt-1 text-[12px] text-gray-500">
                  No collector covers this customer&apos;s area — pick one manually.
                </p>
              )}
              {suggestedCollectorId === null && suggestionReason === 'customer_has_no_barangay' && (
                <p className="mt-1 text-[12px] text-gray-500">
                  This customer has no address on file to match a collector by area.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="listedCashPrice"
                className="block text-[13px] font-medium text-gray-700"
              >
                Listed cash price (₱) *
              </label>
              <input
                id="listedCashPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.listedCashPrice === 0 ? '' : form.listedCashPrice}
                onChange={(e) => setField('listedCashPrice', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.listedCashPrice && (
                <p className="mt-1 text-[12px] text-red-600">{errors.listedCashPrice}</p>
              )}
            </div>
            <div>
              <label htmlFor="downPayment" className="block text-[13px] font-medium text-gray-700">
                Down payment (₱) *
              </label>
              <input
                id="downPayment"
                type="number"
                step="0.01"
                min="0"
                value={form.downPayment === 0 ? '' : form.downPayment}
                onChange={(e) => setField('downPayment', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.downPayment && (
                <p className="mt-1 text-[12px] text-red-600">{errors.downPayment}</p>
              )}
            </div>
            <div>
              <label htmlFor="miFactor" className="block text-[13px] font-medium text-gray-700">
                MI factor *
              </label>
              <input
                id="miFactor"
                type="number"
                step="0.0001"
                min="0"
                value={form.miFactor === 0 ? '' : form.miFactor}
                onChange={(e) => setField('miFactor', Number(e.target.value))}
                placeholder="0.0954"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.miFactor && (
                <p className="mt-1 text-[12px] text-red-600">{errors.miFactor}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="insuranceCharge"
                className="block text-[13px] font-medium text-gray-700"
              >
                IC (Insurance charge) (₱)
              </label>
              <input
                id="insuranceCharge"
                type="number"
                step="0.01"
                min="0"
                value={form.insuranceCharge ?? ''}
                onChange={(e) =>
                  setField(
                    'insuranceCharge',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.insuranceCharge && (
                <p className="mt-1 text-[12px] text-red-600">{errors.insuranceCharge}</p>
              )}
            </div>
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}

          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/crm/installment-accounts"
              className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 sm:w-auto"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50 sm:w-auto"
            >
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-6 lg:col-span-1">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500">
            Financing preview
          </h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Amount financed" value={peso(preview.amountFinanced)} />
            <Row label="Monthly installment" value={peso(preview.monthlyInstallment)} />
            <Row label="PNV (total installments)" value={peso(preview.pnv)} />
            <Row label="Total price" value={peso(preview.totalPrice)} />
            <Row label="Interest differential" value={peso(preview.interestDifferential)} />
          </dl>
        </aside>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
}) {
  // Derived, stable id — also lets tests target fields via getByLabel()
  // instead of brittle selectors, since label/input weren't otherwise linked.
  const id = `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
      />
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
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
