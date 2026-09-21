'use client'

import { MONO } from '../../../purchase-orders/_components/procurementTokens'
import {
  RepossessedSerialSearchCombobox,
  type RepossessedSerialMeta,
} from '@/src/components/inventory/RepossessedSerialSearchCombobox'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'

type Props = {
  itemId: string
  quantity: number
  serialIds: string[]
  labels: Record<number, string>
  showErrors: boolean
  isDuplicate: (unitIndex: number) => boolean
  onChange: (unitIndex: number, id: string, meta?: RepossessedSerialMeta, label?: string) => void
  onClose: () => void
}

/**
 * The repossession counterpart to SerialCaptureDrawer — same "one box per
 * unit" shell, but each box picks an already-sold serial of this item
 * instead of accepting typed input. See ReceiveStockLineDto's
 * existingSerialNumberIds and its schema comment for why a repossessed unit
 * can never be a freshly-typed serial number.
 */
export function RepossessedSerialCaptureDrawer({
  itemId,
  quantity,
  serialIds,
  labels,
  showErrors,
  isDuplicate,
  onChange,
  onClose,
}: Props) {
  const slots = Array.from({ length: quantity }, (_, i) => serialIds[i] ?? '')
  const filled = slots.filter((s) => s.trim()).length
  const complete = quantity > 0 && filled === quantity

  return (
    <div className="rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] px-4 py-3.5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#7c4fd1]`}>
            Repossessed units · one per unit
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className={`${MONO} text-[11.5px] font-semibold ${
                complete ? 'text-[#0b6644]' : 'text-[#8a4b06]'
              }`}
            >
              {filled} / {quantity} picked
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

        <div className="h-1.25 overflow-hidden rounded-[3px] bg-[#eeeef1]">
          <div
            className={`h-full rounded-[3px] ${complete ? 'bg-[#0f7b52]' : 'bg-[#7c4fd1]'}`}
            style={{ width: quantity > 0 ? `${Math.round((filled / quantity) * 100)}%` : '0%' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {slots.map((id, unitIndex) => {
            const duplicate = isDuplicate(unitIndex)
            const missing = showErrors && !id.trim()
            return (
              <div key={unitIndex} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>
                    Unit {unitIndex + 1} of {quantity}
                  </span>
                  {id.trim() && (
                    <span
                      className={`text-[10px] font-semibold ${
                        duplicate ? 'text-[#b42318]' : 'text-[#0f7b52]'
                      }`}
                    >
                      {duplicate ? '✕' : '✓'}
                    </span>
                  )}
                </div>

                <RepossessedSerialSearchCombobox
                  itemId={itemId}
                  value={id}
                  onChange={(pickedId) => onChange(unitIndex, pickedId)}
                  onSelect={(option: SearchComboboxOption) =>
                    onChange(
                      unitIndex,
                      option.id,
                      option.meta as RepossessedSerialMeta,
                      option.primary
                    )
                  }
                  initialLabel={labels[unitIndex]}
                  error={
                    duplicate
                      ? 'Already picked on this receipt.'
                      : missing
                        ? 'Pick a unit for this slot.'
                        : undefined
                  }
                />
              </div>
            )
          })}
        </div>

        <span className="text-[11px] text-[#8b8b9b]">
          Duplicates are rejected across the whole receipt, same as a typed serial.
        </span>
      </div>
    </div>
  )
}
