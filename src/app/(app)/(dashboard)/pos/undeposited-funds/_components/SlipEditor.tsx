'use client'

import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { type BankAccount } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import type { PosDepositLine, PosDepositLineInput } from '../_actions/pos-deposits'

/**
 * Scenario 70 G12 — a deposit's slips, one row per bank, each saying what it
 * empties. Shared by Record deposit and the draft's own edit, so a slip is
 * entered and corrected with the same fields.
 */

export interface Slip {
  bankAccountId: string
  /** A string, and empty on open — the client asked for the amount field to
   * start blank so accounting itemises the banks rather than accepting a
   * figure the system worked out (Scenario 70 G12). */
  amount: string
  /** A processor's clearing account; empty means the branch's own cash. */
  clearsAccountId: string
  note: string
  /** This bank's own deposit slip number — each bank issues its own, and a
   * deposit cannot be recorded without it. */
  reference: string
  /** The day this slip was banked, `YYYY-MM-DD`. Slips on different days post
   * separate journal entries. */
  depositDate: string
}

/** The slips' own numbers, joined — the deposit's reference, capped at the
 * 100 characters it is stored in. */
export function joinReferences(refs: (string | undefined)[]): string | undefined {
  const unique = [...new Set(refs.filter((r): r is string => !!r))]
  return unique.length ? unique.join(', ').slice(0, 100) : undefined
}

type Option = { value: string; label: string }

/** One slip: the bank it went to, the amount on it, the account it empties,
 * that bank's own slip number and the day it was banked. A cheque from a New Receipt is entered the
 * same way, clearing 1-01-010. */
function SlipRow({
  slip,
  label,
  bankOptions,
  clearingOptions,
  onChange,
  onRemove,
  removeDisabled = false,
}: {
  slip: Slip
  /** Names the row for screen readers and the remove tooltip. */
  label: string
  bankOptions: Option[]
  clearingOptions: Option[]
  onChange: (patch: Partial<Slip>) => void
  onRemove: () => void
  removeDisabled?: boolean
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_1fr_10rem_9.5rem_auto]">
      <SearchableSelect
        value={slip.bankAccountId}
        onChange={(value) => onChange({ bankAccountId: value })}
        options={bankOptions}
        placeholder="Bank account…"
        clearable
        portal
      />
      <input
        inputMode="decimal"
        value={slip.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        placeholder="Amount"
        aria-label={`${label} amount`}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right font-mono text-sm tabular-nums"
      />
      <SearchableSelect
        value={slip.clearsAccountId}
        // Cleared back to the branch's cash rather than to nothing.
        onChange={(value) => onChange({ clearsAccountId: value || BRANCH_CASH })}
        options={[{ value: BRANCH_CASH, label: BRANCH_CASH_LABEL }, ...clearingOptions]}
        placeholder={BRANCH_CASH_LABEL}
        portal
      />
      <input
        value={slip.reference}
        onChange={(e) => onChange({ reference: e.target.value })}
        placeholder="Reference number"
        aria-label={`${label} reference`}
        required
        maxLength={100}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <input
        type="date"
        required
        value={slip.depositDate}
        onChange={(e) => onChange({ depositDate: e.target.value })}
        aria-label={`${label} deposit date`}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <Tooltip label={`Remove ${label}`}>
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={`Remove ${label}`}
          className="px-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}

/** The branch's own cash — 1-01-010, what POS_CASH maps to. A value of its
 * own so the dropdown shows it as chosen (an empty value reads as nothing
 * picked); sent as no clearsAccountId, which is what the deposit's cash
 * figure counts. */
const BRANCH_CASH = 'branch-cash'
const BRANCH_CASH_LABEL = '1-01-010 — Cash and Cash Equivalents'

/** The processor's clearing account a slip empties, or undefined for the
 * branch's own cash. */
export function clearsAccountOf(slip: Slip): string | undefined {
  return slip.clearsAccountId && slip.clearsAccountId !== BRANCH_CASH
    ? slip.clearsAccountId
    : undefined
}

/** The client's chart groups every processor's holding account under one
 * header (prisma/data/chart-of-accounts.csv): GCash, Maya, Card/POS, ECPay,
 * Palawan, other gateways, transfers in transit, online bank transfers. */
const CLEARING_GROUP = '1-01-040'
/** Narrows the account search to the group's own number range. */
const CLEARING_GROUP_PREFIX = '1-01-04'

/** CLEARING_GROUP and the accounts filed under it (the client's chart, rows
 * 5–13), as dropdown options — nothing another chart left behind. */
function clearingAccountOptions(data: unknown): Option[] {
  // `/accounts` answers with a bare array, not the paginated shape its type
  // claims, and includes each account's parent.
  const accounts = (
    Array.isArray(data) ? data : ((data as { items?: unknown[] } | undefined)?.items ?? [])
  ) as (Account & { parentAccount?: { number?: string } | null })[]
  return accounts
    .filter((a) => a.number === CLEARING_GROUP || a.parentAccount?.number === CLEARING_GROUP)
    .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))
    .map((a) => ({ value: a.id, label: a.number ? `${a.number} — ${a.name}` : a.name }))
}

/** Centavos, so a tally of typed amounts cannot drift into 0.004 differences. */
export const round2 = (n: number): number => Math.round(n * 100) / 100

/** A blank slip, dated today. Local date, not UTC: toISOString() is a day
 * behind for the first eight hours of every Manila morning, so the slip would
 * open with yesterday's date on it and post there unless somebody noticed. */
export function emptySlip(): Slip {
  return {
    bankAccountId: '',
    amount: '',
    clearsAccountId: BRANCH_CASH,
    note: '',
    reference: '',
    depositDate: new Date().toLocaleDateString('en-CA'),
  }
}

/** The deposit's own date: its earliest slip's. */
export function earliestDate(slips: Slip[]): string {
  return slips.map((s) => s.depositDate).sort()[0]
}

export const slipAmount = (slip: Slip): number => Number(slip.amount) || 0

/** Why the slips cannot be saved yet, or null when they can. */
export function slipsProblem(slips: Slip[]): string | null {
  const incomplete = slips.some(
    (s) => !s.bankAccountId || slipAmount(s) <= 0 || !s.depositDate || !s.reference.trim()
  )
  return incomplete
    ? 'Every slip needs a bank account, an amount, a reference number and a date — remove any empty slip.'
    : null
}

/** The slips as the API takes them. */
export function toLineInputs(slips: Slip[]): PosDepositLineInput[] {
  return slips.map((s) => ({
    bankAccountId: s.bankAccountId,
    amount: slipAmount(s),
    clearsAccountId: clearsAccountOf(s),
    note: s.note || undefined,
    reference: s.reference.trim(),
    depositDate: s.depositDate,
  }))
}

/** A recorded deposit's slips, back in the editor's shape. A slip with no date
 * of its own takes the deposit's. */
export function slipsFromLines(lines: PosDepositLine[], depositDate: string): Slip[] {
  return lines.map((l) => ({
    bankAccountId: l.bankAccount.id,
    amount: String(Number(l.amount)),
    clearsAccountId: l.clearsAccount?.id ?? BRANCH_CASH,
    note: l.note ?? '',
    reference: l.reference ?? '',
    depositDate: (l.depositDate ?? depositDate).slice(0, 10),
  }))
}

/**
 * The Slips box: a row per bank and Add slip. The amount starts blank so
 * accounting itemises it rather than accepting a figure worked out for them;
 * the client's own closing goes to five banks at once and clears the branch's
 * cash and every processor's account in one record.
 */
export function SlipEditor({
  slips,
  onChange,
  accounts,
}: {
  slips: Slip[]
  onChange: (slips: Slip[]) => void
  accounts: BankAccount[]
}): React.JSX.Element {
  // The chart, for the "clears" column: a slip either empties the branch's
  // own cash or one of the accounts the client's chart files under 1-01-040
  // Payment Gateway and Collection Clearing Funds.
  const chart = useQuery({
    queryKey: ['deposit-clearing-accounts'],
    queryFn: () => getAccounts({ search: CLEARING_GROUP_PREFIX }),
    staleTime: 5 * 60_000,
  })
  const clearingOptions = clearingAccountOptions(chart.data?.data)
  const bankOptions = accounts.map((a) => ({
    value: a.id,
    label: a.accountNumber ? `${a.name} — ${a.accountNumber}` : a.name,
  }))
  const setSlip = (i: number, patch: Partial<Slip>): void =>
    onChange(slips.map((s, n) => (n === i ? { ...s, ...patch } : s)))

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Slips</p>
        <button
          type="button"
          onClick={() => onChange([...slips, emptySlip()])}
          className="text-xs font-medium text-prominent-purple-700 hover:underline"
        >
          Add slip
        </button>
      </div>
      <div className="space-y-3 p-3">
        {slips.map((slip, i) => (
          <SlipRow
            key={i}
            slip={slip}
            label={`slip ${i + 1}`}
            bankOptions={bankOptions}
            clearingOptions={clearingOptions}
            onChange={(patch) => setSlip(i, patch)}
            onRemove={() => onChange(slips.filter((_, n) => n !== i))}
            removeDisabled={slips.length === 1}
          />
        ))}
      </div>
    </div>
  )
}
