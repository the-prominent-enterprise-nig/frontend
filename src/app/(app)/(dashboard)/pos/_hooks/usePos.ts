'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTerminals,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  getSessions,
  openSession,
  closeSession,
  handoverSession,
  getTransactions,
  createTransaction,
  voidTransaction,
  sendReceipt,
  getReceipt,
  getCrossBranchStock,
  getCustomerTransactions,
  syncTransactions,
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getGiftCards,
  issueGiftCard,
  voidGiftCard,
  getGiftCardHistory,
  getSessionDisplay,
  getCashDrawerEvents,
  createCashDrawerEvent,
  getBranchPricing,
  createBranchPricing,
  updateBranchPricing,
  deleteBranchPricing,
  getBranchPricingByItem,
  getSalesSummary,
  getBranches,
  createLoyaltyAccount,
  getLoyaltyProgram,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  getPosConfig,
  createPosConfig,
  updatePosConfig,
  getParkedSales,
  resumeParkedSale,
  cancelParkedSale,
} from '../_actions/pos-actions'
import type {
  CreateTerminalInput,
  UpdateTerminalInput,
  OpenSessionInput,
  CloseSessionInput,
  HandoverSessionInput,
  CreateTransactionInput,
  SendReceiptInput,
  SyncTransactionsInput,
  CreateLoyaltyAccountInput,
  CreateLoyaltyProgramInput,
  UpdateLoyaltyProgramInput,
  CreatePosConfigInput,
  UpdatePosConfigInput,
  CreatePromoCodeInput,
  UpdatePromoCodeInput,
  IssueGiftCardInput,
  CreateCashDrawerEventInput,
  CreateBranchPricingInput,
  UpdateBranchPricingInput,
} from '@/src/schema/pos'

// ─── Terminals ────────────────────────────────────────────────────────────────

export function useTerminals(options?: {
  refetchInterval?: number
  refetchOnWindowFocus?: boolean
}) {
  return useQuery({
    queryKey: ['pos-terminals'],
    queryFn: getTerminals,
    staleTime: 2 * 60 * 1000,
    ...options,
  })
}

export function useCreateTerminal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTerminalInput) => createTerminal(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-terminals'] }),
  })
}

export function useUpdateTerminal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTerminalInput }) =>
      updateTerminal(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-terminals'] }),
  })
}

export function useDeleteTerminal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTerminal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-terminals'] }),
  })
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useSessions(
  filters?: Parameters<typeof getSessions>[0],
  options?: { refetchInterval?: number; refetchOnWindowFocus?: boolean }
) {
  return useQuery({
    queryKey: ['pos-sessions', filters],
    queryFn: () => getSessions(filters),
    staleTime: 60 * 1000,
    ...options,
  })
}

export function useSalesSummary(filters?: Parameters<typeof getSalesSummary>[0]) {
  return useQuery({
    queryKey: ['pos-sales-summary', filters],
    queryFn: () => getSalesSummary(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useOpenSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OpenSessionInput) => openSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-sessions'] }),
  })
}

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CloseSessionInput }) =>
      closeSession(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-sessions'] }),
  })
}

export function useHandoverSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HandoverSessionInput }) =>
      handoverSession(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-sessions'] }),
  })
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions(
  filters?: Parameters<typeof getTransactions>[0],
  options?: { refetchInterval?: number; refetchOnWindowFocus?: boolean }
) {
  return useQuery({
    queryKey: ['pos-transactions', filters],
    queryFn: () => getTransactions(filters),
    staleTime: 60 * 1000,
    ...options,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-transactions'] }),
  })
}

export function useVoidTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => voidTransaction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-transactions'] }),
  })
}

export function useSendReceipt() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SendReceiptInput }) => sendReceipt(id, input),
  })
}

export function useGetReceipt(transactionId: string) {
  return useQuery({
    queryKey: ['pos-receipt', transactionId],
    queryFn: () => getReceipt(transactionId),
    enabled: false,
  })
}

export function useCrossBranchStock(itemId: string) {
  return useQuery({
    queryKey: ['pos-cross-branch-stock', itemId],
    queryFn: () => getCrossBranchStock(itemId),
    enabled: !!itemId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCustomerTransactions(customerId: string) {
  return useQuery({
    queryKey: ['pos-customer-transactions', customerId],
    queryFn: () => getCustomerTransactions(customerId),
    enabled: !!customerId,
    staleTime: 60 * 1000,
  })
}

export function useSyncTransactions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SyncTransactionsInput) => syncTransactions(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-transactions'] }),
  })
}

export function useCreateLoyaltyAccount() {
  return useMutation({
    mutationFn: (input: CreateLoyaltyAccountInput) => createLoyaltyAccount(input),
  })
}

export function useBranchPricingByItem(itemId: string, branchId?: string) {
  return useQuery({
    queryKey: ['pos-branch-pricing-item', itemId, branchId],
    queryFn: () => getBranchPricingByItem(itemId, branchId),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export function usePromoCodes() {
  return useQuery({
    queryKey: ['pos-promo-codes'],
    queryFn: getPromoCodes,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreatePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePromoCodeInput) => createPromoCode(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-promo-codes'] }),
  })
}

export function useUpdatePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePromoCodeInput }) =>
      updatePromoCode(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-promo-codes'] }),
  })
}

export function useDeletePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePromoCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-promo-codes'] }),
  })
}

// ─── Gift Cards ───────────────────────────────────────────────────────────────

export function useGiftCards() {
  return useQuery({
    queryKey: ['pos-gift-cards'],
    queryFn: getGiftCards,
    staleTime: 2 * 60 * 1000,
  })
}

export function useIssueGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: IssueGiftCardInput) => issueGiftCard(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-gift-cards'] }),
  })
}

export function useVoidGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => voidGiftCard(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-gift-cards'] }),
  })
}

export function useGiftCardHistory(id: string) {
  return useQuery({
    queryKey: ['pos-gift-card-history', id],
    queryFn: () => getGiftCardHistory(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useSessionDisplay(id: string) {
  return useQuery({
    queryKey: ['pos-session-display', id],
    queryFn: () => getSessionDisplay(id),
    enabled: !!id,
    refetchInterval: 3000,
    staleTime: 0,
  })
}

// ─── Cash Drawer ──────────────────────────────────────────────────────────────

export function useCashDrawerEvents(sessionId: string) {
  return useQuery({
    queryKey: ['pos-cash-drawer', sessionId],
    queryFn: () => getCashDrawerEvents(sessionId),
    enabled: !!sessionId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCashDrawerEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCashDrawerEventInput) => createCashDrawerEvent(input),
    onSuccess: (_, input) =>
      qc.invalidateQueries({ queryKey: ['pos-cash-drawer', input.sessionId] }),
  })
}

// ─── Branch Pricing ───────────────────────────────────────────────────────────

export function useBranchPricing(branchId?: string, itemId?: string) {
  return useQuery({
    queryKey: ['pos-branch-pricing', branchId, itemId],
    queryFn: () => getBranchPricing(branchId, itemId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateBranchPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBranchPricingInput) => createBranchPricing(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-branch-pricing'] }),
  })
}

export function useUpdateBranchPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBranchPricingInput }) =>
      updateBranchPricing(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-branch-pricing'] }),
  })
}

export function useDeleteBranchPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBranchPricing(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-branch-pricing'] }),
  })
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Loyalty Program ──────────────────────────────────────────────────────────

export function useLoyaltyProgram(tenantId: string) {
  return useQuery({
    queryKey: ['pos-loyalty-program', tenantId],
    queryFn: () => getLoyaltyProgram(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateLoyaltyProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLoyaltyProgramInput) => createLoyaltyProgram(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-loyalty-program'] }),
  })
}

export function useUpdateLoyaltyProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLoyaltyProgramInput }) =>
      updateLoyaltyProgram(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-loyalty-program'] }),
  })
}

// ─── Parked Sales ─────────────────────────────────────────────────────────────

export function useParkedSales(terminalId?: string) {
  return useQuery({
    queryKey: ['pos-parked-sales', terminalId],
    queryFn: () => getParkedSales(terminalId),
    staleTime: 30 * 1000,
  })
}

export function useResumeParkedSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => resumeParkedSale(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-parked-sales'] }),
  })
}

export function useCancelParkedSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelParkedSale(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-parked-sales'] }),
  })
}

// ─── POS Config ───────────────────────────────────────────────────────────────

export function usePosConfig(tenantId: string) {
  return useQuery({
    queryKey: ['pos-config', tenantId],
    queryFn: () => getPosConfig(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePosConfigInput) => createPosConfig(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-config'] }),
  })
}

export function useUpdatePosConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePosConfigInput }) =>
      updatePosConfig(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-config'] }),
  })
}
