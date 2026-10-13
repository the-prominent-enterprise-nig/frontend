'use server'

import { revalidateTag } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'

/**
 * Scenario 61 Part 5 — POS deposits: recorded as a draft with proof attached,
 * cleared (posted) by accounting. See backend PosDepositsService.
 */

export type PosDepositStatus = 'draft' | 'cleared' | 'cancelled'

export interface PosDepositSession {
  id: string
  openedAt: string
  closedAt: string | null
  undepositedAmount: string | number | null
  terminal: { name: string } | null
  cashier: { name: string | null; firstName: string | null; lastName: string | null } | null
}

export interface PosDeposit {
  id: string
  branchId: string
  branchName?: string | null
  bankAccountId: string
  bankAccount: { id: string; name: string }
  depositDate: string
  reference: string | null
  amount: string | number
  status: PosDepositStatus
  createdAt: string
  clearedAt: string | null
  journalEntryId: string | null
  sessions: PosDepositSession[]
  /** Scenario 70 G8 — the slips accounting itemised; empty on a deposit
   * recorded before slips existed. */
  lines?: PosDepositLine[]
  /** G11 — the New Receipts banked with the sessions. */
  newReceipts?: { id: string; number: string | null; payerName: string; amount: number }[]
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
  bankAccount: { id: string; name: string; accountNumber: string | null }
  /** Null for the branch's own cash (1-01-010). */
  clearsAccount: { id: string; number: string | null; name: string } | null
}

/** Scenario 70 G8 — one slip: a bank, an amount, and what it empties. */
export interface PosDepositLineInput {
  bankAccountId: string
  amount: number
  /** A processor's clearing account; omitted for the branch's own cash. */
  clearsAccountId?: string
  note?: string
  /** This bank's own deposit slip / reference number. */
  reference?: string
  /** The day this slip was banked — slips on different days post separate
   * journal entries. */
  depositDate?: string
}

export interface CreatePosDepositInput {
  /** The header's own bank. With slips it is the first slip's. */
  bankAccountId: string
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
