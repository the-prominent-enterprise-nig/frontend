'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { importPriceListItems } from '../_actions/import-price-list-items'
import type { PriceListImportResult } from '@/src/schema/inventory/price-lists/import'

export type UploadPhase = 'choose' | 'previewing' | 'review' | 'applying' | 'done'

/** Two-step upload: choosing a file immediately previews it (a dry run that
 * writes nothing); the real upload re-sends the same file once the user has
 * read the preview. */
export function usePriceListUpload(priceListId?: string) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<PriceListImportResult | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('choose')

  function send(csv: File, dryRun: boolean) {
    const body = new FormData()
    body.append('file', csv)
    if (priceListId) body.append('priceListId', priceListId)
    body.append('dryRun', String(dryRun))
    return importPriceListItems(body)
  }

  async function preview(csv: File): Promise<void> {
    setFile(csv)
    setResult(null)
    setPhase('previewing')
    const res = await send(csv, true)
    if (!res.success || !res.data) {
      showToast({ title: 'Could not read file', description: res.message, status: 'error' })
      reset()
      return
    }
    setResult(res.data)
    setPhase('review')
  }

  async function apply(): Promise<void> {
    if (!file) return
    setPhase('applying')
    const res = await send(file, false)
    if (!res.success || !res.data) {
      showToast({ title: 'Upload failed', description: res.message, status: 'error' })
      setPhase('review')
      return
    }
    setResult(res.data)
    setPhase('done')
    // Without a priceListId the file may have touched any list, so refresh
    // every cached list/detail/items query, not one list's.
    queryClient.invalidateQueries({ queryKey: ['inventory-price-list-detail'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-price-list-items'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-price-lists'] })
  }

  function reset(): void {
    setFile(null)
    setResult(null)
    setPhase('choose')
  }

  return { file, result, phase, preview, apply, reset }
}
