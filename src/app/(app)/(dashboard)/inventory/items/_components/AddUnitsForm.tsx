'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, PackagePlus } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { MONO, PLEX } from '@/src/libs/design/plex'
import type { ItemSummary } from '@/src/schema/inventory/items'
import {
  AddUnitsFormSchema,
  EMPTY_BRANCH_ROW,
  parseSerialList,
  type AddUnitsFormValues,
  type BranchRow,
} from '@/src/schema/inventory/items/add-units'
import { receiveInitialAtBranches, type BranchInput } from '../_actions/receive-initial-unit'
import BranchQuantitiesTable from './BranchQuantitiesTable'
import { FormSection } from './item-form-shared'
import { useOriginOptions, useReceivingWarehouses } from './item-create-fields'

type Props = {
  item: ItemSummary
  /** Arrived straight from Add Item's Create — offer to skip instead of
   * going back. */
  isNewItem?: boolean
}

const ITEM_MASTER = '/inventory/items'

function defaultsFor(item: ItemSummary): AddUnitsFormValues {
  return {
    branches: [{ ...EMPTY_BRANCH_ROW }],
    isSerialTracked: item.isSerialTracked ?? false,
  }
}

/** The backend's machine codes, said the way a custodian would read them. */
function humanizeAddUnitsError(message: string | undefined): string {
  if (!message) return 'Could not record the units.'
  if (message.startsWith('serial_already_registered')) {
    return `Already registered: ${message.split(':')[1]?.trim() ?? ''}. Remove those serials and try again.`
  }
  if (message.startsWith('rr_already_used')) {
    return 'That RR # is already on another receiving report — use a different RR #.'
  }
  if (message.startsWith('duplicate_serial_in_request')) return 'A serial is listed more than once.'
  if (message.startsWith('rr_repeated_in_request')) return 'Two branches have the same RR #.'
  if (message.startsWith('branch_repeated')) return 'A branch is listed more than once.'
  if (message === 'warehouse_not_found') return 'One of the branches no longer exists.'
  if (message === 'unparseable_date') return 'Date in is not a valid date.'
  return message
}

/** One row as the backend takes it — serials for a serial item, a quantity
 * (and the unit it was counted in) for a non-serial one. */
function toBranchInput(row: BranchRow, isSerialTracked: boolean): BranchInput {
  const common = {
    warehouseId: row.warehouseId,
    rr: row.rr || undefined,
    // Blank date = today, blank origin = WHSE.
    dateIn: row.dateIn || undefined,
    origin: row.origin || undefined,
    price: row.price,
  }
  return isSerialTracked
    ? {
        ...common,
        serialNumbers: parseSerialList(row.serialsText),
        classification: row.classification,
      }
    : { ...common, quantity: row.quantity ?? 0, unitId: row.unitId || undefined }
}

function useSubmitUnits(item: ItemSummary): (data: AddUnitsFormValues) => Promise<void> {
  const router = useRouter()
  const queryClient = useQueryClient()
  return async (data) => {
    const res = await receiveInitialAtBranches(item.id, {
      branches: data.branches.map((row) => toBranchInput(row, data.isSerialTracked)),
    })
    if (!res.success) {
      showToast({
        title: 'Units not added',
        description: humanizeAddUnitsError(res.message),
        status: 'error',
      })
      return
    }
    showToast({ title: 'Units added', description: res.message, status: 'success' })
    queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-serial-status-count'] })
    router.push(ITEM_MASTER)
  }
}

/** Item Master → Add units, and the step after Add Item's Create. Records
 * units on hand at one or more branches — a row per branch, each its own
 * receipt — with the same rules as the bulk sheet's unit columns (both go
 * through the backend's one receipt writer). */
export default function AddUnitsForm({ item, isNewItem = false }: Props): React.JSX.Element {
  const warehouses = useReceivingWarehouses(true)
  const originOptions = useOriginOptions(true)
  const onSubmit = useSubmitUnits(item)
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddUnitsFormValues>({
    resolver: zodResolver(AddUnitsFormSchema),
    defaultValues: defaultsFor(item),
  })

  return (
    <div
      role="region"
      aria-label="Add units"
      className={`flex flex-1 flex-col bg-[#f2f2f3] ${PLEX}`}
    >
      <AddUnitsHeader item={item} isNewItem={isNewItem} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            <FormSection
              variant="card"
              title={item.isSerialTracked ? 'Units per branch' : 'Stock per branch'}
              errorCount={Object.keys(errors).length}
            >
              <BranchQuantitiesTable
                control={control}
                errors={errors}
                warehouses={warehouses}
                baseUnit={item.baseUnit ?? null}
                originOptions={originOptions}
                isSerialTracked={item.isSerialTracked ?? false}
              />
            </FormSection>
          </div>
        </div>
        <AddUnitsFooter isNewItem={isNewItem} isSubmitting={isSubmitting} />
      </form>
    </div>
  )
}

function AddUnitsHeader({
  item,
  isNewItem,
}: {
  item: ItemSummary
  isNewItem: boolean
}): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-[#e4e4e9] bg-white px-6 py-4">
      <p className={`${MONO} mb-1 text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle`}>
        Inventory &rsaquo; Item Master &rsaquo; Add units
      </p>
      <div className="flex items-start gap-3">
        <PackagePlus className="mt-1 h-5 w-5 shrink-0 text-[#5b21b6]" />
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#17171c]">
            Add units — {item.name}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {isNewItem
              ? 'Item created. Record the units already on hand, or skip if there is no stock yet.'
              : 'Record units on hand at one or more branches — each branch gets its own RR #.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function AddUnitsFooter({
  isNewItem,
  isSubmitting,
}: {
  isNewItem: boolean
  isSubmitting: boolean
}): React.JSX.Element {
  return (
    <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-4 border-t border-[#e4e4e9] bg-white px-6 py-3.5">
      <span className="hidden text-[12px] text-ink-muted sm:block">
        Required fields are marked <span className="text-[#b42318]">*</span>
      </span>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href={ITEM_MASTER}
          aria-disabled={isSubmitting}
          className={`rounded-lg px-4 py-2 text-[13px] font-medium text-ink-muted hover:bg-[#f1f1f4] ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}
        >
          {isNewItem ? 'Skip, no stock yet' : 'Back'}
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Adding…' : 'Add units'}
        </button>
      </div>
    </div>
  )
}
