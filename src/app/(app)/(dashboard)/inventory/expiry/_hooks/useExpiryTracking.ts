'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getExpiringBatches, getAllBatchesWithExpiry } from '../_actions/get-expiry-data'
import { getExpiryStatus } from '@/src/schema/inventory/batches'

export function useExpiryTracking() {
  const [expiryWindowDays, setExpiryWindowDays] = useState(30)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [tab, setTab] = useState<'expiring' | 'all'>('expiring')

  const expiringQuery = useQuery({
    queryKey: ['inventory-batches-expiring', expiryWindowDays],
    queryFn: () => getExpiringBatches({ days: expiryWindowDays, limit: 100 }),
    staleTime: 5 * 60 * 1000,
    enabled: tab === 'expiring',
  })

  const allQuery = useQuery({
    queryKey: ['inventory-batches-all-expiry', { page, limit }],
    queryFn: () => getAllBatchesWithExpiry({ page, limit }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    enabled: tab === 'all',
  })

  const expiringBatches = expiringQuery.data?.data?.data ?? []
  const allBatches = allQuery.data?.data?.data ?? []

  const expiredCount = expiringBatches.filter(
    (b) => getExpiryStatus(b.expiryDate) === 'expired'
  ).length
  const expiringSoonCount = expiringBatches.filter(
    (b) => getExpiryStatus(b.expiryDate) === 'expiring_soon'
  ).length

  const sortedByExpiry = useMemo(
    () =>
      [...(tab === 'expiring' ? expiringBatches : allBatches)].sort((a, b) => {
        if (!a.expiryDate) return 1
        if (!b.expiryDate) return -1
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      }),
    [expiringBatches, allBatches, tab]
  )

  const pagination = {
    total: allQuery.data?.data?.total ?? 0,
    page: allQuery.data?.data?.page ?? 1,
    limit: allQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((allQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    expiringBatches,
    allBatches,
    sortedByExpiry,
    expiredCount,
    expiringSoonCount,
    pagination,
    isLoading: tab === 'expiring' ? expiringQuery.isLoading : allQuery.isLoading,
    isFetching: expiringQuery.isFetching || allQuery.isFetching,
    error: expiringQuery.error || allQuery.error,
    tab,
    setTab,
    expiryWindowDays,
    setExpiryWindowDays: (v: number) => {
      setExpiryWindowDays(v)
      setPage(1)
    },
    page,
    setPage,
  }
}
