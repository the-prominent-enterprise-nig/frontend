'use client'

import { useEffect } from 'react'
import { useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  CreateTransferFormSchema,
  type CreateTransferFormValues,
} from '@/src/schema/inventory/transfers'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import {
  isCaravanBranch,
  warehouseLabel,
  type WarehouseSummary,
} from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import { NewCaravanFields } from '../../transfers/_components/CaravanDestinationFields'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTransferFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  serials: SerialNumberSummary[]
  sourceId: string
  sourceLabel: string
  warehouses: WarehouseSummary[]
  // A branch-scoped user can only host a caravan at their own branch.
  currentUserBranchId?: string | null
}

const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#3d3d4a]'
const inputClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const errorClass = 'mt-1 text-[11.5px] text-[#b42318]'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

/** The transfer the ticked units go out on — one pinned line per serial. */
function initialValues(
  serials: SerialNumberSummary[],
  sourceId: string,
  hostBranchId: string
): CreateTransferFormValues {
  return {
    fromWarehouseId: sourceId,
    toWarehouseId: '',
    destinationType: 'caravan',
    newCaravan: { hostBranchId, eventName: '', location: '', startDate: today(), endDate: '' },
    transferDate: today(),
    expectedArrival: '',
    reason: '',
    skipDestinationApproval: false,
    lines: serials.map((s) => ({
      itemId: s.item?.id ?? '',
      quantity: 1,
      serialNumberId: s.id,
      isSerialTracked: true,
    })),
  }
}

function hostOptions(
  warehouses: WarehouseSummary[],
  currentUserBranchId?: string | null
): { value: string; label: string }[] {
  return warehouses
    .filter((wh) => !!wh.branchId && !isCaravanBranch(wh.branch))
    .filter((wh) => !currentUserBranchId || wh.branchId === currentUserBranchId)
    .map((wh) => ({ value: wh.branchId as string, label: warehouseLabel(wh) }))
}

function UnitList({ serials }: { serials: SerialNumberSummary[] }): React.JSX.Element {
  return (
    <div className="max-h-[132px] overflow-y-auto rounded-[10px] border border-[#eeeef1] bg-[#fbfbfc]">
      {serials.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between gap-3 border-b border-[#f4f4f6] px-3 py-1.5 last:border-b-0"
        >
          <span className={`${MONO} text-[12px] text-[#17171c]`}>{s.serialNumber}</span>
          <span className="truncate text-[12px] text-[#5b5b6b]">{s.item?.name ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

function TransferDates({
  control,
  arrivalError,
}: {
  control: Control<CreateTransferFormValues>
  arrivalError?: string
}): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClass}>
          Transfer date <span className="text-[#b42318]">*</span>
        </label>
        <Controller
          name="transferDate"
          control={control}
          render={({ field }) => <input {...field} type="date" className={inputClass} />}
        />
      </div>
      <div>
        <label className={labelClass}>Expected arrival</label>
        <Controller
          name="expectedArrival"
          control={control}
          render={({ field }) => (
            <input {...field} value={field.value ?? ''} type="date" className={inputClass} />
          )}
        />
        {arrivalError && <p className={errorClass}>{arrivalError}</p>}
      </div>
    </div>
  )
}

export default function ConsignToCaravanModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  serials,
  sourceId,
  sourceLabel,
  warehouses,
  currentUserBranchId,
}: Props): React.JSX.Element | null {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTransferFormValues>({ resolver: zodResolver(CreateTransferFormSchema) })

  // Seeded on open only — the ticked units can't change while it's up.
  useEffect(() => {
    if (isOpen) reset(initialValues(serials, sourceId, currentUserBranchId ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset])

  if (!isOpen) return null
  const count = serials.length

  async function handleFormSubmit(data: CreateTransferFormValues): Promise<void> {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className={`${PLEX} flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e4e4e9] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#17171c]">Consign to Caravan</h2>
            <p className="mt-0.5 text-[13px] text-[#5b5b6b]">
              {count} unit{count !== 1 ? 's' : ''} from {sourceLabel} — sent on a stock transfer to
              a new caravan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-[#5b5b6b] hover:bg-[#f1f1f4]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <UnitList serials={serials} />
            <NewCaravanFields
              control={control}
              errors={errors}
              hostBranchOptions={hostOptions(warehouses, currentUserBranchId)}
              hostLocked={!!currentUserBranchId}
            />
            <TransferDates control={control} arrivalError={errors.expectedArrival?.message} />
            <div>
              <label className={labelClass}>Notes</label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="Anything the source or host branch should know"
                    className={inputClass}
                  />
                )}
              />
            </div>
            {errors.lines && (
              <p className={errorClass}>
                {errors.lines.message ?? 'Some of the ticked units can’t go to a caravan.'}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#e4e4e9] px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Consigning…' : `Consign ${count} unit${count !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
