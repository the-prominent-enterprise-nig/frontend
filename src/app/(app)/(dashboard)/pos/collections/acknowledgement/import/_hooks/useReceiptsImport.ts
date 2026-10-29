'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { AcknowledgementReceipts } from '@/src/libs/data/AccountingV2Data'
import {
  summarizeImportRows,
  type AcknowledgementImportCells,
  type AcknowledgementImportPreview,
  type AcknowledgementImportResult,
} from '@/src/schema/pos/acknowledgement-import'

export type ImportPhase = 'choose' | 'previewing' | 'review' | 'applying' | 'done'

/** A row as the user is editing it. `cells` is the raw text exactly as it would
 * sit in the CSV; it is the source of truth from the first preview on, and the
 * server's answers never overwrite it (so typing is never lost). */
export type EditableImportRow = {
  rowNumber: number
  cells: AcknowledgementImportCells
  /** Changed on screen since the file was read. */
  edited: boolean
}

/** How long typing has to pause before the rows are re-checked. */
const RECHECK_DELAY_MS = 500

/** Two-step upload, then an editable review.
 *
 * Choosing a file previews it (a dry run that writes nothing) and seeds
 * `rows` from the preview's `cells`. From then on the screen works on those
 * rows alone: every edit or removal re-checks all of them through the JSON
 * endpoints (debounced, newest answer wins), and the import posts them the
 * same way. The file itself is not sent again. */
export function useReceiptsImport() {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<EditableImportRow[]>([])
  const [preview, setPreview] = useState<AcknowledgementImportPreview | null>(null)
  const [result, setResult] = useState<AcknowledgementImportResult | null>(null)
  const [phase, setPhase] = useState<ImportPhase>('choose')
  // The user's tick on "post these rows using the calculated Net". Reset with
  // every new file so a tick given to one file never carries to the next.
  // True from an edit until the server has answered for the rows as they now
  // are — the preview on screen is stale in between, so Confirm waits.
  const [checking, setChecking] = useState(false)
  // Rows whose edit panel is open. Seeded with the rows that came back as
  // errors; after that only the user opens and closes them.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())

  // The debounced re-check reads the rows from here, not from a closure, so it
  // always sends what is on screen now.
  const rowsRef = useRef<EditableImportRow[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped by every edit and every new check; an answer for an older one is
  // dropped.
  const seqRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(() => clearTimer, [])

  const storeRows = (next: EditableImportRow[]) => {
    rowsRef.current = next
    setRows(next)
  }

  const runCheck = useCallback(async () => {
    timerRef.current = null
    const current = rowsRef.current
    if (current.length === 0) {
      setPreview({ summary: summarizeImportRows([]), blockingErrors: false, rows: [] })
      setChecking(false)
      return
    }
    const mine = ++seqRef.current
    const res = await AcknowledgementReceipts.importPreviewRows(
      current.map(({ rowNumber, cells }) => ({ rowNumber, cells }))
    )
    if (mine !== seqRef.current) return // a newer edit or check superseded this one
    setChecking(false)
    if (!res.success || !res.data) {
      showToast({ title: 'Could not re-check the rows', description: res.message, status: 'error' })
      return
    }
    setPreview(res.data)
  }, [])

  const scheduleCheck = useCallback(() => {
    seqRef.current += 1 // anything already in flight is now out of date
    setChecking(true)
    clearTimer()
    timerRef.current = setTimeout(() => void runCheck(), RECHECK_DELAY_MS)
  }, [runCheck])

  function reset(): void {
    clearTimer()
    seqRef.current += 1
    rowsRef.current = []
    setFile(null)
    setRows([])
    setPreview(null)
    setResult(null)
    setChecking(false)
    setExpanded(new Set())
    setPhase('choose')
  }

  async function choose(csv: File): Promise<void> {
    clearTimer()
    seqRef.current += 1
    setFile(csv)
    setPreview(null)
    setResult(null)
    setChecking(false)
    setPhase('previewing')
    const res = await AcknowledgementReceipts.importPreview(csv)
    if (!res.success || !res.data) {
      showToast({ title: 'Could not read file', description: res.message, status: 'error' })
      reset()
      return
    }
    storeRows(
      res.data.rows.map((r) => ({ rowNumber: r.rowNumber, cells: r.cells ?? {}, edited: false }))
    )
    setExpanded(new Set(res.data.rows.filter((r) => r.status === 'error').map((r) => r.rowNumber)))
    setPreview(res.data)
    setPhase('review')
  }

  /** Changes some of one row's cells and queues a re-check. */
  function updateCells(rowNumber: number, patch: AcknowledgementImportCells): void {
    storeRows(
      rowsRef.current.map((r) =>
        r.rowNumber === rowNumber ? { ...r, cells: { ...r.cells, ...patch }, edited: true } : r
      )
    )
    scheduleCheck()
  }

  /** Drops a row from the import. It disappears at once; the rest are
   * re-checked behind it. */
  function removeRow(rowNumber: number): void {
    storeRows(rowsRef.current.filter((r) => r.rowNumber !== rowNumber))
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(rowNumber)
      return next
    })
    setPreview((prev) => {
      if (!prev) return prev
      const kept = prev.rows.filter((r) => r.rowNumber !== rowNumber)
      return {
        summary: summarizeImportRows(kept),
        blockingErrors: kept.some((r) => r.status === 'error'),
        rows: kept,
      }
    })
    scheduleCheck()
  }

  function toggleExpanded(rowNumber: number): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  async function apply(): Promise<void> {
    if (rowsRef.current.length === 0) return
    setPhase('applying')
    const res = await AcknowledgementReceipts.importCommitRows(
      rowsRef.current.map(({ rowNumber, cells }) => ({ rowNumber, cells }))
    )
    if (!res.success || !res.data) {
      showToast({ title: 'Import failed', description: res.message, status: 'error' })
      setPhase('review')
      return
    }
    setResult(res.data)
    setPhase('done')
  }

  return {
    file,
    rows,
    preview,
    result,
    phase,
    checking,
    expanded,
    choose,
    updateCells,
    removeRow,
    toggleExpanded,
    apply,
    reset,
  }
}
