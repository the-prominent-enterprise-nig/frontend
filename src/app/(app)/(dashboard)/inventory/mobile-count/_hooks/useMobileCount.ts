'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getMobileCountSessions } from '../_actions/get-mobile-count-data'
import { submitCount } from '../../stock-counts/_actions/submit-count'
import { addCountLine } from '../../stock-counts/_actions/add-count-line'
import { getItems } from '../../items/_actions/get-items'
import { getItem } from '../../items/_actions/get-item'
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

/** The item a scanned code stands for — its SKU, or (as before) its id. */
async function findScannedItem(
  code: string
): Promise<{ id: string; name: string; sku: string } | undefined> {
  const bySku = await getItems({ search: code, limit: 50 })
  const hit = (bySku.data?.data ?? []).find((item) => item.sku === code)
  if (hit) return hit
  const byId = await getItem(code)
  return byId.success && byId.data ? byId.data : undefined
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

  const handleScan = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim()
      if (!trimmed) return
      setBarcodeInput('')

      // Asked of the server, per scan. This used to look the code up in the
      // first 200 items loaded up front (of 3,500+), so a scanned item outside
      // them read "Item not found".
      const matchedItem = await findScannedItem(trimmed)
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
    [scanEntries, selectedSession]
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
