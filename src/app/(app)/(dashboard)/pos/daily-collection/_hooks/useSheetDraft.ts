'use client'

import { useCallback, useState } from 'react'
import type {
  DailyCollectionReport,
  SaveDailyCollectionSheetInput,
} from '@/src/schema/pos/daily-collection'
import { DENOMINATION_LADDER } from '../_components/form-model'

/**
 * Scenario 53 Part 6 — the editable half of the Daily Collection Report, held
 * as a draft until saved.
 *
 * Counts are kept as strings while they are being typed: a half-typed field is
 * a legitimate intermediate state, and coercing it to a number on every
 * keystroke turns an empty box into a 0 the cashier never entered.
 */
export interface SheetDraft {
  checkedBy: string
  certifiedCorrectBy: string
  remarks: string
  /** Face value (or `coins`) to the raw string in its input. */
  denominations: Record<string, string>
  denominationOverrideReason: string
}

function denominationDraft(counts: Record<string, number>): Record<string, string> {
  const extras = Object.keys(counts).filter(
    (k) => k !== 'coins' && !DENOMINATION_LADDER.includes(k as never)
  )
  const faces = [...DENOMINATION_LADDER, ...extras, 'coins']
  return Object.fromEntries(faces.map((face) => [face, String(counts[face] ?? '')]))
}

function draftFrom(report: DailyCollectionReport): SheetDraft {
  return {
    checkedBy: report.sheet?.checkedBy ?? '',
    certifiedCorrectBy: report.sheet?.certifiedCorrectBy ?? '',
    remarks: report.sheet?.remarks ?? '',
    denominations: denominationDraft(report.denominations),
    denominationOverrideReason: report.sheet?.denominationOverrideReason ?? '',
  }
}

/** Empty means "none of these", which is a zero — but only once it is saved. */
function toCounts(draft: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(draft).map(([face, raw]) => [face, Number(raw) || 0]))
}

function sameCounts(a: Record<string, number>, b: Record<string, number>): boolean {
  const faces = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...faces].every((face) => (a[face] ?? 0) === (b[face] ?? 0))
}

export interface SheetDraftController {
  draft: SheetDraft | null
  update: <K extends keyof SheetDraft>(key: K, value: SheetDraft[K]) => void
  setDenomination: (face: string, raw: string) => void
  reset: () => void
  toPayload: () => SaveDailyCollectionSheetInput | null
  /** True once the typed counts disagree with the day's session closings —
   * which is what turns an edit into a stored override needing a reason. */
  countsChanged: boolean
}

export function useSheetDraft(
  report: DailyCollectionReport | undefined,
  date: string
): SheetDraftController {
  // A new day, a new branch or a save that came back — the draft follows the
  // report rather than stranding yesterday's edits on today's form. Adjusted
  // during render against the report it was built from, which is React's own
  // pattern for this: an effect would commit the stale draft first and then
  // immediately re-render over it.
  const [state, setState] = useState<{
    source: DailyCollectionReport | undefined
    draft: SheetDraft | null
  }>({ source: report, draft: report ? draftFrom(report) : null })

  if (state.source !== report) {
    setState({ source: report, draft: report ? draftFrom(report) : null })
  }
  const draft = state.draft

  const setDraft = useCallback((next: (current: SheetDraft | null) => SheetDraft | null) => {
    setState((s) => ({ ...s, draft: next(s.draft) }))
  }, [])

  const update = useCallback(
    <K extends keyof SheetDraft>(key: K, value: SheetDraft[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d))
    },
    [setDraft]
  )

  const setDenomination = useCallback(
    (face: string, raw: string) => {
      setDraft((d) => (d ? { ...d, denominations: { ...d.denominations, [face]: raw } } : d))
    },
    [setDraft]
  )

  const reset = useCallback(() => {
    setDraft(() => (report ? draftFrom(report) : null))
  }, [report, setDraft])

  const countsChanged =
    !!draft && !!report && !sameCounts(toCounts(draft.denominations), report.countedDenominations)

  /** Null when there is no report to save against yet. */
  const toPayload = useCallback((): SaveDailyCollectionSheetInput | null => {
    if (!draft || !report) return null
    const counts = toCounts(draft.denominations)
    // Only an actual disagreement with the session closings is stored as an
    // override — retyping the same figures leaves the form deriving them.
    const isOverride = !sameCounts(counts, report.countedDenominations)
    return {
      date,
      branchId: report.branchId ?? undefined,
      checkedBy: draft.checkedBy.trim() || null,
      certifiedCorrectBy: draft.certifiedCorrectBy.trim() || null,
      remarks: draft.remarks.trim() || null,
      denominationOverride: isOverride ? counts : null,
      denominationOverrideReason: isOverride
        ? draft.denominationOverrideReason.trim() || null
        : null,
    }
  }, [draft, report, date])

  return { draft, update, setDenomination, reset, toPayload, countsChanged }
}
