'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { hasPrivilegedRole, type SessionUser } from '@/src/libs/guards/permission'
import {
  acknowledgePosTurnover,
  correctPosTurnover,
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
 * Mirrors the backend: never whoever recorded it (maker-checker); a user at
 * the receiving branch or the Business Owner acknowledges — Head Office may
 * reject. */
export interface Allowed {
  acknowledge: boolean
  reject: boolean
  note: string | null
}

export function allowedActions(
  t: PosTurnover,
  canManage: boolean,
  me: SessionUser | undefined
): Allowed {
  if (!canManage || !me) return { acknowledge: false, reject: false, note: null }
  if (t.posDeposit.createdById === me.id) {
    return { acknowledge: false, reject: false, note: null }
  }
  const atReceiver = me.branchId === t.turnoverToBranch.id
  const owner = me.isSuperAdmin === true || hasPrivilegedRole(me)
  return {
    acknowledge: atReceiver || owner,
    // The backend only lets the receiving branch, or Head Office, reject.
    reject: atReceiver || !me.branchId,
    // The row's status already says it is awaiting acknowledgment.
    note: null,
  }
}

/** What the correction form needs of a turnover, from either kind of row:
 * one still pending, or one acknowledged whose receipt is not yet banked. */
export interface TurnoverToCorrect {
  /** The sender's deposit line. */
  lineId: string
  amount: number
  reference: string
  /** `YYYY-MM-DD`. */
  date: string
  receivedBy: string
  senderName: string
  toBranchName: string
  acknowledged: boolean
}

/** A pending turnover, as the correction form reads it. */
export function pendingToCorrect(t: PosTurnover): TurnoverToCorrect {
  return {
    lineId: t.id,
    amount: Number(t.amount),
    reference: t.reference ?? '',
    date: (t.depositDate ?? t.createdAt).slice(0, 10),
    receivedBy: t.turnoverReceivedBy ?? '',
    senderName: t.senderName,
    toBranchName: t.turnoverToBranch.name,
    acknowledged: false,
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

const FIELD = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'

/** The turnover's figures, as the form edits them. */
function correctionDraft(t: TurnoverToCorrect): {
  amount: string
  reference: string
  date: string
  receivedBy: string
  reason: string
} {
  return {
    amount: String(t.amount),
    reference: t.reference,
    date: t.date,
    receivedBy: t.receivedBy,
    reason: '',
  }
}

/** A Correct button for a turnover's row — accounting only. */
export function CorrectTurnoverButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      Correct
    </button>
  )
}

/**
 * Accounting corrects a turnover: what was handed over, the slip number, the
 * day and who took it. The sender's deposit is reposted with that line
 * changed; the branch it goes to stays — a turnover sent to the wrong branch
 * is rejected and sent again. One already acknowledged stays acknowledged,
 * and the receiving branch's New Receipt moves with it.
 */
export function CorrectTurnoverDialog({
  turnover,
  onClose,
  onDone,
}: {
  turnover: TurnoverToCorrect
  onClose: () => void
  onDone: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(() => correctionDraft(turnover))
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof draft>): void => setDraft((d) => ({ ...d, ...patch }))
  const amount = Number(draft.amount.replace(/,/g, '')) || 0
  const ready = amount > 0 && !!draft.reference.trim() && !!draft.reason.trim()
  const confirm = async (): Promise<void> => {
    if (!ready) return
    setSaving(true)
    const res = await correctPosTurnover(turnover.lineId, {
      amount,
      reference: draft.reference.trim(),
      depositDate: draft.date || undefined,
      receivedBy: draft.receivedBy.trim() || undefined,
      reason: draft.reason.trim(),
    })
    setSaving(false)
    if (!res.success) {
      const description = res.error || res.message || 'Try again.'
      showToast({ title: 'Could not correct the turnover', description, status: 'error' })
      return
    }
    showToast({ title: 'Turnover corrected', status: 'success' })
    onDone()
  }
  return (
    <ConfirmDialog
      open
      title="Correct turnover"
      message={
        <div className="space-y-3 text-left">
          <p className="text-sm text-ink-muted">
            From <strong>{turnover.senderName}</strong> to <strong>{turnover.toBranchName}</strong>.
            {turnover.acknowledged
              ? ' Already acknowledged: its New Receipt at the receiving branch is corrected with it, and an adjusting entry posts the difference.'
              : ' Sent to the wrong branch? Reject it instead and have it sent again.'}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-ink-muted">
              Amount *
              <input
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) => set({ amount: e.target.value })}
                className={`${FIELD} mt-1 text-right tabular-nums`}
              />
            </label>
            <label className="text-xs text-ink-muted">
              Turnover slip no. *
              <input
                value={draft.reference}
                onChange={(e) => set({ reference: e.target.value })}
                maxLength={100}
                className={`${FIELD} mt-1`}
              />
            </label>
            <label className="text-xs text-ink-muted">
              Date handed over
              <input
                type="date"
                value={draft.date}
                onChange={(e) => set({ date: e.target.value })}
                className={`${FIELD} mt-1`}
              />
            </label>
            <label className="text-xs text-ink-muted">
              Received by
              <input
                value={draft.receivedBy}
                onChange={(e) => set({ receivedBy: e.target.value })}
                maxLength={150}
                className={`${FIELD} mt-1`}
              />
            </label>
          </div>
          <textarea
            value={draft.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="Why is it being corrected? *"
            maxLength={500}
            rows={2}
            className={FIELD}
          />
        </div>
      }
      confirmLabel="Correct and repost"
      loading={saving}
      confirmDisabled={!ready}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  )
}
