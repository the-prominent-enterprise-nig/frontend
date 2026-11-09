'use client'

import { useState } from 'react'
import { useQueries, useQuery, type QueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Pencil, X } from 'lucide-react'
import AttachmentsPanel from '@/src/components/common/AttachmentsPanel'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import Tooltip from '@/src/components/ui/Tooltip'
import {
  FileAttachments,
  fmtDate,
  fmtMoney,
  type BankAccountOption,
} from '@/src/libs/data/AccountingV2Data'
import {
  cancelPosDeposit,
  clearPosDeposit,
  correctPosDeposit,
  updatePosDeposit,
  getPosDeposit,
  getPosDepositHistory,
  getPosDepositSummary,
  type PosDeposit,
  type PosDepositLine,
  type PosDepositLineInput,
  type PosDepositStatus,
  type PosDepositHistoryEntry,
} from '../_actions/pos-deposits'
import {
  SlipEditor,
  cashOnHandFundId,
  round2,
  slipAmount,
  slipsFromLines,
  slipsProblem,
  toLineInputs,
  type Slip,
} from './SlipEditor'
import {
  TurnoverBlock,
  TurnoverLineLabel,
  toTurnoverLine,
  turnoverAmount,
  turnoverProblem,
  turnoversFromLines,
  type Turnover,
} from './TurnoverFields'

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

/** One of the deposits behind a session row — a session banked over several
 * trips to the bank has one per trip, each with its own slips and entries. */
export interface DepositChoice {
  id: string
  label: string
}

/** Opens a deposit by id — the table rows only know which deposit a session
 * is in. A session banked by several deposits passes them all as `choices`,
 * so each can be checked and corrected from the one panel. */
export function DepositDetailLoader({
  id,
  choices = [],
  accounts,
  canManage,
  canVerify,
  canCorrect,
  onClose,
  onChanged,
}: {
  id: string
  choices?: DepositChoice[]
  /** The bank accounts a slip can be corrected to. */
  accounts: BankAccountOption[]
  canManage: boolean
  canVerify: boolean
  /** May correct a posted deposit — accounting. */
  canCorrect: boolean
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const ids = choices.length > 1 ? choices.map((c) => c.id) : [id]
  const queries = useQueries({
    queries: ids.map((depositId) => ({
      queryKey: [POS_DEPOSITS_KEY, 'detail', depositId],
      queryFn: () => getPosDeposit(depositId),
      staleTime: 0,
    })),
  })
  const deposits = queries.map((q) => q.data?.data)
  if (deposits.some((d) => !d)) return <PanelSpinner />
  const loaded = deposits as PosDeposit[]
  if (loaded.length > 1) {
    return (
      <CombinedDepositDetail
        deposits={loaded}
        choices={choices}
        accounts={accounts}
        canManage={canManage}
        canCorrect={canCorrect}
        onClose={onClose}
        onChanged={onChanged}
      />
    )
  }
  return (
    <DepositDetail
      deposit={loaded[0]}
      accounts={accounts}
      canManage={canManage}
      canVerify={canVerify}
      canCorrect={canCorrect}
      onClose={onClose}
      onChanged={onChanged}
    />
  )
}

function PanelSpinner(): React.JSX.Element {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}

/** Each slip with its own date, or its deposit's when it has none. */
function datedLines(deposit: PosDeposit): PosDepositLine[] {
  return (deposit.lines ?? []).map((l) => ({
    ...l,
    depositDate: l.depositDate ?? deposit.depositDate,
  }))
}

/** A posted deposit accounting may still correct. */
function correctable(deposit: PosDeposit): boolean {
  return deposit.status === 'cleared' && !deposit.reconciledAt && correctableSlips(deposit)
}

/**
 * A session banked over several trips to the bank, read as one: every slip of
 * every deposit in one table, oldest first, and one correction across them
 * all. Each deposit keeps its own entries — a correction reposts only the
 * deposits whose slips changed — and its own proof.
 */
function CombinedDepositDetail({
  deposits,
  choices,
  accounts,
  canManage,
  canCorrect,
  onClose,
  onChanged,
}: {
  deposits: PosDeposit[]
  choices: DepositChoice[]
  accounts: BankAccountOption[]
  canManage: boolean
  canCorrect: boolean
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const lines = deposits
    .flatMap(datedLines)
    .sort((a, b) => (a.depositDate ?? '').localeCompare(b.depositDate ?? ''))
  const sessions = [...new Map(deposits.flatMap((d) => d.sessions).map((x) => [x.id, x])).values()]
  const canEdit = canCorrect && deposits.every(correctable)
  return (
    <div className="absolute inset-0 z-40 flex bg-white">
      <div className="flex h-full w-full flex-col bg-white">
        <CombinedHeader
          deposits={deposits}
          slipCount={lines.length}
          sessionCount={sessions.length}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <SessionList sessions={sessions} />
          {editing ? (
            <SlipEdit
              deposits={deposits}
              accounts={accounts}
              correcting
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                onChanged()
              }}
            />
          ) : (
            <SlipList
              lines={lines}
              fallbackDate={deposits[0].depositDate}
              onEdit={canEdit ? () => setEditing(true) : undefined}
              editLabel="Edit deposit"
            />
          )}
          <DepositHistory ids={deposits.map((d) => d.id)} />
          {deposits.map((d) => (
            <AttachmentsPanel
              key={d.id}
              entityType={POS_DEPOSIT_ENTITY}
              entityId={d.id}
              title={`Proof of deposit · ${choices.find((c) => c.id === d.id)?.label ?? d.reference ?? fmtDate(d.depositDate)}`}
              description="Deposit slip, check images, transfer screenshots."
              readOnly={!canManage}
              canRemove={false}
              onChanged={onChanged}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CombinedHeader({
  deposits,
  slipCount,
  sessionCount,
  onClose,
}: {
  deposits: PosDeposit[]
  slipCount: number
  sessionCount: number
  onClose: () => void
}): React.JSX.Element {
  const first = [...deposits].sort((a, b) => a.depositDate.localeCompare(b.depositDate))[0]
  const total = round2(deposits.reduce((sum, d) => sum + Number(d.amount), 0))
  const status = deposits.find((d) => d.status !== 'cleared')?.status ?? 'cleared'
  return (
    <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">Deposits · {fmtDate(first.depositDate)}</h3>
          <StatusChip status={status} />
        </div>
        <p className="text-xs text-gray-500">
          {fmtMoney(total)} · {sessionCount} session{sessionCount === 1 ? '' : 's'} ·{' '}
          {deposits.length} deposits · {slipCount} slip{slipCount === 1 ? '' : 's'}
        </p>
      </div>
      <button onClick={onClose} aria-label="Close">
        <X className="h-5 w-5 text-gray-500" />
      </button>
    </div>
  )
}

const HISTORY_LABEL: Record<PosDepositHistoryEntry['action'], string> = {
  CORRECT: 'Deposit corrected',
  CORRECT_TURNOVER: 'Turnover corrected',
  REJECT_TURNOVER: 'Turnover rejected',
  ACKNOWLEDGE_TURNOVER: 'Turnover acknowledged',
}

/** `Nov 9, 2026, 3:42 PM` in Manila time. */
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** What a change did to the deposit's total, when it changed it. */
function amountChange(e: PosDepositHistoryEntry): string | null {
  if (e.amountBefore === null || e.amountAfter === null) return null
  if (Math.abs(e.amountBefore - e.amountAfter) < 0.005) return null
  return `${fmtMoney(e.amountBefore)} → ${fmtMoney(e.amountAfter)}`
}

/**
 * Every change made to the deposits after they posted — corrections,
 * turnover corrections, rejections, acknowledgments — newest first, with
 * when, who, the reason they gave and what it did to the total. Nothing
 * shows until something was changed.
 */
function DepositHistory({ ids }: { ids: string[] }): React.JSX.Element | null {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [POS_DEPOSITS_KEY, 'history', id],
      queryFn: () => getPosDepositHistory(id),
      staleTime: 0,
    })),
  })
  const entries = queries
    .flatMap((q) => q.data?.data ?? [])
    .sort((a, b) => b.at.localeCompare(a.at))
  if (!entries.length) return null
  return (
    <section className="rounded-lg border border-gray-200">
      <h4 className="border-b border-gray-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        Correction history
      </h4>
      <ol className="divide-y divide-gray-100 text-sm">
        {entries.map((e) => (
          <HistoryRow key={e.id} entry={e} />
        ))}
      </ol>
    </section>
  )
}

function HistoryRow({ entry }: { entry: PosDepositHistoryEntry }): React.JSX.Element {
  const change = amountChange(entry)
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium text-gray-900">{HISTORY_LABEL[entry.action]}</span>
        <span className="text-xs text-ink-muted">
          {fmtWhen(entry.at)} · {entry.by}
        </span>
      </div>
      {entry.reason && <p className="mt-0.5 text-gray-700">{entry.reason}</p>}
      {change && <p className="mt-0.5 text-xs text-ink-muted tabular-nums">{change}</p>}
    </li>
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
  accounts: BankAccountOption[]
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
    correctableSlips(deposit) &&
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
                  : `Deposit to ${deposit.bankAccount?.name ?? 'bank'} · ${fmtDate(deposit.depositDate)}`}
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
          <SessionList sessions={deposit.sessions} />
          {editing ? (
            <SlipEdit
              deposits={[deposit]}
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
              lines={deposit.lines ?? []}
              fallbackDate={deposit.depositDate}
              onEdit={canEditSlips ? () => setEditing(true) : undefined}
              editLabel={correcting ? 'Edit deposit' : 'Edit slips'}
            />
          )}
          {deposit.status !== 'draft' && <DepositHistory ids={[deposit.id]} />}
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

function SessionList({ sessions }: { sessions: PosDeposit['sessions'] }): React.JSX.Element {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
      {sessions.map((s) => (
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
  lines,
  fallbackDate,
  onEdit,
  editLabel = 'Edit slips',
}: {
  lines: PosDepositLine[]
  /** The date a slip with none of its own shows: its deposit's. */
  fallbackDate: string
  /** Present while the slips can still be corrected. */
  onEdit?: () => void
  editLabel?: string
}): React.JSX.Element | null {
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
                <td className="px-3 py-2">
                  {l.turnoverToBranch ? (
                    <TurnoverLineLabel line={l} />
                  ) : (
                    (l.bankAccount?.name ?? '—')
                  )}
                </td>
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
                  {fmtDate(l.depositDate ?? fallbackDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Each deposit's slips, tagged with it, oldest deposit first. */
function initialSlips(deposits: PosDeposit[], accounts: BankAccountOption[]): Slip[] {
  const cashFund = cashOnHandFundId(accounts)
  return deposits.flatMap((d) =>
    slipsFromLines(d.lines ?? [], d.depositDate, cashFund).map((slip) => ({
      ...slip,
      depositId: d.id,
    }))
  )
}

/** Each deposit's cash turnovers, tagged with it. */
function initialTurnovers(deposits: PosDeposit[]): Turnover[] {
  return deposits.flatMap((d) =>
    turnoversFromLines(d.lines ?? [], d.depositDate).map((t) => ({ ...t, depositId: d.id }))
  )
}

/** What each deposit is saved with: its turnovers, then its slips. A slip
 * added in the editor goes on the latest deposit. */
function linesByDeposit(
  deposits: PosDeposit[],
  slips: Slip[],
  turnovers: Turnover[]
): Map<string, PosDepositLineInput[]> {
  const latest = [...deposits].sort((a, b) => a.depositDate.localeCompare(b.depositDate)).at(-1)
  const owner = (depositId?: string): string | undefined => depositId ?? latest?.id
  return new Map(
    deposits.map((d) => {
      const own = slips.filter((s) => owner(s.depositId) === d.id)
      const handed = turnovers.filter((t) => owner(t.depositId) === d.id)
      return [d.id, [...handed.map(toTurnoverLine), ...toLineInputs(own)]]
    })
  )
}

interface SaveResult {
  error: string | null
  /** Deposits already reposted before a refusal — the panel must refresh. */
  corrected: number
}

/** Reposts, one after another, only the deposits whose slips changed. Stops
 * at the first refusal and says which deposits were already corrected. */
async function correctEach(
  changed: [string, PosDepositLineInput[]][],
  reason: string,
  nameOf: (id: string) => string
): Promise<SaveResult> {
  const done: string[] = []
  for (const [id, lines] of changed) {
    const res = await correctPosDeposit(id, lines, reason)
    if (!res.success) {
      const msg = res.error || res.message || 'Failed to correct the deposit'
      const prior = done.length ? ` ${done.join(', ')} already corrected.` : ''
      return { error: `${nameOf(id)}: ${msg}.${prior}`, corrected: done.length }
    }
    done.push(nameOf(id))
  }
  return { error: null, corrected: done.length }
}

/** The slips, editable — saved as a whole, replacing the old ones. The new
 * total is shown beside the old one so a corrected amount is seen before it
 * is saved. A posted deposit's correction also asks why, and reposts it.
 *
 * Given a session's several deposits, it edits all their slips and turnovers
 * as one list; each goes back to its own deposit, and only the deposits that
 * changed are reversed and reposted. */
function SlipEdit({
  deposits,
  accounts,
  correcting,
  onCancel,
  onSaved,
}: {
  deposits: PosDeposit[]
  accounts: BankAccountOption[]
  correcting: boolean
  onCancel: () => void
  onSaved: () => void
}): React.JSX.Element {
  const single = deposits.length === 1 ? deposits[0] : null
  const [reason, setReason] = useState('')
  const [original] = useState(() => initialSlips(deposits, accounts))
  const [slips, setSlips] = useState<Slip[]>(original)
  // Scenario 83 — its cash turnovers, editable while the receiving branch
  // has yet to acknowledge them (an acknowledged one locks the deposit).
  const [originalTurnovers] = useState(() => initialTurnovers(deposits))
  const [turnovers, setTurnovers] = useState<Turnover[]>(originalTurnovers)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wasTotal = round2(deposits.reduce((sum, d) => sum + Number(d.amount), 0))
  const total = round2(
    slips.reduce((sum, s) => sum + slipAmount(s), 0) +
      turnovers.reduce((sum, t) => sum + turnoverAmount(t), 0)
  )
  const nameOf = (id: string): string => deposits.find((d) => d.id === id)?.reference || 'A deposit'
  const emptied = single
    ? undefined
    : [...linesByDeposit(deposits, slips, turnovers)].find(([, lines]) => lines.length === 0)
  const problem =
    turnovers.map(turnoverProblem).find(Boolean) ??
    slipsProblem(slips) ??
    (emptied
      ? `${nameOf(emptied[0])} would have nothing left — every deposit keeps at least one slip or turnover.`
      : null) ??
    (correcting && !reason.trim() ? 'Say why the deposit is being corrected.' : null)
  const patchTurnover = (i: number, patch: Partial<Turnover>): void =>
    setTurnovers((all) => all.map((t, n) => (n === i ? { ...t, ...patch } : t)))

  const saveSingle = async (deposit: PosDeposit): Promise<SaveResult> => {
    const lines = [...turnovers.map(toTurnoverLine), ...toLineInputs(slips)]
    const res = correcting
      ? await correctPosDeposit(deposit.id, lines, reason.trim())
      : await updatePosDeposit(deposit.id, lines)
    const error = res.success ? null : res.error || res.message || 'Failed to save the slips'
    return { error, corrected: 0 }
  }

  const saveAll = async (): Promise<SaveResult> => {
    const before = linesByDeposit(deposits, original, originalTurnovers)
    const changed = [...linesByDeposit(deposits, slips, turnovers)].filter(
      ([id, lines]) => JSON.stringify(lines) !== JSON.stringify(before.get(id))
    )
    if (!changed.length) return { error: 'Nothing was changed.', corrected: 0 }
    return correctEach(changed, reason.trim(), nameOf)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const { error: failed, corrected } = single ? await saveSingle(single) : await saveAll()
    setSaving(false)
    if (failed && corrected > 0) {
      // Part of it posted: the form no longer matches the deposits, so close
      // it onto their fresh state and say what is left to do.
      showToast({ title: 'Deposit only partly corrected', description: failed, status: 'error' })
      onSaved()
      return
    }
    if (failed) {
      setError(failed)
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
      {turnovers.map((t, i) => (
        <TurnoverBlock
          key={i}
          turnover={t}
          senderId={deposits[0].branchId}
          onChange={(patch) => patchTurnover(i, patch)}
        />
      ))}
      {(slips.length > 0 || turnovers.length === 0) && (
        <SlipEditor slips={slips} onChange={setSlips} accounts={accounts} />
      )}
      <p className="text-sm text-gray-600">
        Total <strong className="tabular-nums">{fmtMoney(total)}</strong>
        {Math.abs(total - wasTotal) >= 0.005 && (
          <span className="text-gray-500"> · was {fmtMoney(wasTotal)}</span>
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

/**
 * Scenario 83 — whether a deposit can still be corrected: its bank slips and
 * any cash turnover the receiving branch has yet to acknowledge. Once a
 * turnover is acknowledged its cash is the receiving branch's, so the deposit
 * is final — as reconciliation makes a bank deposit final.
 */
function correctableSlips(deposit: PosDeposit): boolean {
  const lines = deposit.lines ?? []
  return lines.length > 0 && !lines.some((l) => l.turnoverStatus === 'acknowledged')
}

/** What Clear & post will do, in one line: the amount, how many banks the
 * slips went to (one for a deposit recorded before slips existed), and the
 * date — or how many entries, when the slips were banked on different days. */
function ClearSummary({ deposit }: { deposit: PosDeposit }): React.JSX.Element {
  const lines = deposit.lines ?? []
  const banks = new Set(lines.flatMap((l) => (l.bankAccount ? [l.bankAccount.id] : []))).size || 1
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
              <p>Its sessions go back to Undeposited and can be put in another deposit.</p>
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
