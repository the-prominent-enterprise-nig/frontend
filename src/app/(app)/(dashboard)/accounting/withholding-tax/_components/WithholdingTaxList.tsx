'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  ARInvoices,
  fmtMoney,
  fmtDate,
  type WithholdingPaymentListItem,
} from '@/src/libs/data/AccountingV2Data'

type Tab = 'pending' | 'variances'

const VARIANCE_STYLES: Record<string, string> = {
  none: 'bg-emerald-50 text-emerald-700',
  flagged: 'bg-amber-50 text-amber-700',
  resolved: 'bg-gray-100 text-gray-500',
}

export default function WithholdingTaxList() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<WithholdingPaymentListItem[]>([])
  const [variances, setVariances] = useState<WithholdingPaymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState<WithholdingPaymentListItem | null>(null)
  const [resolving, setResolving] = useState<WithholdingPaymentListItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [pendingRes, variancesRes] = await Promise.all([
      ARInvoices.listPendingCertificates(),
      ARInvoices.listFlaggedVariances(),
    ])
    setPending(pendingRes.data ?? [])
    setVariances(variancesRes.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const items = tab === 'pending' ? pending : variances

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Withholding Tax (CWT)</h2>
          <p className="text-sm text-gray-500">
            Track BIR Form 2307 certificates and flag amounts that don&rsquo;t match what was
            withheld at collection.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending Certificates
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
              {pending.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === 'variances'} onClick={() => setTab('variances')}>
          Flagged Variances
          {variances.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
              {variances.length}
            </span>
          )}
        </TabButton>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Collected</th>
              <th className="px-3 py-2 text-right">Withheld (recorded)</th>
              {tab === 'variances' && <th className="px-3 py-2 text-left">Note</th>}
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  {tab === 'pending' ? 'No pending certificates.' : 'No flagged variances.'}
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono text-xs">{p.arInvoice.invoiceNumber}</td>
                  <td className="px-3 py-2">{p.arInvoice.customer.name}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(p.paymentDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(p.withholdingAmount)}</td>
                  {tab === 'variances' && (
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-xs">
                      {p.withholdingVarianceNote}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {tab === 'pending' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">
                        pending
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          VARIANCE_STYLES[p.withholdingVarianceStatus ?? 'flagged']
                        }`}
                      >
                        {p.withholdingVarianceStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {tab === 'pending' ? (
                      <button
                        onClick={() => setReceiving(p)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 border border-purple-200 rounded ml-auto"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Mark Received
                      </button>
                    ) : (
                      <button
                        onClick={() => setResolving(p)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 border border-gray-200 rounded ml-auto"
                      >
                        <AlertTriangle className="w-3 h-3" /> Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {receiving && (
        <MarkReceivedForm
          payment={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => {
            setReceiving(null)
            load()
          }}
        />
      )}
      {resolving && (
        <ResolveVarianceForm
          payment={resolving}
          onClose={() => setResolving(null)}
          onSaved={() => {
            setResolving(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active
          ? 'border-purple-700 text-purple-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function MarkReceivedForm({
  payment,
  onClose,
  onSaved,
}: {
  payment: WithholdingPaymentListItem
  onClose: () => void
  onSaved: () => void
}) {
  const [certificateNo, setCertificateNo] = useState('')
  const [certificateDate, setCertificateDate] = useState('')
  const [certificateAmount, setCertificateAmount] = useState(String(payment.withholdingAmount))
  const [atc, setAtc] = useState('')
  const [taxPeriod, setTaxPeriod] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await ARInvoices.markCertificateReceived(payment.arInvoiceId, payment.id, {
      certificateNo: certificateNo || undefined,
      certificateDate: certificateDate || undefined,
      certificateAmount: Number(certificateAmount),
      atc: atc || undefined,
      taxPeriod: taxPeriod || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to record certificate')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Mark 2307 Certificate Received</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            {payment.arInvoice.customer.name} withheld {fmtMoney(payment.withholdingAmount)} on{' '}
            {payment.arInvoice.invoiceNumber}. If the certificate states a different amount, this
            gets flagged for review instead of silently changed.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Certificate No.</span>
            <input
              value={certificateNo}
              onChange={(e) => setCertificateNo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Certificate Date</span>
              <input
                type="date"
                value={certificateDate}
                onChange={(e) => setCertificateDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">
                Certificate Amount *
              </span>
              <input
                required
                type="number"
                step="0.01"
                value={certificateAmount}
                onChange={(e) => setCertificateAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">ATC</span>
              <input
                value={atc}
                onChange={(e) => setAtc(e.target.value)}
                placeholder="e.g. WC160"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Tax Period</span>
              <input
                value={taxPeriod}
                onChange={(e) => setTaxPeriod(e.target.value)}
                placeholder="e.g. 2026-Q3"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !certificateAmount}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResolveVarianceForm({
  payment,
  onClose,
  onSaved,
}: {
  payment: WithholdingPaymentListItem
  onClose: () => void
  onSaved: () => void
}) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await ARInvoices.resolveWithholdingVariance(payment.arInvoiceId, payment.id, {
      notes: notes || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to resolve')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Resolve Withholding Variance</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">{payment.withholdingVarianceNote}</p>
          <p className="text-xs text-gray-400">
            This records your decision only — it never changes the amount already posted to the GL.
            If a correction is needed, make it as a separate AR adjustment.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Reviewer notes / decision
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Mark Resolved'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
