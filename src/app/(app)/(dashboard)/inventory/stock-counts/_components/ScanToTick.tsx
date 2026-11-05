'use client'

import { useMemo, useRef, useState, type ReactElement } from 'react'
import { CheckCircle2, Info, PlusCircle, ScanLine, XCircle } from 'lucide-react'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import type { CountSheetLine } from './CountSheetTable'

type Result = { tone: 'ticked' | 'repeat' | 'found' | 'unknown'; text: string }

type Props = {
  lines: CountSheetLine[]
  /** What's in the box; it also filters the sheet below. */
  query: string
  onQuery: (q: string) => void
  onTick: (index: number) => void
  /** A unit the sheet doesn't list but the system knows: add it as found. */
  onFound: (serial: SerialNumberSummary) => void
}

const TONE: Record<Result['tone'], { icon: ReactElement; className: string }> = {
  ticked: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    className: 'border-green-200 bg-green-50 text-green-800',
  },
  repeat: {
    icon: <Info className="h-4 w-4 shrink-0" />,
    className: 'border-zinc-200 bg-zinc-50 text-ink-muted',
  },
  found: {
    icon: <PlusCircle className="h-4 w-4 shrink-0" />,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  unknown: {
    icon: <XCircle className="h-4 w-4 shrink-0" />,
    className: 'border-red-200 bg-red-50 text-red-700',
  },
}

function describe(line: CountSheetLine): string {
  return [line.serialLabel, [line.brandName, line.modelNumber].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' — ')
}

/** Looks a serial up across every location, for a unit the sheet doesn't list. */
async function findElsewhere(code: string): Promise<SerialNumberSummary | undefined> {
  const res = await getSerialNumbers({ search: code, limit: 5 })
  const serials = res.success ? (res.data?.data ?? []) : []
  return serials.find((s) => s.serialNumber.toLowerCase() === code.toLowerCase())
}

/**
 * Scan or search (Scenario 87). Typing filters the sheet. Enter — which a
 * barcode scanner sends after each code — ticks that serial In Store? and
 * clears the box, so the counter can go shelf to shelf without touching the
 * screen. A serial nobody knows stays in the box, still filtering.
 */
export default function ScanToTick({
  lines,
  query,
  onQuery,
  onTick,
  onFound,
}: Props): ReactElement {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  const indexBySerial = useMemo(() => {
    const map = new Map<string, number>()
    lines.forEach((l, i) => l.serialLabel && map.set(l.serialLabel.toLowerCase(), i))
    return map
  }, [lines])
  const units = lines.filter((l) => l.serialNumberId)
  const checked = units.filter((l) => l.countedQty === 1).length

  async function scan(raw: string): Promise<void> {
    const value = raw.trim()
    if (!value) return
    const index = indexBySerial.get(value.toLowerCase())
    if (index !== undefined) {
      const line = lines[index]
      onQuery('')
      if (line.countedQty === 1) {
        setResult({ tone: 'repeat', text: `Already counted: ${describe(line)}` })
      } else {
        onTick(index)
        setResult({ tone: 'ticked', text: `In store: ${describe(line)}` })
      }
      return
    }
    setBusy(true)
    const elsewhere = await findElsewhere(value)
    setBusy(false)
    if (!elsewhere) {
      setResult({
        tone: 'unknown',
        text: `No unit with serial ${value}. Showing what matches it instead — or register it under Serial Numbers.`,
      })
      return
    }
    onQuery('')
    onFound(elsewhere)
    const place = elsewhere.currentWarehouse?.name ?? 'no location'
    setResult({
      tone: 'found',
      text: `Added as found: ${elsewhere.serialNumber} (system had it at ${place})`,
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-prominent-purple-100 bg-prominent-purple-50/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative min-w-[260px] flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            void scan(query).then(() => input.current?.focus())
          }}
        >
          <ScanLine className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-prominent-purple-600" />
          <input
            ref={input}
            autoFocus
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            disabled={busy}
            placeholder="Scan a barcode, or search serial, brand, model or remark"
            aria-label="Scan or search the count sheet"
            className="w-full rounded-lg border border-prominent-purple-200 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-prominent-purple-500"
          />
        </form>
        <p className="shrink-0 text-sm text-ink-muted">
          <strong className="text-zinc-900">{checked.toLocaleString()}</strong> of{' '}
          {units.length.toLocaleString()} in store
        </p>
      </div>
      {result && (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TONE[result.tone].className}`}
        >
          {TONE[result.tone].icon}
          {result.text}
        </p>
      )}
    </div>
  )
}
