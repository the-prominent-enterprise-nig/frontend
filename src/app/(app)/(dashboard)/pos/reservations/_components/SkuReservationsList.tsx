'use client'

import { useState } from 'react'
import { BookmarkCheck, RefreshCw, X, CheckCircle2, XCircle, PackageCheck } from 'lucide-react'
import {
  useSkuReservations,
  useFulfilSkuReservation,
  useRequestCancelSkuReservation,
  useApproveCancelSkuReservation,
  useRejectCancelSkuReservation,
  useCustomerAdvances,
} from '../../_hooks/usePos'
import type { SkuReservation, SkuReservationStatus } from '@/src/schema/pos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { PosDateShort } from '../../_components/PosDate'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

const STATUS_LABELS: Record<SkuReservationStatus, string> = {
  open: 'Open',
  earmarked: 'Earmarked',
  cancel_requested: 'Cancel Requested',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<SkuReservationStatus, string> = {
  open: 'bg-gray-100 text-gray-600',
  earmarked: 'bg-blue-50 text-blue-700',
  cancel_requested: 'bg-amber-50 text-amber-700',
  fulfilled: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
}

function StatusBadge({ status }: { status: SkuReservationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function reservationValue(res: SkuReservation): number | null {
  if (res.item?.sellingPrice == null) return null
  return res.item.sellingPrice * res.quantity
}

// SkuReservation.depositAmount stays 0 until fulfilment (Part 1's design —
// the deposit lives on a separate CustomerAdvance row until then, which
// fulfil() reads and copies into depositAmount as its final record). Before
// that, the real collected amount has to come from the ACTIVE/APPLIED
// CustomerAdvance(s) held against this reservation instead.
function collectedDeposit(res: SkuReservation, advancesByReservationId: Map<string, number>) {
  if (res.status === 'fulfilled') return res.depositAmount
  return advancesByReservationId.get(res.id) ?? 0
}

function remainingBalance(res: SkuReservation, deposit: number): number | null {
  const value = reservationValue(res)
  if (value == null) return null
  return Math.max(0, Math.round((value - deposit) * 100) / 100)
}

const PAYMENT_METHODS = ['cash', 'card', 'gcash', 'bank_transfer', 'check']

type ModalState =
  | { type: 'request-cancel'; reservation: SkuReservation }
  | { type: 'reject-cancel'; reservation: SkuReservation }
  | { type: 'approve-cancel'; reservation: SkuReservation }
  | { type: 'fulfil'; reservation: SkuReservation }
  | null

export default function SkuReservationsList({
  canFulfil,
  canRequestCancel,
  canApprove,
}: {
  canFulfil: boolean
  canRequestCancel: boolean
  canApprove: boolean
}) {
  const { branchId } = usePosBranchContext()
  const [statusFilter, setStatusFilter] = useState<SkuReservationStatus | ''>('')
  const { data, isLoading, isFetching, refetch } = useSkuReservations({
    ...(statusFilter && { status: statusFilter }),
    ...(branchId && { branchId }),
  })
  const { data: advancesData } = useCustomerAdvances({
    referenceType: 'sku_reservation',
    ...(branchId && { branchId }),
  })
  const fulfilMutation = useFulfilSkuReservation()
  const requestCancelMutation = useRequestCancelSkuReservation()
  const approveCancelMutation = useApproveCancelSkuReservation()
  const rejectCancelMutation = useRejectCancelSkuReservation()

  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [reasonInput, setReasonInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  const reservations = data?.data ?? []

  // Only ACTIVE/APPLIED advances still represent money currently secured
  // against the reservation — a REFUNDED one has already gone back to the
  // customer and shouldn't read as "collected" anymore.
  const advancesByReservationId = new Map<string, number>()
  for (const advance of advancesData?.data ?? []) {
    if (advance.status === 'REFUNDED') continue
    advancesByReservationId.set(
      advance.referenceId,
      (advancesByReservationId.get(advance.referenceId) ?? 0) + advance.amount
    )
  }

  function closeModal() {
    setModal(null)
    setReasonInput('')
    setPaymentMethod('')
  }

  async function handleRequestCancel() {
    if (modal?.type !== 'request-cancel') return
    if (!reasonInput.trim()) {
      setError('A reason is required to request cancellation.')
      return
    }
    setError('')
    const res = await requestCancelMutation.mutateAsync({
      id: modal.reservation.id,
      reason: reasonInput.trim(),
    })
    if (!res.success) {
      setError(res.error ?? 'Failed to request cancellation')
      return
    }
    closeModal()
  }

  async function handleRejectCancel() {
    if (modal?.type !== 'reject-cancel') return
    if (!reasonInput.trim()) {
      setError('A reason is required to reject a cancellation request.')
      return
    }
    setError('')
    const res = await rejectCancelMutation.mutateAsync({
      id: modal.reservation.id,
      reason: reasonInput.trim(),
    })
    if (!res.success) {
      setError(res.error ?? 'Failed to reject cancellation')
      return
    }
    closeModal()
  }

  async function handleApproveCancel() {
    if (modal?.type !== 'approve-cancel') return
    setError('')
    const res = await approveCancelMutation.mutateAsync(modal.reservation.id)
    if (!res.success) {
      setError(res.error ?? 'Failed to approve cancellation')
      return
    }
    closeModal()
  }

  async function handleFulfil() {
    if (modal?.type !== 'fulfil') return
    const deposit = collectedDeposit(modal.reservation, advancesByReservationId)
    const remaining = remainingBalance(modal.reservation, deposit)
    if ((remaining == null || remaining > 0.009) && !paymentMethod) {
      setError('A payment method is required to collect the remaining balance.')
      return
    }
    setError('')
    const res = await fulfilMutation.mutateAsync({
      id: modal.reservation.id,
      input: paymentMethod ? { paymentMethod } : {},
    })
    if (!res.success) {
      setError(res.error ?? 'Failed to fulfil reservation')
      return
    }
    closeModal()
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
            <p className="mt-1 text-sm text-gray-500">
              SKU-level reservations held for customers ahead of stock arrival.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SkuReservationStatus | '')}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 outline-none focus:border-purple-400"
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABELS) as SkuReservationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div
          className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
            isFetching && !isLoading ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-300">
              <BookmarkCheck size={48} strokeWidth={1} />
              <p className="text-sm font-medium text-gray-400">No reservations</p>
              <p className="text-xs text-gray-400">
                Reservations created from Checkout&apos;s Reserve mode will appear here.
              </p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Item
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                    Qty
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Deposit
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Created
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservations.map((res) => {
                  const deposit = collectedDeposit(res, advancesByReservationId)
                  const remaining = remainingBalance(res, deposit)
                  return (
                    <tr key={res.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{res.item?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">
                          {res.item?.sku}
                          {res.variant ? ` · ${res.variant.variantSku}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{res.customer?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-center text-gray-600">{res.quantity}</td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {fmt(deposit)}
                        {(res.status === 'open' || res.status === 'earmarked') &&
                          remaining != null &&
                          remaining > 0.009 && (
                            <p className="text-[11px] text-gray-400">{fmt(remaining)} due</p>
                          )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={res.status} />
                        {res.status === 'cancel_requested' && res.cancelReason && (
                          <p className="mt-1 max-w-56 truncate text-[11px] text-gray-400">
                            {res.cancelReason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        <PosDateShort iso={res.createdAt} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {res.status === 'earmarked' && canFulfil && (
                            <button
                              onClick={() => {
                                setError('')
                                setModal({ type: 'fulfil', reservation: res })
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-800"
                            >
                              <PackageCheck size={11} />
                              Fulfil
                            </button>
                          )}
                          {(res.status === 'open' || res.status === 'earmarked') &&
                            canRequestCancel && (
                              <button
                                onClick={() => {
                                  setError('')
                                  setModal({ type: 'request-cancel', reservation: res })
                                }}
                                className="text-xs font-medium text-red-500 hover:underline"
                              >
                                Request Cancel
                              </button>
                            )}
                          {res.status === 'cancel_requested' && canApprove && (
                            <>
                              <button
                                onClick={() => {
                                  setError('')
                                  setModal({ type: 'approve-cancel', reservation: res })
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                              >
                                <CheckCircle2 size={11} />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setError('')
                                  setModal({ type: 'reject-cancel', reservation: res })
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                              >
                                <XCircle size={11} />
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>

              {modal.type === 'request-cancel' && (
                <>
                  <h2 className="mb-2 text-lg font-bold text-gray-900">Request Cancellation?</h2>
                  <p className="mb-4 text-sm text-gray-600">
                    A Branch Manager will need to approve this before the deposit (if any) is
                    refunded.
                  </p>
                  <textarea
                    rows={3}
                    className="mb-4 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    placeholder="Why is this being cancelled? *"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeModal}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Keep Reservation
                    </button>
                    <button
                      onClick={handleRequestCancel}
                      disabled={requestCancelMutation.isPending}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {requestCancelMutation.isPending ? 'Submitting…' : 'Request Cancellation'}
                    </button>
                  </div>
                </>
              )}

              {modal.type === 'reject-cancel' && (
                <>
                  <h2 className="mb-2 text-lg font-bold text-gray-900">
                    Reject Cancellation Request?
                  </h2>
                  <p className="mb-4 text-sm text-gray-600">
                    The reservation reverts to its prior status — nothing is refunded.
                  </p>
                  <textarea
                    rows={3}
                    className="mb-4 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    placeholder="Why is this cancellation request being rejected? *"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeModal}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRejectCancel}
                      disabled={rejectCancelMutation.isPending}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      {rejectCancelMutation.isPending ? 'Submitting…' : 'Reject Request'}
                    </button>
                  </div>
                </>
              )}

              {modal.type === 'approve-cancel' && (
                <>
                  <h2 className="mb-2 text-lg font-bold text-gray-900">Approve Cancellation?</h2>
                  <p className="mb-1 text-sm text-gray-600">
                    The reservation will be cancelled and any deposit refunded.
                  </p>
                  {(() => {
                    const deposit = collectedDeposit(modal.reservation, advancesByReservationId)
                    return deposit > 0 ? (
                      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Refunding {fmt(deposit)}.
                      </p>
                    ) : null
                  })()}
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={closeModal}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleApproveCancel}
                      disabled={approveCancelMutation.isPending}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {approveCancelMutation.isPending ? 'Approving…' : 'Approve & Refund'}
                    </button>
                  </div>
                </>
              )}

              {modal.type === 'fulfil' && (
                <>
                  <h2 className="mb-2 text-lg font-bold text-gray-900">Fulfil Reservation?</h2>
                  <p className="mb-4 text-sm text-gray-600">
                    {modal.reservation.item?.name} · Qty {modal.reservation.quantity}
                  </p>
                  <div className="mb-4 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    {(() => {
                      const deposit = collectedDeposit(modal.reservation, advancesByReservationId)
                      const remaining = remainingBalance(modal.reservation, deposit)
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Deposit collected</span>
                            <span className="text-gray-700">{fmt(deposit)}</span>
                          </div>
                          {remaining != null && remaining > 0.009 && (
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-500">Remaining due</span>
                              <span className="text-gray-900">{fmt(remaining)}</span>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Payment method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                  >
                    <option value="">Select…</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeModal}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFulfil}
                      disabled={fulfilMutation.isPending}
                      className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                    >
                      {fulfilMutation.isPending ? 'Fulfilling…' : 'Fulfil'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
