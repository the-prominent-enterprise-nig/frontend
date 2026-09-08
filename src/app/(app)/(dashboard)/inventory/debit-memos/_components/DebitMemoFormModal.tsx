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
  apOutstanding,
  fmtMoney,
  type APBill,
  type SupplierDebitMemo,
} from '@/src/libs/data/AccountingV2Data'
import {
  buildSupplierDebitMemoFormSchema,
  type SupplierDebitMemoFormValues,
  type SupplierDebitMemoLineValues,
} from '@/src/schema/accounting/supplier-debit-memos'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { purchaseOrdersApi } from '@/src/libs/api/procurement'
import { getAccounts } from '@/src/libs/data/AccountingData'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { WarehouseSearchCombobox } from '@/src/components/inventory/WarehouseSearchCombobox'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import WaybillPanel, { uploadStagedWaybills } from './WaybillPanel'
import { locationLabel } from '@/src/libs/format/locationLabel'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** The memo being edited — a draft, or one that has already posted. Omit to
   * raise a new one. */
  memo?: SupplierDebitMemo | null
  /** Pre-selects the invoice when arriving from an AP bill. */
  initialApBillId?: string
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
// Shared by the column headings and every line row — one definition so the
// two can never drift out of alignment.
// Item · Description · Account · Qty · Unit Price · Tax Code · Tax Amount ·
// Total · remove. Total is a read-only mirror of the server's own arithmetic,
// so a line's figure is never typed twice. There is deliberately no second,
// pre-tax total column: with tax standing in its own column, it would only
// restate the two cells beside it.
// The wrapper scrolls horizontally rather than squashing the columns when the
// window is narrow.
// Tax Code is a select, so it needs room for its widest option plus the
// chevron — a numeric-width column clipped "Non-VAT".
const lineGridClass =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(185px,1.25fr)_minmax(145px,1fr)_minmax(185px,1.25fr)_64px_104px_116px_104px_116px_36px]'
// Every control on a line row shares this padding and font size so they come
// out the same height — the two comboboxes reach it via their `compact` prop,
// which uses exactly these values.
const cellClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

// The computed Total column. Not an input, so it carries no border — a box
// the user cannot type in reads as a disabled field.
const readOnlyCellClass =
  'flex w-full items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-right text-[13px] tabular-nums text-zinc-600 md:justify-end'

/** A line's own figures, read back off the form. The read-only cells and the
 * footer both go through these, so a row can never disagree with the total
 * under it.
 *
 * Quantity only multiplies a goods line; a concession (no item) is a flat
 * negotiated sum, so its amount stands as typed. Mirrors lineValue() on the
 * server. */
function lineNet(line: Partial<SupplierDebitMemoLineValues> | undefined): number {
  const unitPrice = Number(line?.unitPrice) || 0
  return line?.itemId ? (Number(line?.quantity) || 0) * unitPrice : unitPrice
}

/** Net plus tax — what the server stores as the line's `lineTotal`. */
function lineGross(line: Partial<SupplierDebitMemoLineValues> | undefined): number {
  return lineNet(line) + (Number(line?.taxAmount) || 0)
}

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
    const subtotal = rows.reduce((sum, l) => sum + lineNet(l), 0)
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
  // Editing this one is not a draft edit: saving reverses what it posted and
  // posts it again. The warning, the extra confirmation and the balance it is
  // allowed to reach all key off this.
  const isPosted = memo?.status === 'FINAL'
  // The validated values waiting on the re-post confirmation, so the dialog
  // only ever appears over a form that would actually save.
  const [confirmingRepost, setConfirmingRepost] = useState<SupplierDebitMemoFormValues | null>(null)
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
  // one the damaged unit arrived on. The memo's own bill is always listed:
  // a posted memo may have settled it outright, and its own effect must not
  // be what stops it being edited.
  const openBills = (billsQuery.data?.data?.items ?? []).filter(
    (b: APBill) => ['RECEIVED', 'PARTIAL', 'OVERDUE'].includes(b.status) || b.id === memo?.apBillId
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
    setValue,
    getValues,
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
            // Approving resolves a goods line's account to Inventory and
            // writes it back. The picker lists revenue accounts only, so it
            // cannot show that — but it is the account that actually posted,
            // so it is kept and sent back unchanged.
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
  const selectedWarehouseId = useWatch({ control, name: 'warehouseId' })
  // A line only means anything once it is settled who the goods go back to,
  // which invoice they come off and where they leave from: until then there
  // is no PO to price the item from and no stock to check it against. Same
  // gating the invoice picker already applies to itself while no supplier is
  // chosen, carried one step further down the form.
  const contextReady = !!supplierId && !!selectedBillId && !!selectedWarehouseId
  // A posted memo has already taken its amount off its bill, so that amount is
  // added back before the cap is judged — mirroring the server's own
  // `alreadyApplied`. Otherwise raising a ₱500 memo to ₱800 would be refused
  // by the ₱500 it had itself removed.
  //
  // Net of withholding, via apOutstanding: the withheld slice left Accounts
  // Payable at receive() and is owed to the BIR, so a returned-goods credit
  // cannot reach it. totalAmount - amountPaid offered a cap above what the
  // supplier is actually owed, which the server now refuses — this stops the
  // form inviting the rejection.
  const outstanding = selectedBill
    ? apOutstanding(selectedBill) +
      (isPosted && selectedBill.id === memo!.apBillId ? memo!.amount : 0)
    : null

  // Keep the resolver's view current. Written in an effect rather than during
  // render (refs are not render-time state), which is soon enough: validation
  // only runs on submit, long after this has settled. No selection yet means
  // no cap to check against — the server enforces it regardless.
  useEffect(() => {
    outstandingRef.current = outstanding ?? Number.MAX_SAFE_INTEGER
  }, [outstanding])

  // The PO the chosen invoice was raised against, if there is one. Its lines
  // carry the price already agreed with the supplier, which is what a
  // returned unit comes off the invoice at — so staff don't retype it. A
  // bill with no PO (or a user without purchase-order read access) simply
  // leaves the amounts blank, which is how it behaved before.
  const purchaseOrderId = selectedBill?.purchaseOrderId ?? null
  const poQuery = useQuery({
    queryKey: ['debit-memo-po-prices', purchaseOrderId],
    queryFn: () => purchaseOrdersApi.get(purchaseOrderId!),
    enabled: open && !!purchaseOrderId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  // itemId → unit price. A zero-priced line (a freebie) prefills nothing:
  // there is no value to deduct for it.
  const poPriceByItemId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const line of poQuery.data?.data?.lines ?? []) {
      const price = Number(line.unitPrice)
      if (line.itemId && price > 0) map[line.itemId] = price
    }
    return map
  }, [poQuery.data])

  // Who last set each line's Unit Price — this form ('auto') or the person
  // filling it in ('manual') — keyed by the field array's own stable id. An
  // auto amount is re-resolved whenever the invoice, and so the PO behind
  // it, changes; a typed one is never overwritten.
  const amountOwnerRef = useRef<Record<string, 'auto' | 'manual'>>({})

  /** Fills a line's Unit Price from the PO when the item is on it. Runs on every
   * pick: the amount showing describes the item that was there before, so it
   * is replaced — or cleared, when this PO doesn't price the new item. */
  const applyPoPrice = useCallback(
    (index: number, itemId: string): void => {
      const fieldId = fields[index]?.id
      const price = itemId ? poPriceByItemId[itemId] : undefined
      if (price != null) {
        setValue(`lines.${index}.unitPrice`, price)
        if (fieldId) amountOwnerRef.current[fieldId] = 'auto'
      } else if (fieldId && amountOwnerRef.current[fieldId] === 'auto') {
        setValue(`lines.${index}.unitPrice`, 0)
        delete amountOwnerRef.current[fieldId]
      }
    },
    [fields, poPriceByItemId, setValue]
  )

  /** The person typed in this line's Unit Price — leave it alone from here on. */
  const claimAmount = useCallback(
    (index: number): void => {
      const fieldId = fields[index]?.id
      if (fieldId) amountOwnerRef.current[fieldId] = 'manual'
    },
    [fields]
  )

  // Re-resolve every prefilled amount against the invoice now selected. This
  // is what keeps an amount honest when the invoice is switched after the
  // lines were filled in: a price from the old PO would otherwise sit there
  // looking like it came from this one.
  useEffect(() => {
    getValues('lines').forEach((line, index) => {
      const fieldId = fields[index]?.id
      const owner = fieldId ? amountOwnerRef.current[fieldId] : undefined
      if (owner === 'manual') return
      const price = line.itemId ? poPriceByItemId[line.itemId] : undefined
      const blank = !(Number(line.unitPrice) > 0)
      if (price != null && (blank || owner === 'auto')) {
        setValue(`lines.${index}.unitPrice`, price)
        if (fieldId) amountOwnerRef.current[fieldId] = 'auto'
      } else if (price == null && owner === 'auto' && fieldId) {
        setValue(`lines.${index}.unitPrice`, 0)
        delete amountOwnerRef.current[fieldId]
      }
    })
  }, [poPriceByItemId, fields, getValues, setValue])

  /** Runs after validation. A posted memo asks first — saving it re-posts. */
  function onSubmit(data: SupplierDebitMemoFormValues): void {
    if (isPosted) setConfirmingRepost(data)
    else void save(data)
  }

  async function save(data: SupplierDebitMemoFormValues) {
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
      setConfirmingRepost(null)
      return
    }
    // The memo exists now, so staged waybills finally have something to
    // attach to. A failure here is reported but never discards the memo.
    let failedUploads = 0
    if (!isEdit && stagedWaybills.length > 0 && res.data?.id) {
      failedUploads = await uploadStagedWaybills(res.data.id, stagedWaybills)
    }

    showToast({
      title: isPosted ? 'Memo re-posted' : isEdit ? 'Draft updated' : 'Draft saved',
      description:
        failedUploads > 0
          ? `Saved, but ${failedUploads} waybill file${failedUploads > 1 ? 's' : ''} failed to upload — reopen the memo to try again.`
          : 'Nothing has posted yet — approve it when the goods actually go.',
      status: failedUploads > 0 ? 'warning' : 'success',
    })
    setStagedWaybills([])
    setConfirmingRepost(null)
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
            {/* Nothing has happened yet — this warns about the save, unlike
                a draft, where saving is inert. */}
            {isPosted && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <p className="font-medium">This memo has already posted. Saving re-posts it.</p>
                <p className="mt-1">
                  Its journal entry is reversed and a revised one posted, the stock it took out goes
                  back and the new quantities come out, and the invoice is re-deducted. It stays one
                  memo under one number, and you become its approver.
                </p>
              </div>
            )}

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
                      initialLabel={memo?.warehouse ? locationLabel(memo.warehouse) : undefined}
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
                {!contextReady ? (
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    Pick the supplier, invoice and warehouse first
                  </span>
                ) : (
                  selectedBill?.purchaseOrder?.code && (
                    <span className="ml-2 text-xs font-normal text-zinc-400">
                      Unit prices prefill from {selectedBill.purchaseOrder.code} for items ordered
                      on it
                    </span>
                  )
                )}
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
                    Unit Price
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Tax Code
                  </span>
                  <span className="text-right text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Tax Amount
                  </span>
                  <span className="text-right text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Total
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
                      onItemPicked={(itemId) => applyPoPrice(index, itemId)}
                      onAmountEdited={() => claimAmount(index)}
                      disabled={!contextReady}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => append(emptyLine)}
                disabled={!contextReady}
                className="mt-2 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </button>
            </div>

            {/* While creating, files stage here and upload straight after the
                memo is saved; while editing, they upload immediately. */}
            <WaybillPanel
              memoId={isEdit ? memo!.id : undefined}
              // A waybill is evidence, not a posting: it can be corrected on
              // a memo that has posted without re-posting anything.
              readOnly={false}
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
            {isPosted ? 'Save and Re-post' : isEdit ? 'Save Draft' : 'Save as Draft'}
          </button>
        </div>
      </form>

      {confirmingRepost && (
        <ConfirmDialog
          open
          title={`Re-post ${memo!.memoNumber}?`}
          message={
            <>
              <p>
                Its journal entry is reversed and a revised one posted, the stock it took out goes
                back and the new quantities come out, and the invoice is deducted again — now by{' '}
                <strong>{fmtMoney(totals.total)}</strong> instead of{' '}
                <strong>{fmtMoney(memo!.amount)}</strong>.
              </p>
              <p>
                The memo keeps its number, and you replace {memo!.memoNumber}&apos;s approver, since
                these are your figures.
              </p>
            </>
          }
          confirmLabel="Save and re-post"
          loading={saving}
          onCancel={() => setConfirmingRepost(null)}
          onConfirm={() => void save(confirmingRepost)}
        />
      )}
    </div>
  )
}

function LineRow({
  control,
  index,
  accountOptions,
  canRemove,
  onRemove,
  onItemPicked,
  onAmountEdited,
  disabled,
}: {
  control: Control<SupplierDebitMemoFormValues>
  index: number
  accountOptions: CategorySelectOption[]
  canRemove: boolean
  onRemove: () => void
  /** Prefills this line's Unit Price from the invoice's PO. */
  onItemPicked: (itemId: string) => void
  /** Hands the Unit Price over to whoever typed in it, so no later prefill
   * overwrites their figure. */
  onAmountEdited: () => void
  /** Supplier, invoice or warehouse still unpicked — nothing on the line can
   * be resolved against them yet. */
  disabled: boolean
}) {
  // Scoped to this line, so typing in one row re-renders only that row.
  const line = useWatch({ control, name: `lines.${index}` })
  return (
    <div className={`${lineGridClass} md:items-center`}>
      <Controller
        name={`lines.${index}.itemId`}
        control={control}
        render={({ field }) => (
          <ItemSearchCombobox
            value={field.value ?? ''}
            onChange={(itemId) => {
              field.onChange(itemId)
              onItemPicked(itemId)
            }}
            placeholder="Search item…"
            compact
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            onChange={(e) => {
              field.onChange(e.target.value === '' ? NaN : e.target.valueAsNumber)
              onAmountEdited()
            }}
            placeholder="0.00"
            disabled={disabled}
            className={`${cellClass} text-right`}
          />
        )}
      />
      <Controller
        name={`lines.${index}.taxCode`}
        control={control}
        render={({ field }) => (
          <select
            {...field}
            value={field.value ?? ''}
            disabled={disabled}
            className={`${cellClass} bg-white`}
          >
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
            disabled={disabled}
            className={`${cellClass} text-right`}
          />
        )}
      />
      {/* Quantity × unit price, plus tax — the figure this line contributes
            to the deduction, and what the memo stores as the line's total. */}
      <span className={`${readOnlyCellClass} font-medium text-zinc-800`}>
        {/* Below md the row stacks and the headings are hidden, so the cell
              names itself the way the inputs' placeholders do. */}
        <span className="text-[11px] font-normal uppercase tracking-wide text-zinc-400 md:hidden">
          Total
        </span>
        <span>{fmtMoney(lineGross(line))}</span>
      </span>
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
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
