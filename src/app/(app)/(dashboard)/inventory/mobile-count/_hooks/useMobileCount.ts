'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getMobileCountSessions } from '../_actions/get-mobile-count-data'
import { submitCount } from '../../stock-counts/_actions/submit-count'
import { getItems } from '../../items/_actions/get-items'
import type { CountSummary } from '@/src/schema/inventory/stock-counts'

export type ScanEntry = {
  barcode: string
  itemId: string
  itemName: string
  sku: string
  countedQty: number
  expectedQty: number
  synced: boolean
  timestamp: number
}

export function useMobileCount() {
  const queryClient = useQueryClient()
  const [selectedSession, setSelectedSession] = useState<CountSummary | null>(null)
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')

  const sessionsQuery = useQuery({
    queryKey: ['inventory-mobile-count-sessions'],
    queryFn: getMobileCountSessions,
    staleTime: 30 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const submitMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { lines: { itemId: string; expectedQty: number; countedQty: number }[] }
    }) => submitCount(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Count submitted', description: result.message, status: 'success' })
        setScanEntries([])
        setSelectedSession(null)
        queryClient.invalidateQueries({ queryKey: ['inventory-mobile-count-sessions'] })
      } else {
        showToast({ title: 'Submission failed', description: result.message, status: 'error' })
      }
    },
  })

  const items = itemsQuery.data?.data?.data ?? []

  const handleScan = useCallback(
    (barcode: string) => {
      const trimmed = barcode.trim()
      if (!trimmed) return

      const matchedItem = items.find((item) => item.sku === trimmed || item.id === trimmed)
      if (!matchedItem) {
        showToast({
          title: 'Item not found',
          description: `No item matched "${trimmed}"`,
          status: 'error',
        })
        setBarcodeInput('')
        return
      }

      setScanEntries((prev) => {
        const existing = prev.findIndex((e) => e.itemId === matchedItem.id)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = {
            ...updated[existing],
            countedQty: updated[existing].countedQty + 1,
            synced: false,
          }
          return updated
        }
        return [
          ...prev,
          {
            barcode: trimmed,
            itemId: matchedItem.id,
            itemName: matchedItem.name,
            sku: matchedItem.sku,
            countedQty: 1,
            expectedQty: 0,
            synced: false,
            timestamp: Date.now(),
          },
        ]
      })
      setBarcodeInput('')
    },
    [items]
  )

  function updateQuantity(itemId: string, qty: number) {
    setScanEntries((prev) =>
      prev.map((e) =>
        e.itemId === itemId ? { ...e, countedQty: Math.max(0, qty), synced: false } : e
      )
    )
  }

  function removeEntry(itemId: string) {
    setScanEntries((prev) => prev.filter((e) => e.itemId !== itemId))
  }

  async function submitScans() {
    if (!selectedSession || scanEntries.length === 0) return

    const lines = scanEntries.map((e) => ({
      itemId: e.itemId,
      expectedQty: e.expectedQty,
      countedQty: e.countedQty,
    }))

    await submitMutation.mutateAsync({ id: selectedSession.id, data: { lines } })
  }

  return {
    sessions: sessionsQuery.data?.data?.data ?? [],
    isLoadingSessions: sessionsQuery.isLoading,
    selectedSession,
    setSelectedSession,
    scanEntries,
    barcodeInput,
    setBarcodeInput,
    handleScan,
    updateQuantity,
    removeEntry,
    submitScans,
    isSubmitting: submitMutation.isPending,
    unsyncedCount: scanEntries.filter((e) => !e.synced).length,
  }
}
