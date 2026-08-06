'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getMobileCountSessions } from '../_actions/get-mobile-count-data'
import { submitCount } from '../../stock-counts/_actions/submit-count'
import { addCountLine } from '../../stock-counts/_actions/add-count-line'
import { getItems } from '../../items/_actions/get-items'
import type { CountSummary } from '@/src/schema/inventory/stock-counts'

export type ScanEntry = {
  barcode: string
  itemId: string
  itemName: string
  sku: string
  countedQty: number
  systemQty: number
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
      data: { lines: { itemId: string; countedQty: number }[] }
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
    async (barcode: string) => {
      const trimmed = barcode.trim()
      if (!trimmed) return
      setBarcodeInput('')

      const matchedItem = items.find((item) => item.sku === trimmed || item.id === trimmed)
      if (!matchedItem) {
        showToast({
          title: 'Item not found',
          description: `No item matched "${trimmed}"`,
          status: 'error',
        })
        return
      }

      const existing = scanEntries.find((e) => e.itemId === matchedItem.id)
      if (existing) {
        setScanEntries((prev) =>
          prev.map((e) =>
            e.itemId === matchedItem.id ? { ...e, countedQty: e.countedQty + 1, synced: false } : e
          )
        )
        return
      }

      if (!selectedSession) return

      // Server resolves systemQty — never trust a client-side value for the
      // "expected" side of a count.
      const res = await addCountLine(selectedSession.id, { itemId: matchedItem.id })
      if (!res.success || !res.data) {
        showToast({
          title: 'Failed to add item',
          description: res.message,
          status: 'error',
        })
        return
      }

      setScanEntries((prev) => [
        ...prev,
        {
          barcode: trimmed,
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          sku: matchedItem.sku,
          countedQty: 1,
          systemQty: Number(res.data!.systemQty),
          synced: false,
          timestamp: Date.now(),
        },
      ])
    },
    [items, scanEntries, selectedSession]
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
