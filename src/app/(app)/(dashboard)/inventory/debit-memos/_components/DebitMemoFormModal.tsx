'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Control, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  APBills,
  SupplierDebitMemos,
  apOutstanding,
  fmtDate,
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
import { MONO, PLEX } from '@/src/libs/design/plex'
import WaybillPanel, { uploadStagedWaybills } from './WaybillPanel'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { lineGross } from '../_lib/debit-memo-format'

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

const cardClass = 'rounded-xl border border-[#e4e4e9] bg-white'
const labelClass = 'block text-xs font-medium text-[#3d3d4a]'
const fieldClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-sm text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const sectionHeadClass = 'text-[13.5px] font-semibold text-[#17171c]'
const sectionNoteClass = 'text-[11.5px] leading-relaxed text-[#5b5b6b]'
const monoHeadClass = `${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`

// Shared by the column headings and every goods row — one definition so the
// two can never drift out of alignment.
// Item · Reason · Account · Qty · Unit Price · Tax Code · Tax Amount · Total ·
// remove. Total is a read-only mirror of the server's own arithmetic, so a
// line's figure is never typed twice.
//
// Account arrives prefilled with what the line would post to anyway (the
// item's own account, else its category's, else the tenant mapping), so the
// common case is confirmed rather than typed — but a person can change it,
// and what they pick is what posts. Asset accounts only: a returned unit goes
// back into stock's value. A charge line picks from income accounts instead,
// which is ChargeRow's own picker.
//
// Item takes both the largest minimum and the largest share of the slack: it
// holds "SKU — Item name", which is the one cell whose content has no bound,
// while every column to its right is a number of known width. Reason gets the
// remainder — it is free text, but the chips under the row already say the
// common four, so it is rarely typed long.
const lineGridClass =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(260px,1.9fr)_minmax(130px,1fr)_minmax(170px,1.1fr)_64px_102px_114px_102px_114px_36px]'
// Every control on a line row shares this padding and font size so they come
// out the same height — the two comboboxes reach it via their `compact` prop,
// which uses exactly these values.
const cellClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

// The computed Total column. Not an input, so it carries no border — a box
// the user cannot type in reads as a disabled field.
const readOnlyCellClass =
  'flex w-full items-center justify-between gap-2 rounded-lg bg-[#f7f7f8] px-2.5 py-1.5 text-right text-[13px] tabular-nums text-[#5b5b6b] md:justify-end'

/** The reasons a unit comes back. Picking one writes it into the line's
 * description, which is the only per-line free-text the memo carries — and
 * which is exactly where "why is it going back" belongs. Typing over it is
 * still allowed; the chips are a shortcut, not a closed list. */
const RETURN_REASONS = ['Defective', 'Wrong item shipped', 'Damaged in transit', 'Over-delivered']

/** The subset of an Account this picker needs. */
type AccountOption = { id: string; number: string; name: string; type?: string | null }

const emptyGoodsLine = {
  kind: 'goods' as const,
  itemId: undefined,
  quantity: 1,
  unitPrice: 0,
  taxAmount: '' as const,
  taxCode: undefined,
  description: undefined,
}

const emptyChargeLine = {
  kind: 'charge' as const,
  itemId: undefined,
  accountId: undefined,
  quantity: 1,
  unitPrice: 0,
  taxAmount: '' as const,
  taxCode: undefined,
  description: undefined,
}

/** Which table a line belongs in. Falls back to whether it carries an item,
 * which is how a memo loaded back from the API is sorted — the server stores
 * no such flag because it infers the same thing the same way. */
function lineKind(line: Partial<SupplierDebitMemoLineValues> | undefined): 'goods' | 'charge' {
  return line?.kind ?? (line?.itemId ? 'goods' : 'charge')
}

/** Live totals, mirroring the server's own arithmetic so the running card and
 * the schema's outstanding-balance check agree with what will actually post.
 *
 * Every line adds. Returned goods and supplier concessions (support,
 * sponsorship) both reduce what we owe, so both count toward the total — and
 * the total is what comes off the supplier's invoice. */
function useLineTotals(control: Control<SupplierDebitMemoFormValues>) {
  const lines = useWatch({ control, name: 'lines' })
  return useMemo(() => {
    const rows = lines ?? []
    const goods = rows.filter((l) => lineKind(l) === 'goods')
    const charges = rows.filter((l) => lineKind(l) === 'charge')
    // Both sides gross, so goodsTotal + chargesTotal === total exactly and the
    // card can show the two parts and their sum with nothing in between. Tax
    // has no row of its own there — it is per line, and the lines show it.
    const goodsTotal = goods.reduce((sum, l) => sum + lineGross(l), 0)
    const chargesTotal = charges.reduce((sum, l) => sum + lineGross(l), 0)
    return {
      total: goodsTotal + chargesTotal,
      goodsTotal,
      chargesTotal,
      goodsCount: goods.length,
      chargesCount: charges.length,
      units: goods.reduce((sum, l) => sum + (l?.itemId ? Number(l.quantity) || 0 : 0), 0),
    }
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
  // The memo's own bill is always listed: a posted memo may have settled it
  // outright, and its own effect must not be what stops it being edited.
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
    formState: { errors, isSubmitted },
  } = useForm<SupplierDebitMemoFormValues>({
    resolver,
    defaultValues: {
      apBillId: memo?.apBillId ?? initialApBillId ?? '',
      memoNumber: memo?.memoNumber ?? undefined,
      warehouseId: memo?.warehouseId ?? '',
      memoDate: (memo?.memoDate ?? new Date().toISOString()).slice(0, 10),
      deliveryReceiptNumber: memo?.deliveryReceiptNumber ?? undefined,
      reason: memo?.reason ?? undefined,
      lines:
        memo?.lines?.map((l) => ({
          kind: (l.itemId ? 'goods' : 'charge') as 'goods' | 'charge',
          itemId: l.itemId ?? undefined,
          serialNumberId: l.serialNumberId ?? undefined,
          // Approving resolves a goods line's account to Inventory and writes
          // it back. The picker lists revenue accounts only, so it cannot show
          // that — but it is the account that actually posted, so it is kept
          // and sent back unchanged.
          accountId: l.accountId ?? undefined,
          sourceApBillId: l.sourceApBillId ?? undefined,
          description: l.description ?? undefined,
          quantity: Number(l.quantity),
          unitPrice: l.unitPrice,
          taxCode: l.taxCode ?? undefined,
          taxAmount: l.taxAmount,
        })) ?? [],
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
  // GET /accounts returns a bare array, even though the client types it as a
  // paginated envelope — reading `.items` off it yields undefined and an
  // empty picker. Accept either shape, same as ExpenseForm does.
  const allAccounts: AccountOption[] = useMemo(() => {
    const raw = accountsQuery.data?.data as
      | AccountOption[]
      | { items?: AccountOption[] }
      | undefined
    return Array.isArray(raw) ? raw : (raw?.items ?? [])
  }, [accountsQuery.data])

  const accountOptions: CategorySelectOption[] = useMemo(
    () =>
      allAccounts
        .filter((a) => (a.type ?? '').toUpperCase() === 'REVENUE')
        .map((a) => ({ id: a.id, name: `${a.number} — ${a.name}`, depth: 0 })),
    [allAccounts]
  )

  // Goods lines relieve an asset account, never an income one — a returned
  // unit goes back into stock's value, it does not earn anything.
  const stockAccountOptions: CategorySelectOption[] = useMemo(
    () =>
      allAccounts
        .filter((a) => (a.type ?? '').toUpperCase() === 'ASSET')
        .map((a) => ({ id: a.id, name: `${a.number} — ${a.name}`, depth: 0 })),
    [allAccounts]
  )

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const totals = useLineTotals(control)
  const watchedLines = useWatch({ control, name: 'lines' })
  const selectedBillId = useWatch({ control, name: 'apBillId' })
  const selectedWarehouseId = useWatch({ control, name: 'warehouseId' })
  const selectedBill = openBills.find((b) => b.id === selectedBillId)

  // A line only means anything once it is settled who the goods go back to,
  // which invoice they come off and where they leave from: until then there
  // is no invoice to price the item from and no stock to check it against.
  const contextReady = !!supplierId && !!selectedBillId && !!selectedWarehouseId

  // A posted memo has already taken its amount off its bill, so that amount is
  // added back before the cap is judged — mirroring the server's own
  // `alreadyApplied`. Otherwise raising a ₱500 memo to ₱800 would be refused
  // by the ₱500 it had itself removed.
  //
  // Net of withholding, via apOutstanding: the withheld slice left Accounts
  // Payable at receive() and is owed to the BIR, so a returned-goods credit
  // cannot reach it.
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

  // What the chosen invoice actually billed. The list endpoint returns bills
  // without their lines, so the selected one is fetched in full — this is the
  // source both the picker below and the prefilled prices read from.
  const billDetailQuery = useQuery({
    queryKey: ['ap-bill-detail', selectedBillId],
    queryFn: () => APBills.get(selectedBillId),
    enabled: open && !!selectedBillId,
    staleTime: 5 * 60 * 1000,
  })

  // Every memo already raised against this invoice, so the picker can say how
  // many of each item have gone back already. Void ones are excluded — they
  // returned nothing in the end — as is this memo itself while it is being
  // edited, or its own quantities would read as somebody else's.
  const priorMemosQuery = useQuery({
    queryKey: ['supplier-debit-memos-for-bill', selectedBillId],
    queryFn: () => SupplierDebitMemos.list({ apBillId: selectedBillId }),
    enabled: open && !!selectedBillId,
    staleTime: 60_000,
  })
  const returnedByItemId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const prior of priorMemosQuery.data?.data?.items ?? []) {
      if (prior.status === 'VOID' || prior.id === memo?.id) continue
      for (const line of prior.lines ?? []) {
        if (!line.itemId) continue
        map[line.itemId] = (map[line.itemId] ?? 0) + Number(line.quantity)
      }
    }
    return map
  }, [priorMemosQuery.data, memo?.id])

  // One row per item the invoice covers, with the two figures that decide how
  // much of it can still go back.
  //
  // Two sources, in order. A bill raised since Scenario 46 carries its own
  // APBillLine rows. A bill scaffolded off a goods receipt carries none — nor
  // does any bill entered before then — and the record of what arrived, at
  // what cost, lives on the receiving reports matched to it instead. The AP
  // bill detail page reads that same fallback; without it this picker would
  // tell most invoices they bill nothing and send everyone to the item search.
  //
  // Lines are folded together by item: an invoice may bill the same item on
  // two lines, or across two receipts, and picker rows that each claimed the
  // whole returned quantity would both read wrong.
  const { invoiceItems, itemSource } = useMemo(() => {
    const bill = billDetailQuery.data?.data
    const ownLines = (bill?.lines ?? []).filter((l) => l.itemId)
    const receipts = bill?.goodsReceipts ?? []
    const receiptLines = receipts.flatMap((r) => r.lines ?? []).filter((l) => l.item?.id)

    type Raw = {
      itemId: string
      sku: string
      name: string
      qty: number
      unitPrice: number
      tax: number
    }
    const raw: Raw[] =
      ownLines.length > 0
        ? ownLines.map((l) => ({
            itemId: l.itemId as string,
            sku: l.item?.sku ?? '',
            name: l.item?.name ?? 'Item',
            qty: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            tax: Number(l.taxAmount) || 0,
          }))
        : receiptLines.map((l) => ({
            itemId: l.item!.id,
            sku: l.item?.sku ?? '',
            name: l.item?.name ?? 'Item',
            qty: Number(l.quantityReceived) || 0,
            // unitCost is the flattened per-unit cost — receiving resolves an
            // srp + discount chain into it, and discountedCost only records
            // why. It is null only on a manual receipt that never carried one.
            unitPrice: Number(l.unitCost ?? l.discountedCost ?? 0) || 0,
            tax: Number(l.taxAmount) || 0,
          }))

    const byItem = new Map<
      string,
      { itemId: string; sku: string; name: string; billed: number; value: number; tax: number }
    >()
    for (const line of raw) {
      const row = byItem.get(line.itemId) ?? {
        itemId: line.itemId,
        sku: line.sku,
        name: line.name,
        billed: 0,
        value: 0,
        tax: 0,
      }
      row.billed += line.qty
      row.value += line.qty * line.unitPrice
      row.tax += line.tax
      byItem.set(line.itemId, row)
    }

    return {
      itemSource: (ownLines.length > 0 ? 'invoice' : raw.length > 0 ? 'receipts' : 'none') as
        | 'invoice'
        | 'receipts'
        | 'none',
      invoiceItems: [...byItem.values()].map((row) => {
        const returned = returnedByItemId[row.itemId] ?? 0
        return {
          ...row,
          unitPrice: row.billed > 0 ? row.value / row.billed : 0,
          taxPerUnit: row.billed > 0 ? row.tax / row.billed : 0,
          returned,
          remaining: Math.max(row.billed - returned, 0),
        }
      }),
    }
  }, [billDetailQuery.data, returnedByItemId])

  // The PO the chosen invoice was raised against, if there is one. Used only
  // for items the invoice itself does not price — a bill scaffolded off a
  // goods receipt carries no lines of its own, and the PO is then the only
  // record of what was agreed.
  const purchaseOrderId = selectedBill?.purchaseOrderId ?? null
  const poQuery = useQuery({
    queryKey: ['debit-memo-po-prices', purchaseOrderId],
    queryFn: () => purchaseOrdersApi.get(purchaseOrderId!),
    enabled: open && !!purchaseOrderId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  // itemId → unit price. A zero-priced line (a freebie) prefills nothing:
  // there is no value to deduct for it. The invoice overrides the PO — what
  // they billed is what comes off the bill, whatever was ordered.
  const priceByItemId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const line of poQuery.data?.data?.lines ?? []) {
      const price = Number(line.unitPrice)
      if (line.itemId && price > 0) map[line.itemId] = price
    }
    for (const row of invoiceItems) {
      if (row.unitPrice > 0) map[row.itemId] = row.unitPrice
    }
    return map
  }, [poQuery.data, invoiceItems])

  // Who last set each line's Unit Price — this form ('auto') or the person
  // filling it in ('manual') — keyed by the field array's own stable id. An
  // auto amount is re-resolved whenever the invoice behind it changes; a typed
  // one is never overwritten.
  const amountOwnerRef = useRef<Record<string, 'auto' | 'manual'>>({})

  /** Fills a line's Unit Price from the invoice (or the PO behind it) when the
   * item is on one. Runs on every pick: the amount showing describes the item
   * that was there before, so it is replaced — or cleared, when neither
   * prices the new item. */
  const applySourcePrice = useCallback(
    (index: number, itemId: string): void => {
      const fieldId = fields[index]?.id
      // The account showing belongs to the item that was there before, the
      // same as the amount does. Cleared here so the prefill resolves the new
      // one — a deliberate override of the old item has no claim on this one.
      setValue(`lines.${index}.accountId`, '')
      const price = itemId ? priceByItemId[itemId] : undefined
      if (price != null) {
        setValue(`lines.${index}.unitPrice`, price)
        if (fieldId) amountOwnerRef.current[fieldId] = 'auto'
      } else if (fieldId && amountOwnerRef.current[fieldId] === 'auto') {
        setValue(`lines.${index}.unitPrice`, 0)
        delete amountOwnerRef.current[fieldId]
      }
    },
    [fields, priceByItemId, setValue]
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
  // lines were filled in: a price from the old invoice would otherwise sit
  // there looking like it came from this one.
  useEffect(() => {
    getValues('lines').forEach((line, index) => {
      const fieldId = fields[index]?.id
      const owner = fieldId ? amountOwnerRef.current[fieldId] : undefined
      if (owner === 'manual') return
      const price = line.itemId ? priceByItemId[line.itemId] : undefined
      const blank = !(Number(line.unitPrice) > 0)
      if (price != null && (blank || owner === 'auto')) {
        setValue(`lines.${index}.unitPrice`, price)
        if (fieldId) amountOwnerRef.current[fieldId] = 'auto'
      } else if (price == null && owner === 'auto' && fieldId) {
        setValue(`lines.${index}.unitPrice`, 0)
        delete amountOwnerRef.current[fieldId]
      }
    })
  }, [priceByItemId, fields, getValues, setValue])

  // What each item is called, for the lines this form fills in on the user's
  // behalf. SearchCombobox only ever learns a label by the user picking a
  // search result, so a line whose itemId was set by the picker above — or
  // loaded back off a saved memo — renders as an empty "Search item…" box
  // unless it is handed one. Built in the same shape a pick would have
  // produced, so a prefilled row and a searched row read identically.
  const itemLabelById = useMemo(() => {
    const map: Record<string, string> = {}
    const put = (id: string, name: string, sku?: string | null) => {
      map[id] = sku ? `${name} (${sku})` : name
    }
    for (const line of memo?.lines ?? []) {
      if (line.itemId && line.item) put(line.itemId, line.item.name, line.item.sku)
    }
    for (const row of invoiceItems) put(row.itemId, row.name, row.sku)
    return map
  }, [memo?.lines, invoiceItems])

  const pickedItemIds = useMemo(
    () => new Set((watchedLines ?? []).map((l) => l?.itemId).filter(Boolean) as string[]),
    [watchedLines]
  )

  /** Ticking an invoice row adds it to the goods below at the quantity that
   * can still go back, priced as the invoice priced it; unticking takes it
   * away again. */
  function toggleInvoiceItem(row: (typeof invoiceItems)[number]): void {
    const existing = getValues('lines').findIndex((l) => l?.itemId === row.itemId)
    if (existing >= 0) {
      remove(existing)
      return
    }
    const quantity = row.remaining > 0 ? row.remaining : 1
    const tax = Number((row.taxPerUnit * quantity).toFixed(2))
    append({
      ...emptyGoodsLine,
      itemId: row.itemId,
      quantity,
      unitPrice: row.unitPrice,
      taxAmount: tax > 0 ? tax : ('' as const),
    })
  }

  // Which rows sit in which table. Read off `fields` rather than the watched
  // values: useFieldArray updates it synchronously, so a line added by the
  // picker cannot spend a render in the charges below before its `kind`
  // arrives. Indexes are kept because every control on a row addresses itself
  // as `lines.${index}.…`, and filtering would otherwise renumber them.
  const goodsRows = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => lineKind(field) === 'goods')
  const chargeRows = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => lineKind(field) === 'charge')

  // What each picked item would post to if nobody touched the Account column.
  // Asked of the server rather than guessed here: the chain runs item →
  // category → tenant mapping, and only the server can see the category side
  // of it.
  // Sorted so the query key is stable whatever order the lines were added in.
  const accountLookupIds = useMemo(() => [...pickedItemIds].sort(), [pickedItemIds])

  const resolvedAccountsQuery = useQuery({
    queryKey: ['sdm-inventory-accounts', accountLookupIds],
    queryFn: () => SupplierDebitMemos.inventoryAccounts(accountLookupIds),
    enabled: open && accountLookupIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  const resolvedAccounts = resolvedAccountsQuery.data?.data

  // Fills the blanks only. A line that already names an account — one someone
  // chose here, or one a posted memo came back with — is never overwritten,
  // so the prefill can never quietly undo a deliberate choice.
  useEffect(() => {
    if (!resolvedAccounts) return
    for (const { index } of goodsRows) {
      const line = watchedLines?.[index]
      if (!line?.itemId || line.accountId) continue
      const resolved = resolvedAccounts[line.itemId]
      if (resolved) setValue(`lines.${index}.accountId`, resolved)
    }
  }, [resolvedAccounts, goodsRows, watchedLines, setValue])

  // Lines asking to return more than the invoice has left. Not blocking: the
  // hybrid model lets a memo settle against any of the supplier's open
  // invoices, so an item that was billed elsewhere legitimately has nothing
  // left on this one. The server's only quantity control is stock on hand.
  //
  // Recomputed each render rather than memoized — it reads the watched
  // quantities, which change on every keystroke anyway, over a handful of
  // lines.
  const overReturned: { index: number; name: string; remaining: number }[] = []
  for (const { index } of goodsRows) {
    const line = watchedLines?.[index]
    if (!line?.itemId) continue
    const billed = invoiceItems.find((r) => r.itemId === line.itemId)
    if (!billed) continue
    if ((Number(line.quantity) || 0) > billed.remaining) {
      overReturned.push({ index, name: billed.name, remaining: billed.remaining })
    }
  }

  // What stands between this memo and a save, said in the bar at the bottom
  // rather than only as red text beside a field somebody has scrolled past.
  // Blocking issues are the ones the schema or the server will refuse;
  // cautions are the ones a person should look at and may still overrule.
  const blocking: string[] = []
  if (!supplierId) blocking.push('Pick the supplier the stock goes back to.')
  if (!selectedBillId) blocking.push('Pick the open invoice this is deducted from.')
  if (!selectedWarehouseId) blocking.push('Pick the branch the units leave.')
  if (fields.length === 0) blocking.push('Nothing is going back — add an item or a charge.')
  const unpickedItems = goodsRows.filter(({ index }) => !watchedLines?.[index]?.itemId).length
  if (unpickedItems > 0) {
    blocking.push(
      `${unpickedItems} item ${unpickedItems === 1 ? 'line has' : 'lines have'} no item picked.`
    )
  }
  const unaccountedCharges = chargeRows.filter(
    ({ index }) => !watchedLines?.[index]?.accountId
  ).length
  if (unaccountedCharges > 0) {
    blocking.push(
      `${unaccountedCharges} ${unaccountedCharges === 1 ? 'charge has' : 'charges have'} no account to credit.`
    )
  }
  if (outstanding !== null && totals.total > outstanding + 0.01) {
    blocking.push(
      `This memo is ${fmtMoney(totals.total)} but the invoice has only ${fmtMoney(outstanding)} left on it.`
    )
  }

  const cautions: string[] = []
  const unexplained = goodsRows.filter(
    ({ index }) => !watchedLines?.[index]?.description?.trim()
  ).length
  if (unexplained > 0) {
    cautions.push(
      `${unexplained} item ${unexplained === 1 ? 'line has' : 'lines have'} no reason — the supplier will ask.`
    )
  }
  if (overReturned.length > 0) {
    cautions.push(
      `${overReturned.length} ${overReturned.length === 1 ? 'line asks' : 'lines ask'} for more than this invoice has left to return.`
    )
  }
  // Deliberately silent about a missing delivery receipt number and a missing
  // waybill. Both are optional — nothing in create, update or approve checks
  // either — and a draft is often raised before the goods actually ship, so a
  // caution about them would fire on every new memo and mean nothing by the
  // time one didn't. The bar is for things that are actually wrong.

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
      lines: data.lines.map(({ kind: _kind, ...l }) => ({
        ...l,
        // '' is a valid in-progress value for the tax box; normalize it away
        // before it reaches the API.
        taxAmount: typeof l.taxAmount === 'number' ? l.taxAmount : undefined,
        // Clearing the Account picker leaves '', which is not the same as "no
        // account" to a server that only checks for null — send nothing and
        // let it resolve the line the way it would have anyway.
        accountId: l.accountId || undefined,
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
    // put there for exactly this, so the form fills the content area and
    // leaves the sidebar and top bar reachable. Same shell the PO, transfer,
    // price-list and UDS modals use.
    <div className={`absolute inset-0 z-50 flex flex-col bg-[#f7f7f8] ${PLEX}`}>
      {/* Header */}
      <div className="flex-none border-b border-[#e4e4e9] bg-white px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-[#17171c]">
                {isEdit ? 'Edit debit memo' : 'New debit memo'}
              </h2>
              {isEdit && (
                <span
                  className={`${MONO} rounded-md bg-[#f1ebfb] px-2.5 py-1 text-[11.5px] font-medium text-[#3f1490]`}
                >
                  {memo!.memoNumber}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#5b5b6b]">
              {isPosted
                ? 'This memo has already posted — saving reverses it and posts the revision.'
                : 'Stock going back out to a supplier. Nothing moves until an approver posts it.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
            <span className="text-[11px] text-[#5b5b6b]">Deducted from invoice</span>
            <span className={`${MONO} text-xl font-semibold tracking-tight text-[#17171c]`}>
              {fmtMoney(totals.total)}
            </span>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div className="mx-auto max-w-[1400px] space-y-4">
            {/* Nothing has happened yet on a draft — this warns about the
                save, which on a posted memo is not inert. */}
            {isPosted && (
              <div className="rounded-xl border border-[#f5e2c6] bg-[#fffdf8] px-4 py-3 text-xs text-[#8a4b06]">
                <p className="font-semibold">This memo has already posted. Saving re-posts it.</p>
                <p className="mt-1 leading-relaxed">
                  Its journal entry is reversed and a revised one posted, the stock it took out goes
                  back and the new quantities come out, and the invoice is re-deducted. It stays one
                  memo under one number, and you become its approver.
                </p>
              </div>
            )}

            {/* ── Supplier & invoice ───────────────────────────── */}
            <section className={`${cardClass} px-4 py-4 md:px-5`}>
              <div className="mb-4">
                <h3 className={sectionHeadClass}>Supplier &amp; invoice</h3>
                <p className={sectionNoteClass}>
                  Who the stock goes back to, and which open invoice this comes off.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`${labelClass} mb-1.5`}>
                    Supplier <span className="text-[#b42318]">*</span>
                  </label>
                  <SupplierSearchCombobox
                    value={supplierId}
                    onChange={(id) => {
                      setSupplierId(id)
                      // The invoice belonged to the old supplier — keeping it
                      // selected would deduct this memo off somebody else's
                      // bill.
                      setValue('apBillId', '')
                    }}
                    initialLabel={memo?.supplier?.name}
                  />
                </div>
                <div>
                  <label className={`${labelClass} mb-1.5`}>
                    Returning from <span className="text-[#b42318]">*</span>
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
                  <p className="mt-1 text-[11px] text-[#8b8b9b]">
                    The branch the units physically leave.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <label className={labelClass}>
                    Deduct from which open supplier invoice?{' '}
                    <span className="text-[#b42318]">*</span>
                  </label>
                  {!supplierId && (
                    <span className="text-[11px] text-[#8b8b9b]">
                      Pick a supplier to see their open invoices
                    </span>
                  )}
                </div>

                {!supplierId ? (
                  <div className="rounded-lg border border-dashed border-[#d3d3db] px-4 py-6 text-center text-xs text-[#8b8b9b]">
                    Pick a supplier first.
                  </div>
                ) : billsQuery.isLoading ? (
                  <div className="rounded-lg border border-dashed border-[#d3d3db] px-4 py-6 text-center text-xs text-[#8b8b9b]">
                    Loading open invoices…
                  </div>
                ) : openBills.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#d3d3db] px-4 py-6 text-center text-xs text-[#8b8b9b]">
                    This supplier has no open invoices to deduct from.
                  </div>
                ) : (
                  <Controller
                    name="apBillId"
                    control={control}
                    render={({ field }) => (
                      <div className="grid gap-2 lg:grid-cols-2">
                        {openBills.map((bill) => {
                          const isOn = field.value === bill.id
                          return (
                            <button
                              key={bill.id}
                              type="button"
                              onClick={() => field.onChange(bill.id)}
                              aria-pressed={isOn}
                              className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left ${
                                isOn
                                  ? 'border-[#5b21b6] bg-[#faf7ff]'
                                  : 'border-[#e4e4e9] bg-white hover:border-[#d3d3db]'
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isOn ? 'border-[#5b21b6]' : 'border-[#d3d3db]'}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${isOn ? 'bg-[#5b21b6]' : 'bg-transparent'}`}
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={`${MONO} block truncate text-[12.5px] font-semibold text-[#17171c]`}
                                >
                                  {bill.billNumber ?? 'SI not yet numbered'}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-[#5b5b6b]">
                                  {fmtDate(bill.billDate)} · due {fmtDate(bill.dueDate)}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span
                                  className={`${MONO} block text-[13px] font-semibold text-[#17171c]`}
                                >
                                  {fmtMoney(apOutstanding(bill))}
                                </span>
                                <span className="block text-[10.5px] text-[#8b8b9b]">
                                  open balance
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  />
                )}
                {errors.apBillId && (
                  <p className="mt-1.5 text-[11px] text-[#b42318]">{errors.apBillId.message}</p>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`${labelClass} mb-1.5`}>
                    Issue date <span className="text-[#b42318]">*</span>
                  </label>
                  <Controller
                    name="memoDate"
                    control={control}
                    render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                  />
                  {errors.memoDate && (
                    <p className="mt-1 text-[11px] text-[#b42318]">{errors.memoDate.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* ── What is going back ───────────────────────────── */}
            {!contextReady ? (
              <section
                className={`${cardClass} flex flex-col items-center gap-1.5 border-dashed px-5 py-10 text-center`}
              >
                <h3 className={sectionHeadClass}>Pick the supplier, invoice and branch first</h3>
                <p className={`${sectionNoteClass} max-w-md`}>
                  What the invoice billed is what prices a returned unit, and the branch is what its
                  stock is checked against — so the items open once all three are settled.
                </p>
              </section>
            ) : (
              <section className={cardClass}>
                <div className="border-b border-[#eeeef1] px-4 py-3.5 md:px-5">
                  <h3 className={sectionHeadClass}>What is going back?</h3>
                  <p className={sectionNoteClass}>
                    Tick what {selectedBill?.billNumber ?? 'this invoice'} covers to add it at the
                    cost it came in at, or search for anything it does not cover.
                  </p>
                </div>

                {/* Add from the invoice */}
                <div className="border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-3.5 md:px-5">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className={monoHeadClass}>
                      {itemSource === 'receipts' ? 'Delivered against' : 'Billed on'}{' '}
                      {selectedBill?.billNumber ?? 'this invoice'}
                    </span>
                    {itemSource !== 'receipts' && (
                      <span className="text-[11px] text-[#8b8b9b]">
                        Quantities left are what this invoice has not already had returned
                      </span>
                    )}
                  </div>
                  {billDetailQuery.isLoading ? (
                    <p className="py-3 text-xs text-[#8b8b9b]">Loading the invoice&apos;s lines…</p>
                  ) : invoiceItems.length === 0 ? (
                    <p className="py-3 text-xs text-[#8b8b9b]">
                      Neither this invoice nor the receiving reports behind it lists any items —
                      search for what is going back below.
                    </p>
                  ) : (
                    <ul className="grid gap-2 lg:grid-cols-2">
                      {invoiceItems.map((row) => {
                        const isOn = pickedItemIds.has(row.itemId)
                        return (
                          <li key={row.itemId}>
                            <button
                              type="button"
                              onClick={() => toggleInvoiceItem(row)}
                              aria-pressed={isOn}
                              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${
                                isOn
                                  ? 'border-[#5b21b6] bg-white'
                                  : 'border-[#e4e4e9] bg-white hover:border-[#d3d3db]'
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border text-[10px] ${
                                  isOn
                                    ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                                    : 'border-[#d3d3db] bg-white text-transparent'
                                }`}
                              >
                                ✓
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-medium text-[#17171c]">
                                  {row.name}
                                </span>
                                <span
                                  className={`${MONO} mt-0.5 block truncate text-[10.5px] text-[#5b5b6b]`}
                                >
                                  {row.sku ? `${row.sku} · ` : ''}
                                  {row.billed} billed · {row.returned} returned · {row.remaining}{' '}
                                  can go back
                                </span>
                              </span>
                              <span className={`${MONO} shrink-0 text-[12px] text-[#5b5b6b]`}>
                                {fmtMoney(row.unitPrice)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                {/* Goods lines */}
                <div className="px-4 py-4 md:px-5">
                  {errors.lines && !Array.isArray(errors.lines) && (
                    <p className="mb-2 rounded-lg bg-[#fdeceb] px-3 py-2 text-[11.5px] text-[#b42318]">
                      {errors.lines.message}
                    </p>
                  )}

                  {goodsRows.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#d3d3db] px-4 py-6 text-center text-xs text-[#8b8b9b]">
                      Nothing added yet — tick a billed item above, or add a line to search the
                      catalog.
                    </p>
                  ) : (
                    // Header and rows share one scroll container so they can
                    // never slide out of alignment on a narrow screen.
                    <div className="overflow-x-auto">
                      {/* Hidden below md, where a row stacks to one column and
                          each field's placeholder names it instead. */}
                      <div className={`${lineGridClass} hidden pb-1.5 md:grid`}>
                        <span className={monoHeadClass}>Item</span>
                        <span className={monoHeadClass}>Description</span>
                        <span className={monoHeadClass}>Account</span>
                        <span className={`${monoHeadClass} text-right`}>Qty</span>
                        <span className={`${monoHeadClass} text-right`}>Unit price</span>
                        <span className={monoHeadClass}>Tax code</span>
                        <span className={`${monoHeadClass} text-right`}>Tax amt</span>
                        <span className={`${monoHeadClass} text-right`}>Total</span>
                        <span />
                      </div>

                      <div className="space-y-3">
                        {goodsRows.map(({ field, index }) => {
                          const over = overReturned.find((o) => o.index === index)
                          const description = watchedLines?.[index]?.description ?? ''
                          return (
                            <div key={field.id} className="space-y-1.5">
                              <LineRow
                                control={control}
                                index={index}
                                initialItemLabel={
                                  field.itemId ? itemLabelById[field.itemId] : undefined
                                }
                                onRemove={() => remove(index)}
                                onItemPicked={(itemId) => applySourcePrice(index, itemId)}
                                onAmountEdited={() => claimAmount(index)}
                                overQuantity={!!over}
                                stockAccountOptions={stockAccountOptions}
                                accountsLoading={accountsQuery.isLoading}
                              />
                              <div className="flex flex-wrap items-center gap-1.5 md:pl-1">
                                <span className="text-[11px] text-[#8b8b9b]">Why:</span>
                                {RETURN_REASONS.map((reason) => {
                                  const isOn = description.trim() === reason
                                  return (
                                    <button
                                      key={reason}
                                      type="button"
                                      onClick={() =>
                                        setValue(`lines.${index}.description`, isOn ? '' : reason)
                                      }
                                      aria-pressed={isOn}
                                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                                        isOn
                                          ? 'border-[#5b21b6] bg-[#5b21b6] font-medium text-white'
                                          : 'border-[#d3d3db] bg-white text-[#3d3d4a] hover:border-[#a3a3b2]'
                                      }`}
                                    >
                                      {reason}
                                    </button>
                                  )
                                })}
                                {over && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#8a4b06]">
                                    <AlertTriangle className="h-3 w-3" />
                                    Only {over.remaining} of {over.name} can still go back on this
                                    invoice
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <button
                      type="button"
                      onClick={() => append(emptyGoodsLine)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-2 text-xs font-medium text-[#3f1490] hover:bg-[#e9dffa]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add item line
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ── Other charges ────────────────────────────────── */}
            {contextReady && (
              <section className={`${cardClass} px-4 py-4 md:px-5`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={sectionHeadClass}>Other charges back to the supplier</h3>
                    <p className={sectionNoteClass}>
                      Freight you paid, a concession they agreed to, a short delivery. No stock
                      moves for these, so each one needs the account to credit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => append(emptyChargeLine)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-2 text-xs font-medium text-[#3f1490] hover:bg-[#e9dffa]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add charge
                  </button>
                </div>

                {chargeRows.length === 0 ? (
                  <p className="text-xs text-[#a3a3b2]">None — most memos are stock only.</p>
                ) : (
                  <div className="space-y-2">
                    {chargeRows.map(({ field, index }) => (
                      <ChargeRow
                        key={field.id}
                        control={control}
                        index={index}
                        accountOptions={accountOptions}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Running total ────────────────────────────────── */}
            {contextReady && (
              <section
                className={`rounded-xl border bg-white px-4 py-4 md:px-5 ${
                  outstanding !== null && totals.total > outstanding + 0.01
                    ? 'border-[#f3c9c5]'
                    : 'border-[#e4e4e9]'
                }`}
              >
                <TotalRow
                  label="Items going back"
                  note={
                    totals.units > 0
                      ? `${totals.units.toLocaleString()} ${totals.units === 1 ? 'unit' : 'units'} of stock across ${totals.goodsCount} ${totals.goodsCount === 1 ? 'line' : 'lines'}`
                      : 'claims only — no stock moves'
                  }
                  value={fmtMoney(totals.goodsTotal)}
                />
                <TotalRow
                  label="Other charges"
                  note={
                    totals.chargesCount
                      ? `${totals.chargesCount} ${totals.chargesCount === 1 ? 'line' : 'lines'}`
                      : 'none'
                  }
                  value={fmtMoney(totals.chargesTotal)}
                />
                <TotalRow
                  strong
                  label={`Deducted from ${selectedBill?.billNumber ?? 'the invoice'}`}
                  note={
                    outstanding !== null
                      ? `balance ${fmtMoney(outstanding)} → ${fmtMoney(outstanding - totals.total)}`
                      : ''
                  }
                  value={fmtMoney(totals.total)}
                  bad={outstanding !== null && totals.total > outstanding + 0.01}
                />
              </section>
            )}

            {/* ── Proof the goods left ─────────────────────────── */}
            <section className={`${cardClass} px-4 py-4 md:px-5`}>
              <div className="mb-4">
                <h3 className={sectionHeadClass}>Proof the goods left</h3>
                <p className={sectionNoteClass}>
                  Without a DR number or a waybill photo there is nothing tying the stock movement
                  to a real shipment — that is what gets queried at audit.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`${labelClass} mb-1.5`}>Delivery receipt no.</label>
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
                  <p className="mt-1 text-[11px] text-[#8b8b9b]">
                    The DR that went out with the goods.
                  </p>
                </div>
                <div>
                  <label className={`${labelClass} mb-1.5`}>Reason / note for the supplier</label>
                  <Controller
                    name="reason"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={1}
                        placeholder="Anything their warehouse or accounts team needs to know…"
                        className={`${fieldClass} resize-none`}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="mt-4">
                {/* While creating, files stage here and upload straight after
                    the memo is saved; while editing, they upload immediately. */}
                <WaybillPanel
                  memoId={isEdit ? memo!.id : undefined}
                  // A waybill is evidence, not a posting: it can be corrected
                  // on a memo that has posted without re-posting anything.
                  readOnly={false}
                  staged={stagedWaybills}
                  onStagedChange={setStagedWaybills}
                />
              </div>
            </section>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="flex-none border-t border-[#e4e4e9] bg-white px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(20,20,30,.35)] md:px-6">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* On a new memo the tally is just the empty form read back at
                  them, so it only shows up once they have tried to save. */}
              {!isEdit && !isSubmitted ? null : blocking.length > 0 ? (
                <>
                  <p className="text-[11.5px] font-medium text-[#b42318]">
                    {blocking.length} {blocking.length === 1 ? 'thing' : 'things'} to fix before
                    this can be saved
                  </p>
                  <p className="truncate text-[11.5px] text-[#5b5b6b]">{blocking[0]}</p>
                </>
              ) : cautions.length > 0 ? (
                <>
                  <p className="text-[11.5px] font-medium text-[#8a4b06]">
                    Ready to save — {cautions.length} worth checking
                  </p>
                  <p className="truncate text-[11.5px] text-[#5b5b6b]">{cautions[0]}</p>
                </>
              ) : (
                <>
                  <p className="text-[11.5px] font-medium text-[#0b6644]">Ready to save</p>
                  <p className="truncate text-[11.5px] text-[#5b5b6b]">
                    {fmtMoney(totals.total)} off {selectedBill?.billNumber ?? 'the invoice'}
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  blocking.length > 0
                    ? 'bg-[#7d5fb8] hover:bg-[#6d4fa8]'
                    : 'bg-[#5b21b6] hover:bg-[#4a189b]'
                }`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPosted ? 'Save and re-post' : isEdit ? 'Save draft' : 'Save as draft'}
              </button>
            </div>
          </div>

          {/* The full list, once there is more than the headline to say. */}
          {(isEdit || isSubmitted) &&
            (blocking.length > 1 || (blocking.length === 0 && cautions.length > 1)) && (
              <ul className="mx-auto mt-2 flex max-w-[1400px] flex-wrap gap-x-4 gap-y-1">
                {(blocking.length > 0 ? blocking : cautions).slice(1).map((issue) => (
                  <li
                    key={issue}
                    className={`text-[11px] ${blocking.length > 0 ? 'text-[#b42318]' : 'text-[#8a4b06]'}`}
                  >
                    • {issue}
                  </li>
                ))}
              </ul>
            )}
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

function TotalRow({
  label,
  note,
  value,
  strong,
  bad,
}: {
  label: string
  note: string
  value: string
  /** The figure that actually comes off the invoice — set apart by a rule
   * above it and a larger number, the way a receipt's total is. */
  strong?: boolean
  bad?: boolean
}) {
  return (
    <div
      className={`flex items-start justify-between gap-6 py-2 ${strong ? 'mt-1 border-t border-[#e4e4e9] pt-3' : ''}`}
    >
      <div className="min-w-0">
        <p className={`text-[12.5px] text-[#17171c] ${strong ? 'font-semibold' : ''}`}>{label}</p>
        {note && <p className="text-[11px] text-[#5b5b6b]">{note}</p>}
      </div>
      <span
        className={`${MONO} shrink-0 tabular-nums ${
          strong ? 'text-[16px] font-semibold' : 'text-[13px] font-medium'
        } ${bad ? 'text-[#b42318]' : 'text-[#3d3d4a]'}`}
      >
        {value}
      </span>
    </div>
  )
}

/** One returned-goods line: an item, how many, and what it comes off the
 * invoice at. */
function LineRow({
  control,
  index,
  initialItemLabel,
  onRemove,
  onItemPicked,
  onAmountEdited,
  overQuantity,
  stockAccountOptions,
  accountsLoading,
}: {
  control: Control<SupplierDebitMemoFormValues>
  index: number
  /** Asset accounts a returned unit can go back into. */
  stockAccountOptions: CategorySelectOption[]
  /** The picker shows a loading placeholder rather than an empty list while
   * the chart is still on its way. */
  accountsLoading: boolean
  /** What to show for an item this row did not have picked through it — one
   * added from the invoice above, or loaded off a saved memo. Read once, when
   * the row mounts, which is why it comes down as a prop rather than being
   * looked up from the watched value. */
  initialItemLabel?: string
  onRemove: () => void
  /** Prefills this line's Unit Price from the invoice, or the PO behind it. */
  onItemPicked: (itemId: string) => void
  /** Hands the Unit Price over to whoever typed in it, so no later prefill
   * overwrites their figure. */
  onAmountEdited: () => void
  /** Asking for more than the invoice has left — flagged, not refused. */
  overQuantity: boolean
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
            initialLabel={initialItemLabel}
            placeholder="Search item…"
            compact
          />
        )}
      />
      {/* Why the unit is coming back. The reason chips under the row write
          into this same field — they are a shortcut for the common four, not
          a replacement for saying it in words. */}
      <Controller
        name={`lines.${index}.description`}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            value={field.value ?? ''}
            type="text"
            placeholder="Reason or note"
            className={cellClass}
          />
        )}
      />
      {/* Prefilled with what this item resolves to, and editable. Left alone
          it posts exactly where it would have without the column; changed, the
          chosen account is what the server credits — approve() honours a line
          that already names one rather than resolving over it. */}
      <Controller
        name={`lines.${index}.accountId`}
        control={control}
        render={({ field }) => (
          <CategorySelect
            value={field.value || undefined}
            onChange={(v) => field.onChange(v ?? '')}
            options={stockAccountOptions}
            placeholder={accountsLoading ? 'Loading…' : 'Inventory account…'}
            noun="accounts"
            aria-label="Inventory account"
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
            aria-label="Quantity"
            className={`${cellClass} text-right ${overQuantity ? 'border-[#e0a94f] bg-[#fffdf8]' : ''}`}
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
            aria-label="Unit price"
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
            aria-label="Tax code"
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
            aria-label="Tax amount"
            className={`${cellClass} text-right`}
          />
        )}
      />
      {/* Quantity × unit price, plus tax — the figure this line contributes to
          the deduction, and what the memo stores as the line's total. */}
      <span className={`${readOnlyCellClass} ${MONO} font-medium text-[#17171c]`}>
        {/* Below md the row stacks and the headings are hidden, so the cell
            names itself the way the inputs' placeholders do. */}
        <span className="text-[11px] font-normal uppercase tracking-wide text-[#8b8b9b] md:hidden">
          Total
        </span>
        <span>{fmtMoney(lineGross(line))}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
        aria-label="Remove line"
        title="Remove line"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

/** A deduction that moves no stock — supplier support, a concession, freight.
 * Flat-sum rather than priced per unit, which is why it has no quantity: the
 * server multiplies quantity into a goods line only. */
function ChargeRow({
  control,
  index,
  accountOptions,
  onRemove,
}: {
  control: Control<SupplierDebitMemoFormValues>
  index: number
  accountOptions: CategorySelectOption[]
  onRemove: () => void
}) {
  const line = useWatch({ control, name: `lines.${index}` })
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1.3fr)_minmax(185px,1.2fr)_116px_104px_116px_36px] md:items-center">
      <Controller
        name={`lines.${index}.description`}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            value={field.value ?? ''}
            type="text"
            placeholder="e.g. Supplier concession"
            aria-label="Charge description"
            className={cellClass}
          />
        )}
      />
      <Controller
        name={`lines.${index}.accountId`}
        control={control}
        render={({ field }) => (
          <CategorySelect
            value={field.value || undefined}
            onChange={(v) => field.onChange(v ?? '')}
            options={accountOptions}
            placeholder="Account to credit…"
            noun="accounts"
            aria-label="Account"
            compact
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
            placeholder="Amount"
            aria-label="Amount"
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
            aria-label="Tax code"
            className={`${cellClass} bg-white`}
          >
            <option value="">Tax code</option>
            <option value="VAT">VAT</option>
            <option value="NON_VAT">Non-VAT</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        )}
      />
      <span className={`${readOnlyCellClass} ${MONO} font-medium text-[#17171c]`}>
        <span className="text-[11px] font-normal uppercase tracking-wide text-[#8b8b9b] md:hidden">
          Total
        </span>
        <span>{fmtMoney(lineGross(line))}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
        aria-label="Remove charge"
        title="Remove charge"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
