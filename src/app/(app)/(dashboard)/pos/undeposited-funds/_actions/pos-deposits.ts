'use server'

import { revalidateTag } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'

/**
 * Scenario 61 Part 5 — POS deposits: recorded as a draft with proof attached,
 * cleared (posted) by accounting. See backend PosDepositsService.
 */

export type PosDepositStatus = 'draft' | 'cleared' | 'cancelled'

/** Scenario 83 — a cash turnover: awaiting the receiving branch, or taken in. */
export type PosTurnoverStatus = 'pending' | 'acknowledged'

export interface PosDepositSession {
  id: string
  openedAt: string
  closedAt: string | null
  undepositedAmount: string | number | null
  terminal: { name: string } | null
  cashier: { name: string | null; firstName: string | null; lastName: string | null } | null
  /** What this deposit banked of it once cleared — less than the session
   * held when the deposit came up short. Null on a draft. */
  bankedAmount?: number | null
}

export interface PosDeposit {
  id: string
  branchId: string
  branchName?: string | null
  /** Null for a settlement of cash turnovers alone (Scenario 83). */
  bankAccountId: string | null
  bankAccount: { id: string; name: string } | null
  depositDate: string
  reference: string | null
  amount: string | number
  status: PosDepositStatus
  createdAt: string
  clearedAt: string | null
  journalEntryId: string | null
  /** Set once matched to a bank statement; a reconciled deposit can't be
   * corrected until that is undone. */
  reconciledAt?: string | null
  sessions: PosDepositSession[]
  /** Scenario 70 G8 — the slips accounting itemised; empty on a deposit
   * recorded before slips existed. */
  lines?: PosDepositLine[]
  /** G11 — the New Receipts banked with the sessions. */
  newReceipts?: {
    id: string
    number: string | null
    payerName: string
    amount: number
    bankedAmount?: number | null
  }[]
  attachmentCount?: number
}

/** One recorded slip, as the deposit detail shows it. */
export interface PosDepositLine {
  id: string
  amount: string | number
  reference: string | null
  note: string | null
  /** The day this slip was banked; null on a slip recorded before slips had
   * dates, which reads as the deposit's own date. */
  depositDate: string | null
  /** Null on a cash turnover. */
  bankAccount: { id: string; name: string; accountNumber: string | null } | null
  /** Scenario 83 — the branch this cash was handed to instead of a bank. */
  turnoverToBranch?: { id: string; name: string } | null
  turnoverReceivedBy?: string | null
  turnoverStatus?: PosTurnoverStatus | null
  turnoverAcknowledgedAt?: string | null
  /** Null for the branch's own cash (1-01-010). */
  clearsAccount: { id: string; number: string | null; name: string } | null
  /** A 1-01-010 sub-ledger fund the slip emptied instead of an account. */
  clearsBankAccount: { id: string; name: string } | null
}

/** Scenario 70 G8 — one slip: a bank, an amount, and what it empties. */
export interface PosDepositLineInput {
  /** Omitted on a cash turnover (turnoverToBranchId). */
  bankAccountId?: string
  /** Scenario 83 — hand this cash to another branch instead of a bank. */
  turnoverToBranchId?: string
  /** Who at the receiving branch took the cash. */
  turnoverReceivedBy?: string
  amount: number
  /** A processor's clearing account; omitted for the branch's own cash. */
  clearsAccountId?: string
  /** A 1-01-010 sub-ledger fund — Cash on Hand, a petty cash fund, a bank. */
  clearsBankAccountId?: string
  note?: string
  /** This bank's own deposit slip / reference number. Required. */
  reference: string
  /** The day this slip was banked — slips on different days post separate
   * journal entries. */
  depositDate?: string
}

export interface CreatePosDepositInput {
  /** The header's own bank. With slips it is the first bank slip's; omitted
   * for a settlement of cash turnovers alone. */
  bankAccountId?: string
  sessionIds: string[]
  /** Scenario 70 G11 — New Receipts banked with the sessions. */
  newReceiptIds?: string[]
  /** Scenario 70 G8 — one per bank the money actually went to. Without them
   * the deposit is the old single-bank shape, amount worked out server-side. */
  lines?: PosDepositLineInput[]
  /** With slips, the earliest slip's date. */
  depositDate: string
  reference?: string
}

/** Same cache tag the undeposited-funds list reads, so it refreshes too. */
const CASH_IN_TRANSIT_TAG = 'pos-cash-in-transit'

function revalidate(): void {
  revalidateTag(CASH_IN_TRANSIT_TAG, 'max')
}

export async function createPosDeposit(
  input: CreatePosDepositInput
): Promise<ApiResponse<PosDeposit>> {
  const result = await api.post<PosDeposit>('/pos-deposits', input)
  if (result.success) revalidate()
  return result
}

export interface PosDepositListParams {
  branchId?: string
  status?: PosDepositStatus
  /** 'settled' = cleared + cancelled, for the recent-deposits list. */
  group?: 'settled'
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface PosDepositPage {
  items: PosDeposit[]
  total: number
  page: number
  pageSize: number
}

export interface PosDepositSummary {
  awaitingClearing: { count: number; amount: number }
  clearedRecent: { count: number; amount: number; days: number }
}

/** Drops empty filters so they are not sent as `?search=`. */
function compact(params: PosDepositListParams): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ) as Record<string, string | number>
}

export async function listPosDeposits(
  params: PosDepositListParams = {}
): Promise<ApiResponse<PosDepositPage>> {
  return api.get<PosDepositPage>('/pos-deposits', compact(params))
}

export async function getPosDeposit(id: string): Promise<ApiResponse<PosDeposit>> {
  return api.get<PosDeposit>(`/pos-deposits/${id}`)
}

export async function getPosDepositSummary(
  branchId?: string
): Promise<ApiResponse<PosDepositSummary>> {
  return api.get<PosDepositSummary>('/pos-deposits/summary', branchId ? { branchId } : undefined)
}

/** Replaces a draft's slips before it is cleared — a mistyped amount, the
 * wrong bank. */
export async function updatePosDeposit(
  id: string,
  lines: PosDepositLineInput[]
): Promise<ApiResponse<PosDeposit>> {
  const result = await api.patch<PosDeposit>(`/pos-deposits/${id}`, { lines })
  if (result.success) revalidate()
  return result
}

/** Corrects a posted deposit against the bank's slip: its entries are
 * reversed and the corrected slips posted, with the reason kept in the audit
 * log. */
export async function correctPosDeposit(
  id: string,
  lines: PosDepositLineInput[],
  reason: string
): Promise<ApiResponse<PosDeposit>> {
  const result = await api.post<PosDeposit>(`/pos-deposits/${id}/correct`, { lines, reason })
  if (result.success) revalidate()
  return result
}

export async function clearPosDeposit(id: string): Promise<ApiResponse<PosDeposit>> {
  const result = await api.post<PosDeposit>(`/pos-deposits/${id}/clear`, {})
  if (result.success) revalidate()
  return result
}

export async function cancelPosDeposit(id: string): Promise<ApiResponse<PosDeposit>> {
  const result = await api.post<PosDeposit>(`/pos-deposits/${id}/cancel`, {})
  if (result.success) revalidate()
  return result
}

/** Scenario 83 — a cash turnover, as either branch reads it. */
export interface PosTurnover {
  id: string
  amount: string | number
  /** The turnover slip number. */
  reference: string | null
  depositDate: string | null
  createdAt: string
  turnoverReceivedBy: string | null
  turnoverStatus: PosTurnoverStatus
  turnoverAcknowledgedAt: string | null
  acknowledgedByName: string | null
  turnoverToBranch: { id: string; name: string }
  /** The receiving branch's New Receipt, once acknowledged. */
  turnoverReceipt: { id: string; number: string | null } | null
  /** createdById: who recorded it — they may not acknowledge or reject it. */
  posDeposit: {
    id: string
    branchId: string
    createdById: string
    /** The first session it settled, for the sender's own list. */
    allocations?: {
      posSession: {
        terminal: { terminalCode: string | null; caravanBranch: { name: string } | null }
        cashier: { name: string | null; email: string | null } | null
      } | null
    }[]
  }
  /** The caravan or branch that handed the cash over. */
  senderName: string
}

export interface PosTurnoverListParams {
  direction?: 'incoming' | 'outgoing'
  status?: PosTurnoverStatus
  branchId?: string
}

export async function listPosTurnovers(
  params: PosTurnoverListParams = {}
): Promise<ApiResponse<PosTurnover[]>> {
  return api.get<PosTurnover[]>('/pos-deposits/turnovers', compact(params as PosDepositListParams))
}

/** The receiving branch has the cash: it becomes a New Receipt there, banked
 * with the branch's next deposit. */
export async function acknowledgePosTurnover(lineId: string): Promise<ApiResponse<PosTurnover>> {
  const result = await api.post<PosTurnover>(`/pos-deposits/turnovers/${lineId}/acknowledge`, {})
  if (result.success) revalidate()
  return result
}

/** The receiving branch never got the cash: it goes back to the sender's
 * undeposited funds. */
export async function rejectPosTurnover(
  lineId: string,
  reason: string
): Promise<ApiResponse<{ rejected: boolean }>> {
  const result = await api.post<{ rejected: boolean }>(`/pos-deposits/turnovers/${lineId}/reject`, {
    reason,
  })
  if (result.success) revalidate()
  return result
}

/** What accounting can correct on a turnover still awaiting acknowledgment. */
export interface CorrectPosTurnoverInput {
  amount: number
  reference: string
  /** `YYYY-MM-DD`. */
  depositDate?: string
  receivedBy?: string
  reason: string
}

/** Accounting fixes a pending turnover's amount, slip number, date or who
 * took it; the sender's deposit is reposted with that line changed. */
export async function correctPosTurnover(
  lineId: string,
  input: CorrectPosTurnoverInput
): Promise<ApiResponse<PosDeposit>> {
  const result = await api.post<PosDeposit>(`/pos-deposits/turnovers/${lineId}/correct`, input)
  if (result.success) revalidate()
  return result
}

/** One change made to a posted deposit, from the accounting audit log. */
export interface PosDepositHistoryEntry {
  id: string
  action: 'CORRECT' | 'CORRECT_TURNOVER' | 'REJECT_TURNOVER' | 'ACKNOWLEDGE_TURNOVER'
  at: string
  by: string
  reason: string | null
  amountBefore: number | null
  amountAfter: number | null
}

/** A deposit's corrections, rejections and acknowledgments, newest first. */
export async function getPosDepositHistory(
  id: string
): Promise<ApiResponse<PosDepositHistoryEntry[]>> {
  return api.get<PosDepositHistoryEntry[]>(`/pos-deposits/${id}/history`)
}

/** A branch cash can be turned over to. */
export interface TurnoverBranchOption {
  id: string
  name: string
  type?: string
  status?: string
  isActive?: boolean
}

/** Every branch, for the Receiving branch pick — a branch-assigned cashier
 * still turns cash over to branches other than their own. */
export async function listTurnoverBranches(): Promise<
  ApiResponse<{ data: TurnoverBranchOption[] }>
> {
  return api.get<{ data: TurnoverBranchOption[] }>('/branches')
}
