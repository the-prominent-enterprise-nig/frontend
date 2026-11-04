'use client'

import { useQuery } from '@tanstack/react-query'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import {
  listTurnoverBranches,
  type PosDepositLine,
  type PosDepositLineInput,
  type PosTurnoverStatus,
  type TurnoverBranchOption,
} from '../_actions/pos-deposits'
import { round2 } from './SlipEditor'

/**
 * Scenario 83 — a branch (or caravan) that cannot reach a bank hands its cash
 * to another branch instead. Recorded in Record deposit beside, or instead
 * of, the bank slips; the receiving branch acknowledges it on its own
 * Undeposited Funds page and banks it with its day.
 */

export type SettleMode = 'bank' | 'turnover'

export interface Turnover {
  toBranchId: string
  /** A string, like a slip's amount, so it can be typed freely. */
  amount: string
  receivedBy: string
  /** The turnover slip number. */
  reference: string
  /** `YYYY-MM-DD`, local. */
  date: string
}

/** A blank turnover, dated today (local date). The amount starts empty, as a
 * bank slip's does, so the cashier types what was actually handed over. */
export function emptyTurnover(): Turnover {
  return {
    toBranchId: '',
    amount: '',
    receivedBy: '',
    reference: '',
    date: new Date().toLocaleDateString('en-CA'),
  }
}

/** The typed amount, commas allowed. */
export const turnoverAmount = (t: Turnover): number =>
  round2(Number(t.amount.replace(/,/g, '')) || 0)

/** Why the turnover cannot be saved yet, or null when it can. */
export function turnoverProblem(t: Turnover): string | null {
  if (!t.toBranchId) return 'Pick the branch receiving the cash.'
  if (turnoverAmount(t) <= 0) return 'Enter the amount turned over.'
  if (!t.reference.trim()) return 'Enter the turnover slip number.'
  if (!t.date) return 'Enter the turnover date.'
  return null
}

/** A recorded deposit's cash turnovers, back in the form's shape — for a
 * correction while the receiving branch has yet to acknowledge them. */
export function turnoversFromLines(lines: PosDepositLine[], depositDate: string): Turnover[] {
  return lines
    .filter((l) => l.turnoverToBranch)
    .map((l) => ({
      toBranchId: l.turnoverToBranch!.id,
      amount: String(Number(l.amount)),
      receivedBy: l.turnoverReceivedBy ?? '',
      reference: l.reference ?? '',
      date: (l.depositDate ?? depositDate).slice(0, 10),
    }))
}

/** The turnover as the API takes it: a line with a branch instead of a bank. */
export function toTurnoverLine(t: Turnover): PosDepositLineInput {
  return {
    turnoverToBranchId: t.toBranchId,
    turnoverReceivedBy: t.receivedBy.trim() || undefined,
    amount: turnoverAmount(t),
    reference: t.reference.trim(),
    depositDate: t.date,
  }
}

/** Branches that can receive cash: active trading branches, not caravans or
 * warehouses, and not the sender itself. */
function receivingOptions(
  branches: TurnoverBranchOption[],
  senderId: string
): { value: string; label: string }[] {
  return branches
    .filter(
      (b) =>
        b.id !== senderId &&
        b.isActive !== false &&
        (b.status ?? 'active') === 'active' &&
        b.type !== 'caravan' &&
        b.type !== 'warehouse'
    )
    .map((b) => ({ value: b.id, label: b.name }))
}

/** Deposit to bank, or Turn over to branch. */
export function SettleAsToggle({
  mode,
  onChange,
}: {
  mode: SettleMode
  onChange: (mode: SettleMode) => void
}): React.JSX.Element {
  const choices: [SettleMode, string, string][] = [
    ['bank', 'Deposit to bank', 'Company bank account'],
    ['turnover', 'Turn over to branch', 'Hand cash to another branch'],
  ]
  return (
    <fieldset className="rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        Settle as
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {choices.map(([value, title, hint]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onChange(value)}
            className={`rounded-lg border px-3 py-2 text-left ${
              mode === value
                ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span
              className={`block text-sm font-medium ${mode === value ? 'text-purple-800' : 'text-gray-900'}`}
            >
              {title}
            </span>
            <span className="block text-xs text-gray-500">{hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'

/** The turnover's own fields: who gets the cash, how much, and the slip. */
export function TurnoverBlock({
  turnover,
  senderId,
  onChange,
}: {
  turnover: Turnover
  /** The branch (or caravan) handing the cash over — not offered. */
  senderId: string
  onChange: (patch: Partial<Turnover>) => void
}): React.JSX.Element {
  const branches = useQuery({
    queryKey: ['turnover-branches'],
    queryFn: () => listTurnoverBranches(),
    staleTime: 5 * 60 * 1000,
  })
  const options = receivingOptions(branches.data?.data?.data ?? [], senderId)
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        Turnover to branch
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
        <Field label="Receiving branch">
          <SearchableSelect
            value={turnover.toBranchId}
            onChange={(value) => onChange({ toBranchId: value })}
            options={options}
            placeholder="Select branch…"
            ariaLabel="Receiving branch"
            loading={branches.isLoading}
            portal
          />
        </Field>
        <Field label="Amount">
          <input
            inputMode="decimal"
            value={turnover.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            aria-label="Turnover amount"
            className={`${inputClass} text-right font-mono tabular-nums`}
          />
        </Field>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_10rem]">
        <Field label="Received by">
          <input
            value={turnover.receivedBy}
            onChange={(e) => onChange({ receivedBy: e.target.value })}
            placeholder="Receiving cashier's name"
            maxLength={150}
            className={inputClass}
          />
        </Field>
        <Field label="Turnover slip no. *">
          <input
            value={turnover.reference}
            onChange={(e) => onChange({ reference: e.target.value })}
            placeholder="TO-0001"
            maxLength={100}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            required
            value={turnover.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-600">{label}</span>
      {children}
    </label>
  )
}

/** Awaiting the receiving branch, or taken in by it. */
export function TurnoverStatusChip({
  status,
}: {
  status: PosTurnoverStatus | null | undefined
}): React.JSX.Element {
  const acknowledged = status === 'acknowledged'
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
        acknowledged
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      {acknowledged ? 'Turned over' : 'Turned over · awaiting acknowledgment'}
    </span>
  )
}

/** A deposit line that went to a branch instead of a bank. */
export function TurnoverLineLabel({ line }: { line: PosDepositLine }): React.JSX.Element {
  return (
    <span className="flex flex-col gap-0.5">
      <span>Turnover → {line.turnoverToBranch?.name ?? 'branch'}</span>
      {line.turnoverReceivedBy && (
        <span className="text-xs text-gray-500">Received by {line.turnoverReceivedBy}</span>
      )}
      <span>
        <TurnoverStatusChip status={line.turnoverStatus} />
      </span>
    </span>
  )
}
