'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { installmentAccountsApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../../../_actions/get-branches'
import { updateInstallmentAccountSchema } from '@/src/schema/crm/installment-account'
import type {
  InstallmentAccountCategory,
  InstallmentAccountClassification,
  InstallmentAccountStatus,
} from '@/src/schema/crm/types'

type FormState = {
  branchId: string
  collectorId: string
  status: InstallmentAccountStatus
  category: InstallmentAccountCategory | ''
  classification: InstallmentAccountClassification | ''
  agingBucket: string
  arrears: string
  penalty: string
}

const empty: FormState = {
  branchId: '',
  collectorId: '',
  status: 'active',
  category: '',
  classification: '',
  agingBucket: '',
  arrears: '',
  penalty: '',
}

type AccountSummary = {
  customerName: string
  listedCashPrice: number
  downPayment: number
  termMonths: number
  miFactor: number
  amountFinanced: number
  monthlyInstallment: number
  pnv: number
  totalPrice: number
}

function peso(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function EditInstallmentAccountForm({ id }: { id: string }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [accountNumber, setAccountNumber] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [originalCategory, setOriginalCategory] = useState<InstallmentAccountCategory | ''>('')
  const [summary, setSummary] = useState<AccountSummary | null>(null)

  // Scenario 24 Part 4 follow-up — same area-based suggestion Create already
  // has. Only auto-selects when this account genuinely has no collector yet
  // (loaded collectorId is empty) — an already-assigned collector is never
  // silently swapped out just because a "better" area match exists.
  const [suggestedCollectorId, setSuggestedCollectorId] = useState<string | null>(null)

  useEffect(() => {
    // Guards against React Strict Mode's dev-mode double-effect-invocation
    // (or any other stale re-fire): without this, a late-resolving duplicate
    // load can call setForm() with the original record well after the user
    // has already started editing, silently discarding their changes. (Same
    // gap found and fixed in EditCollectorForm's equivalent load effect.)
    let cancelled = false
    Promise.all([
      installmentAccountsApi.get(id),
      getBranches(),
      collectorsApi.list({ limit: 200 }),
    ]).then(async ([accountRes, branchesRes, collectorsRes]) => {
      if (cancelled) return
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data.data)
      if (collectorsRes.success && collectorsRes.data) setCollectors(collectorsRes.data.data)

      if (accountRes.success && accountRes.data) {
        const a = accountRes.data
        setAccountNumber(a.accountNumber)
        setOriginalCategory(a.category ?? '')
        setSummary({
          customerName: a.customer?.name ?? '—',
          listedCashPrice: Number(a.listedCashPrice),
          downPayment: Number(a.downPayment),
          termMonths: a.termMonths,
          miFactor: Number(a.miFactor),
          amountFinanced: Number(a.amountFinanced),
          monthlyInstallment: Number(a.monthlyInstallment),
          pnv: Number(a.pnv),
          totalPrice: Number(a.totalPrice),
        })
        setForm({
          branchId: a.branchId ?? '',
          collectorId: a.collectorId ?? '',
          status: a.status,
          category: a.category ?? '',
          classification: a.classification ?? '',
          agingBucket: a.agingBucket ?? '',
          arrears: String(a.arrears ?? 0),
          penalty: String(a.penalty ?? 0),
        })

        const suggestion = await installmentAccountsApi.suggestCollector(a.customerId)
        if (cancelled) return
        const suggestedId = suggestion.success ? (suggestion.data?.collectorId ?? null) : null
        setSuggestedCollectorId(suggestedId)
        if (suggestedId && !a.collectorId) {
          setForm((f) => ({ ...f, collectorId: suggestedId }))
        }
      } else {
        setServerError(accountRes.error ?? 'Installment account not found')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const payload = {
      branchId: form.branchId || undefined,
      collectorId: form.collectorId || undefined,
      status: form.status,
      category: form.category || undefined,
      classification: form.classification || undefined,
      agingBucket: form.agingBucket || undefined,
      arrears: form.arrears === '' ? undefined : Number(form.arrears),
      penalty: form.penalty === '' ? undefined : Number(form.penalty),
    }

    const parsed = updateInstallmentAccountSchema.safeParse(payload)
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
    const res = await installmentAccountsApi.update(id, parsed.data)
    setSubmitting(false)
    if (res.success) {
      router.push(`/crm/installment-accounts/${id}`)
      router.refresh()
    } else {
      setServerError(res.error ?? 'Failed to update installment account')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">
        Loading installment account…
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href={`/crm/installment-accounts/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to account
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">Edit {accountNumber}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Update branch/collector assignment, status, and collection tags.
      </p>

      {summary && (
        <div className="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500">
            Account summary (set at creation, not editable here)
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <SummaryRow label="Customer" value={summary.customerName} />
            <SummaryRow label="Term" value={`${summary.termMonths} months`} />
            <SummaryRow label="MI factor" value={summary.miFactor.toString()} />
            <SummaryRow label="Listed cash price" value={peso(summary.listedCashPrice)} />
            <SummaryRow label="Down payment" value={peso(summary.downPayment)} />
            <SummaryRow label="Amount financed" value={peso(summary.amountFinanced)} />
            <SummaryRow label="Monthly installment" value={peso(summary.monthlyInstallment)} />
            <SummaryRow label="PNV (total installments)" value={peso(summary.pnv)} />
            <SummaryRow label="Total price" value={peso(summary.totalPrice)} />
          </dl>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-4 max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="branchId" className="block text-[13px] font-medium text-gray-700">
              Branch
            </label>
            <select
              id="branchId"
              value={form.branchId}
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
              value={form.collectorId}
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
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className="block text-[13px] font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as InstallmentAccountStatus)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="early_closed">Early closed</option>
              <option value="written_off">Written off</option>
            </select>
          </div>
          <div>
            <label htmlFor="agingBucket" className="block text-[13px] font-medium text-gray-700">
              Aging bucket
            </label>
            <input
              id="agingBucket"
              value={form.agingBucket}
              onChange={(e) => setField('agingBucket', e.target.value)}
              placeholder="current | 30 | 60 | 90 | over_90"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="block text-[13px] font-medium text-gray-700">
              Category
            </label>
            <select
              id="category"
              value={form.category}
              onChange={(e) =>
                setField('category', e.target.value as InstallmentAccountCategory | '')
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unset</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C" disabled={originalCategory !== 'C'}>
                C {originalCategory !== 'C' ? '— requires graduation request' : ''}
              </option>
              <option value="D">D</option>
            </select>
            {originalCategory !== 'C' && (
              <p className="mt-1 text-[12px] text-gray-500">
                Graduation to Category C needs management approval — request it from the account
                detail page instead of editing directly here.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="classification" className="block text-[13px] font-medium text-gray-700">
              Classification
            </label>
            <select
              id="classification"
              value={form.classification}
              onChange={(e) =>
                setField('classification', e.target.value as InstallmentAccountClassification | '')
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unset</option>
              <option value="official">Official</option>
              <option value="arrears">Arrears</option>
              <option value="not_moving">Not moving</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="arrears" className="block text-[13px] font-medium text-gray-700">
              Arrears (₱)
            </label>
            <input
              id="arrears"
              type="number"
              step="0.01"
              min="0"
              value={form.arrears}
              onChange={(e) => setField('arrears', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.arrears && <p className="mt-1 text-[12px] text-red-600">{errors.arrears}</p>}
          </div>
          <div>
            <label htmlFor="penalty" className="block text-[13px] font-medium text-gray-700">
              Penalty (₱)
            </label>
            <input
              id="penalty"
              type="number"
              step="0.01"
              min="0"
              value={form.penalty}
              onChange={(e) => setField('penalty', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.penalty && <p className="mt-1 text-[12px] text-red-600">{errors.penalty}</p>}
          </div>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/crm/installment-accounts/${id}`}
            className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 sm:w-auto"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}
