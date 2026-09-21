'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useWatch, Controller } from 'react-hook-form'
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { ChevronDown, ChevronUp, Copy, RotateCcw, Trash2 } from 'lucide-react'
import type { CreatePoFormValues } from '@/src/schema/inventory/purchase-orders'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { WarehouseSearchCombobox } from '@/src/components/inventory/WarehouseSearchCombobox'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import Tooltip from '@/src/components/ui/Tooltip'
import { PLEX, MONO } from './procurementTokens'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Display name + SKU per itemId — the form itself only carries itemId. */
export type ItemLabel = { name: string; sku?: string }

type Props = {
  control: Control<CreatePoFormValues>
  register: UseFormRegister<CreatePoFormValues>
  errors: FieldErrors<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
  /** Item name by itemId — order-independent, so prepending a line
   * doesn't shift labels onto the wrong rows. */
  initialItemLabels?: Record<string, string>
  initialSupplierLabel?: string
  initialWarehouseLabel?: string
  /** Rendered into the summary rail's footer by the parent, so the sticky
   * action bar and the rail agree on what submitting will do. */
  submitted?: boolean
}

const EMPTY_LINE = {
  itemId: '',
  quantity: 1,
  unitPrice: 0,
  description: undefined,
  notes: undefined,
  srp: undefined,
  discounts: [] as { name?: string; type: 'percentage'; value: number }[],
  isFreebie: false,
}

const CARD = 'rounded-xl border border-[#e4e4e9] bg-white'
const CARD_HEAD =
  'flex items-center justify-between gap-3.5 border-b border-[#eeeef1] px-[18px] py-[13px]'

function peso(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** SRP with every discount step applied in order — each step's output feeds
 * the next (cascading), matching the backend's own sequential rule. */
function unitFromChain(
  srp: number,
  discounts: CreatePoFormValues['lines'][number]['discounts']
): { unit: number; amounts: number[] } {
  const amounts: number[] = []
  let unit = srp
  for (const d of discounts ?? []) {
    const val = Number(d?.value)
    if (!d?.type || d.value == null || Number.isNaN(val)) {
      amounts.push(0)
      continue
    }
    const cut = d.type === 'percentage' ? unit * (val / 100) : val
    amounts.push(cut)
    unit -= cut
  }
  return { unit: Math.max(0, unit), amounts }
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function PurchaseOrderFormFields({
  control,
  register,
  errors,
  setValue,
  initialItemLabels,
  initialSupplierLabel,
  initialWarehouseLabel,
  submitted,
}: Props): React.ReactElement {
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className={`${PLEX} mx-auto flex w-full max-w-[1560px] flex-1 flex-col gap-4 p-3.5 min-[1240px]:p-5`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 min-[1240px]:grid-cols-[minmax(0,1fr)_340px]">
        <PurchaseDetailsCard
          control={control}
          register={register}
          errors={errors}
          initialSupplierLabel={initialSupplierLabel}
          initialWarehouseLabel={initialWarehouseLabel}
          submitted={submitted}
        />
        <OrderSummaryRail control={control} />
      </div>

      <LineItemsCard
        control={control}
        register={register}
        errors={errors}
        setValue={setValue}
        initialItemLabels={initialItemLabels}
        submitted={submitted}
        openLines={openLines}
        setOpenLines={setOpenLines}
        searchRef={searchRef}
      />
    </div>
  )
}

// ─── Purchase details ─────────────────────────────────────────────────────────

function PurchaseDetailsCard({
  control,
  register,
  errors,
  initialSupplierLabel,
  initialWarehouseLabel,
  submitted,
}: {
  control: Control<CreatePoFormValues>
  register: UseFormRegister<CreatePoFormValues>
  errors: FieldErrors<CreatePoFormValues>
  initialSupplierLabel?: string
  initialWarehouseLabel?: string
  submitted?: boolean
}): React.ReactElement {
  const instructions = useWatch({ control, name: 'deliveryInstructions' })

  return (
    <div className={CARD}>
      <div className={CARD_HEAD}>
        <span className="text-[13.5px] font-semibold">Purchase details</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-4 px-[18px] py-4 min-[1240px]:grid-cols-2">
        <Field label="Supplier" required>
          <Controller
            name="supplierId"
            control={control}
            render={({ field }) => (
              <SupplierSearchCombobox
                value={field.value}
                onChange={field.onChange}
                error={errors.supplierId?.message}
                initialLabel={initialSupplierLabel}
              />
            )}
          />
        </Field>

        {/* The destination is decided once here at creation and carried
            through unedited to receiving (see ReceiveAgainstPoModal, which
            locks the field once this is set). Every location is on offer,
            the standalone warehouses and each branch's own stock location
            alike, so ordering for another branch doesn't need a separate
            transfer afterward. */}
        <Field label="Location" required>
          <Controller
            name="warehouseId"
            control={control}
            render={({ field }) => (
              <WarehouseSearchCombobox
                value={field.value}
                onChange={field.onChange}
                error={errors.warehouseId?.message}
                initialLabel={initialWarehouseLabel}
              />
            )}
          />
        </Field>

        <div className="flex flex-col gap-1.5 min-[1240px]:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label
              htmlFor="po-delivery-instructions"
              className="text-[12px] font-medium text-[#3d3d4a]"
            >
              Delivery instructions
            </label>
            <span className="text-[11px] text-[#a3a3b2]">
              {(instructions ?? '').length} / 1000 characters
            </span>
          </div>
          <textarea
            id="po-delivery-instructions"
            rows={2}
            maxLength={1000}
            placeholder="Receiving hours, dock access, packaging requirements…"
            {...register('deliveryInstructions')}
            className="w-full resize-y rounded-lg border border-[#d3d3db] px-3 py-2.5 text-[13px] leading-normal text-[#3d3d4a] outline-none placeholder:text-[#a3a3b2] focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
          />
          {errors.deliveryInstructions && (
            <ErrorLine message={errors.deliveryInstructions.message ?? ''} />
          )}
        </div>
      </div>
      {submitted && null}
    </div>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#3d3d4a]">
        {label} {required && <span className="text-[#b42318]">*</span>}
      </label>
      {children}
      {error && <ErrorLine message={error} />}
    </div>
  )
}

function ErrorLine({ message }: { message: string }): React.ReactElement {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#b42318]" />
      {message}
    </span>
  )
}

// ─── Order summary ────────────────────────────────────────────────────────────

// Isolated in its own component so its useWatch({name: 'lines'}) subscription
// never shares a component instance with the useFieldArray({name: 'lines'})
// call in LineItemsCard — watching a whole array a field array is also
// managing, in the same scope, was regenerating the field array's own item
// keys on the production React build (never reproduced under `next dev`),
// forcing every line to unmount/remount on each keystroke and dropping both
// input focus and the Item combobox's selection.
function OrderSummaryRail({
  control,
}: {
  control: Control<CreatePoFormValues>
}): React.ReactElement {
  const lines = useWatch({ control, name: 'lines' })

  const totals = useMemo(() => {
    let gross = 0
    let net = 0
    let units = 0
    let freeUnits = 0
    for (const line of lines ?? []) {
      const qty = Number(line?.quantity) || 0
      units += qty
      if (line?.isFreebie) {
        freeUnits += qty
        continue
      }
      // A line priced by hand carries no SRP — its own unit price is the
      // only "before discounts" figure there is, so Subtotal at SRP counts
      // that rather than reading as ₱0 against a non-zero grand total.
      gross += (Number(line?.srp) || Number(line?.unitPrice) || 0) * qty
      net += (Number(line?.unitPrice) || 0) * qty
    }
    return { gross, net, units, freeUnits, lineCount: (lines ?? []).length }
  }, [lines])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={`${CARD} flex h-full flex-col overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#eeeef1] px-4 py-[13px]">
          <span className="text-[13px] font-semibold">Order summary</span>
          <span className={`${MONO} text-[10px] tracking-[.08em] text-[#a3a3b2]`}>PHP</span>
        </div>

        <div className="flex flex-1 flex-col gap-[9px] px-4 py-3.5">
          <SummaryRow label="Subtotal at SRP" value={peso(totals.gross)} />
          <SummaryRow
            label="Total discounts"
            value={`−${peso(Math.max(0, totals.gross - totals.net))}`}
            valueClass="text-[#0b6644]"
          />
          <div className="flex items-baseline justify-between gap-2.5 border-t border-[#eeeef1] pt-[9px] text-[11.5px] text-[#8b8b9b]">
            <span>Lines / units</span>
            <span className={MONO}>
              {totals.lineCount} / {totals.units.toLocaleString('en-PH')}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2.5 text-[11.5px] text-[#8b8b9b]">
            <span>Freebies (not billed)</span>
            <span className={MONO}>
              {totals.freeUnits ? `${totals.freeUnits.toLocaleString('en-PH')} units` : 'None'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#eee7fb] bg-[#faf7ff] px-4 py-[13px]">
          <span className="text-[11.5px] text-[#5b5b6b]">Grand total</span>
          <span className={`${MONO} text-[20px] font-semibold tracking-[-.01em] text-[#3f1490]`}>
            ₱{peso(totals.net)}
          </span>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2.5 text-[12.5px]">
      <span className="text-[#5b5b6b]">{label}</span>
      <span className={`${MONO} ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}

// ─── Line items ───────────────────────────────────────────────────────────────

const LINE_GRID =
  'grid grid-cols-[28px_minmax(0,1fr)_60px_112px_136px_112px_116px_44px_52px] gap-x-2 items-center'
// Header keeps items-center; rows top-align so a wrapped item name doesn't
// drag the numeric cells down with it.
const LINE_GRID_ROW =
  'grid grid-cols-[28px_minmax(0,1fr)_60px_112px_136px_112px_116px_44px_52px] gap-x-2 items-start'

function LineItemsCard({
  control,
  register,
  errors,
  setValue,
  initialItemLabels,
  submitted,
  openLines,
  setOpenLines,
  searchRef,
}: {
  control: Control<CreatePoFormValues>
  register: UseFormRegister<CreatePoFormValues>
  errors: FieldErrors<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
  initialItemLabels?: Record<string, string>
  submitted?: boolean
  openLines: Record<string, boolean>
  setOpenLines: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  searchRef: React.RefObject<HTMLDivElement | null>
}): React.ReactElement {
  const { fields, append, insert, remove } = useFieldArray({ control, name: 'lines' })

  // Names/SKUs for lines the form only knows by itemId: seeded from the
  // record being edited, then extended as the catalog search adds lines.
  const [labels, setLabels] = useState<Record<string, ItemLabel>>({})
  const [nonce, setNonce] = useState(0)
  const merged: Record<string, ItemLabel> = useMemo(() => {
    const seed: Record<string, ItemLabel> = {}
    for (const [id, name] of Object.entries(initialItemLabels ?? {})) seed[id] = { name }
    return { ...seed, ...labels }
  }, [initialItemLabels, labels])

  const anyOpen = Object.values(openLines).some(Boolean)

  const addFromCatalog = (option: SearchComboboxOption): void => {
    setLabels((s) => ({ ...s, [option.id]: { name: option.primary, sku: option.secondary } }))
    // SRP is deliberately left blank — it is the price on THIS supplier's
    // quote, which the item's own last cost is not a safe stand-in for.
    append({ ...EMPTY_LINE, itemId: option.id })
    setNonce((n) => n + 1)
  }

  return (
    <div className={`${CARD} flex flex-1 flex-col`}>
      <div className={`${CARD_HEAD} flex-wrap`}>
        <div className="flex items-center gap-2.5">
          <span className="text-[13.5px] font-semibold">
            Line items <span className="text-[#b42318]">*</span>
          </span>
          <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
            {fields.length} {fields.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        {/* Catalog search — adds a line per pick, sitting inline beside the
            section label. The nonce remounts it after each pick so it resets
            to empty, ready for the next item (it has no clear-on-select of
            its own). */}
        <div ref={searchRef} className="min-w-[220px] flex-1">
          <ItemSearchCombobox
            key={nonce}
            value=""
            onChange={() => {}}
            onSelect={addFromCatalog}
            compact
            placeholder="Search item by name or SKU to add a line…"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next: Record<string, boolean> = {}
              if (!anyOpen) fields.forEach((_, i) => (next[String(i)] = true))
              setOpenLines(next)
            }}
            className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12.5px] text-[#5b5b6b] hover:border-[#a3a3b2] hover:text-[#17171c]"
          >
            {anyOpen ? 'Collapse all stacks' : 'Expand all stacks'}
          </button>
          <button
            type="button"
            onClick={() => searchRef.current?.querySelector('button')?.click()}
            className="rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
          >
            + Add item
          </button>
        </div>
      </div>

      {errors.lines && !Array.isArray(errors.lines) && (
        <div className="px-[18px] pt-3">
          <ErrorLine message={errors.lines.message ?? ''} />
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {fields.length === 0 ? (
          <div className="px-[18px] pb-5 pt-[26px]">
            <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-[#d3d3db] bg-[#fbfbfc] px-[22px] py-[30px] text-center">
              <div className="h-8 w-8 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb]" />
              <div className="mt-1 text-[14px] font-semibold">No line items yet</div>
              <div className="max-w-[430px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                Search the catalog below to add a line. Discounts can be stacked on any line at any
                point.
              </div>
              <button
                type="button"
                onClick={() => searchRef.current?.querySelector('button')?.click()}
                className="mt-3 rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
              >
                Search items
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Wide: table */}
            <div className="hidden min-[1240px]:block">
              <div
                className={`${LINE_GRID} ${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-[18px] py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
              >
                <span />
                <span>Item / SKU</span>
                <span className="text-right">Qty</span>
                <span className="text-right">SRP</span>
                <span>Discounts</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Line total</span>
                <span className="text-center">Free</span>
                <span />
              </div>
              {fields.map((field, index) => (
                <LineRow
                  key={field.id}
                  narrow={false}
                  control={control}
                  register={register}
                  errors={errors}
                  setValue={setValue}
                  index={index}
                  lineCount={fields.length}
                  labels={merged}
                  submitted={submitted}
                  open={!!openLines[String(index)]}
                  onToggle={() =>
                    setOpenLines((s) => ({ ...s, [String(index)]: !s[String(index)] }))
                  }
                  onRemove={() => remove(index)}
                  onDuplicate={(line) => insert(index + 1, line)}
                  onLabel={(id, label) => setLabels((s) => ({ ...s, [id]: label }))}
                />
              ))}
            </div>

            {/* Narrow: cards */}
            <div className="flex flex-col gap-2.5 p-3 min-[1240px]:hidden">
              {fields.map((field, index) => (
                <LineRow
                  key={field.id}
                  narrow
                  control={control}
                  register={register}
                  errors={errors}
                  setValue={setValue}
                  index={index}
                  lineCount={fields.length}
                  labels={merged}
                  submitted={submitted}
                  open={!!openLines[String(index)]}
                  onToggle={() =>
                    setOpenLines((s) => ({ ...s, [String(index)]: !s[String(index)] }))
                  }
                  onRemove={() => remove(index)}
                  onDuplicate={(line) => insert(index + 1, line)}
                  onLabel={(id, label) => setLabels((s) => ({ ...s, [id]: label }))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── One line ─────────────────────────────────────────────────────────────────

type LineRowProps = {
  narrow: boolean
  control: Control<CreatePoFormValues>
  register: UseFormRegister<CreatePoFormValues>
  errors: FieldErrors<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
  index: number
  lineCount: number
  labels: Record<string, ItemLabel>
  submitted?: boolean
  open: boolean
  onToggle: () => void
  onRemove: () => void
  onDuplicate: (line: CreatePoFormValues['lines'][number]) => void
  onLabel: (id: string, label: ItemLabel) => void
}

// One line's whole row — its own component (not inlined in the parent's
// .map()) so the discount chain's own useFieldArray can be called per line,
// which the Rules of Hooks don't allow inside a loop within one component.
function LineRow(props: LineRowProps): React.ReactElement {
  const { control, index, setValue, submitted, labels, narrow } = props

  const {
    fields: discountFields,
    append: appendDiscount,
    remove: removeDiscount,
  } = useFieldArray({ control, name: `lines.${index}.discounts` as `lines.${number}.discounts` })

  const itemId = useWatch({ control, name: `lines.${index}.itemId` })
  const srp = useWatch({ control, name: `lines.${index}.srp` })
  const discounts = useWatch({ control, name: `lines.${index}.discounts` })
  const isFreebie = useWatch({ control, name: `lines.${index}.isFreebie` })
  const quantity = useWatch({ control, name: `lines.${index}.quantity` })
  const unitPrice = useWatch({ control, name: `lines.${index}.unitPrice` })

  // Unit Price is a real input the buyer can type the price actually
  // negotiated into. Left alone it derives from srp with every discount step
  // applied sequentially; the first keystroke in it marks the line manual
  // and the derive below stops writing over it until Reset puts it back on
  // the chain. Deriving reacts to srp/discounts via useWatch (not a
  // setValue() call chained off those fields' own onChange) so typing in SRP
  // or a discount value never fires a cross-field form update synchronously
  // inside its own change event. That re-entrant update was what dropped
  // input focus after every keystroke.
  const [manual, setManual] = useState<boolean>(() => {
    // An edit-mode line whose stored price doesn't match srp less its
    // discounts was overridden when the PO was written — keep it overridden
    // rather than silently repricing it the moment the modal opens.
    if (!srp || isFreebie) return false
    const derived = unitFromChain(Number(srp) || 0, discounts ?? []).unit
    return Math.abs((Number(unitPrice) || 0) - derived) > 0.005
  })

  useEffect(() => {
    if (isFreebie) {
      setValue(`lines.${index}.unitPrice`, 0)
      return
    }
    if (manual || !srp) return
    const derived = unitFromChain(Number(srp) || 0, discounts ?? []).unit
    setValue(`lines.${index}.unitPrice`, Number(derived.toFixed(2)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srp, discounts, isFreebie, manual, index])

  // A line priced by hand alone has no SRP for the chain to cut from, so its
  // discounts would silently take nothing off. The first discount added to
  // such a line promotes the typed unit price into SRP — that price is the
  // pre-discount one the buyer was quoted — and hands the line back to the
  // chain so the cut actually lands.
  const addDiscount = (v: { name?: string; type: 'percentage'; value: number }): void => {
    if (!isFreebie && !(Number(srp) || 0) && (Number(unitPrice) || 0) > 0) {
      setValue(`lines.${index}.srp`, Number(unitPrice) || 0)
      setManual(false)
    }
    appendDiscount(v)
  }

  const chain = unitFromChain(Number(srp) || 0, discounts)
  const qty = Number(quantity) || 0
  const unit = Number(unitPrice) || 0
  const lineTotal = isFreebie ? 0 : unit * qty
  // The pill reports what the discount chain takes off, not what the unit
  // price ended up at — an overridden price shouldn't be read back as a
  // discount nobody entered.
  const effective = Number(srp) ? (1 - chain.unit / Number(srp)) * 100 : 0

  const badQty = !!submitted && (!quantity || qty < 1)
  // A line priced by hand needs no SRP: one or the other has to give the
  // line a cost, and either alone is enough.
  const badSrp = !!submitted && !srp && !isFreebie && unit <= 0
  const badItem = !!submitted && !itemId
  const errorText = badItem
    ? 'Item is required.'
    : badQty
      ? 'Quantity must be at least 1.'
      : badSrp
        ? 'Enter the supplier’s SRP, or type a unit price directly.'
        : ''

  const label = itemId ? labels[itemId] : undefined
  const discCount = discountFields.length

  const shared = {
    ...props,
    chain,
    qty,
    unit,
    lineTotal,
    effective,
    errorText,
    badQty,
    badSrp,
    label,
    discCount,
    isFreebie: !!isFreebie,
    discountFields,
    appendDiscount: addDiscount,
    removeDiscount,
    itemId,
    srp,
    discountValues: discounts,
    // A default empty discount row still counts toward discCount but takes
    // nothing off, so "has discounts" and "is actually discounted" differ.
    discounted: (Number(srp) || 0) > 0 && chain.unit < (Number(srp) || 0),
    manual,
    // Typing in Unit price takes the line off the discount chain…
    onManualPrice: (): void => setManual(true),
    // …and Reset puts it back on it.
    onResetPrice: (): void => {
      setManual(false)
      const derived = unitFromChain(Number(srp) || 0, discounts ?? []).unit
      setValue(`lines.${index}.unitPrice`, Number(derived.toFixed(2)))
    },
    // The pill reads "+ Add discount" while the line has none, so clicking
    // it should actually add one rather than open an empty panel.
    onOpenDiscounts: (): void => {
      if (!props.open) {
        if (discountFields.length === 0) {
          addDiscount({ name: undefined, type: 'percentage', value: 0 })
        }
      } else {
        for (let i = (discounts ?? []).length - 1; i >= 0; i--) {
          const d = (discounts ?? [])[i]
          if (!Number(d?.value) && !d?.name?.trim()) removeDiscount(i)
        }
      }
      props.onToggle()
    },
  }

  return narrow ? <LineCardNarrow {...shared} /> : <LineRowWide {...shared} />
}

type RenderProps = LineRowProps & {
  chain: { unit: number; amounts: number[] }
  qty: number
  unit: number
  lineTotal: number
  effective: number
  errorText: string
  badQty: boolean
  badSrp: boolean
  label?: ItemLabel
  discCount: number
  isFreebie: boolean
  discountFields: { id: string }[]
  appendDiscount: (v: { name?: string; type: 'percentage'; value: number }) => void
  removeDiscount: (i: number) => void
  itemId?: string
  srp?: number
  discountValues?: CreatePoFormValues['lines'][number]['discounts']
  discounted: boolean
  onOpenDiscounts: () => void
  manual: boolean
  onManualPrice: () => void
  onResetPrice: () => void
}

function cellBox(bad: boolean): string {
  return `flex items-center rounded-md px-2.5 py-1.5 ${
    bad ? 'border border-[#b42318] bg-[#fdeceb]' : 'border border-[#e4e4e9] bg-white'
  }`
}

/** A right-aligned peso field. It holds whatever the user is typing verbatim
 * while focused: committing "12." as the number 12 and echoing that back
 * swallows the decimal point the moment it is typed, so centavos could never
 * be entered at all. The form still only ever sees a number. */
function MoneyInput({
  label,
  value,
  onChange,
  onType,
  emptyIsUndefined,
  disabled,
  className,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  /** Fires on every keystroke, before the value commits. */
  onType?: () => void
  /** Clearing the field yields undefined rather than 0 — for optional fields. */
  emptyIsUndefined?: boolean
  disabled?: boolean
  className?: string
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      aria-label={label}
      placeholder="0.00"
      inputMode="decimal"
      disabled={disabled}
      value={draft ?? value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, '')
        setDraft(raw)
        onType?.()
        if (raw === '') onChange(emptyIsUndefined ? undefined : 0)
        else if (!Number.isNaN(Number(raw))) onChange(Number(raw))
      }}
      onBlur={() => setDraft(null)}
      className={`${MONO} w-full border-none bg-transparent p-0 text-right text-[12.5px] outline-none disabled:text-[#a3a3b2] ${
        className ?? ''
      }`}
    />
  )
}

/** Unit price: editable, with the SRP it came off struck through beneath it —
 * or, once typed into by hand, a Reset back onto the discount chain. */
function UnitPriceCell(p: RenderProps): React.ReactElement {
  const hasSrp = (Number(p.srp) || 0) > 0
  return (
    <div className="flex min-w-0 flex-col items-end gap-px">
      <div className={`w-full ${cellBox(false)} ${p.isFreebie ? 'bg-[#f7f7f9]' : ''}`}>
        <Controller
          name={`lines.${p.index}.unitPrice`}
          control={p.control}
          render={({ field }) => (
            <MoneyInput
              label="Unit price"
              value={field.value}
              onChange={(v) => field.onChange(v ?? 0)}
              onType={p.onManualPrice}
              disabled={p.isFreebie}
            />
          )}
        />
      </div>
      {p.manual && hasSrp && !p.isFreebie ? (
        <Tooltip label="Reset to SRP less discounts" align="end">
          <button
            type="button"
            onClick={p.onResetPrice}
            className={`${MONO} flex items-center gap-1 text-[9.5px] tracking-[.04em] text-[#9a6b00] hover:text-[#3f1490]`}
          >
            <RotateCcw className="h-2.5 w-2.5" />
            MANUAL
          </button>
        </Tooltip>
      ) : p.discounted && !p.isFreebie ? (
        <span className={`${MONO} text-[9.5px] text-[#a3a3b2] line-through`}>
          {peso(Number(p.srp) || 0)}
        </span>
      ) : null}
    </div>
  )
}

function LineRowWide(p: RenderProps): React.ReactElement {
  const { index, control, open, errorText, label, itemId } = p
  return (
    <div
      className={`border-t border-[#f1f1f4] ${
        errorText ? 'bg-[#fffbfa]' : open ? 'bg-[#fdfcff]' : 'bg-white'
      }`}
    >
      <div className={`${LINE_GRID_ROW} px-[18px] py-[9px]`}>
        <span
          className={`${MONO} flex min-h-8 items-center justify-end text-[11px] text-[#a3a3b2]`}
        >
          {index + 1}
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          {itemId ? (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-medium leading-snug break-words">
                  {label?.name ?? 'Item'}
                </span>
                {p.isFreebie && <FreebieTag />}
              </div>
              <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{label?.sku ?? ''}</span>
              <InternalNoteInput index={index} control={control} />
            </>
          ) : (
            // A line with no item yet (edit-mode leftovers) still needs a
            // picker — the design assumes every line arrived via the search.
            <Controller
              name={`lines.${index}.itemId`}
              control={control}
              render={({ field }) => (
                <ItemSearchCombobox
                  value={field.value}
                  onChange={field.onChange}
                  onSelect={(o) => p.onLabel(o.id, { name: o.primary, sku: o.secondary })}
                  compact
                  placeholder="Search item…"
                />
              )}
            />
          )}
        </div>

        <div className={cellBox(p.badQty)}>
          <Controller
            name={`lines.${index}.quantity`}
            control={control}
            render={({ field }) => (
              <input
                aria-label="Quantity"
                inputMode="numeric"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)}
                className={`${MONO} w-full border-none bg-transparent p-0 text-right text-[12.5px] outline-none`}
              />
            )}
          />
        </div>

        <div className={cellBox(p.badSrp)}>
          <Controller
            name={`lines.${index}.srp`}
            control={control}
            render={({ field }) => (
              <MoneyInput
                label="Supplier SRP"
                value={field.value}
                onChange={field.onChange}
                emptyIsUndefined
              />
            )}
          />
        </div>

        <button
          type="button"
          onClick={p.onOpenDiscounts}
          className={`flex w-full items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 hover:border-[#a3a3b2] ${
            open ? 'border border-[#ddd0f7] bg-[#f1ebfb]' : 'border border-[#e4e4e9] bg-white'
          }`}
        >
          {p.discounted ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`${MONO} rounded px-1.5 py-px text-[10px] bg-[#f1ebfb] text-[#3f1490]`}
              >
                {p.discCount}
              </span>
              <span
                className={`${MONO} whitespace-nowrap text-[11.5px] font-medium text-[#3f1490]`}
              >
                −{p.effective.toFixed(1)}%
              </span>
            </span>
          ) : (
            <span className="whitespace-nowrap text-[12px] text-[#8b8b9b]">+ Add discount</span>
          )}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[#8b8b9b]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8b8b9b]" />
          )}
        </button>

        <UnitPriceCell {...p} />

        <span
          className={`${MONO} flex min-h-8 items-center justify-end text-right text-[13px] font-semibold ${
            p.isFreebie ? 'text-[#0b6644]' : 'text-[#17171c]'
          }`}
        >
          {peso(p.lineTotal)}
        </span>

        <div className="flex min-h-8 items-center justify-center">
          <FreebieBox index={index} control={control} setValue={p.setValue} />
        </div>

        <div className="flex min-h-8 items-center justify-end gap-0.5">
          <Tooltip label="Duplicate line" align="end">
            <button
              type="button"
              aria-label="Duplicate line"
              onClick={() =>
                p.onDuplicate({
                  itemId: itemId ?? '',
                  quantity: p.qty,
                  unitPrice: p.unit,
                  srp: p.srp,
                  // Copy the discount stack by value, so editing the copy
                  // never writes back into the line it came from.
                  discounts: (p.discountValues ?? []).map((d) => ({ ...d })),
                  isFreebie: p.isFreebie,
                })
              }
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#a3a3b2] hover:bg-[#f1ebfb] hover:text-[#3f1490]"
            >
              <Copy className="h-3.25 w-3.25" />
            </button>
          </Tooltip>
          <Tooltip label="Remove line" align="end">
            <button
              type="button"
              aria-label="Remove line"
              onClick={p.onRemove}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
            >
              <Trash2 className="h-3.25 w-3.25" />
            </button>
          </Tooltip>
        </div>
      </div>

      {errorText && (
        <div className="flex items-center gap-1.5 pb-2.5 pl-[66px] pr-[18px] text-[11.5px] text-[#b42318]">
          <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#b42318]" />
          {errorText}
        </div>
      )}

      {open && <DiscountStack {...p} />}
    </div>
  )
}

/** The line's `description` — kept for the buyer's own reference (e.g. a
 * pricing breakdown) and deliberately left off the printed PO and the
 * supplier-facing sheet. */
function InternalNoteInput({
  index,
  control,
}: {
  index: number
  control: Control<CreatePoFormValues>
}): React.ReactElement {
  return (
    <Controller
      name={`lines.${index}.description`}
      control={control}
      render={({ field }) => (
        <input
          aria-label="Internal note (not printed)"
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value || undefined)}
          maxLength={500}
          placeholder="Internal note (not printed)"
          className="mt-1 w-full rounded-md border border-dashed border-[#e4e4e9] bg-transparent px-2 py-1 text-[11.5px] text-[#5b5b6b] outline-none placeholder:text-[#b4b4c0] focus:border-[#a78bfa]"
        />
      )}
    />
  )
}

function FreebieTag(): React.ReactElement {
  return (
    <span
      className={`${MONO} shrink-0 rounded px-1.5 py-px text-[9.5px] tracking-[.06em] bg-[#e7f5ef] text-[#0b6644]`}
    >
      FREEBIE
    </span>
  )
}

function FreebieBox({
  index,
  control,
  setValue,
}: {
  index: number
  control: Control<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
}): React.ReactElement {
  return (
    <Controller
      name={`lines.${index}.isFreebie`}
      control={control}
      render={({ field }) => (
        <button
          type="button"
          role="checkbox"
          aria-checked={!!field.value}
          aria-label="Freebie"
          title="Freebie (supplier-given free unit — no cost)"
          onClick={() => {
            const next = !field.value
            field.onChange(next)
            if (next) setValue(`lines.${index}.unitPrice`, 0)
          }}
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border text-[11px] ${
            field.value
              ? 'border-[#0f7b52] bg-[#0f7b52] text-white'
              : 'border-[#d3d3db] bg-white text-transparent'
          }`}
        >
          ✓
        </button>
      )}
    />
  )
}

// ─── Discount stack ───────────────────────────────────────────────────────────

function DiscountStack(p: RenderProps): React.ReactElement {
  const { control, index, narrow } = p
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] ${
        narrow ? 'mx-3 mb-3' : 'mb-3.5 ml-9 mr-[18px]'
      }`}
    >
      {/* Collapse sits as a quiet icon in the panel's own corner rather than
          a labelled button in a header strip — the row's Discounts pill is
          the primary toggle, this is just the way back out once a tall stack
          has pushed that pill out of view. */}
      <span className="absolute right-2 top-2 z-10">
        <Tooltip label="Collapse discounts" side="bottom" align="end">
          <button
            type="button"
            onClick={p.onToggle}
            aria-label="Collapse discounts"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#a3a3b2] hover:bg-white hover:text-[#3f1490]"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </span>

      <div className="flex min-w-0 flex-col gap-[9px] px-4 py-[13px]">
        <div
          className={`${MONO} hidden grid-cols-[22px_minmax(0,1fr)_76px_124px_120px_28px] gap-x-2 pb-0.5 text-[9.5px] uppercase tracking-[.09em] text-[#a3a3b2] min-[1240px]:grid`}
        >
          <span />
          <span>Discount</span>
          <span className="text-center">Type</span>
          <span className="text-right">Value</span>
          <span className="text-right">Off unit</span>
          <span />
        </div>

        <div className="flex flex-col gap-1.5">
          {p.discountFields.map((field, di) => (
            <div
              key={field.id}
              className="grid grid-cols-[22px_minmax(0,1fr)_76px_124px_120px_28px] items-center gap-x-2"
            >
              <span className={`${MONO} text-center text-[10.5px] text-[#a3a3b2]`}>{di + 1}</span>

              <Controller
                name={`lines.${index}.discounts.${di}.name`}
                control={control}
                render={({ field: f }) => (
                  <input
                    aria-label="Discount name"
                    placeholder="Discount name"
                    maxLength={100}
                    value={f.value ?? ''}
                    onChange={f.onChange}
                    className="w-full rounded-[7px] border border-[#e4e4e9] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
                  />
                )}
              />

              <Controller
                name={`lines.${index}.discounts.${di}.type`}
                control={control}
                render={({ field: f }) => (
                  <Tooltip
                    label={
                      f.value === 'amount'
                        ? 'Click to switch to % (percentage off)'
                        : 'Click to switch to ₱ (fixed amount off)'
                    }
                    className="w-full"
                  >
                    <button
                      type="button"
                      aria-label={`Discount type: ${
                        f.value === 'amount' ? 'fixed amount' : 'percentage'
                      } — click to change`}
                      onClick={() => f.onChange(f.value === 'percentage' ? 'amount' : 'percentage')}
                      className={`${MONO} w-full rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] py-1.5 text-[12px] text-[#3f1490] hover:bg-[#e8ddfa]`}
                    >
                      {f.value === 'amount' ? '₱' : '%'}
                    </button>
                  </Tooltip>
                )}
              />

              <Controller
                name={`lines.${index}.discounts.${di}.value`}
                control={control}
                render={({ field: f }) => (
                  <div className="flex items-center gap-1 rounded-[7px] border border-[#e4e4e9] bg-white px-2.5 py-1.5">
                    <input
                      aria-label="Discount value"
                      inputMode="decimal"
                      value={f.value ?? ''}
                      onChange={(e) =>
                        f.onChange(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)
                      }
                      className={`${MONO} w-full border-none bg-transparent p-0 text-right text-[12.5px] outline-none`}
                    />
                    <DiscountUnit control={control} index={index} di={di} />
                  </div>
                )}
              />

              <span className={`${MONO} text-right text-[12px] text-[#b42318]`}>
                −{peso(p.chain.amounts[di] ?? 0)}
              </span>

              <Tooltip label="Remove discount" align="end">
                <button
                  type="button"
                  aria-label="Remove discount"
                  onClick={() => p.removeDiscount(di)}
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
          ))}
          {p.discountFields.length === 0 && (
            <span className="py-0.5 pl-[30px] text-[12px] text-[#8b8b9b]">
              No discounts on this line — it will be purchased at SRP.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={() => p.appendDiscount({ name: undefined, type: 'percentage', value: 0 })}
            className="rounded-[7px] border border-[#ddd0f7] bg-white px-[11px] py-1.5 text-[12px] font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
          >
            + Add discount
          </button>
          <span className="ml-auto flex items-baseline gap-2.5">
            <span className="text-[12px] font-semibold text-[#3f1490]">Unit price</span>
            <span className={`${MONO} text-[15px] font-semibold text-[#3f1490]`}>
              ₱{peso(p.unit)}
            </span>
            <span className="text-[11.5px] text-[#8b8b9b]">× {p.qty}</span>
            <span className={`${MONO} text-[13px] font-semibold`}>₱{peso(p.lineTotal)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function DiscountUnit({
  control,
  index,
  di,
}: {
  control: Control<CreatePoFormValues>
  index: number
  di: number
}): React.ReactElement {
  const type = useWatch({ control, name: `lines.${index}.discounts.${di}.type` })
  return (
    <span className={`${MONO} text-[11px] text-[#a3a3b2]`}>{type === 'amount' ? '₱' : '%'}</span>
  )
}

// ─── Narrow card ──────────────────────────────────────────────────────────────

function LineCardNarrow(p: RenderProps): React.ReactElement {
  const { control, index, open, errorText, label, itemId } = p
  return (
    <div
      className={`overflow-hidden rounded-[11px] border bg-white ${
        errorText ? 'border-[#f3c9c5]' : 'border-[#e4e4e9]'
      }`}
    >
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            {itemId ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium leading-snug">
                    {label?.name ?? 'Item'}
                  </span>
                  {p.isFreebie && <FreebieTag />}
                </div>
                <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{label?.sku ?? ''}</span>
                <InternalNoteInput index={index} control={control} />
              </>
            ) : (
              <Controller
                name={`lines.${index}.itemId`}
                control={control}
                render={({ field }) => (
                  <ItemSearchCombobox
                    value={field.value}
                    onChange={field.onChange}
                    onSelect={(o) => p.onLabel(o.id, { name: o.primary, sku: o.secondary })}
                    compact
                    placeholder="Search item…"
                  />
                )}
              />
            )}
          </div>
          <Tooltip label="Remove line" align="end">
            <button
              type="button"
              aria-label="Remove line"
              onClick={p.onRemove}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
            >
              <Trash2 className="h-3.75 w-3.75" />
            </button>
          </Tooltip>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Controller
            name={`lines.${index}.quantity`}
            control={control}
            render={({ field }) => (
              <div className="flex items-center overflow-hidden rounded-lg border border-[#d3d3db]">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => field.onChange(Math.max(0, (Number(field.value) || 0) - 1))}
                  className="flex h-10 w-11 items-center justify-center border-r border-[#e4e4e9] bg-white text-[16px] text-[#5b5b6b]"
                >
                  −
                </button>
                <input
                  aria-label="Quantity"
                  inputMode="numeric"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)
                  }
                  className={`${MONO} h-10 w-14 border-none text-center text-[13px] outline-none`}
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => field.onChange((Number(field.value) || 0) + 1)}
                  className="flex h-10 w-11 items-center justify-center border-l border-[#e4e4e9] bg-white text-[16px] text-[#5b5b6b]"
                >
                  +
                </button>
              </div>
            )}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="shrink-0 text-[12px] text-[#5b5b6b]">Unit price</span>
            <div className="min-w-0 flex-1">
              <UnitPriceCell {...p} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-[#5b5b6b]">SRP</span>
          <Controller
            name={`lines.${index}.srp`}
            control={control}
            render={({ field }) => (
              <div className={`flex-1 ${cellBox(p.badSrp)}`}>
                <MoneyInput
                  label="Supplier SRP"
                  value={field.value}
                  onChange={field.onChange}
                  emptyIsUndefined
                />
              </div>
            )}
          />
        </div>

        <button
          type="button"
          onClick={p.onOpenDiscounts}
          className="flex min-h-11 w-full items-center justify-between gap-2.5 rounded-lg border border-[#ddd0f7] bg-[#f7f3ff] px-[11px] py-2.5"
        >
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#3f1490]">
            {p.discounted && (
              <span className={`${MONO} rounded bg-white px-1.5 py-px text-[10px]`}>
                {p.discCount}
              </span>
            )}
            {p.discounted ? `discounts · −${p.effective.toFixed(1)}%` : 'Add discount'}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[#7c4fd1]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#7c4fd1]" />
          )}
        </button>

        {errorText && <ErrorLine message={errorText} />}
      </div>

      {open && <DiscountStack {...p} />}

      <div className="flex items-center justify-between gap-2.5 border-t border-[#eeeef1] bg-[#fbfbfc] px-3 py-2.5">
        <FreebieToggleNarrow index={index} control={control} setValue={p.setValue} />
        <div className="flex items-baseline gap-2">
          <span className="text-[11.5px] text-[#8b8b9b]">Line total</span>
          <span
            className={`${MONO} text-[13px] font-semibold ${
              p.isFreebie ? 'text-[#0b6644]' : 'text-[#17171c]'
            }`}
          >
            ₱{peso(p.lineTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

function FreebieToggleNarrow({
  index,
  control,
  setValue,
}: {
  index: number
  control: Control<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
}): React.ReactElement {
  return (
    <Controller
      name={`lines.${index}.isFreebie`}
      control={control}
      render={({ field }) => (
        <button
          type="button"
          role="checkbox"
          aria-checked={!!field.value}
          aria-label="Freebie"
          onClick={() => {
            const next = !field.value
            field.onChange(next)
            if (next) setValue(`lines.${index}.unitPrice`, 0)
          }}
          className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-[11px] py-1.5 text-[12px] ${
            field.value
              ? 'border-[#b6e0cd] bg-[#e7f5ef] text-[#0b6644]'
              : 'border-[#d3d3db] bg-white text-[#5b5b6b]'
          }`}
        >
          {field.value ? '✓ Freebie' : 'Mark as freebie'}
        </button>
      )}
    />
  )
}
