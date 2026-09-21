'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
  X,
  Loader2,
  Trash2,
  AlertTriangle,
  ArrowRight,
  PackageSearch,
  Check,
  Search,
} from 'lucide-react'
import {
  CreateTransferFormSchema,
  CreateTransferFormValues,
  type CreateTransferLineValues,
  type TransferSummary,
} from '@/src/schema/inventory/transfers'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ConsignToBranchFormValues } from '@/src/schema/inventory/serial-numbers'
import { getItem } from '../../items/_actions/get-item'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
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
  // line for the item being looked at. Only a count — the exact units are
  // the source's call at dispatch, so a selection made over there can't be
  // carried through as a binding choice.
  initialDraft?: {
    fromWarehouseId: string
    itemId: string
    itemLabel?: string
    quantity: number
  } | null
  // Sending stock out for a caravan starts on this screen too, but it is not
  // a transfer — ownership never moves, so there is no destination branch,
  // no dispatch and no receipt. It goes to the consign endpoint instead,
  // which is why it takes its own submit handler rather than reusing
  // onSubmit with a flag.
  onConsign?: (
    serialNumberIds: string[],
    data: ConsignToBranchFormValues
  ) => Promise<ApiResponse<unknown>>
  isConsigning?: boolean
  // Set to turn this screen into an edit of an existing, undispatched
  // request instead of a new one. The whole form is reused rather than given
  // a second copy: an edit submits the same complete request shape a create
  // does (the backend replaces the request wholesale and re-routes it), so
  // the two differ only in where the initial values come from and where the
  // submit goes. Consignment is hidden entirely while editing — a caravan
  // was never a transfer, so an existing transfer can't become one.
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
// auto-generated "{branch} Warehouse" name.
function branchLabel(wh: WarehouseSummary): string {
  return wh.branch?.name ?? wh.name
}

const inputClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

// Stable reference for useWatch's fallback below — `?? []` inline would hand
// back a fresh array every render, which the issues useMemo then sees as a
// changed dependency on every render regardless of whether the lines
// themselves actually changed.
const EMPTY_LINES: CreateTransferFormValues['lines'] = []
const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#3d3d4a]'
/** Stable empty default for a row's picked-serial list — see EMPTY_LINES. */
const EMPTY_IDS: string[] = []
/** Same stable-reference trick for a row's fetched serial list. */
const EMPTY_SERIAL_ROWS: never[] = []
/** How many unit checkboxes a consignment row shows before the rest go
 * behind a "see more" — a branch can hold hundreds of one model. */
const SERIAL_PREVIEW_COUNT = 30

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
  /** Consignment mode: the row picks the exact units going out instead of a
   * quantity. Unlike a transfer — where the source decides at dispatch what
   * physically leaves — a consignment names its units up front, because the
   * consign endpoint marks those specific serials and nothing downstream
   * ever gets a chance to choose them. */
  consignMode?: boolean
  pickedSerialIds?: string[]
  onPickedSerialIdsChange?: (ids: string[]) => void
  serialError?: string
}

function TransferLineRow({
  control,
  index,
  canRemove,
  onRemove,
  itemError,
  quantityError,
  initialItemLabel,
  consignMode = false,
  pickedSerialIds = EMPTY_IDS,
  onPickedSerialIdsChange,
  serialError,
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
    queryKey: ['inventory-serials-available-count', fromWarehouseId, selectedItemId, consignMode],
    queryFn: () =>
      getSerialNumbers({
        warehouseId: fromWarehouseId,
        itemId: selectedItemId,
        status: 'in_stock',
        freeForTransfer: true,
        // A transfer only needs the number; a consignment has to list them,
        // since the user is picking the individual units.
        limit: consignMode ? 200 : 1,
      }),
    enabled: itemDetailQuery.isSuccess && isSerialTracked && !!fromWarehouseId && !!selectedItemId,
    staleTime: 30 * 1000,
  })
  const serialRows = serialAvailabilityQuery.data?.data?.data
  const serialOptions = useMemo(() => serialRows ?? EMPTY_SERIAL_ROWS, [serialRows])

  const [serialSearch, setSerialSearch] = useState('')
  const [showAllSerials, setShowAllSerials] = useState(false)
  const filteredSerialOptions = useMemo(() => {
    const q = serialSearch.trim().toLowerCase()
    if (!q) return serialOptions
    return serialOptions.filter((sn) => sn.serialNumber.toLowerCase().includes(q))
  }, [serialOptions, serialSearch])
  const visibleSerialOptions = showAllSerials
    ? filteredSerialOptions
    : filteredSerialOptions.slice(0, SERIAL_PREVIEW_COUNT)
  const hiddenSerialCount = filteredSerialOptions.length - visibleSerialOptions.length
  // Bulk-select only ever touches what's on screen — ticking units hidden
  // behind the search would be the opposite of what the button offers.
  const allFilteredPicked =
    filteredSerialOptions.length > 0 &&
    filteredSerialOptions.every((sn) => pickedSerialIds.includes(sn.id))

  function toggleSerial(id: string) {
    onPickedSerialIdsChange?.(
      pickedSerialIds.includes(id)
        ? pickedSerialIds.filter((x) => x !== id)
        : [...pickedSerialIds, id]
    )
  }

  function toggleAllFiltered() {
    const ids = filteredSerialOptions.map((sn) => sn.id)
    onPickedSerialIdsChange?.(
      allFilteredPicked
        ? pickedSerialIds.filter((id) => !ids.includes(id))
        : [...new Set([...pickedSerialIds, ...ids])]
    )
  }

  // Availability at the chosen source — informational only, never blocks
  // submit. The source's own accept/dispatch step is the real check, since
  // actual stock can shift between a request and its dispatch.
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

  // Form-only field carrying whether this line's item is serial-tracked, so
  // handleFormSubmit knows which lines to split into single-unit lines
  // without re-deriving it.
  const isTrackedController = useController({
    control,
    name: `lines.${index}.isSerialTracked`,
  })
  useEffect(() => {
    isTrackedController.field.onChange(isSerialTracked)
    // Only re-run when the tracked-ness itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSerialTracked])

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
          {consignMode ? (
            <span
              className={`${MONO} block text-center text-[15px] ${
                pickedSerialIds.length > 0 ? 'font-semibold text-[#17171c]' : 'text-[#a3a3b2]'
              }`}
            >
              {pickedSerialIds.length}
            </span>
          ) : (
            <input
              {...quantityController.field}
              type="number"
              min="1"
              step="1"
              placeholder="Qty"
              aria-label="Units to send"
              className={`${inputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              onChange={(e) =>
                quantityController.field.onChange(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
            />
          )}
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
        <p className="mt-1.5 pl-0.5 text-[11.5px] text-[#b42318]">{quantityError}</p>
      )}

      {!consignMode && showAvailability && (
        <p
          className={`mt-1 pl-0.5 text-[11.5px] ${
            exceedsAvailable ? 'font-medium text-[#8a4b06]' : 'text-[#8b8b9b]'
          }`}
        >
          {exceedsAvailable
            ? `Only ${available} available at the source (requesting ${quantityValue}).`
            : `Available at the source: ${available}`}
        </p>
      )}

      {consignMode && !isSerialTracked && selectedItemId && (
        <p className="mt-2 pl-0.5 text-[11.5px] font-medium text-[#8a4b06]">
          Only serial-tracked items can go out on a caravan — a consignment marks specific units,
          and this item has none to mark.
        </p>
      )}

      {consignMode && isSerialTracked && !fromWarehouseId && (
        <p className="mt-2 pl-0.5 text-[11px] text-[#5b5b6b]">
          Pick a source branch first, so this only shows units actually there.
        </p>
      )}

      {consignMode && isSerialTracked && fromWarehouseId && (
        <div
          data-testid="consign-pick-panel"
          className="mt-2.5 rounded-[9px] border border-[#ddd0f7] bg-[#fcfaff] p-2.5"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p
              className={`${MONO} text-[9.5px] font-semibold tracking-[.08em] text-[#7c4fd1] uppercase`}
            >
              Pick the units going out
            </p>
            {serialOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className={`${MONO} text-[10.5px] font-semibold ${
                    pickedSerialIds.length > 0 ? 'text-[#0b6644]' : 'text-[#8a4b06]'
                  }`}
                >
                  {pickedSerialIds.length} of {serialOptions.length} picked
                </span>
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  disabled={filteredSerialOptions.length === 0}
                  className="rounded-[6px] border border-[#ddd0f7] bg-white px-2 py-1 text-[10.5px] font-medium text-[#3f1490] hover:bg-[#f1ebfb] disabled:opacity-40"
                >
                  {allFilteredPicked
                    ? 'Clear all'
                    : serialSearch.trim()
                      ? `Select all ${filteredSerialOptions.length} matches`
                      : 'Select all'}
                </button>
              </div>
            )}
          </div>

          {serialOptions.length > 0 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b8b9b]" />
              <input
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                type="text"
                placeholder="Search serial number…"
                className="w-full rounded-[7px] border border-[#ddd0f7] bg-white py-1.5 pr-7 pl-7 text-[11.5px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
              />
              {serialSearch && (
                <button
                  type="button"
                  onClick={() => setSerialSearch('')}
                  title="Clear search"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[5px] p-0.5 text-[#8b8b9b] hover:bg-[#f1ebfb] hover:text-[#3f1490]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {serialAvailabilityQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-[7px] bg-[#eeeef1]" />
              ))}
            </div>
          ) : serialOptions.length === 0 ? (
            <p className="text-[11px] font-medium text-[#8a4b06]">
              No in-stock units of this item at the source.
            </p>
          ) : filteredSerialOptions.length === 0 ? (
            <p className="text-[11px] text-[#5b5b6b]">
              No unit here matches &ldquo;{serialSearch.trim()}&rdquo;.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {visibleSerialOptions.map((sn) => {
                  const checked = pickedSerialIds.includes(sn.id)
                  return (
                    <Tooltip
                      key={sn.id}
                      label={checked ? 'Click to remove this unit' : 'Click to select this unit'}
                      className="w-full"
                    >
                      <button
                        type="button"
                        data-testid="consign-pick-card"
                        aria-pressed={checked}
                        onClick={() => toggleSerial(sn.id)}
                        className={`flex w-full items-center gap-1.5 rounded-[7px] border px-2 py-1.5 text-left ${
                          checked
                            ? 'border-[#5b21b6] bg-[#f7f3ff]'
                            : 'border-[#e4e4e9] bg-white hover:border-[#ddd0f7]'
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                            checked
                              ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                              : 'border-[#d3d3db] bg-white'
                          }`}
                        >
                          {checked && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span
                          className={`${MONO} truncate text-[10.5px] font-medium text-[#17171c]`}
                        >
                          {sn.serialNumber}
                        </span>
                      </button>
                    </Tooltip>
                  )
                })}
              </div>

              {hiddenSerialCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllSerials(true)}
                  className="mt-2 w-full rounded-[7px] border border-[#ddd0f7] bg-white py-1.5 text-[11px] font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
                >
                  See {hiddenSerialCount} more {hiddenSerialCount === 1 ? 'unit' : 'units'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {serialError && <p className="mt-1.5 pl-0.5 text-[11.5px] text-[#b42318]">{serialError}</p>}
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
  onConsign,
  isConsigning = false,
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

  // Consignment lives outside react-hook-form: it doesn't submit a
  // CreateTransferFormValues at all, it calls the consign endpoint with the
  // units picked below. Keeping it out of the resolver means the transfer
  // schema can't start half-describing something that isn't a transfer.
  const [isConsignment, setIsConsignment] = useState(false)
  const [destKind, setDestKind] = useState<'branch' | 'venue'>('venue')
  const [hostBranchId, setHostBranchId] = useState('')
  const [venue, setVenue] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [eventEnd, setEventEnd] = useState('')
  // One picked-serial list per line index, keyed by the field array's own id
  // so removing a line can't shift another line's picks onto it.
  const [pickedByLine, setPickedByLine] = useState<Record<string, string[]>>({})
  // react-hook-form's isSubmitted never flips in consignment mode (the
  // resolver is bypassed entirely), so inline errors need their own "they
  // have tried once" signal.
  const [consignSubmitTried, setConsignSubmitTried] = useState(false)

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
              lines: collapseLinesForEdit(editing.lines ?? []),
            }
          : {
              fromWarehouseId: initialDraft?.fromWarehouseId ?? '',
              toWarehouseId: lockedToWarehouseId ?? '',
              transferDate: today,
              expectedArrival: '',
              reason: '',
              lines: initialDraft
                ? [
                    {
                      itemId: initialDraft.itemId,
                      quantity: initialDraft.quantity,
                      itemLabel: initialDraft.itemLabel,
                    },
                  ]
                : [],
            }
      )
      setAddItemKey((k) => k + 1)
      setIsConsignment(false)
      setDestKind('venue')
      setHostBranchId('')
      setVenue('')
      setEventName('')
      setEventStart('')
      setEventEnd('')
      setPickedByLine({})
      setConsignSubmitTried(false)
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

  // In consignment mode a line's "how many" is however many units are
  // ticked on it, not the quantity box (which isn't shown).
  const pickedSerialIds = useMemo(
    () => fields.flatMap((f) => pickedByLine[f.id] ?? EMPTY_IDS),
    [fields, pickedByLine]
  )
  const totalUnits = isConsignment
    ? pickedSerialIds.length
    : watchedLines.reduce((sum, l) => sum + (Number(l?.quantity) || 0), 0)
  const hasSerialTrackedLine = watchedLines.some((l) => l?.isSerialTracked)

  // Consignment's own required fields, checked by hand because they sit
  // outside the resolver (see the state block above).
  const consignDestinationMissing =
    isConsignment && (destKind === 'venue' ? !venue.trim() : !hostBranchId)
  const consignEventNameMissing = isConsignment && !eventName.trim()
  const consignNothingPicked = isConsignment && pickedSerialIds.length === 0
  const consignEventEndInvalid = !!eventStart && !!eventEnd && eventEnd < eventStart
  const consignInvalid =
    isConsignment &&
    (consignDestinationMissing ||
      consignEventNameMissing ||
      consignNothingPicked ||
      consignEventEndInvalid ||
      !fromId)

  // Each branch has one warehouse here, so the host-branch options come off
  // the same warehouse list the route already uses rather than a second
  // branches fetch. The source branch is excluded: consigning to yourself
  // through this screen would be a no-op move with an event attached, and
  // the Serial Numbers screen already covers that case properly.
  const hostBranchOptions = useMemo(
    () =>
      warehouses
        .filter((wh) => !!wh.branchId && wh.id !== fromId)
        .map((wh) => ({ value: wh.branchId as string, label: branchLabel(wh) })),
    [warehouses, fromId]
  )

  const fromLabel = warehouses.find((w) => w.id === fromId)

  // Flat, human-readable summary of what's still wrong, shown as one panel
  // once a submit has actually been attempted. Deliberately paraphrases
  // rather than repeating a field's own inline error verbatim — reusing the
  // exact same string in two places on screen at once (the row's own error
  // and this panel) would make `getByText` locators in e2e specs ambiguous.
  const issues = useMemo(() => {
    if (!isSubmitted && !consignSubmitTried) return []
    const out: string[] = []
    if (isConsignment) {
      if (!fromId) out.push('Pick the branch these units are leaving.')
      if (consignDestinationMissing) out.push('Say where the units are going.')
      if (consignEventNameMissing) out.push('Name the caravan event.')
      if (consignNothingPicked) out.push('Tick at least one unit to send out.')
      if (consignEventEndInvalid) out.push('The event ends before it starts.')
      return out
    }
    if (errors.fromWarehouseId) out.push(errors.fromWarehouseId.message ?? 'Source is required')
    if (errors.toWarehouseId) out.push(errors.toWarehouseId.message ?? 'Destination is required')
    if (errors.transferDate) out.push(errors.transferDate.message ?? 'Transfer date is required')
    if (errors.expectedArrival) out.push(errors.expectedArrival.message ?? '')
    watchedLines.forEach((line, i) => {
      const lineErr = errors.lines?.[i]
      if (!lineErr) return
      const label = line?.itemId ? `Line ${i + 1}` : `Line ${i + 1} — no item picked yet`
      if (lineErr.itemId) out.push(`${label}: pick an item.`)
      if (lineErr.quantity) out.push(`${label}: quantity needs a fix.`)
    })
    if (typeof errors.lines?.message === 'string') out.push(errors.lines.message)
    if (errors.lines?.root?.message) out.push(errors.lines.root.message)
    return out.filter(Boolean)
  }, [
    isSubmitted,
    consignSubmitTried,
    errors,
    watchedLines,
    isConsignment,
    fromId,
    consignDestinationMissing,
    consignEventNameMissing,
    consignNothingPicked,
    consignEventEndInvalid,
  ])

  if (!isOpen) return null

  // Consignment never goes through handleSubmit — the transfer resolver
  // would reject it for the missing destination it legitimately doesn't
  // have. This is the whole submit path for that mode.
  async function handleConsignSubmit() {
    setConsignSubmitTried(true)
    if (consignInvalid || !onConsign) return
    const result = await onConsign(pickedSerialIds, {
      destinationKind: destKind,
      ...(destKind === 'venue' ? { venue: venue.trim() } : { hostBranchId }),
      eventName: eventName.trim(),
      ...(eventStart && { eventStartDate: eventStart }),
      ...(eventEnd && { eventEndDate: eventEnd }),
    })
    if (result.success) onClose()
  }

  async function handleFormSubmit(data: CreateTransferFormValues) {
    // Strip every form-only field before this reaches the server action, and
    // split a serial-tracked line asking for N units into N single-unit
    // lines — the backend enforces exactly 1 unit per serial-tracked line
    // (validateSerialLineQuantities) so each can take its own serial at
    // dispatch, but the requester shouldn't have to add the same item N
    // times to satisfy that.
    const lines = data.lines.flatMap((line) => {
      const quantity = Number(line.quantity) || 0
      if (line.isSerialTracked && quantity > 1) {
        return Array.from({ length: quantity }, () => ({ itemId: line.itemId, quantity: 1 }))
      }
      return [{ itemId: line.itemId, quantity }]
    })

    const result = await onSubmit({
      ...data,
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
                : isConsignment
                  ? 'Send Stock Out on Caravan'
                  : 'New Stock Transfer'}
            </h2>
            <p className="mt-1 text-[13px] text-[#5b5b6b]">
              {isEditing
                ? 'Saving resubmits this request for approval from the start — any sign-off it already has is cleared.'
                : isConsignment
                  ? 'Takes effect immediately — no approval, no dispatch. The units stay on your books and stay sellable here.'
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
                    {isConsignment ? 'Consignment details' : 'Transfer details'}
                  </span>
                  {/* Two different operations sharing one screen, so the
                      switch sits at the top of the card rather than inside
                      the route: everything below it changes meaning.
                      Absent while editing — a consignment is not a transfer
                      (ownership never moves, there is no dispatch and no
                      receipt), so an existing transfer cannot be turned into
                      one, and the endpoint behind it takes no transfer id. */}
                  {!isEditing && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#3d3d4a]">
                      <input
                        type="checkbox"
                        checked={isConsignment}
                        onChange={(e) => setIsConsignment(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-[#5b21b6] focus:ring-[#5b21b6]"
                      />
                      <span className="font-medium">This is a consignment</span>
                      <span className="text-[#8b8b9b]">
                        — a caravan: stock goes out, stays on your books
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
                          {isConsignment ? 'Host branch' : 'From'}{' '}
                          <span className="text-[#b42318]">*</span>
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
                              options={warehouses
                                .filter((wh) => wh.id !== lockedToWarehouseId)
                                .map((wh) => ({ value: wh.id, label: branchLabel(wh) }))}
                            />
                          )}
                        />
                        <p className="mt-1 text-[11px] text-[#5b5b6b]">
                          {isConsignment
                            ? 'Whose stock goes out — and whose books it stays on.'
                            : 'Stock leaves here.'}
                        </p>
                        {errors.fromWarehouseId && (
                          <p className="mt-1 text-[11.5px] text-[#b42318]">
                            {errors.fromWarehouseId.message}
                          </p>
                        )}
                      </div>

                      <span
                        aria-hidden="true"
                        className="mt-6.5 hidden h-7 w-7 items-center justify-center rounded-full bg-[#f1ebfb] text-[#5b21b6] sm:flex"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>

                      <div>
                        <label className={labelClass}>
                          {isConsignment ? 'Goes to' : 'To'}{' '}
                          <span className="text-[#b42318]">*</span>
                        </label>

                        {isConsignment ? (
                          <>
                            {/* Branch or venue are genuinely different
                                outcomes, not two spellings of one: a host
                                branch takes the stock in and sells it, a
                                venue is only a place it sits. */}
                            <div className="mb-2 flex gap-1.5">
                              {(
                                [
                                  { value: 'venue', label: 'A place' },
                                  { value: 'branch', label: 'Another branch' },
                                ] as const
                              ).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setDestKind(opt.value)}
                                  className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium ${
                                    destKind === opt.value
                                      ? 'border-[#5b21b6] bg-[#f1ebfb] text-[#3f1490]'
                                      : 'border-[#d3d3db] bg-white text-[#5b5b6b] hover:bg-[#fafafb]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {destKind === 'venue' ? (
                              <input
                                value={venue}
                                onChange={(e) => setVenue(e.target.value)}
                                type="text"
                                placeholder="e.g. Lemery Town Fair"
                                className={
                                  consignSubmitTried && consignDestinationMissing
                                    ? `${inputClass} border-[#b42318]`
                                    : inputClass
                                }
                              />
                            ) : (
                              <SearchableSelect
                                value={hostBranchId}
                                onChange={setHostBranchId}
                                placeholder="Search host branch…"
                                chrome={CONTROL_CHROME}
                                options={hostBranchOptions}
                              />
                            )}
                            <p className="mt-1 text-[11px] text-[#5b5b6b]">
                              {destKind === 'venue'
                                ? 'Any place with no branch of ours — a fair, a dealer, a town. These units stay yours and stay sellable here.'
                                : 'The host sells these units while they are there; they stay on your books.'}
                            </p>
                            {consignSubmitTried && consignDestinationMissing && (
                              <p className="mt-1 text-[11.5px] text-[#b42318]">
                                Say where the units are going.
                              </p>
                            )}
                          </>
                        ) : (
                          <>
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
                                    options={(currentUserBranchId
                                      ? ownBranchWarehouses
                                      : warehouses
                                    )
                                      .filter((wh) => wh.id !== fromId)
                                      .map((wh) => ({ value: wh.id, label: branchLabel(wh) }))}
                                  />
                                )
                              }
                            />
                            <p className="mt-1 text-[11px] text-[#5b5b6b]">
                              {lockedToWarehouseId
                                ? 'Requests are always routed to your own branch.'
                                : 'Stock arrives here.'}
                            </p>
                            {errors.toWarehouseId && (
                              <p className="mt-1 text-[11.5px] text-[#b42318]">
                                {errors.toWarehouseId.message}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isConsignment && (
                    <div className="rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] p-3.5">
                      <p
                        className={`${MONO} mb-2.5 text-[10px] tracking-[0.09em] text-[#7c4fd1] uppercase`}
                      >
                        Caravan event
                      </p>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <div>
                          <label className={labelClass}>
                            Name <span className="text-[#b42318]">*</span>
                          </label>
                          <input
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            type="text"
                            placeholder="e.g. Iloilo Appliance Fair 2026"
                            className={
                              consignSubmitTried && consignEventNameMissing
                                ? `${inputClass} border-[#b42318]`
                                : inputClass
                            }
                          />
                          {consignSubmitTried && consignEventNameMissing && (
                            <p className="mt-1 text-[11.5px] text-[#b42318]">
                              Name the event this stock is going out for.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={labelClass}>Starts</label>
                          <input
                            value={eventStart}
                            onChange={(e) => setEventStart(e.target.value)}
                            type="date"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Ends</label>
                          <input
                            value={eventEnd}
                            onChange={(e) => setEventEnd(e.target.value)}
                            type="date"
                            className={
                              consignEventEndInvalid ? `${inputClass} border-[#b42318]` : inputClass
                            }
                          />
                          {consignEventEndInvalid && (
                            <p className="mt-1 text-[11.5px] text-[#b42318]">
                              Must be on or after the start.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Same column template as the route grid above (with an
                      empty cell where the arrow sits) so Transfer date lines
                      up under the source and Expected arrival under the
                      destination — the dates belong to those two ends. A
                      consignment has no such journey: nothing is dispatched
                      and nothing arrives, so these don't apply to it. */}
                  <div
                    className={`grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] ${
                      isConsignment ? 'hidden' : ''
                    }`}
                  >
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

                  <div className={isConsignment ? 'hidden' : undefined}>
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
                  {canSkipApproval && !isConsignment && (
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
                    {isConsignment ? 'Units going out' : 'Items to transfer'}{' '}
                    <span className="text-[#b42318]">*</span>
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
                  <span className="text-center">{isConsignment ? 'Picked' : 'Units'}</span>
                  <span />
                </div>
              )}

              {/* Said once for the whole card rather than per row — it's how
                  serial-tracked transfers work, not a fact about one line. */}
              {hasSerialTrackedLine && !isConsignment && (
                <p className="border-b border-[#eeeef1] bg-[#fbfbfc] px-[18px] py-2 text-[11.5px] text-[#5b5b6b]">
                  Serial-tracked — the source picks which exact units leave when they dispatch.
                </p>
              )}

              {fields.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <PackageSearch className="h-7 w-7 text-[#c9c9d3]" />
                  <p className="text-[13.5px] font-semibold text-[#17171c]">No items yet</p>
                  <p className="max-w-[420px] text-[12px] leading-relaxed text-[#5b5b6b]">
                    Use the search above to add stock held at{' '}
                    {fromLabel ? branchLabel(fromLabel) : 'the source branch'}
                    {isConsignment
                      ? ', then tick the exact units going out.'
                      : ', then say how many units you need.'}
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
                    consignMode={isConsignment}
                    pickedSerialIds={pickedByLine[field.id] ?? EMPTY_IDS}
                    onPickedSerialIdsChange={(ids) =>
                      setPickedByLine((prev) => ({ ...prev, [field.id]: ids }))
                    }
                    serialError={
                      consignSubmitTried && consignNothingPicked
                        ? 'Tick at least one unit to send out.'
                        : undefined
                    }
                    initialItemLabel={
                      initialDraft && watchedLines[index]?.itemId === initialDraft.itemId
                        ? initialDraft.itemLabel
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>

            {/* Validation issues — only once a submit has actually been tried */}
            {(isSubmitted || consignSubmitTried) && issues.length > 0 && (
              <div className="rounded-xl border border-[#f3c9c5] bg-white p-[15px]">
                <div className="mb-2.5 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#b42318]" />
                  <span className="text-[12.5px] font-semibold text-[#b42318]">
                    {issues.length} {issues.length === 1 ? 'issue' : 'issues'} to resolve before
                    this can be submitted
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {issues.map((issue, i) => (
                    <li key={i} className="text-[12px] leading-relaxed text-[#3d3d4a]">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#e4e4e9] bg-white px-6 py-3.5">
          <div className="hidden sm:flex flex-col gap-0.5">
            <span className="text-[11px] text-[#5b5b6b]">
              {isConsignment ? 'Units going out' : 'Units selected'}
            </span>
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
            {/* A consignment doesn't go through the form's resolver (it
                isn't a CreateTransferFormValues), so it can't ride the
                submit event — it's a button with its own handler. */}
            {isConsignment ? (
              <button
                type="button"
                onClick={handleConsignSubmit}
                disabled={isConsigning}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
              >
                {isConsigning && <Loader2 className="h-4 w-4 animate-spin" />}
                {isConsigning
                  ? 'Consigning…'
                  : `Consign ${totalUnits} ${totalUnits === 1 ? 'Unit' : 'Units'}`}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || arrivalBeforeTransfer}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? isEditing
                    ? 'Saving…'
                    : 'Submitting…'
                  : isEditing
                    ? 'Save & Resubmit'
                    : 'Submit Request'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
