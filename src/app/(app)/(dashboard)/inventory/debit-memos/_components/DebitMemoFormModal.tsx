'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Control, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import {
  APBills,
  SupplierDebitMemos,
  fmtMoney,
  type APBill,
  type SupplierDebitMemo,
} from '@/src/libs/data/AccountingV2Data'
import {
  buildSupplierDebitMemoFormSchema,
  type SupplierDebitMemoFormValues,
} from '@/src/schema/accounting/supplier-debit-memos'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { getAccounts } from '@/src/libs/data/AccountingData'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { WarehouseSearchCombobox } from '@/src/components/inventory/WarehouseSearchCombobox'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { showToast } from '@/src/components/ui/toast'
import WaybillPanel, { uploadStagedWaybills } from './WaybillPanel'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Editing an existing draft. Omit to raise a new one. */
  memo?: SupplierDebitMemo | null
  /** Pre-selects the invoice when arriving from an AP bill. */
  initialApBillId?: string
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
// Shared by the column headings and every line row — one definition so the
// two can never drift out of alignment.
// Item · Description · Account · Qty · Amount · Tax Code · Tax Amount · remove.
// The wrapper scrolls horizontally rather than squashing the columns when the
// window is narrow.
// Tax Code is a select, so it needs room for its widest option plus the
// chevron — a numeric-width column clipped "Non-VAT".
const lineGridClass =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(190px,1.3fr)_minmax(150px,1fr)_minmax(190px,1.3fr)_64px_110px_120px_110px_36px]'
// Every control on a line row shares this padding and font size so they come
// out the same height — the two comboboxes reach it via their `compact` prop,
// which uses exactly these values.
const cellClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

/** The subset of an Account this picker needs. */
type AccountOption = { id: string; number: string; name: string; type?: string | null }

const emptyLine = {
  itemId: undefined,
  quantity: 1,
  unitPrice: 0,
  taxAmount: '' as const,
  taxCode: undefined,
  description: undefined,
}

/** Live total, mirroring the server's own arithmetic so the footer and the
 * schema's outstanding-balance check agree with what will actually post.
 *
 * Every line adds. Returned goods and supplier concessions (support,
 * sponsorship) both reduce what we owe, so both count toward the total — and
 * the total is what comes off the supplier's invoice.
 *
 * Quantity only multiplies a goods line; a concession is a flat negotiated
 * sum, so its amount stands as typed. Mirrors lineValue() on the server. */
function useLineTotals(control: Control<SupplierDebitMemoFormValues>) {
  const lines = useWatch({ control, name: 'lines' })
  return useMemo(() => {
    const rows = lines ?? []
    const subtotal = rows.reduce(
      (sum, l) =>
        sum +
        (l?.itemId
          ? (Number(l?.quantity) || 0) * (Number(l?.unitPrice) || 0)
          : Number(l?.unitPrice) || 0),
      0
    )
    const tax = rows.reduce((sum, l) => sum + (Number(l?.taxAmount) || 0), 0)
    return { subtotal, tax, total: subtotal + tax }
  }, [lines])
}

export default function DebitMemoFormModal({
  open,
  onClose,
  onSaved,
  memo,
  initialApBillId,
}: Props) {
  const isEdit = !!memo
  // Seeded once on mount. The parent gives this modal a `key` that changes per
  // open, so it remounts with fresh state rather than needing an effect to
  // re-sync when `memo` changes underneath it.
  const [supplierId, setSupplierId] = useState<string>(memo?.supplierId ?? '')
  const [saving, setSaving] = useState(false)
  // Held here while creating, then uploaded once the memo has an id — an
  // attachment needs an entityId to point at.
  const [stagedWaybills, setStagedWaybills] = useState<File[]>([])

  // Only the chosen supplier's open bills can be deducted against — but any
  // of them, not just the one the damaged unit arrived on.
  const billsQuery = useQuery({
    queryKey: ['ap-bills-open', supplierId],
    queryFn: () => APBills.list({ supplierId }),
    enabled: open && !!supplierId,
    staleTime: 60_000,
  })
  // Only open bills can be deducted against — but any of them, not just the
  // one the damaged unit arrived on.
  const openBills = (billsQuery.data?.data?.items ?? []).filter((b: APBill) =>
    ['RECEIVED', 'PARTIAL', 'OVERDUE'].includes(b.status)
  )

  // The schema's cap depends on which bill is selected, but useForm only reads
  // `resolver` once. A ref lets the stable resolver below see the current
  // outstanding balance instead of the one that happened to be selected on
  // first render.
  const outstandingRef = useRef<number>(Number.MAX_SAFE_INTEGER)
  const resolver = useCallback<Resolver<SupplierDebitMemoFormValues>>(
    (values, context, options) =>
      zodResolver(buildSupplierDebitMemoFormSchema(outstandingRef.current))(
        values,
        context,
        options
      ),
    []
  )

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierDebitMemoFormValues>({
    resolver,
    defaultValues: {
      apBillId: memo?.apBillId ?? initialApBillId ?? '',
      memoNumber: memo?.memoNumber ?? undefined,
      warehouseId: memo?.warehouseId ?? '',
      memoDate: (memo?.memoDate ?? new Date().toISOString()).slice(0, 10),
      deliveryReceiptNumber: memo?.deliveryReceiptNumber ?? undefined,
      reason: memo?.reason ?? undefined,
      lines: memo?.lines?.length
        ? memo.lines.map((l) => ({
            itemId: l.itemId ?? undefined,
            serialNumberId: l.serialNumberId ?? undefined,
            accountId: l.accountId ?? undefined,
            sourceApBillId: l.sourceApBillId ?? undefined,
            description: l.description ?? undefined,
            quantity: Number(l.quantity),
            unitPrice: l.unitPrice,
            taxCode: l.taxCode ?? undefined,
            taxAmount: l.taxAmount,
          }))
        : [emptyLine],
    },
  })

  // A line with no item is a non-inventory deduction — supplier support,
  // sponsorship, a freight recharge — and needs an account to credit, since
  // there is no inventory account to fall back to. These are the income
  // accounts that case posts against ("Support from Supplier" and
  // "Incentives from Supplier" are the seeded ones).
  const accountsQuery = useQuery({
    queryKey: ['coa-revenue-accounts'],
    queryFn: () => getAccounts({ limit: 500 }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const accountOptions: CategorySelectOption[] = useMemo(() => {
    // GET /accounts returns a bare array, even though the client types it as a
    // paginated envelope — reading `.items` off it yields undefined and an
    // empty picker. Accept either shape, same as ExpenseForm does.
    const raw = accountsQuery.data?.data as
      | AccountOption[]
      | { items?: AccountOption[] }
      | undefined
    const list = Array.isArray(raw) ? raw : (raw?.items ?? [])
    return list
      .filter((a) => (a.type ?? '').toUpperCase() === 'REVENUE')
      .map((a) => ({ id: a.id, name: `${a.number} — ${a.name}`, depth: 0 }))
  }, [accountsQuery.data])

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const totals = useLineTotals(control)
  const selectedBillId = useWatch({ control, name: 'apBillId' })
  const selectedBill = openBills.find((b) => b.id === selectedBillId)
  const outstanding = selectedBill ? selectedBill.totalAmount - selectedBill.amountPaid : null

  // Keep the resolver's view current. Written in an effect rather than during
  // render (refs are not render-time state), which is soon enough: validation
  // only runs on submit, long after this has settled. No selection yet means
  // no cap to check against — the server enforces it regardless.
  useEffect(() => {
    outstandingRef.current = outstanding ?? Number.MAX_SAFE_INTEGER
  }, [outstanding])

  async function onSubmit(data: SupplierDebitMemoFormValues) {
    setSaving(true)
    const payload = {
      apBillId: data.apBillId,
      warehouseId: data.warehouseId,
      memoNumber: data.memoNumber || undefined,
      memoDate: data.memoDate,
      deliveryReceiptNumber: data.deliveryReceiptNumber || undefined,
      reason: data.reason || undefined,
      lines: data.lines.map((l) => ({
        ...l,
        // '' is a valid in-progress value for the tax box; normalize it away
        // before it reaches the API.
        taxAmount: typeof l.taxAmount === 'number' ? l.taxAmount : undefined,
      })),
    }
    const res = isEdit
      ? await SupplierDebitMemos.update(memo!.id, payload)
      : await SupplierDebitMemos.create(payload)
    setSaving(false)

    if (!res.success) {
      showToast({
        title: 'Could not save',
        description: res.message || res.error || 'Failed to save the debit memo',
        status: 'error',
      })
      return
    }
    // The memo exists now, so staged waybills finally have something to
    // attach to. A failure here is reported but never discards the memo.
    let failedUploads = 0
    if (!isEdit && stagedWaybills.length > 0 && res.data?.id) {
      failedUploads = await uploadStagedWaybills(res.data.id, stagedWaybills)
    }

    showToast({
      title: isEdit ? 'Draft updated' : 'Draft saved',
      description:
        failedUploads > 0
          ? `Saved, but ${failedUploads} waybill file${failedUploads > 1 ? 's' : ''} failed to upload — reopen the memo to try again.`
          : 'Nothing has posted yet — approve it when the goods actually go.',
      status: failedUploads > 0 ? 'warning' : 'success',
    })
    setStagedWaybills([])
    reset()
    onSaved()
  }

  if (!open) return null

  return (
    // `absolute`, not `fixed` — the app layout's <main> is a relative frame
    // put there for exactly this, so the modal fills the content area and
    // leaves the sidebar and top bar reachable. Same shell the PO, transfer,
    // price-list and UDS modals use.
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            {isEdit ? 'Edit Debit Memo' : 'New Debit Memo'}
          </h2>
          <p className="text-xs text-zinc-500">
            Defective stock going back to the supplier. Saving keeps it a draft — nothing moves
            until it is approved.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-1 flex-col overflow-hidden"
      >
        {/* Deliberately uncapped: the modal fills <main>, so collapsing the
            sidebar widens it, and the line grid's fr columns should take that
            room rather than sitting inside a fixed max-width. */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Ref no. + issue date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reference No.
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (leave blank to generate)
                  </span>
                </label>
                <Controller
                  name="memoNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="SDM-20260904-0001"
                      className={fieldClass}
                    />
                  )}
                />
                {errors.memoNumber && (
                  <p className="mt-1 text-xs text-red-500">{errors.memoNumber.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="memoDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.memoDate && (
                  <p className="mt-1 text-xs text-red-500">{errors.memoDate.message}</p>
                )}
              </div>
            </div>

            {/* Supplier + invoice */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <SupplierSearchCombobox
                  value={supplierId}
                  onChange={setSupplierId}
                  initialLabel={memo?.supplier?.name}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Purchase Invoice (SI) <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="apBillId"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      disabled={!supplierId}
                      className={`${fieldClass} bg-white disabled:bg-zinc-50`}
                    >
                      <option value="">
                        {supplierId ? 'Select invoice…' : 'Pick a supplier first'}
                      </option>
                      {openBills.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.billNumber ?? '(no number)'} — {fmtMoney(b.totalAmount - b.amountPaid)}{' '}
                          outstanding
                        </option>
                      ))}
                    </select>
                  )}
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Any of this supplier&apos;s open invoices — it need not be the one the damaged
                  unit was invoiced on.
                </p>
                {errors.apBillId && (
                  <p className="mt-1 text-xs text-red-500">{errors.apBillId.message}</p>
                )}
              </div>
            </div>

            {/* Warehouse + DR */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Returning From <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <WarehouseSearchCombobox
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.warehouseId?.message}
                      initialLabel={memo?.warehouse?.name}
                    />
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Delivery Receipt No.
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (the DR sent with the goods)
                  </span>
                </label>
                <Controller
                  name="deliveryReceiptNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. DR-00123"
                      className={fieldClass}
                    />
                  )}
                />
              </div>
            </div>

            {/* Lines */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Items <span className="text-red-500">*</span>
              </label>
              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mb-2 text-xs text-red-500">{errors.lines.message}</p>
              )}

              {/* Header and rows share one scroll container so they can never
                  slide out of alignment with each other on a narrow screen. */}
              <div className="overflow-x-auto">
                {/* Column headings, matching LineRow's own grid template. Hidden
                  below md, where the row stacks to one column and each field's
                  placeholder names it instead. Same pattern as the PO form. */}
                <div className={`${lineGridClass} hidden pb-1 md:grid`}>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Item
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Description
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Account
                  </span>
                  <span className="text-right text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Qty
                  </span>
                  <span className="text-right text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Amount
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Tax Code
                  </span>
                  <span className="text-right text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Tax Amount
                  </span>
                  <span />
                </div>

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <LineRow
                      key={field.id}
                      control={control}
                      index={index}
                      accountOptions={accountOptions}
                      canRemove={fields.length > 1}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => append(emptyLine)}
                className="mt-2 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </button>
            </div>

            {/* While creating, files stage here and upload straight after the
                memo is saved; while editing, they upload immediately. */}
            <WaybillPanel
              memoId={isEdit ? memo!.id : undefined}
              readOnly={isEdit && memo!.status !== 'DRAFT'}
              staged={stagedWaybills}
              onStagedChange={setStagedWaybills}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reason</label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder="Defective units, wrong shipment, etc."
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>

            {/* Totals */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Subtotal</dt>
                  <dd className="tabular-nums text-zinc-800">{fmtMoney(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Tax</dt>
                  <dd className="tabular-nums text-zinc-800">{fmtMoney(totals.tax)}</dd>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-1">
                  <dt className="font-medium text-zinc-700">Total deducted from invoice</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">
                    {fmtMoney(totals.total)}
                  </dd>
                </div>
                {outstanding !== null && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Invoice outstanding after this memo</dt>
                    <dd
                      className={`tabular-nums ${
                        outstanding - totals.total < -0.01
                          ? 'font-medium text-red-600'
                          : 'text-zinc-800'
                      }`}
                    >
                      {fmtMoney(outstanding - totals.total)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Draft' : 'Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  )
}

function LineRow({
  control,
  index,
  accountOptions,
  canRemove,
  onRemove,
}: {
  control: Control<SupplierDebitMemoFormValues>
  index: number
  accountOptions: CategorySelectOption[]
  canRemove: boolean
  onRemove: () => void
}) {
  return (
    <div className={`${lineGridClass} md:items-center`}>
      <Controller
        name={`lines.${index}.itemId`}
        control={control}
        render={({ field }) => (
          <ItemSearchCombobox
            value={field.value ?? ''}
            onChange={field.onChange}
            placeholder="Search item…"
            compact
          />
        )}
      />
      {/* Names a line that has no item — "Q3 sponsorship", "freight
            recharge". Without it such a line shows only as "Non-inventory
            line" wherever the memo is read back. */}
      <Controller
        name={`lines.${index}.description`}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            value={field.value ?? ''}
            type="text"
            placeholder="Description"
            className={cellClass}
          />
        )}
      />
      {/* Left blank for a returned item — approving resolves it to Inventory
            and writes the resolved account back. Set it for a line with no
            item: supplier support, sponsorship, a freight recharge. */}
      <Controller
        name={`lines.${index}.accountId`}
        control={control}
        render={({ field }) => (
          <CategorySelect
            value={field.value || undefined}
            onChange={(v) => field.onChange(v ?? '')}
            options={accountOptions}
            placeholder="Inventory (default)"
            aria-label="Account"
            compact
          />
        )}
      />
      <Controller
        name={`lines.${index}.quantity`}
        control={control}
        render={({ field }) => (
          <input
            type="number"
            min="0"
            step="1"
            value={Number.isNaN(field.value) ? '' : field.value}
            onChange={(e) => field.onChange(e.target.value === '' ? NaN : e.target.valueAsNumber)}
            placeholder="1"
            className={`${cellClass} text-right`}
          />
        )}
      />
      <Controller
        name={`lines.${index}.unitPrice`}
        control={control}
        render={({ field }) => (
          <input
            type="number"
            min="0"
            step="0.01"
            value={Number.isNaN(field.value) ? '' : field.value}
            onChange={(e) => field.onChange(e.target.value === '' ? NaN : e.target.valueAsNumber)}
            placeholder="0.00"
            className={`${cellClass} text-right`}
          />
        )}
      />
      <Controller
        name={`lines.${index}.taxCode`}
        control={control}
        render={({ field }) => (
          <select {...field} value={field.value ?? ''} className={`${cellClass} bg-white`}>
            <option value="">Tax code</option>
            <option value="VAT">VAT</option>
            <option value="NON_VAT">Non-VAT</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        )}
      />
      <Controller
        name={`lines.${index}.taxAmount`}
        control={control}
        render={({ field }) => (
          <input
            type="number"
            min="0"
            step="0.01"
            value={field.value === '' || field.value == null ? '' : field.value}
            onChange={(e) => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)}
            placeholder="0.00"
            className={`${cellClass} text-right`}
          />
        )}
      />
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Remove line"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}
