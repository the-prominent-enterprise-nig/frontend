'use client'

import { manilaToday } from '@/src/libs/format/manila-date'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  type BankAccountOption,
  fmtDate,
  fmtMoney,
  UnidentifiedBankCredits,
} from '@/src/libs/data/AccountingV2Data'
import { getAccountOptions, type Account } from '@/src/libs/data/AccountingData'
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
  /** A processor's clearing account (1-01-041 to 1-01-048). Empty when the
   * slip names a 1-01-010 fund instead. */
  clearsAccountId: string
  /** A 1-01-010 sub-ledger fund the slip empties instead — Cash on Hand, a
   * petty cash or special fund, another bank. Empty when it empties an account. */
  clearsBankAccountId: string
  /** The provider a card / e-wallet / bank-transfer slip banks, as a tender key
   * ("card::BDO"); empty when it names none, ANY_PROVIDER when accounting chose
   * not to. Providers share one clearing account, so the account alone cannot
   * say whose money the slip is — without a name the deposit clears the oldest
   * session's money, whichever provider took it. */
  clearsTender: string
  note: string
  /** This bank's own deposit slip number — each bank issues its own, and a
   * deposit cannot be recorded without it. */
  reference: string
  /** The day this slip was banked, `YYYY-MM-DD`. Slips on different days post
   * separate journal entries. */
  depositDate: string
  /** The posted deposit this slip belongs to, when a correction spans a
   * session's several deposits. Absent on a slip added in the editor. */
  depositId?: string
  /** The Unidentified Bank Credit this slip matches, when Bank account is
   * 2-01-042 — see UNIDENTIFIED_BANK. Its amount and reference fill the
   * slip; the amount must stay the credit's full amount. */
  credit?: SlipCredit
}

/** An Unidentified Bank Credit as a slip shows it. */
export interface SlipCredit {
  id: string
  amount: number
  bankRef: string | null
  /** `YYYY-MM-DD` */
  creditDate: string
  bankName: string
}

/** Bank account's pick for "the money is already in the bank, recorded on Bank
 * Reconciliation as an Unidentified Bank Credit". Not a bank id: the slip then
 * names which credit, and takes that credit's bank. */
export const UNIDENTIFIED_BANK = 'unidentified-bank-credits'
const UNIDENTIFIED_LABEL = 'Unidentified Bank Credits — 2-01-042'

/** True when the slip matches an Unidentified Bank Credit. */
export const isCreditSlip = (slip: Slip): boolean => slip.bankAccountId === UNIDENTIFIED_BANK

/** A credit's dropdown label: where, how much, its reference and its date. */
function creditLabel(c: SlipCredit): string {
  return [c.bankName, fmtMoney(c.amount), c.bankRef || 'No reference', fmtDate(c.creditDate)].join(
    ' · '
  )
}

/** A Bank account pick, back in the slip's fields: picking 2-01-042 or
 * leaving it clears the credit and the figures it filled. */
function bankPatch(slip: Slip, value: string): Partial<Slip> {
  if (isCreditSlip(slip) === (value === UNIDENTIFIED_BANK)) return { bankAccountId: value }
  return slip.credit
    ? { bankAccountId: value, credit: undefined, amount: '', reference: '' }
    : { bankAccountId: value }
}

/** A credit pick: the slip takes its amount and reference. The date stays
 * the slip's own — the day the credit is identified, not the day it reached
 * the bank, which Bank Reconciliation already booked. */
function creditPatch(credit: SlipCredit | undefined): Partial<Slip> {
  if (!credit) return { credit: undefined, amount: '', reference: '' }
  return {
    credit,
    amount: String(credit.amount),
    reference: credit.bankRef ?? '',
  }
}

/** The slips' own numbers, joined — the deposit's reference, capped at the
 * 100 characters it is stored in. */
export function joinReferences(refs: (string | undefined)[]): string | undefined {
  const unique = [...new Set(refs.filter((r): r is string => !!r))]
  return unique.length ? unique.join(', ').slice(0, 100) : undefined
}

/** A card or e-wallet provider the sessions being deposited took money on, and
 * the clearing account it posts to. */
export interface SlipProvider {
  /** Tender key: "card::BDO", "qr::Soundpay". */
  key: string
  label: string
  /** The clearing account the provider posts to, or null where none is set. */
  accountId: string | null
  /** What is still to bank of it across the selected sessions. */
  amount: number
}

/** Accounting's explicit "not specified": the slip clears the oldest session's
 * card money, as every deposit did before a slip could name a provider. */
export const ANY_PROVIDER = '*'

/** The providers the selected sessions still have money on, one entry each. */
export function providersOf(
  rows: {
    clearingTenders?: { key: string; label: string; accountId: string | null; amount: number }[]
  }[]
): SlipProvider[] {
  const byKey = new Map<string, SlipProvider>()
  for (const row of rows) {
    for (const t of row.clearingTenders ?? []) {
      const held = byKey.get(t.key)
      byKey.set(t.key, {
        key: t.key,
        label: t.label,
        accountId: t.accountId,
        amount: round2((held?.amount ?? 0) + Number(t.amount)),
      })
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/** The providers that post to the account a slip empties. */
function providersFor(providers: SlipProvider[], clearsAccountId: string): SlipProvider[] {
  return clearsAccountId ? providers.filter((p) => p.accountId === clearsAccountId) : []
}

/** The one provider an account holds, when it holds exactly one — nothing to
 * ask then. Empty when several share it (accounting picks) or none do. */
function onlyProvider(providers: SlipProvider[], clearsAccountId: string): string {
  const held = providersFor(providers, clearsAccountId)
  return held.length === 1 ? held[0].key : ''
}

type Option = { value: string; label: string; group?: string; indent?: boolean }

/** One slip: the bank it went to, the amount on it, the account it empties,
 * that bank's own slip number and the day it was banked. A cheque from a New Receipt is entered the
 * same way, clearing 1-01-010. */
function SlipRow({
  slip,
  label,
  bankOptions,
  clearsOptions,
  providers,
  credits,
  onChange,
  onRemove,
  removeDisabled = false,
}: {
  slip: Slip
  /** Names the row for screen readers and the remove tooltip. */
  label: string
  bankOptions: Option[]
  /** Everything a slip can empty, grouped by its GL account. */
  clearsOptions: Option[]
  /** The providers the selected sessions took money on. */
  providers: SlipProvider[]
  /** The Unidentified Bank Credits this slip may match. */
  credits: SlipCredit[]
  onChange: (patch: Partial<Slip>) => void
  onRemove: () => void
  removeDisabled?: boolean
}): React.JSX.Element {
  // Filled from the credit, so not typed: the bank already has these figures.
  const auto = isCreditSlip(slip)
  return (
    <div className="space-y-2">
      <SlipFields
        slip={slip}
        label={label}
        bankOptions={bankOptions}
        clearsOptions={clearsOptions}
        providers={providers}
        auto={auto}
        onChange={onChange}
        onRemove={onRemove}
        removeDisabled={removeDisabled}
      />
      <ProviderPicker slip={slip} label={label} providers={providers} onChange={onChange} />
      {auto && <CreditPicker slip={slip} label={label} credits={credits} onChange={onChange} />}
    </div>
  )
}

/** Which provider's money a card / e-wallet slip banks. Asked only when several
 * providers share the account the slip empties — one provider is no choice, and
 * with none there is nothing to name. */
function ProviderPicker({
  slip,
  label,
  providers,
  onChange,
}: {
  slip: Slip
  label: string
  providers: SlipProvider[]
  onChange: (patch: Partial<Slip>) => void
}): React.JSX.Element | null {
  const held = providersFor(providers, slip.clearsAccountId)
  if (held.length === 0) return null
  if (held.length === 1) {
    return (
      <p className="text-xs text-ink-muted" data-testid="slip-provider-note">
        Banks {held[0].label} — {fmtMoney(held[0].amount)} to bank.
      </p>
    )
  }
  return (
    <div data-testid="slip-provider">
      <SearchableSelect
        value={slip.clearsTender}
        onChange={(value) => onChange({ clearsTender: value })}
        options={[
          ...held.map((p) => ({
            value: p.key,
            label: `${p.label} — ${fmtMoney(p.amount)} to bank`,
          })),
          { value: ANY_PROVIDER, label: 'Not specified — oldest session first' },
        ]}
        placeholder="Whose money is this slip banking?"
        ariaLabel={`${label} provider`}
        portal
      />
    </div>
  )
}

/** Which Unidentified Bank Credit a 2-01-042 slip matches. */
function CreditPicker({
  slip,
  label,
  credits,
  onChange,
}: {
  slip: Slip
  label: string
  credits: SlipCredit[]
  onChange: (patch: Partial<Slip>) => void
}): React.JSX.Element {
  return (
    <div className="sm:pl-0">
      <SearchableSelect
        value={slip.credit?.id ?? ''}
        onChange={(id) => onChange(creditPatch(credits.find((c) => c.id === id)))}
        options={credits.map((c) => ({ value: c.id, label: creditLabel(c) }))}
        placeholder={
          credits.length
            ? 'Which unidentified credit…'
            : 'No unmatched credits on Bank Reconciliation'
        }
        ariaLabel={`${label} unidentified credit`}
        clearable
        portal
      />
    </div>
  )
}

/** Classes for a field the credit fills. */
const AUTO_FIELD = 'bg-gray-50 text-ink-muted'

/** The slip's own row of fields. */
function SlipFields({
  slip,
  label,
  bankOptions,
  clearsOptions,
  providers,
  auto,
  onChange,
  onRemove,
  removeDisabled,
}: {
  slip: Slip
  label: string
  bankOptions: Option[]
  clearsOptions: Option[]
  providers: SlipProvider[]
  /** The reference comes from a credit. */
  auto: boolean
  onChange: (patch: Partial<Slip>) => void
  onRemove: () => void
  removeDisabled: boolean
}): React.JSX.Element {
  // A credit with no reference of its own leaves the field to be typed.
  const refAuto = auto && !!slip.credit?.bankRef
  return (
    <div className={`grid grid-cols-1 gap-2 ${SLIP_COLUMNS}`}>
      <SearchableSelect
        value={slip.bankAccountId}
        onChange={(value) => onChange(bankPatch(slip, value))}
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
        value={clearsValue(slip)}
        onChange={(value) => onChange(clearsPatch(value, providers))}
        options={clearsOptions}
        placeholder="Deposit from…"
        ariaLabel={`${label} deposit from`}
        portal
      />
      <input
        value={slip.reference}
        onChange={(e) => onChange({ reference: e.target.value })}
        placeholder={refAuto ? 'Reference (auto)' : 'Reference number *'}
        aria-label={`${label} reference`}
        required
        readOnly={refAuto}
        maxLength={100}
        className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm ${refAuto ? AUTO_FIELD : ''}`}
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

/** One grid for the column headers and every slip row, so they line up. */
const SLIP_COLUMNS = 'sm:grid-cols-[1fr_8rem_1fr_10rem_9.5rem_auto]'

/** Names each field once, above the rows: a pre-filled slip — on a
 * correction — shows values, not placeholders, so without these the
 * reference number reads as a stray figure. */
function SlipColumnHeaders(): React.JSX.Element {
  return (
    <div className={`hidden gap-2 px-0.5 text-xs text-gray-500 sm:grid ${SLIP_COLUMNS}`}>
      <span>Bank account</span>
      <span className="text-right">Amount</span>
      <span>Deposit from</span>
      <span>Reference no. *</span>
      <span>Date</span>
      <span className="w-8" />
    </div>
  )
}

/** The two headers a slip's Deposit from is picked under. Headers only —
 * a slip names one of their sub-ledger funds or accounts, never the header. */
const CASH_GROUP_LABEL = '1-01-010 Cash and Cash Equivalents'
const CLEARING_GROUP_LABEL = '1-01-040 Payment Gateway and Collection Clearing Funds'

/** A sub-ledger fund's dropdown value, kept apart from GL account ids. */
const FUND_PREFIX = 'fund:'

/** The slip's pick in the Deposit from dropdown. */
function clearsValue(slip: Slip): string {
  return slip.clearsBankAccountId ? FUND_PREFIX + slip.clearsBankAccountId : slip.clearsAccountId
}

/** A Deposit from pick, back in the slip's fields. Changing it drops any
 * provider named for the old account; an account that holds just one provider
 * names it at once. */
function clearsPatch(
  value: string,
  providers: SlipProvider[]
): Pick<Slip, 'clearsAccountId' | 'clearsBankAccountId' | 'clearsTender'> {
  return value.startsWith(FUND_PREFIX)
    ? {
        clearsAccountId: '',
        clearsBankAccountId: value.slice(FUND_PREFIX.length),
        clearsTender: '',
      }
    : {
        clearsAccountId: value,
        clearsBankAccountId: '',
        clearsTender: onlyProvider(providers, value),
      }
}

/** The funds kept in 1-01-010's sub-ledger — every bank and cash fund posts
 * to 1-01-010, told apart by a tag — under its header. */
function fundOptions(accounts: BankAccountOption[], excludeId: string): Option[] {
  return accounts
    .filter((a) => a.isActive && a.id !== excludeId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({
      value: FUND_PREFIX + a.id,
      label: a.name,
      group: CASH_GROUP_LABEL,
      indent: true,
    }))
}

/** The processor's clearing account a slip empties, if it names one. */
export function clearsAccountOf(slip: Slip): string | undefined {
  return slip.clearsAccountId || undefined
}

/** True when the slip banks the branch's own cash, from a 1-01-010 fund. */
export const isBranchCashSlip = (slip: Slip): boolean => !!slip.clearsBankAccountId

/** The client's chart groups every processor's holding account under one
 * header (prisma/data/chart-of-accounts.csv): GCash, Maya, Card/POS, ECPay,
 * Palawan, other gateways, transfers in transit, online bank transfers. */
const CLEARING_GROUP = '1-01-040'
/** Narrows the account search to the group's own number range. */
const CLEARING_GROUP_PREFIX = '1-01-04'

/** The accounts filed under CLEARING_GROUP (the client's chart, rows 6–13),
 * as dropdown options — nothing another chart left behind, and not the
 * non-postable header itself. */
function clearingAccountOptions(data: unknown): Option[] {
  // `/accounts/options` answers with a bare array and names each account's
  // parent by id only, so the header is found in the same search and its
  // children are matched against it.
  const accounts = (
    Array.isArray(data) ? data : ((data as { items?: unknown[] } | undefined)?.items ?? [])
  ) as (Account & { parentAccountId?: string | null })[]
  const header = accounts.find((a) => a.number === CLEARING_GROUP)
  if (!header) return []
  return accounts
    .filter((a) => a.parentAccountId === header.id)
    .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))
    .map((a) => ({
      value: a.id,
      label: a.number ? `${a.number} — ${a.name}` : a.name,
      group: CLEARING_GROUP_LABEL,
      indent: true,
    }))
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
    clearsAccountId: '',
    clearsBankAccountId: '',
    clearsTender: '',
    note: '',
    reference: '',
    depositDate: manilaToday(),
  }
}

/** The deposit's own date: its earliest slip's. */
export function earliestDate(slips: Slip[]): string {
  return slips.map((s) => s.depositDate).sort()[0]
}

/** The typed amount, read the way it is written on a slip: "17,425.00"
 * counts, where Number() alone would make it nothing. */
export const slipAmount = (slip: Slip): number => Number(slip.amount.replace(/,/g, '')) || 0

/** Why the slips cannot be saved yet, or null when they can. `providers` are
 * the card and e-wallet providers of the sessions being deposited: where
 * several share the account a slip empties, the slip has to say which. */
export function slipsProblem(slips: Slip[], providers: SlipProvider[] = []): string | null {
  const incomplete = slips.some(
    (s) =>
      !s.bankAccountId ||
      slipAmount(s) <= 0 ||
      !s.depositDate ||
      !s.reference.trim() ||
      (!s.clearsAccountId && !s.clearsBankAccountId)
  )
  if (slips.some((s) => isCreditSlip(s) && !s.credit)) {
    return 'Pick which Unidentified Bank Credit the 2-01-042 slip matches.'
  }
  const short = slips.find((s) => s.credit && round2(slipAmount(s)) !== round2(s.credit.amount))
  if (short?.credit) {
    return `The Unidentified Bank Credit slip must be ${fmtMoney(short.credit.amount)}, the credit's full amount — a credit is matched whole.`
  }
  if (incomplete) {
    return 'Every slip needs a bank account, an amount, a Deposit from account, a reference number and a date — remove any empty slip.'
  }
  const unnamed = slips.findIndex(
    (s) => !s.clearsTender && providersFor(providers, s.clearsAccountId).length > 1
  )
  if (unnamed >= 0) {
    return `Slip ${unnamed + 1}: say whose money it banks. Several providers share that clearing account, and without a name the deposit clears the oldest session's money.`
  }
  return slips.some((s) => s.clearsBankAccountId && s.clearsBankAccountId === s.bankAccountId)
    ? "A slip can't be deposited from the same account it is banked to."
    : null
}

/** 'slip 2' / 'slips 1 and 3' — the slips a warning is about, by position. */
function slipNumbers(slips: Slip[], picked: Slip[]): string {
  const numbers = picked.map((s) => slips.indexOf(s) + 1)
  if (numbers.length === 1) return `Slip ${numbers[0]}`
  return `Slips ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}

const total = (picked: Slip[]): number => round2(picked.reduce((t, s) => t + slipAmount(s), 0))

/** True when a card / e-wallet slip names the provider whose money it banks. */
const namesProvider = (s: Slip): boolean =>
  !!s.clearsAccountId && !!s.clearsTender && s.clearsTender !== ANY_PROVIDER

/** Slips naming a provider for more than it has left to bank — the extra
 * clears nothing (Pandan, Nov 14 2026: ₱6,000 named for BPI-Central's
 * ₱1,842.01). */
function providerOverWarnings(slips: Slip[], providers: SlipProvider[]): string[] {
  return providers.flatMap((p) => {
    const picked = slips.filter((s) => namesProvider(s) && s.clearsTender === p.key)
    const over = round2(total(picked) - p.amount)
    if (over < 0.005) return []
    return [
      `${slipNumbers(slips, picked)}: ${fmtMoney(total(picked))} for ${p.label}, which has only ${fmtMoney(p.amount)} left to bank. The extra ${fmtMoney(over)} won't clear anything — check the provider or the amount.`,
    ]
  })
}

/** Slips naming no provider, against what is left on the account they empty
 * once the named slips have taken theirs. */
function accountOverWarnings(slips: Slip[], providers: SlipProvider[]): string[] {
  // No providers at all is an older backend, not an empty account.
  if (!providers.length) return []
  const unnamed = slips.filter((s) => s.clearsAccountId && !namesProvider(s))
  const accounts = [...new Set(unnamed.map((s) => s.clearsAccountId))]
  return accounts.flatMap((account) => {
    const picked = unnamed.filter((s) => s.clearsAccountId === account)
    const held = providersFor(providers, account)
    if (!held.length) {
      return [
        `${slipNumbers(slips, picked)}: none of these sessions has money left on that Deposit from account, so it will clear the oldest session's card or e-wallet money instead. Check the Deposit from.`,
      ]
    }
    const named = total(slips.filter((s) => s.clearsAccountId === account && namesProvider(s)))
    const left = round2(Math.max(0, held.reduce((t, p) => t + p.amount, 0) - named))
    const over = round2(total(picked) - left)
    if (over < 0.005) return []
    return [
      `${slipNumbers(slips, picked)}: ${fmtMoney(total(picked))} from an account with only ${fmtMoney(left)} left to bank. The extra ${fmtMoney(over)} won't clear anything.`,
    ]
  })
}

/** Cash slips for more than the ticked sessions and New Receipts hold — the
 * extra clears nothing (San Sebastian, Nov 14 2026: a ₱21,065 cash slip with
 * only an ₱8,420 receipt ticked). */
function cashOverWarning(slips: Slip[], cashToBank: number, turnedOver: number): string[] {
  const entered = round2(total(slips.filter(isBranchCashSlip)) + turnedOver)
  const over = round2(entered - cashToBank)
  if (over < 0.005) return []
  return [
    `Cash comes to ${fmtMoney(entered)}, but what is ticked has only ${fmtMoney(cashToBank)} of cash to bank. Is a session missing from this deposit? The extra ${fmtMoney(over)} won't clear anything.`,
  ]
}

/**
 * What looks wrong with the slips without stopping them being recorded — an
 * amount larger than the money it is meant to bank. Accounting may know
 * better (a correction, money from elsewhere), so these warn, never block.
 */
export function slipsWarnings(
  slips: Slip[],
  providers: SlipProvider[],
  cashToBank: number,
  turnedOver = 0
): string[] {
  return [
    ...providerOverWarnings(slips, providers),
    ...accountOverWarnings(slips, providers),
    ...cashOverWarning(slips, cashToBank, turnedOver),
  ]
}

/** The warnings, under the slips. Nothing when there are none. */
export function SlipWarnings({ warnings }: { warnings: string[] }): React.JSX.Element | null {
  if (!warnings.length) return null
  return (
    <div
      role="status"
      data-testid="slip-warnings"
      className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      {warnings.map((w) => (
        <p key={w}>{w}</p>
      ))}
    </div>
  )
}

/** The slips as the API takes them. */
export function toLineInputs(slips: Slip[]): PosDepositLineInput[] {
  return slips.map((s) => ({
    // A credit slip takes the credit's own bank on the server.
    bankAccountId: isCreditSlip(s) ? undefined : s.bankAccountId,
    unidentifiedCreditId: isCreditSlip(s) ? s.credit?.id : undefined,
    amount: slipAmount(s),
    clearsAccountId: clearsAccountOf(s),
    clearsBankAccountId: s.clearsBankAccountId || undefined,
    clearsTender:
      s.clearsAccountId && s.clearsTender && s.clearsTender !== ANY_PROVIDER
        ? s.clearsTender
        : undefined,
    note: s.note || undefined,
    reference: s.reference.trim(),
    depositDate: s.depositDate,
  }))
}

/** A slip to a bank, not a cash turnover to a branch (Scenario 83). */
export const isBankLine = (l: PosDepositLine): boolean => !l.turnoverToBranch

/** The branch's Cash on Hand fund, if one is set up. A slip from it posts
 * exactly as a slip naming no fund did — it empties the branch's undeposited
 * POS cash — so it stands in for one recorded before funds could be picked. */
export function cashOnHandFundId(accounts: BankAccountOption[]): string {
  return accounts.find((a) => a.isActive && a.accountType === 'Cash')?.id ?? ''
}

/** A recorded deposit's slips, back in the editor's shape. A slip with no date
 * of its own takes the deposit's. */
export function slipsFromLines(
  lines: PosDepositLine[],
  depositDate: string,
  /** What a slip recorded against 1-01-010 itself — before only its funds
   * could be picked — opens with: Cash on Hand, the same posting. */
  cashFundId = ''
): Slip[] {
  // Scenario 83 — a cash turnover is not a bank slip; see turnoversFromLines.
  return lines.filter(isBankLine).map((l) => ({
    bankAccountId: l.unidentifiedCredit ? UNIDENTIFIED_BANK : (l.bankAccount?.id ?? ''),
    credit: l.unidentifiedCredit
      ? {
          id: l.unidentifiedCredit.id,
          amount: Number(l.unidentifiedCredit.amount),
          bankRef: l.unidentifiedCredit.bankRef,
          creditDate: l.unidentifiedCredit.creditDate.slice(0, 10),
          bankName: l.bankAccount?.name ?? 'Bank',
        }
      : undefined,
    amount: String(Number(l.amount)),
    clearsAccountId: l.clearsAccount?.id ?? '',
    clearsBankAccountId: l.clearsBankAccount?.id ?? (l.clearsAccount ? '' : cashFundId),
    clearsTender: l.clearsTender ?? '',
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
  providers = [],
}: {
  slips: Slip[]
  onChange: (slips: Slip[]) => void
  accounts: BankAccountOption[]
  /** The card and e-wallet providers of the sessions being deposited. Empty
   * when correcting a recorded deposit: its slips keep the provider they named. */
  providers?: SlipProvider[]
}): React.JSX.Element {
  // The chart, for the Deposit from column: a slip empties the branch's own
  // cash, a fund in 1-01-010's sub-ledger, or one of the accounts the client's
  // chart files under 1-01-040 Payment Gateway and Collection Clearing Funds.
  const chart = useQuery({
    queryKey: ['deposit-clearing-accounts'],
    queryFn: () => getAccountOptions({ search: CLEARING_GROUP_PREFIX }),
    staleTime: 5 * 60_000,
  })
  const clearingOptions = clearingAccountOptions(chart.data?.data)
  const unmatched = useUnmatchedCredits(accounts)
  const bankOptions: Option[] = [
    ...accounts.map((a) => ({
      value: a.id,
      label: a.accountNumber ? `${a.name} — ${a.accountNumber}` : a.name,
    })),
    { value: UNIDENTIFIED_BANK, label: UNIDENTIFIED_LABEL },
  ]
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
        {slips.length > 0 && <SlipColumnHeaders />}
        {slips.map((slip, i) => (
          <SlipRow
            key={i}
            slip={slip}
            label={`slip ${i + 1}`}
            bankOptions={bankOptions}
            clearsOptions={[...fundOptions(accounts, slip.bankAccountId), ...clearingOptions]}
            providers={providers}
            credits={creditsFor(slip, slips, unmatched)}
            onChange={(patch) => setSlip(i, patch)}
            onRemove={() => onChange(slips.filter((_, n) => n !== i))}
            removeDisabled={slips.length === 1}
          />
        ))}
      </div>
    </div>
  )
}

/** The Unidentified Bank Credits still waiting on Bank Reconciliation. */
function useUnmatchedCredits(accounts: BankAccountOption[]): SlipCredit[] {
  const query = useQuery({
    queryKey: ['deposit-unmatched-credits'],
    queryFn: () => UnidentifiedBankCredits.list('unmatched'),
    staleTime: 60_000,
  })
  const bankName = (id: string): string => accounts.find((a) => a.id === id)?.name ?? 'Bank'
  return (query.data?.data ?? []).map((c) => ({
    id: c.id,
    amount: Number(c.amount),
    bankRef: c.bankRef ?? null,
    creditDate: c.creditDate.slice(0, 10),
    bankName: c.bankAccount?.name ?? bankName(c.bankAccountId),
  }))
}

/** What one slip may match: the unmatched credits no other slip has taken,
 * and its own — already matched, when a posted deposit is corrected. */
function creditsFor(slip: Slip, slips: Slip[], unmatched: SlipCredit[]): SlipCredit[] {
  const taken = new Set(slips.filter((s) => s !== slip).map((s) => s.credit?.id))
  const free = unmatched.filter((c) => !taken.has(c.id))
  return slip.credit && !free.some((c) => c.id === slip.credit?.id) ? [slip.credit, ...free] : free
}
