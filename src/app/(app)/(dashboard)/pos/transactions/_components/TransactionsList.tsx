'use client'

import { useState } from 'react'
import { useTransactions, useSendReceipt } from '../../_hooks/usePos'
import {
  RefreshCw,
  ShoppingCart,
  X,
  Search,
  ChevronDown,
  Mail,
  Printer,
  KeyRound,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import {
  getReceipt,
  logReprintEvent,
  validateManagerOverride,
  submitVoidRequest,
  approveVoidRequest,
} from '../../_actions/pos-actions'
import type { PosTransaction } from '@/src/schema/pos'
import { PosDateTime } from '../../_components/PosDate'
import { type SessionUser, can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

const typeColor: Record<string, string> = {
  sale: 'bg-blue-100 text-blue-700',
  refund: 'bg-orange-100 text-orange-700',
  exchange: 'bg-purple-100 text-purple-700',
}

const statusColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

type DetailModal = { type: 'none' } | { type: 'detail'; transaction: PosTransaction }

interface Props {
  session: SessionUser
}

export default function TransactionsList({ session }: Props) {
  const canVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_READ)
  const canDirectVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  const [filters, setFilters] = useState({
    transactionType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    transactionNumber: '',
  })
  const [applied, setApplied] = useState(filters)
  const [detail, setDetail] = useState<DetailModal>({ type: 'none' })
  const [voidTarget, setVoidTarget] = useState<PosTransaction | null>(null)
  const [voidError, setVoidError] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [voidMode, setVoidMode] = useState<'id-and-pin' | 'request'>('id-and-pin')
  const [voidManagerId, setVoidManagerId] = useState('')
  const [voidManagerPin, setVoidManagerPin] = useState('')
  const [voidPending, setVoidPending] = useState(false)

  const { data, isLoading, isFetching, refetch } = useTransactions(
    Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== '')) as Record<
      string,
      string
    >
  )

  const transactions: PosTransaction[] = data?.data ?? []

  async function handleVoid() {
    if (!voidTarget) return
    if (!voidReason.trim()) {
      setVoidError('A reason for the void is required.')
      return
    }
    setVoidError('')
    setVoidPending(true)

    if (voidMode === 'request') {
      const reqRes = await submitVoidRequest(voidTarget.id, { reason: voidReason.trim() })
      setVoidPending(false)
      if (!reqRes.success) {
        setVoidError(reqRes.error ?? 'Failed to submit void request.')
        return
      }
      setVoidTarget(null)
      setVoidReason('')
      return
    }

    // ID + PIN: manager or owner present
    if (!voidManagerId.trim()) {
      setVoidError('Manager ID is required.')
      setVoidPending(false)
      return
    }
    if (!voidManagerPin.trim()) {
      setVoidError('PIN is required.')
      setVoidPending(false)
      return
    }

    const pinRes = await validateManagerOverride(voidManagerId.trim(), voidManagerPin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setVoidError(pinRes.error ?? 'Invalid ID or PIN. Please try again.')
      setVoidPending(false)
      return
    }
    const managerName = pinRes.data.managerName

    const reqRes = await submitVoidRequest(voidTarget.id, { reason: voidReason.trim() })
    if (!reqRes.success || !reqRes.data) {
      setVoidError(reqRes.error ?? 'Failed to submit void request.')
      setVoidPending(false)
      return
    }

    const approveRes = await approveVoidRequest(reqRes.data.id, {
      reviewNotes: `Authorized by ${managerName}`,
    })
    setVoidPending(false)
    if (!approveRes.success) {
      setVoidError(approveRes.error ?? 'Failed to void.')
      return
    }
    setVoidTarget(null)
    setVoidReason('')
    setVoidManagerId('')
    setVoidManagerPin('')
    refetch()
  }

  function openVoidModal(tx: PosTransaction) {
    setVoidTarget(tx)
    setVoidError('')
    setVoidReason('')
    setVoidMode('id-and-pin')
    setVoidManagerId('')
    setVoidManagerPin('')
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-1 text-sm text-gray-500">All sales, refunds, and exchanges.</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex-1 min-w-40">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Transaction #</label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="input pl-8"
                placeholder="Search…"
                value={filters.transactionNumber}
                onChange={(e) => setFilters((p) => ({ ...p, transactionNumber: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Type</label>
            <div className="relative">
              <select
                className="select"
                value={filters.transactionType}
                onChange={(e) => setFilters((p) => ({ ...p, transactionType: e.target.value }))}
              >
                <option value="">All types</option>
                <option value="sale">Sale</option>
                <option value="refund">Refund</option>
                <option value="exchange">Exchange</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
            <div className="relative">
              <select
                className="select"
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="voided">Voided</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">From</label>
            <input
              className="input"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">To</label>
            <input
              className="input"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
            />
          </div>
          <button
            onClick={() => setApplied(filters)}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            Apply
          </button>
          <button
            onClick={() => {
              const cleared = {
                transactionType: '',
                status: '',
                dateFrom: '',
                dateTo: '',
                transactionNumber: '',
              }
              setFilters(cleared)
              setApplied(cleared)
            }}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Clear
          </button>
        </div>

        {!isLoading && transactions.length > 0 && (
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{transactions.length}</span>{' '}
            transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <ShoppingCart size={40} />
              <p className="text-sm">No transactions found.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Transaction #
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setDetail({ type: 'detail', transaction: tx })}
                  >
                    <td className="px-5 py-3 font-mono text-sm font-medium text-gray-800">
                      {tx.transactionNumber}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[tx.transactionType]}`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[tx.status]}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <PosDateTime iso={tx.occurredAt ?? tx.createdAt} />
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detail.type === 'detail' && (
        <TransactionDetail
          transaction={detail.transaction}
          onClose={() => setDetail({ type: 'none' })}
          canVoid={canVoid}
          onVoid={() => {
            setDetail({ type: 'none' })
            openVoidModal(detail.transaction)
          }}
        />
      )}

      {/* Void Modal */}
      {voidTarget && canVoid && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => !voidPending && setVoidTarget(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              {/* Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <KeyRound size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Void Transaction</h2>
                  <p className="font-mono text-xs text-gray-500">{voidTarget.transactionNumber}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Reason */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    placeholder="e.g. Incorrect item scanned"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    disabled={voidPending}
                  />
                </div>

                {/* Mode tabs — always shown so cashiers can offer manager override */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setVoidMode('request')
                      setVoidManagerId('')
                      setVoidManagerPin('')
                    }}
                    className={`flex-1 py-2 transition-colors ${voidMode === 'request' ? 'bg-gray-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Request Approval
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoidMode('id-and-pin')
                      setVoidManagerId('')
                      setVoidManagerPin('')
                    }}
                    className={`flex-1 py-2 transition-colors ${voidMode === 'id-and-pin' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Manager Override
                  </button>
                </div>

                {voidMode === 'id-and-pin' ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={13} className="text-amber-600" />
                      <p className="text-xs font-semibold text-amber-700">
                        Manager / Owner Authorization
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Employee ID
                      </label>
                      <input
                        autoFocus
                        type="text"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Manager or owner employee ID"
                        value={voidManagerId}
                        onChange={(e) => setVoidManagerId(e.target.value)}
                        disabled={voidPending}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono tracking-widest text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="••••"
                        value={voidManagerPin}
                        onChange={(e) =>
                          setVoidManagerPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && handleVoid()}
                        disabled={voidPending}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">
                      A void request will be sent for manager approval. The transaction will be
                      voided once approved from the{' '}
                      <span className="font-medium text-gray-700">Void Requests</span> page.
                    </p>
                  </div>
                )}
              </div>

              {voidError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {voidError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setVoidTarget(null)}
                  disabled={voidPending}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  disabled={
                    voidPending ||
                    !voidReason.trim() ||
                    (voidMode === 'id-and-pin' && (!voidManagerId.trim() || !voidManagerPin.trim()))
                  }
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {voidPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />{' '}
                      {voidMode === 'request' ? 'Submitting…' : 'Voiding…'}
                    </>
                  ) : voidMode === 'request' ? (
                    'Submit Request'
                  ) : (
                    'Void Transaction'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TransactionDetail({
  transaction: tx,
  onClose,
  canVoid,
  onVoid,
}: {
  transaction: PosTransaction
  onClose: () => void
  canVoid?: boolean
  onVoid?: () => void
}) {
  const sendReceiptMutation = useSendReceipt()
  const [showSendReceipt, setShowSendReceipt] = useState(false)
  const [receiptForm, setReceiptForm] = useState({ email: '', phone: '' })
  const [receiptMsg, setReceiptMsg] = useState('')
  const [receiptErr, setReceiptErr] = useState('')
  const [reprinting, setReprinting] = useState(false)

  async function handleSendReceipt() {
    setReceiptErr('')
    setReceiptMsg('')
    const input = {
      email: receiptForm.email || undefined,
      phone: receiptForm.phone || undefined,
    }
    const res = await sendReceiptMutation.mutateAsync({ id: tx.id, input })
    if (!res.success) {
      setReceiptErr(res.error ?? 'Failed to send receipt')
      return
    }
    setReceiptMsg(res.data?.message ?? 'Receipt delivery queued')
    setShowSendReceipt(false)
  }

  async function handleReprint() {
    setReprinting(true)
    await getReceipt(tx.id)
    try {
      await logReprintEvent(tx.id)
    } catch {}
    setReprinting(false)

    const lineRows = (tx.lines ?? [])
      .map(
        (l) =>
          `<tr><td>${l.itemName}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">&#8369;${l.unitPrice.toFixed(2)}</td><td style="text-align:right">&#8369;${l.lineTotal.toFixed(2)}</td></tr>`
      )
      .join('')

    const payRows = (tx.payments ?? [])
      .map(
        (p) =>
          `<tr><td style="text-transform:capitalize">${p.paymentMethod.replace(/_/g, ' ')}</td><td style="text-align:right">&#8369;${p.amount.toFixed(2)}</td></tr>`
      )
      .join('')

    const date = new Date(tx.occurredAt ?? tx.createdAt).toLocaleString('en-PH')

    const html = `<!DOCTYPE html><html><head><title>REPRINT — ${tx.transactionNumber}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:360px;margin:0 auto;padding:16px}
  .banner{background:#000;color:#fff;text-align:center;padding:6px 0;font-size:15px;font-weight:bold;letter-spacing:6px;margin-bottom:10px}
  .center{text-align:center;margin:3px 0;color:#555}
  hr{border:none;border-top:1px dashed #aaa;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#888;padding:2px 4px}
  td{padding:3px 4px}
  .total-row td{font-weight:bold;border-top:1px solid #ccc;padding-top:5px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:10px}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="banner">— REPRINT —</div>
<p class="center" style="font-weight:bold">${tx.transactionNumber}</p>
<p class="center">${date}</p>
<hr>
<table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead><tbody>${lineRows}</tbody></table>
<hr>
<table>
  <tr><td>Subtotal</td><td style="text-align:right">&#8369;${tx.subtotal.toFixed(2)}</td></tr>
  ${tx.discountTotal > 0 ? `<tr><td>Discount</td><td style="text-align:right">-&#8369;${tx.discountTotal.toFixed(2)}</td></tr>` : ''}
  ${tx.taxTotal > 0 ? `<tr><td>Tax</td><td style="text-align:right">&#8369;${tx.taxTotal.toFixed(2)}</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">&#8369;${tx.totalAmount.toFixed(2)}</td></tr>
</table>
<hr>
<table><tbody>${payRows}</tbody></table>
<hr>
<p class="footer">This is a reprint of an original receipt.</p>
<button class="no-print" onclick="window.print()" style="display:block;margin:12px auto;padding:6px 20px;cursor:pointer;font-size:12px">Print</button>
</body></html>`

    const w = window.open('', '_blank', 'width=440,height=680,scrollbars=yes')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 400)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          <h2 className="mb-1 text-lg font-bold text-gray-900">{tx.transactionNumber}</h2>
          <p className="mb-4 text-sm text-gray-500 capitalize">
            {tx.transactionType} · {tx.status}
          </p>

          {tx.lines && tx.lines.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Items</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-1">Item</th>
                    <th className="pb-1 text-right">Qty</th>
                    <th className="pb-1 text-right">Unit Price</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tx.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5 text-gray-800">{l.itemName}</td>
                      <td className="py-1.5 text-right text-gray-600">{l.quantity}</td>
                      <td className="py-1.5 text-right text-gray-600">
                        {formatCurrency(l.unitPrice)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-gray-900">
                        {formatCurrency(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
            <Row label="Subtotal" value={formatCurrency(tx.subtotal)} />
            {tx.discountTotal > 0 && (
              <Row label="Discount" value={`-${formatCurrency(tx.discountTotal)}`} />
            )}
            {tx.taxTotal > 0 && <Row label="Tax" value={formatCurrency(tx.taxTotal)} />}
            <div className="border-t border-gray-200 pt-2">
              <Row label="Total" value={formatCurrency(tx.totalAmount)} bold />
            </div>
          </div>

          {tx.payments && tx.payments.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Payments</p>
              {tx.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm py-1">
                  <span className="capitalize text-gray-600">
                    {p.paymentMethod.replace('_', ' ')}
                  </span>
                  <span className="font-medium text-gray-900">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {receiptMsg && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {receiptMsg}
            </p>
          )}
          {receiptErr && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{receiptErr}</p>
          )}

          {showSendReceipt && (
            <div className="mt-4 space-y-3 rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Send Receipt</p>
              <input
                className="input"
                placeholder="Email (optional)"
                type="email"
                value={receiptForm.email}
                onChange={(e) => setReceiptForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Phone (optional)"
                value={receiptForm.phone}
                onChange={(e) => setReceiptForm((p) => ({ ...p, phone: e.target.value }))}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowSendReceipt(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleSendReceipt}
                  disabled={sendReceiptMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {sendReceiptMutation.isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                setShowSendReceipt((v) => !v)
                setReceiptMsg('')
                setReceiptErr('')
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Mail size={12} />
              Send Receipt
            </button>
            <button
              onClick={handleReprint}
              disabled={reprinting}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Printer size={12} />
              {reprinting ? 'Loading…' : 'Reprint'}
            </button>
            {tx.status === 'completed' && canVoid && onVoid && (
              <button
                onClick={onVoid}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-600 ring-1 ring-orange-200 hover:bg-orange-100 transition-colors"
              >
                Void
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
