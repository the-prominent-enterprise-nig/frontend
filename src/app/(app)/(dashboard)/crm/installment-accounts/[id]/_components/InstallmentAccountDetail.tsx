'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Banknote, Coins, ArrowUpCircle, Check, X as XIcon } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import EarlyPayoffModal from '@/src/components/crm/EarlyPayoffModal'
import RecordPaymentModal from '@/src/components/crm/RecordPaymentModal'
import AgingColorBadge from '@/src/components/crm/AgingColorBadge'
import type {
  InstallmentAccountDetail as DetailType,
  CategoryGraduationRequest,
} from '@/src/schema/crm/types'

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-blue-50 text-blue-700 ring-blue-200',
  C: 'bg-amber-50 text-amber-700 ring-amber-200',
  D: 'bg-red-50 text-red-700 ring-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 ring-blue-200',
  closed: 'bg-gray-100 text-gray-600 ring-gray-200',
  early_closed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  written_off: 'bg-red-50 text-red-700 ring-red-200',
}

function Badge({ value, colors }: { value?: string | null; colors: Record<string, string> }) {
  if (!value) return <span className="text-gray-400">—</span>
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        colors[value] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {value.replace('_', ' ')}
    </span>
  )
}

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function InstallmentAccountDetail({
  id,
  canEdit,
  canEarlyPayoff,
  canRecordPayment,
  canApproveGraduation,
}: {
  id: string
  canEdit: boolean
  canEarlyPayoff: boolean
  canRecordPayment: boolean
  canApproveGraduation: boolean
}) {
  const [account, setAccount] = useState<DetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payoffOpen, setPayoffOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const [graduationRequests, setGraduationRequests] = useState<CategoryGraduationRequest[]>([])
  const [requestingGraduation, setRequestingGraduation] = useState(false)
  const [graduationError, setGraduationError] = useState<string | null>(null)
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null)

  function reload() {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
    })
  }

  function reloadGraduationRequests() {
    installmentAccountsApi.listGraduationRequests(id).then((res) => {
      if (res.success && res.data) setGraduationRequests(res.data)
    })
  }

  useEffect(() => {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
      else setError(res.error ?? 'Installment account not found')
      setLoading(false)
    })
    reloadGraduationRequests()
  }, [id])

  const pendingGraduation = graduationRequests.find((r) => r.status === 'pending')

  async function handleRequestGraduation() {
    setGraduationError(null)
    setRequestingGraduation(true)
    const res = await installmentAccountsApi.requestGraduation(id, {})
    setRequestingGraduation(false)
    if (res.success) {
      reloadGraduationRequests()
    } else {
      setGraduationError(res.error ?? 'Failed to request graduation')
    }
  }

  async function handleApproveGraduation(requestId: string) {
    const res = await installmentAccountsApi.approveGraduation(id, requestId)
    if (res.success) {
      reload()
      reloadGraduationRequests()
    }
  }

  async function handleRejectGraduation(requestId: string, reason: string) {
    const res = await installmentAccountsApi.rejectGraduation(id, requestId, { reason })
    if (res.success) {
      setRejectingRequestId(null)
      reloadGraduationRequests()
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">
        Loading installment account…
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/crm/installment-accounts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to installment accounts
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const canSettle = canEarlyPayoff && account.status === 'active'
  const canPay = canRecordPayment && account.status === 'active'

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/crm/installment-accounts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to installment accounts
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{account.accountNumber}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{account.customer.name}</span>
            <span>·</span>
            <Badge value={account.status} colors={STATUS_COLORS} />
            <Badge value={account.category} colors={CATEGORY_COLORS} />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {canPay && (
            <button
              onClick={() => setPaymentOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none"
            >
              <Coins className="h-4 w-4" />
              Record payment
            </button>
          )}
          {canSettle && (
            <button
              onClick={() => setPayoffOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 sm:flex-none"
            >
              <Banknote className="h-4 w-4" />
              Settle early
            </button>
          )}
          {canEdit && (
            <Link
              href={`/crm/installment-accounts/${id}/edit`}
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
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Customer & assignment</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Customer" value={account.customer.name} />
            <Row label="Phone" value={account.customer.phone ?? '—'} />
            <Row label="Email" value={account.customer.email ?? '—'} />
            <Row label="Branch" value={account.branch?.name ?? '—'} />
            <Row
              label="Collector"
              value={
                account.collector
                  ? `${account.collector.stubNumber} — ${account.collector.name}`
                  : '—'
              }
            />
          </dl>

          <h2 className="mb-3 mt-5 text-[14px] font-semibold text-gray-900">Collection tags</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Classification" value={account.classification ?? '—'} />
            <Row label="Aging bucket" value={account.agingBucket ?? '—'} />
            <Row label="Months run" value={String(account.monthsRun)} />
            <Row label="Points" value={String(account.points)} />
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Aging color</dt>
              <dd className="text-right">
                <AgingColorBadge color={account.agingColor} />
              </dd>
            </div>
          </dl>

          {account.category !== 'C' && !pendingGraduation && canEdit && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <button
                onClick={handleRequestGraduation}
                disabled={requestingGraduation}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowUpCircle className="h-4 w-4" />
                {requestingGraduation ? 'Requesting…' : 'Request graduation to Category C'}
              </button>
              {graduationError && (
                <p className="mt-2 text-[12px] text-red-600">{graduationError}</p>
              )}
            </div>
          )}

          {pendingGraduation && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[13px] font-medium text-amber-900">
                Pending graduation to Category C
              </p>
              <p className="mt-0.5 text-[12px] text-amber-700">
                Requires management approval before the category changes.
              </p>
              {canApproveGraduation && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleApproveGraduation(pendingGraduation.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingRequestId(pendingGraduation.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Financing</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <Row label="Listed cash price" value={peso(account.listedCashPrice)} />
            <Row label="Down payment" value={peso(account.downPayment)} />
            <Row label="Amount financed" value={peso(account.amountFinanced)} />
            <Row label="Term" value={`${account.termMonths} mo`} />
            <Row label="MI factor" value={String(account.miFactor)} />
            <Row label="Monthly installment" value={peso(account.monthlyInstallment)} />
            <Row label="PNV" value={peso(account.pnv)} />
            <Row label="Total price" value={peso(account.totalPrice)} />
            <Row label="Interest differential" value={peso(account.interestDifferential)} />
            <Row label="PPD" value={peso(account.ppd)} />
          </div>

          <h2 className="mb-3 mt-5 text-[14px] font-semibold text-gray-900">Ledger balances</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <Row label="Opening balance" value={peso(account.openingBalance)} />
            <Row label="Current balance" value={peso(account.currentBalance)} />
            <Row label="DP balance" value={peso(account.dpBalance)} />
            <Row label="Arrears" value={peso(account.arrears)} />
            <Row label="Penalty" value={peso(account.penalty)} />
            <Row label="Not yet due" value={peso(account.notYetDue)} />
            <Row label="Total due" value={peso(account.totalDue)} />
            <Row label="MI due" value={peso(account.miDue)} />
            <Row label="Uncollected" value={peso(account.uncollected)} />
          </div>

          <h2 className="mb-3 mt-5 text-[14px] font-semibold text-gray-900">Last OR</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <Row label="OR number" value={account.lastOrNumber ?? '—'} />
            <Row
              label="OR date"
              value={account.lastOrDate ? new Date(account.lastOrDate).toLocaleDateString() : '—'}
            />
            <Row
              label="OR amount"
              value={account.lastOrAmount != null ? peso(account.lastOrAmount) : '—'}
            />
          </div>
        </section>
      </div>

      <EarlyPayoffModal
        open={payoffOpen}
        onClose={() => setPayoffOpen(false)}
        onSettled={reload}
        accountId={id}
        suggestedAmount={Number(account.currentBalance)}
      />

      <RecordPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onRecorded={reload}
        accountId={id}
        suggestedAmount={Number(account.monthlyInstallment)}
      />

      {rejectingRequestId && (
        <RejectGraduationModal
          onClose={() => setRejectingRequestId(null)}
          onReject={(reason) => handleRejectGraduation(rejectingRequestId, reason)}
        />
      )}
    </div>
  )
}

function RejectGraduationModal({
  onClose,
  onReject,
}: {
  onClose: () => void
  onReject: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Reject graduation request</h2>
        <label className="block text-[13px] font-medium text-gray-700">Reason</label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. arrears not yet cleared"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onReject(reason)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-50 py-1 last:border-0 sm:block sm:border-0 sm:py-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800 sm:mt-0.5 sm:text-left">{value}</dd>
    </div>
  )
}
