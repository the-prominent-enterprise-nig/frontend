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
  attachmentCount?: number
}

export interface CreatePosDepositInput {
  bankAccountId: string
  sessionIds: string[]
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
