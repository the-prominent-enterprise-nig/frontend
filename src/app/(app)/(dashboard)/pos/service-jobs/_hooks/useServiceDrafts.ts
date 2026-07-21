'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import {
  getServiceDrafts,
  getServiceDraft,
  createServiceDraft,
  updateServiceDraft,
  cancelServiceDraft,
  getServiceDraftStockCheck,
  confirmServiceDraftSourcing,
  startServiceDraftInstall,
  recordServiceDraftActuals,
  completeServiceDraft,
} from '../_actions/service-draft-actions'
import type {
  CreateServiceDraftFormValues,
  UpdateServiceDraftFormValues,
  StartInstallFormValues,
  RecordActualsFormValues,
} from '@/src/schema/pos/service-drafts'

// Mirrors usePurchaseRequests — a TanStack Query wrapper around the
// page-local server actions, used by ServiceJobsList.
export function useServiceDrafts() {
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const queryParams = useMemo(() => ({ status: statusFilter }), [statusFilter])

  const listQuery = useQuery({
    queryKey: ['service-drafts', queryParams],
    queryFn: () => getServiceDrafts(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.OPERATIONAL,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceDraftFormValues) => createServiceDraft(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Service job created',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
      } else {
        showToast({
          title: 'Failed to create service job',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceDraftFormValues }) =>
      updateServiceDraft(id, data),
    onSuccess: (result, { id }) => {
      if (result.success) {
        showToast({
          title: 'Service job updated',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
        // The list query and the single-detail query are separate cache
        // entries (['service-drafts', ...] vs ['service-draft', id]) —
        // invalidating only the list leaves a stale cached detail behind,
        // so reopening this same job's detail modal can show pre-update
        // data (e.g. a stale status) until its own staleTime elapses.
        queryClient.invalidateQueries({ queryKey: ['service-draft', id] })
      } else {
        showToast({
          title: 'Failed to update service job',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const sourceMutation = useMutation({
    mutationFn: (id: string) => confirmServiceDraftSourcing(id),
    onSuccess: (result, id) => {
      if (result.success) {
        showToast({
          title: 'Sourcing confirmed',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
        queryClient.invalidateQueries({ queryKey: ['service-draft', id] })
      } else {
        showToast({
          title: 'Failed to confirm sourcing',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const startInstallMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StartInstallFormValues }) =>
      startServiceDraftInstall(id, data),
    onSuccess: (result, { id }) => {
      if (result.success) {
        showToast({
          title: 'Install started',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
        queryClient.invalidateQueries({ queryKey: ['service-draft', id] })
      } else {
        showToast({
          title: 'Failed to start install',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const recordActualsMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordActualsFormValues }) =>
      recordServiceDraftActuals(id, data),
    onSuccess: (result, { id }) => {
      if (result.success) {
        showToast({
          title: 'Actuals recorded',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
        queryClient.invalidateQueries({ queryKey: ['service-draft', id] })
      } else {
        showToast({
          title: 'Failed to record actuals',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeServiceDraft(id),
    onSuccess: (result, id) => {
      if (result.success) {
        showToast({
          title: 'Service job completed',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
        queryClient.invalidateQueries({ queryKey: ['service-draft', id] })
      } else {
        showToast({
          title: 'Failed to complete service job',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelServiceDraft(id),
    onSuccess: (result, id) => {
      if (result.success) {
        showToast({
          title: 'Service job cancelled',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['service-drafts'] })
        // Same reason as updateMutation above — without this, reopening the
        // cancelled job's detail modal can show its pre-cancel status (and
        // therefore a still-clickable Cancel button) until the stale cached
        // single-detail query naturally expires.
        queryClient.invalidateQueries({ queryKey: ['service-draft', id] })
      } else {
        showToast({
          title: 'Failed to cancel service job',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const items = listQuery.data?.data?.data ?? []

  return {
    items,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,

    statusFilter,
    setStatusFilter,

    createDraft: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateDraft: (id: string, data: UpdateServiceDraftFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    cancelDraft: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    confirmSourcing: sourceMutation.mutateAsync,
    isSourcing: sourceMutation.isPending,

    startInstall: (id: string, data: StartInstallFormValues) =>
      startInstallMutation.mutateAsync({ id, data }),
    isStartingInstall: startInstallMutation.isPending,

    recordActuals: (id: string, data: RecordActualsFormValues) =>
      recordActualsMutation.mutateAsync({ id, data }),
    isRecordingActuals: recordActualsMutation.isPending,

    completeDraft: completeMutation.mutateAsync,
    isCompleting: completeMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['service-drafts'] }),
  }
}

// Fetches the shortfall preview for the "Check Stock" step — a separate,
// short-staleTime query since it reflects live stock levels that a create/
// update/source mutation elsewhere can immediately invalidate.
export function useServiceDraftStockCheck(id: string | null) {
  const query = useQuery({
    queryKey: ['service-draft-stock-check', id],
    queryFn: () => getServiceDraftStockCheck(id as string),
    enabled: !!id,
    staleTime: 0,
  })

  return {
    stockCheck: query.data?.success ? (query.data.data ?? null) : null,
    isLoading: query.isLoading,
    error: query.data?.success === false ? query.data.message : null,
  }
}

// Fetches a single draft's full detail (populated lines with nested item) —
// the list response isn't guaranteed to include that, so the detail/edit
// views re-fetch by id rather than reusing the list row.
export function useServiceDraft(id: string | null) {
  const query = useQuery({
    queryKey: ['service-draft', id],
    queryFn: () => getServiceDraft(id as string),
    enabled: !!id,
    staleTime: STALE.OPERATIONAL,
  })

  return {
    draft: query.data?.success ? (query.data.data ?? null) : null,
    isLoading: query.isLoading,
    error: query.data?.success === false ? query.data.message : null,
  }
}
