'use client'

import { memo, useDeferredValue, useMemo, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import FoundUnitPicker from './FoundUnitPicker'
import Tooltip from '@/src/components/ui/Tooltip'
import RemarksInput from './RemarksInput'

/** One row of the Physical Inventory Count Sheet (Scenario 87). */
export type CountSheetLine = {
  /** The count line on the server, once it exists — what autosave targets. */
  lineId?: string
  itemId: string
  itemName: string
  brandName: string
  modelNumber: string
  batchId?: string
  locationId?: string
  // Scenario 19 Part 5 — present (even as '') for a serial-level line, so
  // the row can tell "aggregate line" apart from "one unit, a checkbox
  // instead of a quantity". '' means a found-serial row whose serial hasn't
  // been picked yet.
  serialNumberId?: string
  serialLabel?: string
  systemQty: number | null // null = not in the system snapshot (a genuine find)
  countedQty: number | ''
  /** Free text; a preset at its start ("Defective — …") becomes its tag. */
  remarks: string
}

type Props = {
  lines: CountSheetLine[]
  usedSerialIds: ReadonlySet<string>
  onPickFound: (index: number, serial: SerialNumberSummary) => void
  onChange: (index: number, patch: Partial<CountSheetLine>) => void
  onRemove: (index: number) => void
}

const COLUMNS = ['Serial Number', 'Brand', 'Model', 'In Store?', 'Remarks', '']

/** Rows drawn at a time. A big warehouse holds ~9,000 units, and drawing them
 * all at once makes the sheet slow to open; the search covers every line. */
const PAGE = 200

/** A serial line not found in store, with nothing said about where it is. */
export function isUnaccounted(line: CountSheetLine): boolean {
  return line.serialNumberId !== undefined && line.countedQty === 0 && !line.remarks.trim()
}

function SerialCell({
  line,
  index,
  usedSerialIds,
  onPickFound,
}: { line: CountSheetLine; index: number } & Pick<
  Props,
  'usedSerialIds' | 'onPickFound'
>): ReactElement {
  if (line.serialNumberId === '') {
    return (
      <FoundUnitPicker
        usedSerialIds={usedSerialIds}
        onPick={(serial) => onPickFound(index, serial)}
      />
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {line.serialLabel ? (
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700">
          {line.serialLabel}
        </span>
      ) : (
        <span className="text-xs text-ink-faint">No serial</span>
      )}
      {line.systemQty === null && (
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
          New find
        </span>
      )}
    </div>
  )
}

/** A unit is either here or not; a non-serial item still takes a count. */
function InStoreCell({
  line,
  index,
  onChange,
}: { line: CountSheetLine; index: number } & Pick<Props, 'onChange'>): ReactElement {
  if (line.serialNumberId !== undefined) {
    return (
      <input
        type="checkbox"
        aria-label={`In store: ${line.serialLabel ?? 'unit'}`}
        checked={line.countedQty === 1}
        disabled={line.serialNumberId === ''}
        onChange={(e) => onChange(index, { countedQty: e.target.checked ? 1 : 0 })}
        className="h-4 w-4 cursor-pointer accent-prominent-purple-700"
      />
    )
  }
  const variance = line.countedQty === '' ? null : line.countedQty - (line.systemQty ?? 0)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        inputMode="numeric"
        aria-label={`Counted: ${line.itemName}`}
        value={line.countedQty}
        onChange={(e) => {
          const v = e.target.value
          if (v === '' || /^\d+$/.test(v))
            onChange(index, { countedQty: v === '' ? '' : Number(v) })
        }}
        placeholder="Qty"
        className={`w-16 rounded-lg border px-2 py-1 text-center text-sm outline-none focus:border-prominent-purple-500 ${
          variance ? 'border-amber-400 bg-amber-50' : 'border-zinc-200'
        }`}
      />
      <span className="text-[11px] text-ink-subtle">of {line.systemQty ?? 0}</span>
    </div>
  )
}

function RemarksCell({
  line,
  index,
  onChange,
}: { line: CountSheetLine; index: number } & Pick<Props, 'onChange'>): ReactElement {
  return (
    <div className="min-w-[280px]">
      <RemarksInput
        value={line.remarks}
        onChange={(remarks) => onChange(index, { remarks })}
        ariaLabel={`Remarks: ${line.serialLabel ?? line.itemName}`}
        placeholder={
          line.countedQty === 0 ? 'Search or type — location / ref. no.' : 'Search or type a remark'
        }
        highlight={isUnaccounted(line)}
      />
    </div>
  )
}

type RowProps = Omit<Props, 'lines'> & { line: CountSheetLine; index: number }

/** Memoized: an edit replaces only its own line object, so every other row
 * keeps its props and skips the redraw. */
const SheetRow = memo(function SheetRow(props: RowProps) {
  const { line, index, onRemove } = props
  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="px-3 py-3">
        <SerialCell {...props} />
      </td>
      <td className="px-3 py-3 text-sm font-medium text-zinc-800">{line.brandName || '—'}</td>
      <td className="px-3 py-3">
        <p className="text-sm text-zinc-900">{line.modelNumber || '—'}</p>
        <p className="text-xs text-ink-subtle">{line.itemName}</p>
      </td>
      <td className="px-3 py-3 text-center">
        <InStoreCell line={line} index={index} onChange={props.onChange} />
      </td>
      <td className="px-3 py-3">
        <RemarksCell line={line} index={index} onChange={props.onChange} />
      </td>
      <td className="px-1 py-3">
        {line.systemQty === null && (
          <Tooltip label="Remove this find" align="end">
            <button
              type="button"
              aria-label="Remove this find"
              onClick={() => onRemove(index)}
              className="rounded p-1 text-ink-faint hover:bg-zinc-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </td>
    </tr>
  )
})

/** Whether a row matches the search: its serial, brand, model, item name or
 * remark. A find still waiting for its pick always shows, so a search can't
 * hide the row just added. */
function rowMatches(line: CountSheetLine, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q || !line.itemId) return true
  return [line.serialLabel, line.brandName, line.modelNumber, line.itemName, line.remarks].some(
    (field) => field?.toLowerCase().includes(q)
  )
}

/** The Count Sheet, laid out like the client's form: Serial Number · Brand ·
 * Model (item name under it) · In Store? · Remarks. `query` filters it — it
 * comes from the scan/search box above. */
export default function CountSheetTable(props: Props & { query: string }): ReactElement {
  // Everything a row needs except the whole list, which changes on every
  // keystroke and would defeat SheetRow's memo.
  const rowProps: Omit<Props, 'lines'> = {
    usedSerialIds: props.usedSerialIds,
    onPickFound: props.onPickFound,
    onChange: props.onChange,
    onRemove: props.onRemove,
  }
  const { query } = props
  // How many rows are drawn, back to one page whenever the search changes.
  const [shown, setShown] = useState({ query, limit: PAGE })
  const limit = shown.query === query ? shown.limit : PAGE
  // The filter runs a beat behind the keystrokes, so the box never lags.
  const deferredQuery = useDeferredValue(query)
  // Keep each row's real position: edits go to lines[index], not to the
  // filtered list's.
  const matched = useMemo(
    () =>
      props.lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => rowMatches(line, deferredQuery)),
    [props.lines, deferredQuery]
  )
  const rows = matched.slice(0, limit)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-left">
          <thead className="bg-zinc-50">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c}
                  className={`px-3 py-2.5 text-xs font-semibold text-ink-muted ${c === 'In Store?' ? 'text-center' : ''}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, index }) => (
              <SheetRow key={index} {...rowProps} line={line} index={index} />
            ))}
            {matched.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-8 text-center text-sm text-ink-faint"
                >
                  No lines match &ldquo;{query.trim()}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {matched.length > rows.length && (
        <div className="flex items-center justify-center gap-3 text-xs text-ink-muted">
          <span>
            Showing {rows.length} of {matched.length} — search to jump to a unit.
          </span>
          <button
            type="button"
            onClick={() => setShown({ query, limit: limit + PAGE })}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
          >
            Show {Math.min(PAGE, matched.length - rows.length)} more
          </button>
        </div>
      )}
    </div>
  )
}
