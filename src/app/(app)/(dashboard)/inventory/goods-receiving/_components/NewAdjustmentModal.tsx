'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, useWatch, Controller, type DefaultValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { Modal } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { WarehouseSearchCombobox } from '@/src/components/inventory/WarehouseSearchCombobox'
import { STALE } from '@/src/libs/query/stale-times'
import {
  ADJUSTMENT_REASON_LABELS,
  AdjustmentReasonCodeSchema,
  CreateAdjustmentFormSchema,
  type CreateAdjustmentFormValues,
} from '@/src/schema/inventory/stock-counts'
import AdjustmentLineRow from '../../stock-counts/_components/AdjustmentLineRow'
import { createAdjustment } from '../../stock-counts/_actions/create-adjustment'
import { getItems } from '../../items/_actions/get-items'
import { getBatches } from '../../batches/_actions/get-batches'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { BatchSummary } from '@/src/schema/inventory/batches'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

const FIELD =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

// Quantities start empty (not 0) so their placeholders show; the schema
// still requires both before submit.
const EMPTY_LINE = { itemId: '' } as CreateAdjustmentFormValues['lines'][number]

const DEFAULTS: DefaultValues<CreateAdjustmentFormValues> = {
  warehouseId: '',
  adjustmentDate: new Date().toISOString().slice(0, 10),
  reasonCode: 'miscounted',
  notes: '',
  lines: [EMPTY_LINE],
}

const FORM_ID = 'new-adjustment-form'

type Props = { open: boolean; onClose: () => void }

/**
 * Scenario 56 — a stock adjustment started from the Stock Ledger. Same form,
 * schema and action the stock-count flow uses (not a free-form ledger row),
 * so it goes through the usual review chain and only posts to the ledger —
 * and the GL — once approved.
 */
export default function NewAdjustmentModal({ open, onClose }: Props): React.ReactElement {
  const queryClient = useQueryClient()
  const form = useForm<CreateAdjustmentFormValues>({
    resolver: zodResolver(CreateAdjustmentFormSchema),
    defaultValues: DEFAULTS,
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const warehouseId = useWatch({ control: form.control, name: 'warehouseId' })
  const options = useAdjustmentOptions(open, warehouseId)

  useEffect(() => {
    if (open) form.reset({ ...DEFAULTS, adjustmentDate: new Date().toISOString().slice(0, 10) })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: createAdjustment,
    onSuccess: (res) => {
      if (!res.success) {
        showToast({ title: 'Failed', description: res.message, status: 'error' })
        return
      }
      showToast({ title: 'Adjustment submitted', description: res.message, status: 'success' })
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] })
      onClose()
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title="New stock adjustment"
      description="Submitted for review — it reaches the ledger once approved."
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit for review
          </button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
        className="mx-auto max-w-5xl space-y-4 rounded-xl border border-zinc-200 bg-white p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Labeled label="Location" error={form.formState.errors.warehouseId?.message}>
            <Controller
              name="warehouseId"
              control={form.control}
              render={({ field }) => (
                <WarehouseSearchCombobox value={field.value} onChange={field.onChange} />
              )}
            />
          </Labeled>
          <Labeled label="Reason">
            <Controller
              name="reasonCode"
              control={form.control}
              render={({ field }) => (
                <select {...field} className={`${FIELD} bg-white`}>
                  {AdjustmentReasonCodeSchema.options.map((code) => (
                    <option key={code} value={code}>
                      {ADJUSTMENT_REASON_LABELS[code]}
                    </option>
                  ))}
                </select>
              )}
            />
          </Labeled>
          <Labeled label="Date">
            <Controller
              name="adjustmentDate"
              control={form.control}
              render={({ field }) => <input {...field} type="date" className={FIELD} />}
            />
          </Labeled>
        </div>

        <Labeled label="Notes" error={form.formState.errors.notes?.message}>
          <Controller
            name="notes"
            control={form.control}
            render={({ field }) => (
              <textarea
                {...field}
                rows={2}
                placeholder="Why is this stock being adjusted?"
                className={`${FIELD} resize-none`}
              />
            )}
          />
        </Labeled>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Items</span>
            <button
              type="button"
              onClick={() => lines.append(EMPTY_LINE)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-prominent-purple-400 hover:text-prominent-purple-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add line
            </button>
          </div>
          {lines.fields.map((line, i) => (
            <AdjustmentLineRow
              key={line.id}
              index={i}
              control={form.control}
              items={options.items}
              batches={options.batches}
              serials={options.serials}
              fieldClass={FIELD}
              onRemove={() => lines.remove(i)}
            />
          ))}
          {typeof form.formState.errors.lines?.message === 'string' && (
            <p className="text-xs text-red-600">{form.formState.errors.lines.message}</p>
          )}
        </div>
      </form>
    </Modal>
  )
}

function Labeled({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Item/batch/serial choices for the line rows; serials follow the picked
 * location, the same way the stock-count adjust form scopes them. */
type AdjustmentOptions = {
  items: ItemSummary[]
  batches: BatchSummary[]
  serials: SerialNumberSummary[]
}

function useAdjustmentOptions(open: boolean, warehouseId: string): AdjustmentOptions {
  const items = useQuery({
    queryKey: ['adjustment-item-options'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: STALE.LOOKUP,
    enabled: open,
  })
  const batches = useQuery({
    queryKey: ['adjustment-batch-options'],
    queryFn: () => getBatches({ limit: 200 }),
    staleTime: STALE.LOOKUP,
    enabled: open,
  })
  const serials = useQuery({
    queryKey: ['adjustment-serial-options', warehouseId],
    queryFn: () => getSerialNumbers({ warehouseId, limit: 200 }),
    staleTime: STALE.OPERATIONAL,
    enabled: open && !!warehouseId,
  })
  return {
    items: items.data?.data?.data ?? [],
    batches: batches.data?.data?.data ?? [],
    serials: serials.data?.data?.data ?? [],
  }
}
