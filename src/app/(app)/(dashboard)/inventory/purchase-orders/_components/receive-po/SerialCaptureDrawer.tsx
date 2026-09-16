'use client'

import { useRef, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { MONO } from '../procurementTokens'
import Tooltip from '@/src/components/ui/Tooltip'

type Props = {
  quantity: number
  serials: string[]
  /** Whether a blank box should already read as an error. */
  showErrors: boolean
  /** True when this unit's serial repeats one typed elsewhere on the receipt. */
  isDuplicate: (unitIndex: number) => boolean
  onChange: (unitIndex: number, value: string) => void
  onClearAll: () => void
  onClose: () => void
}

/**
 * One box per unit, because that is what the backend stores — a serial is a
 * unit, not a line attribute.
 *
 * Duplicates are checked against the whole receipt rather than the line: the
 * server throws a 400 for a serial listed more than once *in the request*
 * (stock.service.ts), so catching it per line would still have let a repeat
 * across two items reach the API and come back as an unexplained failure.
 */
export function SerialCaptureDrawer({
  quantity,
  serials,
  showErrors,
  isDuplicate,
  onChange,
  onClearAll,
  onClose,
}: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const slots = Array.from({ length: quantity }, (_, i) => serials[i] ?? '')
  const filled = slots.filter((s) => s.trim()).length
  const complete = quantity > 0 && filled === quantity

  // Scanners emit Enter after each barcode, so Enter has to land on the next
  // box or a receiver scanning ten units types into the first one ten times.
  const advance = (event: KeyboardEvent<HTMLInputElement>, unitIndex: number) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    inputs.current[unitIndex + 1]?.focus()
  }

  return (
    <div className="rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] px-4 py-3.5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#7c4fd1]`}>
            Serial numbers · one per unit
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className={`${MONO} text-[11.5px] font-semibold ${
                complete ? 'text-[#0b6644]' : 'text-[#8a4b06]'
              }`}
            >
              {filled} / {quantity} entered
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#ddd0f7] bg-white px-2.5 py-1 text-[11.5px] text-[#5b5b6b] hover:border-[#7c4fd1] hover:text-[#3f1490]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#eeeef1]">
          <div
            className={`h-full rounded-[3px] ${complete ? 'bg-[#0f7b52]' : 'bg-[#7c4fd1]'}`}
            style={{ width: quantity > 0 ? `${Math.round((filled / quantity) * 100)}%` : '0%' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {slots.map((value, unitIndex) => {
            const duplicate = isDuplicate(unitIndex)
            const missing = showErrors && !value.trim()
            const bad = duplicate || missing
            return (
              <div key={unitIndex} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>
                    Unit {unitIndex + 1} of {quantity}
                  </span>
                  {value.trim() && (
                    <span
                      className={`text-[10px] font-semibold ${
                        duplicate ? 'text-[#b42318]' : 'text-[#0f7b52]'
                      }`}
                    >
                      {duplicate ? '✕' : '✓'}
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-[7px] rounded-[7px] border px-2.5 py-2 ${
                    bad
                      ? 'border-[#b42318] bg-[#fdeceb]'
                      : value.trim()
                        ? 'border-[#b6e0cd] bg-white'
                        : 'border-[#e4e4e9] bg-white'
                  }`}
                >
                  <input
                    ref={(el) => {
                      inputs.current[unitIndex] = el
                    }}
                    value={value}
                    onChange={(e) => onChange(unitIndex, e.target.value)}
                    onKeyDown={(e) => advance(e, unitIndex)}
                    type="text"
                    // Every PO renders these boxes under the same field name, so
                    // the browser offers the last delivery's serial as a
                    // suggestion. A serial is unique per unit and never repeats
                    // — there is nothing useful to suggest.
                    autoComplete="off"
                    placeholder={`Serial ${unitIndex + 1}`}
                    className={`${MONO} min-w-0 flex-1 border-none bg-transparent p-0 text-[12.5px] text-[#17171c] outline-none`}
                  />
                  {value.trim() && (
                    <Tooltip label="Clear this serial" side="top" align="end">
                      <button
                        type="button"
                        onClick={() => onChange(unitIndex, '')}
                        aria-label={`Clear serial for unit ${unitIndex + 1}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Tooltip>
                  )}
                </div>

                {bad && (
                  <span className="text-[11px] text-[#b42318]">
                    {duplicate ? 'Already used on this receipt.' : 'Serial required for this unit.'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-[7px] border border-[#e4e4e9] px-2.5 py-1.5 text-[12px] text-[#5b5b6b] hover:border-[#a3a3b2] hover:text-[#17171c]"
          >
            Clear all
          </button>
          <span className="text-[11px] text-[#8b8b9b]">
            Duplicates are rejected across the whole receipt.
          </span>
        </div>
      </div>
    </div>
  )
}
