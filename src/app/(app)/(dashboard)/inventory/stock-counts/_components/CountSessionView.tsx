'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Loader2, Plus, AlertTriangle, Check } from 'lucide-react'
import type {
  CountSummary,
  CountLineSnapshot,
  SubmitCountFormValues,
  UpdateCountLineValues,
} from '@/src/schema/inventory/stock-counts'
import { COUNT_REMARK_TAG_LABELS } from '@/src/schema/inventory/stock-counts'
import type { ApiResponse } from '@/src/libs/api/client'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import ScanToTick from './ScanToTick'
import { useCountAutosave, type AutosaveStatus } from '../_hooks/useCountAutosave'
import { addCountLine } from '../_actions/add-count-line'
import { removeCountLine } from '../_actions/remove-count-line'
import Tooltip from '@/src/components/ui/Tooltip'
import CountSheetTable, { isUnaccounted, type CountSheetLine } from './CountSheetTable'
import { tagFor } from './RemarksInput'

type Props = {
  count: CountSummary | null
  onClose: () => void
  onStart: (id: string) => Promise<ApiResponse<unknown>>
  onSubmit: (args: { id: string; data: SubmitCountFormValues }) => Promise<ApiResponse<unknown>>
  onCancel: (id: string) => Promise<ApiResponse<unknown>>
  isStarting: boolean
  isSubmitting: boolean
  isCancelling: boolean
  countLines: CountLineSnapshot[]
  isCountLinesLoading: boolean
}

/** A sheet change as the server's line update takes it: the tick/quantity,
 * and the remark split into its preset tag and the whole text. */
function toSavedPatch(patch: Partial<CountSheetLine>): UpdateCountLineValues {
  return {
    ...(typeof patch.countedQty === 'number' && { countedQty: patch.countedQty }),
    ...(patch.remarks !== undefined && {
      remarkTag: tagFor(patch.remarks) ?? null,
      remarks: patch.remarks.trim() || null,
    }),
  }
}

/** What a found unit puts on its row. */
function foundFields(serial: SerialNumberSummary): Partial<CountSheetLine> {
  return {
    itemId: serial.item?.id ?? '',
    itemName: serial.item?.name ?? '',
    brandName: serial.item?.brand?.name ?? '',
    modelNumber: serial.item?.modelNumber ?? '',
    serialNumberId: serial.id,
    serialLabel: serial.serialNumber,
  }
}

/** Saving… / Saved / Couldn't save — retry, beside the footer buttons. */
function SaveStatus({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }) {
  if (status === 'idle') return null
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Couldn&apos;t save — retry
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      {status === 'saving' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5 text-green-600" />
      )}
      {status === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  )
}

/** Submit Count, off until the sheet differs from how it loaded. */
function SubmitCountButton({
  disabled,
  noChanges,
  isSubmitting,
  onClick,
}: {
  disabled: boolean
  noChanges: boolean
  isSubmitting: boolean
  onClick: () => void
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
      {isSubmitting ? 'Submitting…' : 'Submit Count'}
    </button>
  )
  if (!noChanges) return button
  return (
    <Tooltip label="Tick a unit, add a remark or a found item first" align="end">
      {button}
    </Tooltip>
  )
}

/** What the counter can change on a line, as one string per sheet: equal
 * strings mean nothing was changed (or every change was undone). */
function sheetSignature(lines: CountSheetLine[]): string {
  return (
    lines
      // A found row still waiting for its unit isn't sent, so isn't a change.
      .filter((l) => l.itemId && l.serialNumberId !== '')
      .map((l) => `${l.serialNumberId ?? l.itemId}:${l.countedQty}:${l.remarks.trim()}`)
      .join('|')
  )
}

/** What Submit Count is about to send, so the counter can catch a slip. */
function SubmitSummary({ lines }: { lines: CountSheetLine[] }) {
  const units = lines.filter((l) => l.serialNumberId)
  const inStore = units.filter((l) => l.countedQty === 1).length
  const notInStore = units.length - inStore
  const unaccounted = lines.filter(isUnaccounted).length
  return (
    <>
      <p>
        <strong className="text-zinc-900">{inStore}</strong> in store ·{' '}
        <strong className="text-zinc-900">{notInStore}</strong> not in store
      </p>
      {unaccounted > 0 && (
        <p>
          <strong className="text-amber-700">{unaccounted}</strong> units not in store have no
          remark saying where they are. They&apos;ll be reported as unaccounted for.
        </p>
      )}
      <p>
        Anything that doesn&apos;t match the system goes into one stock adjustment for review. You
        can&apos;t edit this count after you submit it.
      </p>
    </>
  )
}

/** A row for something the snapshot didn't list, before it's picked. */
const EMPTY_FIND: Omit<CountSheetLine, 'countedQty'> = {
  itemId: '',
  itemName: '',
  brandName: '',
  modelNumber: '',
  systemQty: null,
  remarks: '',
}

export default function CountSessionView({
  count,
  onClose,
  onStart,
  onSubmit,
  onCancel,
  isStarting,
  isSubmitting,
  isCancelling,
  countLines,
  isCountLinesLoading,
}: Props) {
  const [confirming, setConfirming] = useState<'submit' | 'cancel' | null>(null)
  const [lines, setLines] = useState<CountSheetLine[]>([])
  // The scan/search box's text, which also filters the sheet.
  const [sheetQuery, setSheetQuery] = useState('')
  const seededCountId = useRef<string | null>(null)
  // The sheet as it loaded, so Submit Count stays off until something changes.
  const [seededSignature, setSeededSignature] = useState('')

  // Seed the count sheet from the server-side snapshot taken at start() —
  // expected quantity is never something the counter types in themselves.
  // Guarded to run once per count (after its first real snapshot response,
  // not while `countLines` is still the pre-fetch default `[]`) — without
  // that guard, a background refetch of the snapshot query re-runs this
  // effect and silently wipes out any found item/serial the counter had
  // already added locally in the gap between starting the count and the
  // snapshot query's first resolution.
  useEffect(() => {
    if (count?.status !== 'in_progress') return
    if (isCountLinesLoading) return
    if (seededCountId.current === count.id) return
    seededCountId.current = count.id
    // Most recently added line first — reverse of snapshot/creation order.
    const seeded: CountSheetLine[] = [...countLines].reverse().map((l) => ({
      itemId: l.itemId,
      itemName: l.item.name,
      brandName: l.item.brand?.name ?? '',
      modelNumber: l.item.modelNumber ?? '',
      batchId: l.batchId ?? undefined,
      locationId: l.locationId ?? undefined,
      lineId: l.id,
      serialNumberId: l.serialNumberId ?? undefined,
      serialLabel: l.serialNumber?.serialNumber,
      systemQty: Number(l.systemQty),
      // A unit is "not in store" until ticked (Scenario 87 In Store?).
      countedQty: l.countedQty ?? (l.serialNumberId ? 0 : ''),
      remarks: l.remarks ?? (l.remarkTag ? COUNT_REMARK_TAG_LABELS[l.remarkTag] : ''),
    }))
    setLines(seeded)
    // "Changed" is measured against the sheet as start() made it — so a count
    // resumed with saved ticks, remarks or finds can be submitted straight away.
    setSeededSignature(
      sheetSignature(
        seeded
          .filter((l) => l.systemQty !== 0)
          .map((l) => ({ ...l, countedQty: l.serialNumberId ? 0 : '', remarks: '' }))
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count?.id, countLines])

  const autosave = useCountAutosave(count?.id)
  // The latest sheet, for the stable callbacks below to read a line's server id.
  const linesRef = useRef(lines)
  linesRef.current = lines

  // Stable across keystrokes, so a large sheet (a warehouse can hold ~9,000
  // units) only redraws the row being edited — see CountSheetTable's memo.
  // A saved line's tick / remark is queued to the server as it changes.
  const updateLine = useCallback(
    (index: number, patch: Partial<CountSheetLine>) => {
      setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
      const lineId = linesRef.current[index]?.lineId
      if (lineId) autosave.queue(lineId, toSavedPatch(patch))
    },
    [autosave]
  )

  const removeLine = useCallback(
    (index: number) => {
      const line = linesRef.current[index]
      setLines((prev) => prev.filter((_, i) => i !== index))
      if (line?.lineId && count) void removeCountLine(count.id, line.lineId)
    },
    [count]
  )

  /** Puts a found unit on the server as a count line, ticked, and gives the
   * row its id — so a find survives a refresh like everything else. */
  const persistFound = useCallback(
    async (serial: SerialNumberSummary) => {
      if (!count || !serial.item) return
      const res = await addCountLine(count.id, {
        itemId: serial.item.id,
        serialNumberId: serial.id,
      })
      if (!res.success || !res.data) return
      const lineId = res.data.id
      setLines((prev) => prev.map((l) => (l.serialNumberId === serial.id ? { ...l, lineId } : l)))
      autosave.queue(lineId, { countedQty: 1 })
    },
    [count, autosave]
  )

  // Add Found Item (Scenario 87): the picked unit fills the row.
  const pickFoundUnit = useCallback(
    (index: number, serial: SerialNumberSummary) => {
      setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...foundFields(serial) } : l)))
      void persistFound(serial)
    },
    [persistFound]
  )

  // Scan to tick: a scanned unit the sheet doesn't list comes in as found.
  const scanFoundUnit = useCallback(
    (serial: SerialNumberSummary) => {
      setLines((prev) => [{ ...EMPTY_FIND, ...foundFields(serial), countedQty: 1 }, ...prev])
      void persistFound(serial)
    },
    [persistFound]
  )

  const tickLine = useCallback(
    (index: number) => updateLine(index, { countedQty: 1 }),
    [updateLine]
  )

  const hasChanges = useMemo(
    () => sheetSignature(lines) !== seededSignature,
    [lines, seededSignature]
  )

  // Units already on the sheet can't be added again. Keyed on the serial ids
  // alone, so ticking or typing doesn't rebuild it.
  const usedSerialKey = lines.map((l) => l.serialNumberId ?? '').join('|')
  const usedSerialIds = useMemo(
    () => new Set(usedSerialKey.split('|').filter(Boolean)),
    [usedSerialKey]
  )

  if (!count) return null

  const isInProgress = count.status === 'in_progress'
  const isScheduled = count.status === 'scheduled'
  const isCompleted = count.status === 'completed'
  const isCancelled = count.status === 'cancelled'

  function addFoundItem() {
    // A unit the snapshot didn't list (every NIG item is serialized). Its
    // serial is searched in the new row; prepended so the sheet stays
    // most-recent-first. Found means in store, so it starts ticked.
    setLines((prev) => [{ ...EMPTY_FIND, serialNumberId: '', countedQty: 1 }, ...prev])
  }

  async function handleSubmitCount() {
    if (!count) return
    // Every serial line goes up, ticked (1) or not (0), with its Remarks; an
    // unticked one with no remark is allowed and reads as unaccounted.
    const validLines = lines
      .filter((l) => l.itemId && l.serialNumberId !== '' && l.countedQty !== '')
      .map((l) => ({
        itemId: l.itemId,
        batchId: l.batchId,
        locationId: l.locationId,
        serialNumberId: l.serialNumberId,
        countedQty: Number(l.countedQty),
        // The preset it starts with is its tag; the whole text is kept.
        remarkTag: tagFor(l.remarks),
        remarks: l.remarks.trim() || undefined,
      }))

    if (validLines.length === 0) return

    // The submit carries the whole sheet; queued saves would only be refused.
    autosave.discard()
    await onSubmit({ id: count.id, data: { lines: validLines } })
  }

  const variantLines = lines.filter(
    (l) => l.countedQty !== '' && l.countedQty !== (l.systemQty ?? 0)
  )
  const unaccountedCount = lines.filter(isUnaccounted).length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center px-4">
      <div className="flex w-full max-w-6xl max-h-[92vh] flex-col rounded-t-2xl md:rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Count Session</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {count.warehouse?.branch?.name ?? count.warehouse?.name ?? '—'} &bull;{' '}
              {new Date(count.scheduledDate ?? '').toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isScheduled && (
              <button
                type="button"
                onClick={() => onStart(count.id)}
                disabled={isStarting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isStarting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Start Count
              </button>
            )}
            {/* A scheduled count has no Submit yet, so its Cancel stays up here
                beside Start Count; an in-progress one cancels from the footer. */}
            {isScheduled && (
              <button
                type="button"
                onClick={() => setConfirming('cancel')}
                disabled={isCancelling}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel Count
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {(isScheduled || isCompleted || isCancelled) && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-sm text-zinc-600">
              <p>
                Status: <strong className="text-zinc-900 capitalize">{count.status}</strong>
              </p>
              {count.scheduledDate && (
                <p className="mt-1">
                  Scheduled: {new Date(count.scheduledDate).toLocaleDateString()}
                </p>
              )}
              {count.startedAt && (
                <p className="mt-1">Started: {new Date(count.startedAt).toLocaleDateString()}</p>
              )}
              {count.completedAt && (
                <p className="mt-1">
                  Completed: {new Date(count.completedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {isInProgress && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted">
                This list is the system&apos;s stock when the count started. Tick{' '}
                <strong>In Store?</strong> for each unit you find. If a unit is missing, note where
                it is and its document number in Remarks. Use <strong>Add Found Item</strong> for
                anything not on the list.
              </p>

              {(variantLines.length > 0 || unaccountedCount > 0) && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    {variantLines.length} line(s) differ from the system.
                    {unaccountedCount > 0 &&
                      ` ${unaccountedCount} not in store have no remark saying where they are — they'll be reported as unaccounted for.`}
                  </p>
                </div>
              )}

              {isCountLinesLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-ink-faint">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading snapshot…
                </div>
              ) : lines.length > 0 ? (
                <>
                  <ScanToTick
                    lines={lines}
                    query={sheetQuery}
                    onQuery={setSheetQuery}
                    onTick={tickLine}
                    onFound={scanFoundUnit}
                  />
                  <CountSheetTable
                    lines={lines}
                    usedSerialIds={usedSerialIds}
                    onPickFound={pickFoundUnit}
                    onChange={updateLine}
                    onRemove={removeLine}
                    query={sheetQuery}
                  />
                </>
              ) : (
                <p className="py-4 text-center text-sm text-ink-faint">
                  Nothing in the system balance for this warehouse yet — add a found item below to
                  begin counting.
                </p>
              )}
            </div>
          )}
        </div>

        {isInProgress && (
          <div className="flex shrink-0 items-center gap-3 border-t border-zinc-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={addFoundItem}
              className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:border-prominent-purple-400 hover:text-prominent-purple-700"
            >
              <Plus className="h-4 w-4" /> Add Found Item
            </button>

            <SaveStatus status={autosave.status} onRetry={() => void autosave.retry()} />

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirming('cancel')}
                disabled={isCancelling || isSubmitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel Count
              </button>
              {lines.length > 0 && (
                <SubmitCountButton
                  disabled={!hasChanges || isSubmitting || isCancelling}
                  noChanges={!hasChanges}
                  isSubmitting={isSubmitting}
                  onClick={() => setConfirming('submit')}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming === 'submit'}
        title="Submit this physical inventory?"
        message={<SubmitSummary lines={lines} />}
        confirmLabel="Submit Count"
        cancelLabel="Keep counting"
        loading={isSubmitting}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          await handleSubmitCount()
          setConfirming(null)
        }}
      />
      <ConfirmDialog
        open={confirming === 'cancel'}
        title="Cancel this physical inventory?"
        message={
          <p>
            The count is marked cancelled and can&apos;t be resumed.
            {isInProgress && ' Everything ticked and typed on this sheet is discarded.'}
          </p>
        }
        confirmLabel="Cancel Count"
        cancelLabel={isInProgress ? 'Keep counting' : 'Keep it'}
        destructive
        loading={isCancelling}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          autosave.discard()
          await onCancel(count.id)
          setConfirming(null)
        }}
      />
    </div>
  )
}
