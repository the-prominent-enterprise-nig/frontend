'use client'

import { useEffect, useRef, useState } from 'react'
import {
  useForm,
  useWatch,
  useController,
  Controller,
  useFieldArray,
  type Control,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, Trash2, ArrowRight, PackageSearch } from 'lucide-react'
import {
  CreateTransferFormSchema,
  CreateTransferFormValues,
  type CreateTransferLineValues,
  type NewCaravanFormValues,
  type TransferSummary,
} from '@/src/schema/inventory/transfers'
import {
  isCaravanBranch,
  isCaravanEnded,
  warehouseLabel,
  type WarehouseSummary,
} from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import { getItem } from '../../items/_actions/get-item'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { NewCaravanFields } from './CaravanDestinationFields'
import TransferSerialPicker, { type PickedSerial } from './TransferSerialPicker'
import Tooltip from '@/src/components/ui/Tooltip'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import { getCrossBranchStock } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { PLEX, MONO, CONTROL_CHROME } from '../../purchase-orders/_components/procurementTokens'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTransferFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseSummary[]
  // A Branch Manager is always requesting stock be sent TO their own branch
  // — "To Branch" locks to it, "From Branch" stays their free choice of who
  // to ask. null/undefined (head office / Business Owner) leaves both fully
  // open, matching this project's role-hierarchy convention.
  currentUserBranchId?: string | null
  // Scenario 50 — gates the direct-transfer checkbox below. The backend
  // enforces this independently (ForbiddenException on
  // inventory:transfers:direct), so hiding the control isn't the real
  // security boundary — it just keeps someone who can't use it from being
  // offered it at all.
  canSkipApproval?: boolean
  // Deep-link from Item 360's Stock tab: seeds the source branch and one
  // line for the item being looked at. `serialIds`, when present, are the
  // exact units ticked over there — the line opens in pick-serials mode with
  // them already chosen; without it the line is a plain count.
  initialDraft?: {
    fromWarehouseId: string
    itemId: string
    itemLabel?: string
    quantity: number
    serialIds?: string[]
  } | null
  // Scenario 60 — a caravan can be created inline as the destination. It is
  // created first; its warehouse then becomes the transfer's toWarehouseId.
  onCreateCaravan?: (data: NewCaravanFormValues) => Promise<ApiResponse<{ warehouseId: string }>>
  isCreatingCaravan?: boolean
  // Gated on inventory:caravan:manage — transfers:create alone doesn't grant it.
  canCreateCaravan?: boolean
  // Set to turn this screen into an edit of an existing, undispatched
  // request instead of a new one. The whole form is reused rather than given
  // a second copy: an edit submits the same complete request shape a create
  // does (the backend replaces the request wholesale and re-routes it), so
  // the two differ only in where the initial values come from and where the
  // submit goes.
  editing?: TransferSummary | null
}

/**
 * Undoes what handleFormSubmit's split did on the way out. A serial-tracked
 * line asking for N units is sent as N single-unit lines (the backend allows
 * exactly 1 unit per serial-tracked line so each can take its own serial at
 * dispatch), so a saved request reads back as those N rows. Showing them as N
 * separate rows would misrepresent what the requester typed — and editing one
 * of them would be meaningless — so they fold back into one row of quantity N.
 *
 * Grouped by item rather than by adjacency: the backend preserves no line
 * order the client can rely on, and two rows for the same item in one request
 * are indistinguishable from a split anyway.
 *
 * Lines pinned to a specific serial need no special case here — the backend
 * refuses to edit a transfer that has any (see TransfersService.update), so
 * such a transfer never reaches this form.
 */
function collapseLinesForEdit(
  lines: NonNullable<TransferSummary['lines']>
): CreateTransferLineValues[] {
  const byItem = new Map<string, CreateTransferLineValues>()

  for (const line of lines) {
    const itemId = line.itemId ?? line.item?.id ?? ''
    if (!itemId) continue
    const existing = byItem.get(itemId)
    if (existing) {
      existing.quantity += Number(line.quantity) || 0
      continue
    }
    byItem.set(itemId, {
      itemId,
      quantity: Number(line.quantity) || 0,
      isSerialTracked: line.item?.isSerialTracked ?? false,
      itemLabel: line.item?.name,
      itemSku: line.item?.sku,
    })
  }

  return [...byItem.values()]
}

// Each branch has exactly one warehouse, so this picker is really choosing a
// branch — display the branch's own name rather than the warehouse's
// auto-generated "{branch} Warehouse" name. A caravan names its event and
// host; one whose event is over says so, since it can still be a source.
function branchLabel(wh: WarehouseSummary): string {
  const label = warehouseLabel(wh)
  return isCaravanEnded(wh.branch) ? `${label} (ended)` : label
}

const EMPTY_NEW_CARAVAN: NewCaravanFormValues = {
  hostBranchId: '',
  eventName: '',
  location: '',
  startDate: '',
  endDate: '',
}

const inputClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

// Stable reference for useWatch's fallback below — `?? []` inline would hand
// back a fresh array every render, so anything depending on it would see a
// change every render regardless of whether the lines actually changed.
const EMPTY_LINES: CreateTransferFormValues['lines'] = []
const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#3d3d4a]'

type LineRowProps = {
  control: Control<CreateTransferFormValues>
  index: number
  canRemove: boolean
  onRemove: () => void
  itemError?: string
  quantityError?: string
  // Only set for a row seeded from Item 360's "Transfer selected" deep link
  // — ItemSearchCombobox only ever learns a label from a search result the
  // user picked, so without this the row would show a bare, unlabeled id
  // until someone happened to re-search the same item.
  initialItemLabel?: string
}

function TransferLineRow({
  control,
  index,
  canRemove,
  onRemove,
  itemError,
  quantityError,
  initialItemLabel,
}: LineRowProps) {
  const selectedItemId = useWatch({ control, name: `lines.${index}.itemId` })
  const fromWarehouseId = useWatch({ control, name: 'fromWarehouseId' })
  const quantityWatched = useWatch({ control, name: `lines.${index}.quantity` })
  const quantityValue = Number(quantityWatched) || 0

  // ItemSearchCombobox searches the catalog server-side rather than from a
  // fixed pre-fetched list, so the selected item's own isSerialTracked flag
  // is looked up directly by id rather than assumed present in some list.
  const itemDetailQuery = useQuery({
    queryKey: ['inventory-item-detail', selectedItemId],
    queryFn: () => getItem(selectedItemId),
    enabled: !!selectedItemId,
    staleTime: 5 * 60 * 1000,
  })
  const isSerialTracked = itemDetailQuery.data?.data?.isSerialTracked ?? false

  // Prefer what the search result that added this line already told us, so
  // the row reads correctly from the first paint; the detail fetch is only a
  // fallback (e.g. a line seeded from Item 360's deep link, which carries a
  // name but no SKU).
  const storedLabel = useWatch({ control, name: `lines.${index}.itemLabel` })
  const storedSku = useWatch({ control, name: `lines.${index}.itemSku` })
  const itemName = storedLabel || initialItemLabel || itemDetailQuery.data?.data?.name || ''
  const itemSku = storedSku || itemDetailQuery.data?.data?.sku || ''

  // How many units of a serial-tracked item are free at the source — a
  // count only, never the list: the requester doesn't choose which one, so
  // there's nothing to enumerate. limit:1 keeps it to `total` off the
  // envelope rather than dragging hundreds of rows across for a number.
  const serialAvailabilityQuery = useQuery({
    queryKey: ['inventory-serials-available-count', fromWarehouseId, selectedItemId],
    queryFn: () =>
      getSerialNumbers({
        warehouseId: fromWarehouseId,
        itemId: selectedItemId,
        status: 'in_stock',
        freeForTransfer: true,
        limit: 1,
      }),
    enabled: itemDetailQuery.isSuccess && isSerialTracked && !!fromWarehouseId && !!selectedItemId,
    staleTime: 30 * 1000,
  })
  // Availability at the chosen source, shown as the requester types. The
  // backend refuses a request for more than the source has, and checks again
  // at dispatch, since stock can shift between the two.
  const crossBranchStockQuery = useQuery({
    queryKey: ['inventory-cross-branch-stock', selectedItemId],
    queryFn: () => getCrossBranchStock(selectedItemId),
    enabled: itemDetailQuery.isSuccess && !isSerialTracked && !!selectedItemId,
    staleTime: 30 * 1000,
  })
  const available = isSerialTracked
    ? serialAvailabilityQuery.data?.data?.total
    : crossBranchStockQuery.isSuccess
      ? (crossBranchStockQuery.data?.data?.find((b) => b.warehouse.id === fromWarehouseId)
          ?.availableQty ?? 0)
      : undefined
  const showAvailability = !!fromWarehouseId && !!selectedItemId && available !== undefined
  const exceedsAvailable = showAvailability && quantityValue > (available ?? 0)

  const quantityController = useController({ control, name: `lines.${index}.quantity` })

  const serialsController = useController({ control, name: `lines.${index}.serials` })
  const pickedSerials: PickedSerial[] = serialsController.field.value ?? []

  // A serial-tracked line's unit count is its pick — never typed separately.
  const setPicked = (next: PickedSerial[]): void => {
    serialsController.field.onChange(next)
    quantityController.field.onChange(next.length)
  }

  // Form-only field carrying whether this line's item is serial-tracked, so
  // handleFormSubmit knows which lines go out as one line per picked serial.
  // Once the item turns out to be serial-tracked, the count re-derives from
  // the pick — a seeded pick (Item 360) keeps its units; a fresh line starts
  // at none picked.
  const isTrackedController = useController({
    control,
    name: `lines.${index}.isSerialTracked`,
  })
  useEffect(() => {
    isTrackedController.field.onChange(isSerialTracked)
    if (isSerialTracked) setPicked(pickedSerials)
    // Only re-run when the tracked-ness itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSerialTracked])

  // Picked units belong to the source they were picked at — a new source
  // can't ship them. Skips the first render so a seeded pick survives.
  const prevFromRef = useRef(fromWarehouseId)
  useEffect(() => {
    if (prevFromRef.current === fromWarehouseId) return
    prevFromRef.current = fromWarehouseId
    if (isSerialTracked) setPicked([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWarehouseId])

  return (
    <div
      className={`rounded-[10px] border p-3 ${PLEX} ${itemError ? 'border-[#f3c9c5] bg-[#fffbfb]' : 'border-[#eeeef1] bg-white'}`}
    >
      <div className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-[minmax(0,1fr)_96px_40px]">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#17171c]">
            {itemName || 'Unknown item'}
          </p>
          {itemSku && <p className={`${MONO} mt-0.5 text-[11px] text-[#8b8b9b]`}>{itemSku}</p>}
          {itemError && <p className="mt-1 text-[11.5px] text-[#b42318]">{itemError}</p>}
        </div>

        <div>
          <input
            {...quantityController.field}
            type="number"
            min="1"
            step="1"
            placeholder="Qty"
            aria-label="Units to send"
            readOnly={isSerialTracked}
            title={isSerialTracked ? 'Set by the serials picked below' : undefined}
            className={`${inputClass} text-center ${isSerialTracked ? 'bg-[#f7f7f9] text-[#5b5b6b]' : ''} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            onChange={(e) =>
              quantityController.field.onChange(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </div>

        <div className="flex items-center justify-end">
          <Tooltip label="Remove line">
            <button
              type="button"
              onClick={onRemove}
              disabled={!canRemove}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {quantityError && (
        <p className="mt-1.5 pl-0.5 text-[11.5px] text-[#b42318]">
          {isSerialTracked && pickedSerials.length === 0
            ? 'Pick at least one serial'
            : quantityError}
        </p>
      )}

      {isSerialTracked && selectedItemId && (
        <div className="mt-2">
          <TransferSerialPicker
            fromWarehouseId={fromWarehouseId}
            itemId={selectedItemId}
            selected={pickedSerials}
            onChange={setPicked}
          />
        </div>
      )}

      {showAvailability && (
        <p
          className={`mt-1 pl-0.5 text-[11.5px] ${
            exceedsAvailable ? 'font-medium text-[#b42318]' : 'text-[#8b8b9b]'
          }`}
        >
          {exceedsAvailable
            ? available === 0
              ? 'Out of stock at the source — remove this line or pick another source.'
              : `Only ${available} available at the source — reduce the quantity.`
            : `Available at the source: ${available}`}
        </p>
      )}
    </div>
  )
}

export default function CreateTransferModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  currentUserBranchId,
  canSkipApproval = false,
  initialDraft = null,
  onCreateCaravan,
  isCreatingCaravan = false,
  canCreateCaravan = false,
  editing = null,
}: Props) {
  const today = new Date().toISOString().split('T')[0]
  const isEditing = !!editing

  const ownBranchWarehouses = currentUserBranchId
    ? warehouses.filter((wh) => wh.branchId === currentUserBranchId)
    : []
  // Only lock the field when it resolves to exactly one warehouse — if a
  // branch ever has more than one, a Branch Manager still needs to choose
  // among their own rather than have an arbitrary one silently picked.
  const lockedToWarehouseId =
    ownBranchWarehouses.length === 1 ? ownBranchWarehouses[0].id : undefined

  // Remounts the header's "add item" search box after each pick — it never
  // holds a confirmed value itself (each pick appends a new line instead),
  // so its own internal state has to be reset back to blank some other way.
  const [addItemKey, setAddItemKey] = useState(0)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<CreateTransferFormValues>({
    resolver: zodResolver(CreateTransferFormSchema),
    defaultValues: {
      fromWarehouseId: '',
      toWarehouseId: '',
      transferDate: today,
      expectedArrival: '',
      reason: '',
      skipDestinationApproval: false,
      destinationType: 'branch',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const fromId = watch('fromWarehouseId')
  const transferDate = watch('transferDate')
  const expectedArrival = watch('expectedArrival')
  const watchedLines = useWatch({ control, name: 'lines' }) ?? EMPTY_LINES
  // Live check (not gated behind a submit attempt) so the error and disabled
  // Save button appear the instant an invalid date is picked, not only after
  // the user tries to submit once.
  const arrivalBeforeTransfer =
    !!expectedArrival && !!transferDate && expectedArrival < transferDate

  useEffect(() => {
    if (isOpen) {
      // Re-applied on every open (not just mount) since `warehouses` loads
      // asynchronously and may not have resolved the lock yet at mount time.
      reset(
        editing
          ? {
              fromWarehouseId: editing.fromWarehouse?.id ?? '',
              // The saved destination wins over lockedToWarehouseId: the
              // lock exists to stop a Branch Manager requesting stock TO
              // somewhere that isn't theirs, and an existing request has
              // already cleared that. Overriding it here would silently
              // redirect the request being edited.
              toWarehouseId: editing.toWarehouse?.id ?? lockedToWarehouseId ?? '',
              // Date inputs need YYYY-MM-DD; the API sends full ISO stamps.
              transferDate: (editing.transferDate ?? '').slice(0, 10) || today,
              expectedArrival: (editing.expectedArrival ?? '').slice(0, 10),
              reason: editing.reason ?? '',
              skipDestinationApproval: false,
              destinationType: isCaravanBranch(editing.toWarehouse?.branch) ? 'caravan' : 'branch',
              lines: collapseLinesForEdit(editing.lines ?? []),
            }
          : {
              fromWarehouseId: initialDraft?.fromWarehouseId ?? '',
              toWarehouseId: lockedToWarehouseId ?? '',
              transferDate: today,
              expectedArrival: '',
              reason: '',
              destinationType: 'branch',
              lines: initialDraft
                ? [
                    {
                      itemId: initialDraft.itemId,
                      quantity: initialDraft.serialIds?.length || initialDraft.quantity,
                      itemLabel: initialDraft.itemLabel,
                      serials: initialDraft.serialIds?.map((id) => ({ id })),
                    },
                  ]
                : [],
            }
      )
      setAddItemKey((k) => k + 1)
    } else {
      reset({
        fromWarehouseId: '',
        toWarehouseId: '',
        transferDate: today,
        expectedArrival: '',
        reason: '',
        lines: [],
      })
    }
    // lockedToWarehouseId intentionally omitted — this must only reset on
    // the open/close transition, not on every render while the modal stays
    // open (which would wipe in-progress edits if `warehouses` re-fetches).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset, today, initialDraft, editing])

  // `warehouses` (and therefore lockedToWarehouseId) resolves asynchronously
  // and can still be empty at the moment the effect above runs on open, so
  // the locked value wouldn't otherwise reach the form state until the next
  // open/close cycle. This narrowly re-syncs just that one field — safe to
  // depend on lockedToWarehouseId directly since a locked field is never
  // something the user is actively editing.
  //
  // Skipped while editing: an existing request already has a destination,
  // and it cleared this very check when it was raised. Letting the lock
  // re-apply here would quietly redirect the request being corrected to the
  // editor's own branch the moment `warehouses` resolved.
  useEffect(() => {
    if (isOpen && !isEditing && lockedToWarehouseId) {
      setValue('toWarehouseId', lockedToWarehouseId, { shouldValidate: true })
    }
  }, [isOpen, isEditing, lockedToWarehouseId, setValue])

  const totalUnits = watchedLines.reduce((sum, l) => sum + (Number(l?.quantity) || 0), 0)

  // Scenario 60 — "For a caravan": the stock goes to a new caravan (a
  // temporary branch set up at a host branch for an event), created from the
  // details entered here. An existing caravan is never a destination; stock
  // already at one moves on by picking the caravan as the source.
  const isCaravanDestination = (watch('destinationType') ?? 'branch') === 'caravan'
  const isCreatingNewCaravan = isCaravanDestination && !!watch('newCaravan')
  const toId = watch('toWarehouseId')
  const fromWarehouse = warehouses.find((w) => w.id === fromId)
  const toWarehouse = warehouses.find((w) => w.id === toId)
  // Editing a request that already goes to a caravan keeps that caravan.
  const editingCaravanDestination = isEditing && isCaravanDestination && !isCreatingNewCaravan

  // Branch destinations never list a caravan.
  const branchDestinations = (currentUserBranchId ? ownBranchWarehouses : warehouses).filter(
    (wh) => wh.id !== fromId && !isCaravanBranch(wh.branch)
  )
  // Host branch for a new caravan: a real branch, never another caravan. A
  // branch-scoped user can only host at their own branch (the backend
  // enforces the same).
  const hostBranchOptions = (currentUserBranchId ? ownBranchWarehouses : warehouses)
    .filter((wh) => !!wh.branchId && !isCaravanBranch(wh.branch))
    .map((wh) => ({ value: wh.branchId as string, label: branchLabel(wh) }))

  // A new caravan's host defaults to where the stock is coming from — the
  // source branch itself, or a source caravan's own host. A branch-scoped
  // user can only ever host at their own branch.
  const defaultHostBranchId =
    currentUserBranchId ??
    (isCaravanBranch(fromWarehouse?.branch)
      ? (fromWarehouse?.branch?.hostBranch?.id ?? '')
      : (fromWarehouse?.branchId ?? ''))

  function setForCaravan(on: boolean): void {
    setValue('destinationType', on ? 'caravan' : 'branch')
    setValue(
      'newCaravan',
      on ? { ...EMPTY_NEW_CARAVAN, hostBranchId: defaultHostBranchId, startDate: today } : undefined
    )
    setValue('toWarehouseId', on ? '' : (lockedToWarehouseId ?? ''), {
      shouldValidate: isSubmitted,
    })
  }

  // A source picked after "For a caravan" was switched on still fills an
  // empty Host branch — never overwrites one the user already chose.
  useEffect(() => {
    if (isCreatingNewCaravan && defaultHostBranchId && !getValues('newCaravan.hostBranchId')) {
      setValue('newCaravan.hostBranchId', defaultHostBranchId)
    }
  }, [isCreatingNewCaravan, defaultHostBranchId, getValues, setValue])

  const fromLabel = warehouses.find((w) => w.id === fromId)

  if (!isOpen) return null

  // Scenario 60 — a new caravan is created before the transfer, and the
  // form is switched over to it as an existing caravan straight away: if the
  // transfer then fails, a retry reuses the caravan instead of making another.
  async function resolveDestination(data: CreateTransferFormValues): Promise<string | null> {
    if (!data.newCaravan) return data.toWarehouseId
    if (!onCreateCaravan) return null
    const created = await onCreateCaravan(data.newCaravan)
    if (!created.success || !created.data) return null
    setValue('newCaravan', undefined)
    setValue('toWarehouseId', created.data.warehouseId)
    return created.data.warehouseId
  }

  async function handleFormSubmit(data: CreateTransferFormValues) {
    // Strip every form-only field before this reaches the server action, and
    // send a serial-tracked line as one single-unit line per picked serial —
    // the backend enforces exactly 1 unit per serial-tracked line
    // (validateSerialLineQuantities), and each carries the exact unit it
    // ships, so dispatch has nothing left to choose.
    const lines = data.lines.flatMap((line) => {
      if (line.isSerialTracked) {
        return (line.serials ?? []).map((serial) => ({
          itemId: line.itemId,
          quantity: 1,
          serialNumberId: serial.id,
        }))
      }
      return [{ itemId: line.itemId, quantity: Number(line.quantity) || 0 }]
    })

    const toWarehouseId = await resolveDestination(data)
    if (!toWarehouseId) return

    const result = await onSubmit({
      ...data,
      toWarehouseId,
      newCaravan: undefined,
      lines,
      // Fields are defaulted to '' (not undefined) so their inputs stay
      // controlled from mount — but the backend DTO's @IsOptional() only
      // skips validation for undefined, not '', so an empty expectedArrival
      // would fail @IsDateString(). Normalize back to undefined here.
      expectedArrival: data.expectedArrival || undefined,
      reason: data.reason?.trim() || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className={`absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] ${PLEX}`}>
      {/* Header */}
      <div className="shrink-0 border-b border-[#e4e4e9] bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`${MONO} mb-1 text-[10.5px] uppercase tracking-[0.08em] text-[#a3a3b2]`}>
              Inventory &rsaquo; Stock transfers &rsaquo;{' '}
              {isEditing ? (editing?.transferNumber ?? 'Edit') : 'New'}
            </p>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#17171c]">
              {isEditing
                ? `Edit Request ${editing?.transferNumber ?? ''}`.trim()
                : 'New Stock Transfer'}
            </h2>
            <p className="mt-1 text-[13px] text-[#5b5b6b]">
              {isEditing
                ? 'Saving resubmits this request for approval from the start — any sign-off it already has is cleared.'
                : 'Submitted as a request — routed to the source branch, or to head office first if approval is required.'}
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
      </div>

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Transfer details */}
              <div className="rounded-xl border border-[#e4e4e9] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-[18px] py-[13px]">
                  <span className="text-[13.5px] font-semibold text-[#17171c]">
                    Transfer details
                  </span>
                  {canCreateCaravan && !isEditing && (
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#3d3d4a]">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={isCaravanDestination}
                        onChange={(e) => setForCaravan(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="relative h-[18px] w-8 shrink-0 rounded-full bg-[#d3d3db] transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-[14px] after:w-[14px] after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#5b21b6] peer-checked:after:translate-x-[14px] peer-focus-visible:ring-2 peer-focus-visible:ring-[#5b21b6]/40"
                      />
                      <span className="font-medium">For a caravan</span>
                      <span className="hidden text-[#8b8b9b] sm:inline">
                        — sending stock to a caravan event hosted at a branch
                      </span>
                    </label>
                  )}
                </div>
                <div className="flex flex-col gap-4 px-[18px] py-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`${MONO} text-[10px] font-semibold tracking-[.09em] text-[#8b8b9b] uppercase`}
                      >
                        Route
                      </span>
                    </div>

                    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <div>
                        <label className={labelClass}>
                          From <span className="text-[#b42318]">*</span>
                        </label>
                        <Controller
                          name="fromWarehouseId"
                          control={control}
                          render={({ field }) => (
                            <SearchableSelect
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              placeholder="Search source branch…"
                              chrome={CONTROL_CHROME}
                              // A Branch Manager's own branch is normally the
                              // destination, never the source — except when
                              // it is sending to a caravan it hosts.
                              options={warehouses
                                .filter(
                                  (wh) => isCaravanDestination || wh.id !== lockedToWarehouseId
                                )
                                .map((wh) => ({ value: wh.id, label: branchLabel(wh) }))}
                            />
                          )}
                        />
                        <p className="mt-1 text-[11px] text-[#5b5b6b]">
                          {isCaravanBranch(fromWarehouse?.branch)
                            ? `Caravan stock, recorded under ${fromWarehouse?.branch?.hostBranch?.name ?? 'its host branch'}.`
                            : 'Stock leaves here.'}
                        </p>
                        {errors.fromWarehouseId && (
                          <p className="mt-1 text-[11.5px] text-[#b42318]">
                            {errors.fromWarehouseId.message}
                          </p>
                        )}
                      </div>

                      {/* Hidden for "For a caravan": the caravan's details
                          below are the destination. */}
                      {!isCreatingNewCaravan && (
                        <>
                          <span
                            aria-hidden="true"
                            className="mt-6.5 hidden h-7 w-7 items-center justify-center rounded-full bg-[#f1ebfb] text-[#5b21b6] sm:flex"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>

                          <div>
                            <label className={labelClass}>
                              To <span className="text-[#b42318]">*</span>
                            </label>
                            {editingCaravanDestination ? (
                              <SearchableSelect
                                value={toId ?? ''}
                                onChange={() => {}}
                                disabled
                                chrome={CONTROL_CHROME}
                                options={
                                  toWarehouse
                                    ? [{ value: toWarehouse.id, label: branchLabel(toWarehouse) }]
                                    : []
                                }
                              />
                            ) : (
                              <Controller
                                name="toWarehouseId"
                                control={control}
                                render={({ field }) =>
                                  lockedToWarehouseId ? (
                                    <SearchableSelect
                                      value={field.value ?? ''}
                                      onChange={field.onChange}
                                      disabled
                                      chrome={CONTROL_CHROME}
                                      options={[
                                        {
                                          value: lockedToWarehouseId,
                                          label: branchLabel(ownBranchWarehouses[0]),
                                        },
                                      ]}
                                    />
                                  ) : (
                                    <SearchableSelect
                                      value={field.value ?? ''}
                                      onChange={field.onChange}
                                      placeholder="Search destination branch…"
                                      chrome={CONTROL_CHROME}
                                      options={branchDestinations.map((wh) => ({
                                        value: wh.id,
                                        label: branchLabel(wh),
                                      }))}
                                    />
                                  )
                                }
                              />
                            )}
                            <p className="mt-1 text-[11px] text-[#5b5b6b]">
                              {isCaravanDestination
                                ? ''
                                : lockedToWarehouseId
                                  ? 'Requests are always routed to your own branch.'
                                  : 'Stock arrives here.'}
                            </p>
                            {errors.toWarehouseId && (
                              <p className="mt-1 text-[11.5px] text-[#b42318]">
                                {errors.toWarehouseId.message}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {isCreatingNewCaravan && (
                    <NewCaravanFields
                      control={control}
                      errors={errors}
                      hostBranchOptions={hostBranchOptions}
                      hostLocked={!!currentUserBranchId}
                    />
                  )}
                  {/* Same column template as the route grid above (with an
                      empty cell where the arrow sits) so Transfer date lines
                      up under the source and Expected arrival under the
                      destination — the dates belong to those two ends. */}
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <div>
                      <label className={labelClass}>
                        Transfer date <span className="text-[#b42318]">*</span>
                      </label>
                      <Controller
                        name="transferDate"
                        control={control}
                        render={({ field }) => (
                          <input {...field} type="date" className={inputClass} />
                        )}
                      />
                      {errors.transferDate && (
                        <p className="mt-1 text-[11.5px] text-[#b42318]">
                          {errors.transferDate.message}
                        </p>
                      )}
                    </div>

                    <span aria-hidden="true" className="hidden w-7 sm:block" />

                    <div>
                      <label className={labelClass}>Expected arrival</label>
                      <Controller
                        name="expectedArrival"
                        control={control}
                        render={({ field }) => (
                          <input {...field} type="date" className={inputClass} />
                        )}
                      />
                      {(arrivalBeforeTransfer || errors.expectedArrival) && (
                        <p className="mt-1 text-[11.5px] text-[#b42318]">
                          {errors.expectedArrival?.message ??
                            'Expected arrival cannot be before the transfer date'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Reason</label>
                    <Controller
                      name="reason"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="e.g. Rebalancing stock for upcoming campaign"
                          className={inputClass}
                        />
                      )}
                    />
                  </div>

                  {/* Direct transfer — Scenario 50, additive to the existing
                      Stock Request flow. Both paths stay available; this only
                      changes whether the destination branch's manager has to
                      approve first. */}
                  {canSkipApproval && (
                    <div className="rounded-lg border border-[#e4e4e9] bg-[#faf9fb] px-3 py-2.5">
                      <label className="flex items-start gap-2 text-[13px] text-[#3d3d4a]">
                        <Controller
                          name="skipDestinationApproval"
                          control={control}
                          render={({ field }) => (
                            <input
                              type="checkbox"
                              checked={field.value ?? false}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="mt-0.5"
                            />
                          )}
                        />
                        <span>
                          <span className="font-medium">
                            Send directly — no destination approval required
                          </span>
                          <span className="block text-[11.5px] text-[#5b5b6b]">
                            Skips the receiving branch manager&apos;s sign-off. The stock request
                            flow is unaffected; this only applies to this transfer.
                          </span>
                          {/* A transfer doesn't record whether it was raised
                              directly, so an edit can't restore the choice —
                              it starts unticked, which routes through the
                              approval rather than around it. Said plainly
                              here because the safe default is also the
                              surprising one for whoever raised it directly. */}
                          {isEditing && (
                            <span className="mt-1 block text-[11.5px] text-[#8a4b06]">
                              If this request was raised directly, re-tick this — saving otherwise
                              sends it through the destination manager&apos;s approval.
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl border border-[#e4e4e9] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-[18px] py-[13px]">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13.5px] font-semibold text-[#17171c]">
                    Items to transfer <span className="text-[#b42318]">*</span>
                  </span>
                  <span className={`${MONO} text-[11px] text-[#5b5b6b]`}>
                    {fields.length} {fields.length === 1 ? 'line' : 'lines'} · {totalUnits} units
                  </span>
                </div>
                <div className="w-full sm:w-[520px] sm:max-w-[55%] sm:flex-1">
                  <ItemSearchCombobox
                    key={addItemKey}
                    value=""
                    onChange={() => {}}
                    onSelect={(option) => {
                      append({
                        itemId: option.id,
                        quantity: 1,
                        itemLabel: option.primary,
                        itemSku: option.secondary,
                      })
                      // The box never holds a confirmed value of its own —
                      // remount it so it drops straight back to a blank
                      // "add another" state instead of showing the last pick.
                      setAddItemKey((k) => k + 1)
                    }}
                    placeholder="Add item — search name, SKU, or serial…"
                  />
                </div>
              </div>

              {typeof errors.lines?.message === 'string' && (
                <p className="px-[18px] pt-3 text-[11.5px] text-[#b42318]">
                  {errors.lines.message}
                </p>
              )}
              {errors.lines?.root && (
                <p className="px-[18px] pt-3 text-[11.5px] text-[#b42318]">
                  {errors.lines.root.message}
                </p>
              )}

              {/* Column headings — matches each line row's own grid below */}
              {fields.length > 0 && (
                <div
                  className={`${MONO} hidden items-center gap-3 border-b border-[#eeeef1] bg-[#fbfbfc] px-[18px] py-2 text-[10px] font-semibold tracking-[.09em] text-[#8b8b9b] uppercase sm:grid sm:grid-cols-[minmax(0,1fr)_96px_40px]`}
                >
                  <span>Item / SKU</span>
                  <span className="text-center">Units</span>
                  <span />
                </div>
              )}

              {fields.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <PackageSearch className="h-7 w-7 text-[#c9c9d3]" />
                  <p className="text-[13.5px] font-semibold text-[#17171c]">No items yet</p>
                  <p className="max-w-[420px] text-[12px] leading-relaxed text-[#5b5b6b]">
                    Use the search above to add stock held at{' '}
                    {fromLabel ? branchLabel(fromLabel) : 'the source branch'}, then say how many
                    units you need.
                  </p>
                </div>
              )}

              <div className={`flex flex-col gap-2.5 ${fields.length > 0 ? 'p-[18px]' : ''}`}>
                {fields.map((field, index) => (
                  <TransferLineRow
                    key={field.id}
                    control={control}
                    index={index}
                    canRemove
                    onRemove={() => remove(index)}
                    itemError={errors.lines?.[index]?.itemId?.message}
                    quantityError={errors.lines?.[index]?.quantity?.message}
                    initialItemLabel={
                      initialDraft && watchedLines[index]?.itemId === initialDraft.itemId
                        ? initialDraft.itemLabel
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#e4e4e9] bg-white px-6 py-3.5">
          <div className="hidden sm:flex flex-col gap-0.5">
            <span className="text-[11px] text-[#5b5b6b]">Units selected</span>
            <span className={`${MONO} text-[16px] font-semibold tracking-[-0.01em] text-[#17171c]`}>
              {totalUnits}
            </span>
          </div>
          <div className="flex items-center gap-3">
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
              disabled={isSubmitting || isCreatingCaravan || arrivalBeforeTransfer}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {(isSubmitting || isCreatingCaravan) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreatingCaravan
                ? 'Creating caravan…'
                : isSubmitting
                  ? isEditing
                    ? 'Saving…'
                    : 'Submitting…'
                  : isEditing
                    ? 'Save & Resubmit'
                    : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
