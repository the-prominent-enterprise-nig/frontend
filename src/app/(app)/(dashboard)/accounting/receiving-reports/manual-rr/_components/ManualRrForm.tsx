'use client'

/* Scenario 53 — rebuilt from a single-item form into a multi-line document
 * mirroring the normal Create Receiving Report screen (ReceiveStockModal.tsx
 * + create-rr/RrDeliveryPanel.tsx), reusing its own PANEL/INPUT/
 * CONTROL_CHROME tokens directly rather than copying them, per that
 * module's own stated rule ("so the two receiving surfaces cannot drift
 * apart") — this is a third receiving surface, so the same rule applies.
 * The two real differences from that normal flow: itemId (per line) /
 * supplierId (header) are optional, satisfied instead by a typed
 * newItemName / newSourceName; and there's no PO linking and no approval
 * gate — saving here only creates a draft, posting is a separate action on
 * the detail page. A routed page, not an overlay (developer feedback: no
 * modals — see ManualRrDetail.tsx's doc comment for the fuller precedent).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, PackagePlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  CreateManualReceivingReportFormSchema,
  type CreateManualReceivingReportFormValues,
  VatTreatmentSchema,
} from '@/src/schema/inventory/manual-receiving-reports'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { locationLabel } from '@/src/libs/format/locationLabel'
import {
  CONTROL_CHROME,
  MONO,
  PLEX,
} from '../../../../inventory/purchase-orders/_components/procurementTokens'
import {
  PANEL,
  INPUT,
} from '../../../../inventory/purchase-orders/_components/receive-po/receiveTokens'
import type { ItemSearchMeta } from '../../../../inventory/purchase-requests/_components/ItemSearchCombobox'
import { getWarehouses } from '../../../../inventory/warehouses/_actions/get-warehouses'
import { createManualReceivingReport } from '../../../../inventory/manual-receiving-reports/_actions/create-manual-receiving-report'
import { showToast } from '@/src/components/ui/toast'
import ManualRrLineRow from './ManualRrLineRow'
import { manualRrTotals } from './manualRrCosting'

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-medium text-[#3d3d4a]">
        {label}
        {required && <span className="text-[#b42318]"> *</span>}
        {hint && <span className="ml-1 font-normal text-[#8b8b9b]">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] leading-[1.4] text-[#8b8b9b]">{children}</span>
}
function FieldError({ text }: { text?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#b42318]" />
      {text}
    </span>
  )
}
const fmtPeso = (n: number) => n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
function TotalRow({
  label,
  value,
  negative,
  muted,
  emphasize,
}: {
  label: string
  value: number
  negative?: boolean
  muted?: boolean
  emphasize?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-[#8b8b9b]">{label}</span>
      <span
        className={`${MONO} text-[13px] ${
          muted ? 'text-[#a3a3b2]' : emphasize ? 'font-semibold text-[#17171c]' : 'text-[#17171c]'
        }`}
      >
        {negative && value > 0 ? '−' : ''}
        {fmtPeso(value)}
      </span>
    </div>
  )
}
const toggleBtnClass = (active: boolean) =>
  `flex-1 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
    active
      ? 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'
      : 'border-[#d3d3db] text-[#5b5b6b] hover:border-[#a3a3b2]'
  }`

const defaultValues: CreateManualReceivingReportFormValues = {
  warehouseId: '',
  receivedAt: '',
  deliveryReceiptNumber: '',
  supplierInvoiceNumber: '',
  poNumber: '',
  notes: '',
  supplierId: '',
  newSourceName: '',
  vatTreatment: 'inclusive',
  lines: [{ itemId: '', quantityReceived: 1 }],
}

type LineMeta = { name?: string; isSerialTracked: boolean }

export default function ManualRrForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sourceMode, setSourceMode] = useState<'registered' | 'new'>('registered')
  const [supplierName, setSupplierName] = useState<string | undefined>(undefined)
  const [lineModes, setLineModes] = useState<Record<string, 'catalog' | 'other'>>({})
  // Keyed by itemId, not field.id — a duplicated line copies the same
  // itemId, so its serial-tracked-ness/display name resolve correctly with
  // zero extra bookkeeping (field.id is a fresh, unknowable value the
  // instant a line is inserted, so keying on it would lose this metadata).
  const [itemMeta, setItemMeta] = useState<Record<string, LineMeta>>({})
  const [lineTrackSerial, setLineTrackSerial] = useState<Record<string, boolean>>({})

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })
  const warehouseOptions = warehousesQuery.data?.data?.data ?? []
  // The warehouses lead and the branches follow — same convention as
  // create-rr/RrDeliveryPanel.tsx's own "Destination Location": a flat
  // alphabetical mix of 2 real warehouses and 40+ branch locations is
  // exactly how a receiver picks the wrong kind of destination.
  const isBranchLocation = (wh: { branchId?: string | null; branch?: unknown }) =>
    !!wh.branchId || !!wh.branch
  const locationOptions: SearchableSelectOption[] = [
    ...warehouseOptions
      .filter((wh) => !isBranchLocation(wh))
      .map((wh) => ({ value: wh.id, label: locationLabel(wh, wh.name) })),
    ...warehouseOptions
      .filter(isBranchLocation)
      .map((wh) => ({ value: wh.id, label: locationLabel(wh, wh.name) })),
  ]
  const vatTreatmentOptions: SearchableSelectOption[] = VatTreatmentSchema.options
    .filter((o) => o !== 'exempt')
    .map((o) => ({ value: o, label: o === 'inclusive' ? 'VAT inclusive' : 'VAT exclusive' }))

  const form = useForm<CreateManualReceivingReportFormValues>({
    resolver: zodResolver(CreateManualReceivingReportFormSchema),
    defaultValues,
  })
  const { control, setValue, getValues, watch } = form
  const { errors } = form.formState
  const { fields, append, insert, remove } = useFieldArray({ control, name: 'lines' })

  const watched = watch()
  const lines = watched.lines ?? []
  const anyCosted = lines.some((l) => l?.unitCost != null)
  const totalUnits = lines.reduce((sum, l) => sum + (Number(l?.quantityReceived) || 0), 0)
  const totals = manualRrTotals(watched)

  // Falls back to whichever of itemId/newItemName is actually populated —
  // covers a duplicated line, whose id was never explicitly toggled but
  // whose data already says which mode it's in.
  function lineModeFor(
    fieldId: string,
    line?: { itemId?: string; newItemName?: string }
  ): 'catalog' | 'other' {
    if (fieldId in lineModes) return lineModes[fieldId]
    return line?.newItemName ? 'other' : 'catalog'
  }

  function isLineSerialTracked(
    fieldId: string,
    line?: { itemId?: string; newItemName?: string; serialNumbers?: string[] }
  ): boolean {
    const mode = lineModeFor(fieldId, line)
    if (mode === 'catalog') return !!(line?.itemId && itemMeta[line.itemId]?.isSerialTracked)
    // Falls back to "serials already present" — covers a duplicated
    // "Something else" line that copied a non-empty serialNumbers array.
    return lineTrackSerial[fieldId] ?? (line?.serialNumbers?.length ?? 0) > 0
  }

  function resizeSerials(index: number, qty: number) {
    const current = getValues(`lines.${index}.serialNumbers`) ?? []
    const next = current.slice(0, qty)
    while (next.length < qty) next.push('')
    setValue(`lines.${index}.serialNumbers`, next, { shouldValidate: submitted })
  }

  function setLineQuantity(index: number, fieldId: string, raw: number) {
    const qty = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0
    setValue(`lines.${index}.quantityReceived`, qty, { shouldValidate: submitted })
    if (isLineSerialTracked(fieldId, getValues(`lines.${index}`))) resizeSerials(index, qty)
  }

  function setLineMode(index: number, fieldId: string, mode: 'catalog' | 'other') {
    setLineModes((prev) => ({ ...prev, [fieldId]: mode }))
    setValue(`lines.${index}.itemId`, '', { shouldValidate: false })
    setValue(`lines.${index}.newItemName`, '', { shouldValidate: false })
    setValue(`lines.${index}.serialNumbers`, [], { shouldValidate: false })
    setLineTrackSerial((prev) => ({ ...prev, [fieldId]: false }))
  }

  function toggleLineTrackSerial(index: number, fieldId: string) {
    const next = !(lineTrackSerial[fieldId] ?? false)
    setLineTrackSerial((prev) => ({ ...prev, [fieldId]: next }))
    const qty = Number(getValues(`lines.${index}.quantityReceived`)) || 0
    setValue(`lines.${index}.serialNumbers`, next ? Array.from({ length: qty }, () => '') : [], {
      shouldValidate: submitted,
    })
  }

  function setSerial(index: number, unitIndex: number, value: string) {
    const next = (getValues(`lines.${index}.serialNumbers`) ?? []).slice()
    while (next.length <= unitIndex) next.push('')
    next[unitIndex] = value
    setValue(`lines.${index}.serialNumbers`, next, { shouldValidate: submitted })
  }

  function addLine() {
    append({ itemId: '', quantityReceived: 1 })
  }

  function duplicateLine(index: number) {
    const line = getValues(`lines.${index}`)
    insert(index + 1, { ...line, discounts: line.discounts ? [...line.discounts] : undefined })
    // The duplicate's own mode/serial-tracked-ness is inferred from its
    // copied itemId/newItemName by lineModeFor()/isLineSerialTracked()
    // below — no explicit state needed for a field id that doesn't exist
    // until the next render.
  }

  async function handleSubmit(data: CreateManualReceivingReportFormValues) {
    setSubmitted(true)
    const payload: CreateManualReceivingReportFormValues = {
      ...data,
      // An unset SearchCombobox value is '', not undefined — sent as-is,
      // that's a non-null but non-existent supplierId, which fails the DB's
      // foreign key rather than being treated as "no supplier".
      supplierId: sourceMode === 'registered' ? data.supplierId || undefined : undefined,
      newSourceName: sourceMode === 'new' ? data.newSourceName : undefined,
      lines: data.lines.map((line) => ({
        ...line,
        // Same '' vs undefined issue as supplierId above — a "Something
        // else" line's itemId is reset to '' by setLineMode, not undefined.
        itemId: line.itemId || undefined,
        serialNumbers:
          line.serialNumbers && line.serialNumbers.length > 0 ? line.serialNumbers : undefined,
      })),
    }
    setIsSubmitting(true)
    const result = await createManualReceivingReport(payload)
    setIsSubmitting(false)
    if (result.success) {
      showToast({ title: 'Draft created', description: result.message, status: 'success' })
      const id = (result.data as { id?: string } | undefined)?.id
      router.push(
        id ? `/accounting/receiving-reports/manual-rr/${id}` : '/accounting/receiving-reports'
      )
    } else {
      showToast({ title: 'Failed', description: result.message, status: 'error' })
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className={`${PLEX} flex min-h-screen flex-col bg-[#f2f2f3] text-[#17171c]`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-5 border-b border-[#e4e4e9] bg-white px-4 py-3.5 lg:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
            Accounting › Receiving Reports › New
          </div>
          <h2 className="text-[21px] font-semibold tracking-[-.02em]">
            New Manual Receiving Report
          </h2>
          <p className="text-[12.5px] text-[#5b5b6b]">
            No PO/transfer/count context. Saves as a draft — you post it yourself when ready, no
            second approver needed.
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-3.5 px-3.5 py-4 lg:px-5">
        <div className={`${PANEL} flex flex-col overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-2.5">
            <span className="text-[13.5px] font-semibold">Delivery details</span>
            <span className="text-[11.5px] text-[#8b8b9b]">No PO/transfer/count context</span>
          </div>

          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-4.5 pb-4 pt-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Location" required>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Select location…"
                    loading={warehouseOptions.length === 0}
                    loadingLabel="Loading locations…"
                    chrome={
                      errors.warehouseId
                        ? { idle: 'border-[#b42318]', focused: 'border-[#b42318]' }
                        : CONTROL_CHROME
                    }
                    options={locationOptions}
                  />
                )}
              />
              {errors.warehouseId && <FieldError text={errors.warehouseId.message} />}
            </Field>

            <Field label="Date Received" hint="optional">
              <Controller
                name="receivedAt"
                control={control}
                render={({ field: f }) => (
                  <input {...f} value={f.value ?? ''} type="date" className={INPUT} />
                )}
              />
              <Hint>Leave blank to stamp it when this is posted.</Hint>
            </Field>

            <Field label="Delivery Receipt No." hint="optional">
              <Controller
                name="deliveryReceiptNumber"
                control={control}
                render={({ field: f }) => (
                  <input {...f} value={f.value ?? ''} type="text" className={INPUT} />
                )}
              />
            </Field>

            <Field label="Supplier Invoice No." hint="optional">
              <Controller
                name="supplierInvoiceNumber"
                control={control}
                render={({ field: f }) => (
                  <input {...f} value={f.value ?? ''} type="text" className={INPUT} />
                )}
              />
            </Field>

            <Field label="PO Number" hint="optional">
              <Controller
                name="poNumber"
                control={control}
                render={({ field: f }) => (
                  <input {...f} value={f.value ?? ''} type="text" className={INPUT} />
                )}
              />
            </Field>
          </div>
        </div>

        <div className={PANEL}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[13.5px] font-semibold">
                  Items received <span className="text-[#b42318]">*</span>
                </span>
                <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
                  {fields.length} {fields.length === 1 ? 'line' : 'lines'} · {totalUnits} units
                </span>
              </div>
              <span className="text-[11.5px] text-[#8b8b9b]">
                Pick a catalog item, or mark it &ldquo;Something else&rdquo; for anything not in the
                catalog.
              </span>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5.5 py-10 text-center">
              <PackagePlus className="h-7 w-7 text-[#d3d3db]" />
              <span className="text-[13.5px] font-semibold">No items added yet.</span>
              <button
                type="button"
                onClick={addLine}
                className="mt-2 rounded-lg bg-[#5b21b6] px-3.75 py-2.25 text-[13px] font-medium text-white hover:bg-[#4a189b]"
              >
                Add a line
              </button>
            </div>
          ) : (
            <>
              <div
                className={`${MONO} hidden grid-cols-[minmax(0,1fr)_64px_100px_120px_112px_96px_60px_60px] gap-x-3 border-b border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-2.5 text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] sm:grid`}
              >
                <span>Item / SKU</span>
                <span className="text-right">Qty</span>
                <span className="text-right">SRP</span>
                <span>Discounts</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">Line Total</span>
                <span className="text-center">Free</span>
                <span />
              </div>
              {fields.map((field, index) => {
                const line = watched.lines?.[index]
                const mode = lineModeFor(field.id, line)
                const serialTracked = isLineSerialTracked(field.id, line)
                const lineErrors = errors.lines?.[index]
                return (
                  <ManualRrLineRow
                    key={field.id}
                    control={control}
                    setValue={setValue}
                    index={index}
                    mode={mode}
                    onSetMode={(m) => setLineMode(index, field.id, m)}
                    itemName={line?.itemId ? itemMeta[line.itemId]?.name : undefined}
                    isSerialTracked={serialTracked}
                    trackSerial={lineTrackSerial[field.id] ?? false}
                    onToggleTrackSerial={() => toggleLineTrackSerial(index, field.id)}
                    onSelectCatalogItem={(option: SearchComboboxOption) => {
                      const meta = option.meta as ItemSearchMeta | undefined
                      const isSerialTrackedItem = meta?.isSerialTracked ?? false
                      setItemMeta((prev) => ({
                        ...prev,
                        [option.id]: { name: option.primary, isSerialTracked: isSerialTrackedItem },
                      }))
                      if (isSerialTrackedItem) {
                        resizeSerials(
                          index,
                          Number(getValues(`lines.${index}.quantityReceived`)) || 1
                        )
                      }
                    }}
                    onQuantityChange={(raw) => setLineQuantity(index, field.id, raw)}
                    onSerialChange={(unitIndex, value) => setSerial(index, unitIndex, value)}
                    onDuplicate={() => duplicateLine(index)}
                    onRemove={() => remove(index)}
                    lineErrors={lineErrors}
                  />
                )
              })}
            </>
          )}
          {errors.lines?.message && (
            <div className="px-4.5 pb-3">
              <FieldError text={errors.lines.message} />
            </div>
          )}
        </div>

        <div className={`${PANEL} flex flex-col overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-2.5">
            <span className="text-[13.5px] font-semibold">Source &amp; tax</span>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-4.5 pb-4 pt-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Source" required={anyCosted}>
              <div className="mb-1.5 flex gap-2">
                <button
                  type="button"
                  className={toggleBtnClass(sourceMode === 'registered')}
                  onClick={() => setSourceMode('registered')}
                >
                  Registered
                </button>
                <button
                  type="button"
                  className={toggleBtnClass(sourceMode === 'new')}
                  onClick={() => setSourceMode('new')}
                >
                  Other
                </button>
              </div>
              {sourceMode === 'registered' ? (
                <Controller
                  name="supplierId"
                  control={control}
                  render={({ field: f }) => (
                    <SupplierSearchCombobox
                      value={f.value ?? ''}
                      onChange={f.onChange}
                      onSelect={(option) => setSupplierName(option.primary)}
                      initialLabel={supplierName}
                      error={errors.supplierId?.message}
                    />
                  )}
                />
              ) : (
                <Controller
                  name="newSourceName"
                  control={control}
                  render={({ field: f }) => (
                    <input
                      {...f}
                      value={f.value ?? ''}
                      type="text"
                      placeholder="Who or what this came from"
                      className={INPUT}
                    />
                  )}
                />
              )}
              {sourceMode === 'registered' && errors.supplierId && (
                <FieldError text={errors.supplierId.message} />
              )}
            </Field>

            <Field label="VAT Treatment">
              <Controller
                name="vatTreatment"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 'inclusive'}
                    onChange={field.onChange}
                    chrome={CONTROL_CHROME}
                    options={vatTreatmentOptions}
                    portal
                  />
                )}
              />
            </Field>
          </div>
        </div>

        {anyCosted && (
          <div className={`${PANEL} flex flex-col gap-2 px-4.5 py-3.5`}>
            <span className="text-[13.5px] font-semibold">Totals</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <TotalRow label="Stock value" value={totals.net} />
              <TotalRow label="Input VAT" value={totals.vat} muted={totals.vat === 0} />
              <TotalRow
                label="Withholding"
                value={totals.withheld}
                negative
                muted={totals.withheld === 0}
              />
              <TotalRow label="Payable to source" value={totals.payable} emphasize />
            </div>
          </div>
        )}

        <div className={`${PANEL} flex flex-col gap-2 px-4.5 py-3.5`}>
          <label className="text-[12px] font-medium text-[#3d3d4a]">
            Notes <span className="font-normal text-[#8b8b9b]">optional</span>
          </label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                value={field.value ?? ''}
                rows={2}
                placeholder="Damage on arrival, short-shipped cartons, anything the next person should know…"
                className="w-full resize-y rounded-lg border border-[#d3d3db] bg-white px-3 py-2.5 text-[13px] leading-[1.5] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
              />
            )}
          />
        </div>
      </div>

      <div className="sticky bottom-0 z-40 flex flex-wrap items-center justify-between gap-3.5 border-t border-[#e4e4e9] bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(20,20,30,.3)] lg:px-5">
        <span className="text-[13px] font-semibold text-[#5b5b6b]">
          Saves as a draft — post it yourself when ready
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/accounting/receiving-reports"
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#5b5b6b] hover:bg-[#f1f1f4]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Draft
          </button>
        </div>
      </div>
    </form>
  )
}
