'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getCreditApplications } from '../_actions/get-applications'
import { createCreditApplication } from '../_actions/create-application'
import type {
  CreateCreditApplicationFormValues,
  CreditApplicationStatus,
} from '@/src/schema/credit/applications'

export function useCreditApplications() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<CreditApplicationStatus | undefined>(undefined)

  const queryParams = useMemo(
    () => ({ page, limit, status: statusFilter }),
    [page, limit, statusFilter]
  )

  const applicationsQuery = useQuery({
    queryKey: ['credit-applications', queryParams],
    queryFn: () => getCreditApplications(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Scenario 26 — this queue is a maker-checker handoff between three
    // different people's browser tabs (Cashier submits, Investigator
    // records, Branch Manager decides); staleTime alone only ever refetches
    // on this tab's own refocus/remount, so another actor's transition
    // could sit stale here indefinitely. Matches
    // ReleaseApprovalsList.tsx's own 10s poll for the same reason.
    refetchInterval: 10 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateCreditApplicationFormValues) => createCreditApplication(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Credit application opened',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['credit-applications'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const applications = applicationsQuery.data?.data?.data ?? []
  const meta = applicationsQuery.data?.data?.meta
  const pagination = {
    total: meta?.total ?? 0,
    page: meta?.page ?? 1,
    limit: meta?.limit ?? limit,
    totalPages: meta?.totalPages ?? 0,
  }

  return {
    applications,
    pagination,
    isLoading: applicationsQuery.isLoading,
    isFetching: applicationsQuery.isFetching,
    error: applicationsQuery.error,

    statusFilter,
    setStatusFilter: (v: CreditApplicationStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },

    page,
    setPage,

    createApplication: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}
