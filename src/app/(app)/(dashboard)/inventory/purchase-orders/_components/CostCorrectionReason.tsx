'use client'

import { Controller, useWatch, type Control } from 'react-hook-form'
import type {
  CreatePoFormValues,
  PurchaseOrderSummary,
} from '@/src/schema/inventory/purchase-orders'
import { receivedCostChanged } from '../_lib/poEditRules'

/**
 * Asked only when the edit reprices a line that already has stock received.
 * That change is pushed to its receiving reports — the stock is revalued and
 * an adjusting entry posted — so it needs a reason, the same as correcting a
 * cost on the RR itself.
 */
export function CostCorrectionReason({
  control,
  po,
  error,
}: {
  control: Control<CreatePoFormValues>
  po: PurchaseOrderSummary
  error?: string
}): React.ReactElement | null {
  const lines = useWatch({ control, name: 'lines' })
  if (!receivedCostChanged(po, lines)) return null
  return (
    <div className="mx-5 mt-3 flex flex-col gap-1.5 rounded-lg border border-[#f7dfc0] bg-[#fdf3e7] px-4 py-3">
      <span className="text-[12.5px] font-medium text-[#8a4b06]">
        You changed the cost of a line that was already received
      </span>
      <span className="text-[12px] text-[#8a4b06]">
        Saving updates its receiving reports too: the stock is revalued and an adjusting entry is
        posted. Say why the cost changed.
      </span>
      <Controller
        name="costCorrectionReason"
        control={control}
        render={({ field }) => (
          <textarea
            {...field}
            value={field.value ?? ''}
            rows={2}
            maxLength={500}
            placeholder="e.g. Supplier invoiced a lower price than the PO"
            className="mt-1 w-full resize-y rounded-lg border border-[#e4e4e9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
          />
        )}
      />
      {error && <span className="text-[11.5px] text-[#b42318]">{error}</span>}
    </div>
  )
}
