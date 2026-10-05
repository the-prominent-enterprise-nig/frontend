'use client'

import { useState } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import AttachmentsPanel from '@/src/components/common/AttachmentsPanel'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { FileAttachments, fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import {
  cancelPosDeposit,
  clearPosDeposit,
  getPosDeposit,
  getPosDepositSummary,
  type PosDeposit,
  type PosDepositStatus,
} from '../_actions/pos-deposits'

/**
 * Scenario 61 Part 5 — a POS deposit opened from the Undeposited Funds table:
 * its sessions, its proof, and (while a draft) Clear for accounting or
 * Cancel. Clearing posts Dr Bank / Cr Undeposited Funds dated the deposit
 * date.
 */

/** FileAttachment entityType — the backend model name. */
export const POS_DEPOSIT_ENTITY = 'PosDeposit'

/** React Query key root for every deposit query, so one invalidation
 * refreshes all of them. */
export const POS_DEPOSITS_KEY = 'pos-deposits'

const STATUS_LABEL: Record<PosDepositStatus, string> = {
  draft: 'Awaiting clearing',
  cleared: 'Cleared',
  cancelled: 'Cancelled',
}

const STATUS_CHIP: Record<PosDepositStatus, string> = {
  draft: 'bg-amber-50 text-amber-800 border-amber-200',
  cleared: 'bg-green-50 text-green-800 border-green-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
}

/** Refreshes every deposit query (detail and summary) at once. */
export function refreshDeposits(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [POS_DEPOSITS_KEY] })
}

/** Totals for the summary cards, from the database. Refetched whenever
 * looked at: the app default keeps data a minute. */
export function useDepositSummary(branchId: string | null) {
  return useQuery({
    queryKey: [POS_DEPOSITS_KEY, 'summary', branchId],
    queryFn: () => getPosDepositSummary(branchId ?? undefined),
    staleTime: 0,
  })
}

/** Whole days since `iso`. */
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/** Opens a deposit by id — the table rows only know which deposit a session
 * is in. */
export function DepositDetailLoader({
  id,
  canManage,
  canVerify,
  onClose,
  onChanged,
}: {
  id: string
  canManage: boolean
  canVerify: boolean
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const query = useQuery({
    queryKey: [POS_DEPOSITS_KEY, 'detail', id],
    queryFn: () => getPosDeposit(id),
    staleTime: 0,
  })
  const deposit = query.data?.data
  if (!deposit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    )
  }
  return (
    <DepositDetail
      deposit={deposit}
      canManage={canManage}
      canVerify={canVerify}
      onClose={onClose}
      onChanged={onChanged}
    />
  )
}

function StatusChip({ status }: { status: PosDepositStatus }): React.JSX.Element {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function DepositDetail({
  deposit,
  canManage,
  canVerify,
  onClose,
  onChanged,
}: {
  deposit: PosDeposit
  canManage: boolean
  canVerify: boolean
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const isDraft = deposit.status === 'draft'
  // Same query key the attachments panel uses, so the two stay in step.
  const attachments = useQuery({
    queryKey: ['attachments', POS_DEPOSIT_ENTITY, deposit.id],
    queryFn: () => FileAttachments.listForEntity(POS_DEPOSIT_ENTITY, deposit.id),
  })
  const attachmentCount = attachments.data?.data?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            {/* The status lives with the title, not loose above the list. */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">
                Deposit to {deposit.bankAccount.name} · {fmtDate(deposit.depositDate)}
              </h3>
              <StatusChip status={deposit.status} />
            </div>
            <p className="text-xs text-gray-500">
              {fmtMoney(Number(deposit.amount))} · {deposit.sessions.length} session
              {deposit.sessions.length === 1 ? '' : 's'}
              {deposit.reference ? ` · Ref ${deposit.reference}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <SessionList deposit={deposit} />
          <AttachmentsPanel
            entityType={POS_DEPOSIT_ENTITY}
            entityId={deposit.id}
            title="Proof of deposit"
            description="Deposit slip, check images, transfer screenshots."
            readOnly={!isDraft || !canManage}
            onChanged={onChanged}
          />
          {isDraft && (
            <DraftActions
              deposit={deposit}
              canManage={canManage}
              canVerify={canVerify}
              hasAttachments={attachmentCount > 0}
              onDone={() => {
                onChanged()
                onClose()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SessionList({ deposit }: { deposit: PosDeposit }): React.JSX.Element {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
      {deposit.sessions.map((s) => (
        <li key={s.id} className="flex justify-between gap-4 px-3 py-2">
          <span>
            {s.terminal?.name ?? 'Terminal'} ·{' '}
            {[s.cashier?.firstName, s.cashier?.lastName].filter(Boolean).join(' ') ||
              s.cashier?.name ||
              'Cashier'}{' '}
            · closed {fmtDate(s.closedAt)}
          </span>
          <span className="font-medium">{fmtMoney(Number(s.undepositedAmount ?? 0))}</span>
        </li>
      ))}
    </ul>
  )
}

/** Clear (accounting) and Cancel (the branch), each behind a confirm. */
function DraftActions({
  deposit,
  canManage,
  canVerify,
  hasAttachments,
  onDone,
}: {
  deposit: PosDeposit
  canManage: boolean
  canVerify: boolean
  hasAttachments: boolean
  onDone: () => void
}): React.JSX.Element {
  const [confirm, setConfirm] = useState<'clear' | 'cancel' | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: 'clear' | 'cancel'): Promise<void> {
    setBusy(true)
    const res =
      action === 'clear' ? await clearPosDeposit(deposit.id) : await cancelPosDeposit(deposit.id)
    setBusy(false)
    setConfirm(null)
    if (!res.success) {
      showToast({
        title: 'Could not update the deposit',
        description: res.message || res.error,
        status: 'error',
      })
      return
    }
    showToast({
      title: action === 'clear' ? 'Deposit cleared and posted' : 'Draft cancelled',
      status: 'success',
    })
    onDone()
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
      {canVerify && !hasAttachments && (
        <p className="mr-auto text-xs text-amber-700">Attach the deposit slip before clearing.</p>
      )}
      {canManage && (
        <button onClick={() => setConfirm('cancel')} className="btn-secondary">
          Cancel draft
        </button>
      )}
      {canVerify && (
        <button
          onClick={() => setConfirm('clear')}
          disabled={!hasAttachments}
          className="btn-primary flex items-center gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" /> Clear &amp; post
        </button>
      )}
      {confirm && (
        <ConfirmDialog
          open
          title={confirm === 'clear' ? 'Clear and post this deposit?' : 'Cancel this draft?'}
          message={
            confirm === 'clear' ? (
              <p>
                Posts <strong>{fmtMoney(Number(deposit.amount))}</strong> Dr{' '}
                {deposit.bankAccount.name} / Cr Undeposited Funds, dated{' '}
                <strong>{fmtDate(deposit.depositDate)}</strong>. This cannot be undone here.
              </p>
            ) : (
              <p>Its sessions go back to Undeposited Funds and can be put in another deposit.</p>
            )
          }
          confirmLabel={confirm === 'clear' ? 'Clear & post' : 'Cancel draft'}
          destructive={confirm === 'cancel'}
          loading={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(confirm)}
        />
      )}
    </div>
  )
}
