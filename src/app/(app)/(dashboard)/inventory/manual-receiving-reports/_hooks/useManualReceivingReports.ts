'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import type { ApiResponse } from '@/src/libs/api/client'
import { getManualReceivingReports } from '../_actions/get-manual-receiving-reports'
import { submitManualReceivingReport } from '../_actions/submit-manual-receiving-report'
import { approveManualReceivingReport } from '../_actions/approve-manual-receiving-report'
import { rejectManualReceivingReport } from '../_actions/reject-manual-receiving-report'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type {
  ManualReceivingReport,
  ManualReceivingReportStatus,
  CreateManualReceivingReportFormValues,
  RejectManualReceivingReportFormValues,
} from '@/src/schema/inventory/manual-receiving-reports'

export function useManualReceivingReports() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<ManualReceivingReportStatus | undefined>(
    undefined
  )
  const [selectedReport, setSelectedReport] = useState<ManualReceivingReport | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const queryParams = useMemo(
    () => ({ page, limit, warehouseId: warehouseFilter, status: statusFilter }),
    [page, limit, warehouseFilter, statusFilter]
  )

  const reportsQuery = useQuery({
    queryKey: ['inventory-manual-receiving-reports', queryParams],
    queryFn: () => getManualReceivingReports(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Same rationale as useAdjustments.ts — a submit-then-approve handoff
    // across different people's browser tabs, and there's no notification
    // wired for this feature (deliberately, see the implementation notes)
    // to otherwise prompt a refetch.
    refetchInterval: 10 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  function onActionSuccess(result: ApiResponse<unknown>, successTitle: string) {
    if (result.success) {
      showToast({ title: successTitle, description: result.message, status: 'success' })
      queryClient.invalidateQueries({ queryKey: ['inventory-manual-receiving-reports'] })
      setSelectedReport((prev) =>
        prev ? { ...prev, ...(result.data as Partial<ManualReceivingReport>) } : prev
      )
    } else {
      showToast({ title: 'Failed', description: result.message, status: 'error' })
    }
  }

  const submitMutation = useMutation({
    mutationFn: (data: CreateManualReceivingReportFormValues) => submitManualReceivingReport(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Submitted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-manual-receiving-reports'] })
        setShowCreateModal(false)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveManualReceivingReport(id),
    onSuccess: (result) => onActionSuccess(result, 'Approved'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectManualReceivingReportFormValues }) =>
      rejectManualReceivingReport(id, data),
    onSuccess: (result) => onActionSuccess(result, 'Rejected'),
  })

  const reports = reportsQuery.data?.data?.data ?? []
  const meta = reportsQuery.data?.data?.meta
  const pagination = {
    total: meta?.total ?? 0,
    page: meta?.page ?? 1,
    limit: meta?.limit ?? limit,
    totalPages: meta?.lastPage ?? 0,
  }

  return {
    reports,
    pagination,
    isLoading: reportsQuery.isLoading,
    isFetching: reportsQuery.isFetching,
    error: reportsQuery.error,

    warehouseFilter,
    statusFilter,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setStatusFilter: (v: ManualReceivingReportStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setStatusFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedReport,
    setSelectedReport,

    showCreateModal,
    setShowCreateModal,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],

    submit: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,

    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,

    reject: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,

    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ['inventory-manual-receiving-reports'] }),
  }
}
