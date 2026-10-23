'use client'

import { useState } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Pencil, X } from 'lucide-react'
import AttachmentsPanel from '@/src/components/common/AttachmentsPanel'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import Tooltip from '@/src/components/ui/Tooltip'
import {
  FileAttachments,
  fmtDate,
  fmtMoney,
  type BankAccount,
} from '@/src/libs/data/AccountingV2Data'
import {
  cancelPosDeposit,
  clearPosDeposit,
  correctPosDeposit,
  updatePosDeposit,
  getPosDeposit,
  getPosDepositSummary,
  type PosDeposit,
  type PosDepositStatus,
} from '../_actions/pos-deposits'
import {
  SlipEditor,
  round2,
  slipAmount,
  slipsFromLines,
  slipsProblem,
  toLineInputs,
  type Slip,
} from './SlipEditor'

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

/** Opens a deposit by id — the table rows only know which deposit a session
 * is in. */
export function DepositDetailLoader({
  id,
  accounts,
  canManage,
  canVerify,
  canCorrect,
  onClose,
  onChanged,
}: {
  id: string
  /** The bank accounts a slip can be corrected to. */
  accounts: BankAccount[]
  canManage: boolean
  canVerify: boolean
  /** May correct a posted deposit — accounting. */
  canCorrect: boolean
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
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }
  return (
    <DepositDetail
      deposit={deposit}
      accounts={accounts}
      canManage={canManage}
      canVerify={canVerify}
      canCorrect={canCorrect}
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
  accounts,
  canManage,
  canVerify,
  canCorrect,
  onClose,
  onChanged,
}: {
  deposit: PosDeposit
  accounts: BankAccount[]
  canManage: boolean
  canVerify: boolean
  canCorrect: boolean
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
  // A draft's slips are edited by whoever can record or clear one. A posted
  // deposit is corrected by accounting, against the bank's slip, until it is
  // reconciled: its entries are reversed and the corrected slips posted.
  const correcting = deposit.status === 'cleared'
  const canEditSlips =
    !!deposit.lines?.length &&
    (isDraft ? canManage || canVerify : correcting && canCorrect && !deposit.reconciledAt)
  const [editing, setEditing] = useState(false)

  return (
    // Fills the content area like Record deposit, leaving the navigation in
    // view; the header stays put and the body scrolls.
    <div className="absolute inset-0 z-40 flex bg-white">
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            {/* The status lives with the title, not loose above the list. */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">
                {/* With slips the money went to several banks; the header's own
                    bank is only the first slip's. */}
                {deposit.lines?.length
                  ? `Deposit · ${fmtDate(deposit.depositDate)}`
                  : `Deposit to ${deposit.bankAccount.name} · ${fmtDate(deposit.depositDate)}`}
              </h3>
              <StatusChip status={deposit.status} />
            </div>
            <p className="text-xs text-gray-500">
              {fmtMoney(Number(deposit.amount))} · {deposit.sessions.length} session
              {deposit.sessions.length === 1 ? '' : 's'}
              {deposit.lines?.length
                ? ` · ${deposit.lines.length} slip${deposit.lines.length === 1 ? '' : 's'}`
                : ''}
              {deposit.reference ? ` · Ref ${deposit.reference}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <SessionList deposit={deposit} />
          {editing ? (
            <SlipEdit
              deposit={deposit}
              accounts={accounts}
              correcting={correcting}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                onChanged()
              }}
            />
          ) : (
            <SlipList
              deposit={deposit}
              onEdit={canEditSlips ? () => setEditing(true) : undefined}
              editLabel={correcting ? 'Correct deposit' : 'Edit slips'}
            />
          )}
          <AttachmentsPanel
            entityType={POS_DEPOSIT_ENTITY}
            entityId={deposit.id}
            title="Proof of deposit"
            description="Deposit slip, check images, transfer screenshots."
            // The cashier attaches the slip whenever they have it — before or
            // after the deposit posts — but files on a posted one stay put.
            readOnly={!canManage || deposit.status === 'cancelled'}
            canRemove={isDraft}
            onChanged={onChanged}
          />
        </div>
        {/* Pinned below the scrolling body, so attaching files never moves
            Cancel draft or Clear & post. */}
        {isDraft && !editing && (
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
  )
}

function SessionList({ deposit }: { deposit: PosDeposit }): React.JSX.Element {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
      {deposit.sessions.map((s) => (
        // Named, not priced: the slips below are the figures accounting checks.
        <li key={s.id} className="px-3 py-2">
          {s.terminal?.name ?? 'Terminal'} ·{' '}
          {[s.cashier?.firstName, s.cashier?.lastName].filter(Boolean).join(' ') ||
            s.cashier?.name ||
            'Cashier'}{' '}
          · closed {fmtDate(s.closedAt)}
        </li>
      ))}
    </ul>
  )
}

/** The slips as recorded — each bank, its amount, the account it empties,
 * its slip number and the day it was banked. */
function SlipList({
  deposit,
  onEdit,
  editLabel = 'Edit slips',
}: {
  deposit: PosDeposit
  /** Present while the slips can still be corrected. */
  onEdit?: () => void
  editLabel?: string
}): React.JSX.Element | null {
  const lines = deposit.lines ?? []
  if (lines.length === 0) return null
  return (
    <div className="space-y-2">
      {onEdit && (
        <div className="flex justify-end">
          <Tooltip label="Correct the slips before clearing">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editLabel}
            </button>
          </Tooltip>
        </div>
      )}
      {lines.length > 0 && (
        <table className="w-full overflow-hidden rounded-lg border border-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Bank</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Clears</th>
              <th className="px-3 py-2 text-left">Reference no.</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">{l.bankAccount.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(l.amount))}</td>
                <td className="px-3 py-2">
                  {l.clearsBankAccount
                    ? `1-01-010 · ${l.clearsBankAccount.name}`
                    : l.clearsAccount
                      ? `${l.clearsAccount.number ?? ''} ${l.clearsAccount.name}`.trim()
                      : '1-01-010 Cash and Cash Equivalents'}
                </td>
                <td className="px-3 py-2 text-gray-600">{l.reference ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {fmtDate(l.depositDate ?? deposit.depositDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** The deposit's slips, editable — saved as a whole, replacing the old ones.
 * The new total is shown beside the old one so a corrected amount is seen
 * before it is saved. A posted deposit's correction also asks why, and
 * reposts it. */
function SlipEdit({
  deposit,
  accounts,
  correcting,
  onCancel,
  onSaved,
}: {
  deposit: PosDeposit
  accounts: BankAccount[]
  correcting: boolean
  onCancel: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [slips, setSlips] = useState<Slip[]>(() =>
    slipsFromLines(deposit.lines ?? [], deposit.depositDate)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = round2(slips.reduce((sum, s) => sum + slipAmount(s), 0))
  const problem =
    slipsProblem(slips) ??
    (correcting && !reason.trim() ? 'Say why the deposit is being corrected.' : null)

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const lines = toLineInputs(slips)
    const res = correcting
      ? await correctPosDeposit(deposit.id, lines, reason.trim())
      : await updatePosDeposit(deposit.id, lines)
    setSaving(false)
    if (!res.success) {
      setError(res.error || res.message || 'Failed to save the slips')
      return
    }
    showToast(
      correcting
        ? {
            title: 'Deposit corrected',
            description: 'The old entries were reversed and the corrected slips posted.',
            status: 'success',
          }
        : { title: 'Slips updated', status: 'success' }
    )
    onSaved()
  }

  return (
    <div className="space-y-3">
      <SlipEditor slips={slips} onChange={setSlips} accounts={accounts} />
      <p className="text-sm text-gray-600">
        Total <strong className="tabular-nums">{fmtMoney(total)}</strong>
        {Math.abs(total - Number(deposit.amount)) >= 0.005 && (
          <span className="text-gray-500"> · was {fmtMoney(Number(deposit.amount))}</span>
        )}
      </p>
      {correcting && (
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Reason for correction *</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. Slip shows ₱12,500, not ₱15,200"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
      )}
      {(error || problem) && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error || problem}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !!problem}
          className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {correcting ? 'Correct and repost' : 'Save slips'}
        </button>
      </div>
    </div>
  )
}

/** What Clear & post will do, in one line: the amount, how many banks the
 * slips went to (one for a deposit recorded before slips existed), and the
 * date — or how many entries, when the slips were banked on different days. */
function ClearSummary({ deposit }: { deposit: PosDeposit }): React.JSX.Element {
  const lines = deposit.lines ?? []
  const banks = new Set(lines.map((l) => l.bankAccount.id)).size || 1
  const days = new Set(lines.map((l) => (l.depositDate ?? deposit.depositDate).slice(0, 10)))
  return (
    <p>
      Posts <strong>{fmtMoney(Number(deposit.amount))}</strong> to {banks} bank
      {banks === 1 ? '' : 's'},{' '}
      {days.size > 1 ? (
        <>
          as <strong>{days.size} entries</strong>, one per slip date
        </>
      ) : (
        <>
          dated <strong>{fmtDate(deposit.depositDate)}</strong>
        </>
      )}
      . This can&apos;t be undone.
    </p>
  )
}

/** For now (client, 2026-10-14) a deposit clears without its slip attached.
 * Mirrors REQUIRE_SLIP_ATTACHMENT in the backend's pos-deposits.service. */
const REQUIRE_SLIP_ATTACHMENT = false

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
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
      {canVerify && !hasAttachments && (
        <p className="mr-auto text-xs text-amber-700">
          {REQUIRE_SLIP_ATTACHMENT
            ? 'Attach the deposit slip before clearing.'
            : 'No deposit slip attached yet.'}
        </p>
      )}
      {canManage && (
        <button onClick={() => setConfirm('cancel')} className="btn-secondary">
          Cancel draft
        </button>
      )}
      {canVerify && (
        <button
          onClick={() => setConfirm('clear')}
          disabled={REQUIRE_SLIP_ATTACHMENT && !hasAttachments}
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
              <ClearSummary deposit={deposit} />
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
