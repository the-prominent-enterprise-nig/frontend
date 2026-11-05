'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import {
  acknowledgePosTurnover,
  listPosTurnovers,
  rejectPosTurnover,
  type PosTurnover,
} from '../_actions/pos-deposits'

export const TURNOVERS_KEY = 'pos-turnovers'

/**
 * Scenario 83 — acknowledging a cash turnover. Pending incoming turnovers are
 * rows of the Collected Funds table, in the receiving branch's group, with
 * Acknowledge / Reject in its Action column: the one place it is done.
 */

/** Turnovers sent to the branch (every branch, for none) still awaiting it. */
export function usePendingIncoming(branchId: string | null): {
  turnovers: PosTurnover[]
  loading: boolean
} {
  const pending = useQuery({
    queryKey: [TURNOVERS_KEY, 'incoming-pending', branchId],
    queryFn: () =>
      listPosTurnovers({
        direction: 'incoming',
        status: 'pending',
        ...(branchId ? { branchId } : {}),
      }),
    staleTime: 0,
  })
  return { turnovers: pending.data?.data ?? [], loading: pending.isLoading }
}

export type Action = 'acknowledge' | 'reject'

/** What this user may do with a turnover, and why not when they may not.
 * Mirrors the backend: never whoever recorded it (maker-checker), and only a
 * user at the receiving branch acknowledges — Head Office may reject. */
export interface Allowed {
  acknowledge: boolean
  reject: boolean
  note: string | null
}

export function allowedActions(
  t: PosTurnover,
  canManage: boolean,
  me: { id: string; branchId?: string | null } | undefined
): Allowed {
  if (!canManage || !me) return { acknowledge: false, reject: false, note: null }
  if (t.posDeposit.createdById === me.id) {
    return {
      acknowledge: false,
      reject: false,
      note: null,
    }
  }
  const atReceiver = me.branchId === t.turnoverToBranch.id
  return {
    acknowledge: atReceiver,
    // The backend only lets the receiving branch, or Head Office, reject.
    reject: atReceiver || !me.branchId,
    // The row's status already says it is awaiting acknowledgment.
    note: null,
  }
}

export function TurnoverActions({
  allowed,
  onAct,
}: {
  allowed: Allowed
  onAct: (kind: Action) => void
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2">
      {allowed.note && <span className="text-xs text-gray-500">{allowed.note}</span>}
      {allowed.reject && (
        <button
          type="button"
          onClick={() => onAct('reject')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Reject
        </button>
      )}
      {allowed.acknowledge && (
        <button
          type="button"
          onClick={() => onAct('acknowledge')}
          className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800"
        >
          Acknowledge
        </button>
      )}
    </span>
  )
}

/** Acknowledge, or reject with a reason — each behind a confirm. */
export function ActionDialog({
  turnover,
  kind,
  onClose,
  onDone,
}: {
  turnover: PosTurnover
  kind: Action
  onClose: () => void
  onDone: () => void
}): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const amount = fmtMoney(Number(turnover.amount))
  const confirm = async (): Promise<void> => {
    if (kind === 'reject' && !reason.trim()) return
    setSaving(true)
    const res =
      kind === 'acknowledge'
        ? await acknowledgePosTurnover(turnover.id)
        : await rejectPosTurnover(turnover.id, reason.trim())
    setSaving(false)
    if (!res.success) {
      showToast({
        title: kind === 'acknowledge' ? 'Could not acknowledge' : 'Could not reject',
        description: res.error || res.message || 'Try again.',
        status: 'error',
      })
      return
    }
    showToast({
      title: kind === 'acknowledge' ? 'Turnover acknowledged' : 'Turnover rejected',
      description:
        kind === 'acknowledge'
          ? `${amount} is now this branch's cash, to deposit with its day.`
          : `${amount} is back in ${turnover.senderName}'s undeposited funds.`,
      status: 'success',
    })
    onDone()
  }
  return (
    <ConfirmDialog
      open
      title={kind === 'acknowledge' ? 'Acknowledge turnover' : 'Reject turnover'}
      message={
        kind === 'acknowledge' ? (
          <p>
            Confirm you received <strong>{amount}</strong> in cash from{' '}
            <strong>{turnover.senderName}</strong>
            {turnover.reference ? ` (slip ${turnover.reference})` : ''}. It becomes a New Receipt
            here and is deposited with this branch&apos;s collections.
          </p>
        ) : (
          <div className="space-y-2">
            <p>
              The {amount} goes back to {turnover.senderName}&apos;s undeposited funds.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is it being rejected? *"
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        )
      }
      confirmLabel={kind === 'acknowledge' ? 'Acknowledge' : 'Reject turnover'}
      destructive={kind === 'reject'}
      loading={saving}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  )
}
