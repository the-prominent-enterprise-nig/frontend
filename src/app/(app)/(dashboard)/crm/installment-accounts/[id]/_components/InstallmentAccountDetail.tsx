'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Banknote, Coins } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import EarlyPayoffModal from '@/src/components/crm/EarlyPayoffModal'
import RecordPaymentModal from '@/src/components/crm/RecordPaymentModal'
import type { InstallmentAccountDetail as DetailType } from '@/src/schema/crm/types'

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
}: {
  id: string
  canEdit: boolean
  canEarlyPayoff: boolean
  canRecordPayment: boolean
}) {
  const [account, setAccount] = useState<DetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payoffOpen, setPayoffOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  function reload() {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
    })
  }

  useEffect(() => {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
      else setError(res.error ?? 'Installment account not found')
      setLoading(false)
    })
  }, [id])

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
          </dl>
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
