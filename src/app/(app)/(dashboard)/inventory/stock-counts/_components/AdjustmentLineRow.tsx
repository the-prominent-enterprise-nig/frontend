'use client'

import { useWatch, type Control } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { X } from 'lucide-react'
import type { CreateAdjustmentFormValues } from '@/src/schema/inventory/stock-counts'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { BatchSummary } from '@/src/schema/inventory/batches'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/src/schema/inventory/batches'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  NON_SALEABLE_SERIAL_STATUSES,
} from '@/src/schema/inventory/serial-numbers'

const NON_SALEABLE_BATCH_STATUSES = ['quarantine', 'expired', 'recalled'] as const

type Props = {
  index: number
  control: Control<CreateAdjustmentFormValues>
  items: ItemSummary[]
  batches: BatchSummary[]
  serials: SerialNumberSummary[]
  fieldClass: string
  onRemove: () => void
}

export default function AdjustmentLineRow({
  index,
  control,
  items,
  batches,
  serials,
  fieldClass,
  onRemove,
}: Props) {
  const itemId = useWatch({ control, name: `lines.${index}.itemId` })
  const batchId = useWatch({ control, name: `lines.${index}.batchId` })
  const serialNumberId = useWatch({ control, name: `lines.${index}.serialNumberId` })

  const selectedItem = items.find((i) => i.id === itemId)
  const itemBatches = batches.filter((b) => b.item?.id === itemId)
  const itemSerials = serials.filter((s) => s.item?.id === itemId)

  const selectedBatch = itemBatches.find((b) => b.id === batchId)
  const selectedSerial = itemSerials.find((s) => s.id === serialNumberId)

  const batchIsNonSaleable =
    selectedBatch &&
    (NON_SALEABLE_BATCH_STATUSES as readonly string[]).includes(selectedBatch.status)
  const serialIsNonSaleable =
    selectedSerial && NON_SALEABLE_SERIAL_STATUSES.includes(selectedSerial.status)

  return (
    <div className="rounded-lg border border-zinc-100 p-2">
      <div className="grid grid-cols-12 items-start gap-2">
        <div className="col-span-5">
          <Controller
            name={`lines.${index}.itemId`}
            control={control}
            render={({ field }) => (
              <select {...field} className={`${fieldClass} bg-white`}>
                <option value="">Select item…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name}
                  </option>
                ))}
              </select>
            )}
          />
        </div>
        <div className="col-span-3">
          <Controller
            name={`lines.${index}.expectedQty`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                placeholder="Expected"
                className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            )}
          />
        </div>
        <div className="col-span-3">
          <Controller
            name={`lines.${index}.actualQty`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="Actual"
                className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            )}
          />
        </div>
        <div className="col-span-1 flex items-center justify-center pt-2">
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {selectedItem?.isBatchTracked && (
        <div className="mt-2 flex items-center gap-2">
          <Controller
            name={`lines.${index}.batchId`}
            control={control}
            render={({ field }) => (
              <select {...field} className={`${fieldClass} bg-white flex-1`}>
                <option value="">Select batch (optional)…</option>
                {itemBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNumber} — {BATCH_STATUS_LABELS[batch.status]}
                  </option>
                ))}
              </select>
            )}
          />
          {selectedBatch && (
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${BATCH_STATUS_COLORS[selectedBatch.status]}`}
            >
              {batchIsNonSaleable ? 'Non-saleable — ' : ''}
              {BATCH_STATUS_LABELS[selectedBatch.status]}
            </span>
          )}
        </div>
      )}

      {selectedItem?.isSerialTracked && (
        <div className="mt-2 flex items-center gap-2">
          <Controller
            name={`lines.${index}.serialNumberId`}
            control={control}
            render={({ field }) => (
              <select {...field} className={`${fieldClass} bg-white flex-1`}>
                <option value="">Select serial (optional)…</option>
                {itemSerials.map((serial) => (
                  <option key={serial.id} value={serial.id}>
                    {serial.serialNumber} — {SERIAL_STATUS_LABELS[serial.status]}
                  </option>
                ))}
              </select>
            )}
          />
          {selectedSerial && (
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${SERIAL_STATUS_COLORS[selectedSerial.status]}`}
            >
              {serialIsNonSaleable ? 'Non-saleable — ' : ''}
              {SERIAL_STATUS_LABELS[selectedSerial.status]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
