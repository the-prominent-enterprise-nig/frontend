'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  SupplierDebitMemos,
  fmtMoney,
  type SupplierDebitMemo,
} from '@/src/libs/data/AccountingV2Data'
import {
  SupplierDebitMemoFormSchema,
  type SupplierDebitMemoFormValues,
  type SupplierDebitMemoLineValues,
} from '@/src/schema/accounting/supplier-debit-memos'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '../../purchase-requests/_components/ItemSearchCombobox'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
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
// Item · Reason · Account · Qty · Unit Price · Tax Code · Tax Amount · Total.
// Total is a read-only mirror of the server's own arithmetic, so a line's
// figure is never typed twice. Remove is deliberately not a column here: the
// row's minimums add up past the content area whenever the nav sidebar is
// open, so a last column scrolls out of sight. It sits on the reason line
// below instead, which wraps to the container and is always in view.
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
// common four, so it is rarely typed long. The minimums are set so the whole
// row still fits the content area with the nav sidebar expanded; below that
// the shared scroll container takes over.
const lineGridClass =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(230px,1.9fr)_minmax(130px,1fr)_minmax(152px,1.1fr)_64px_102px_114px_102px_114px]'
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

/** Live totals, mirroring the server's own arithmetic so the running card
 * agrees with what will actually post.
 *
 * Every line adds. Returned goods and supplier concessions (support,
 * sponsorship) both count toward what the supplier owes back — the total
 * accounting later applies to one of their invoices. */
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

export default function DebitMemoFormModal({ open, onClose, onSaved, memo }: Props) {
  const isEdit = !!memo
  // Editing this one is not a draft edit: saving reverses what it posted and
  // posts it again. The warning and the extra confirmation key off this.
  const isPosted = memo?.status === 'FINAL'
  // Drafted by a "Return units to supplier" DR on approval (Scenario 72 Part
  // 8). What goes back, how many, from where and to whom is the DR's — the
  // memo may reprice the goods and add charges, nothing more.
  const fromDr = memo?.deliveryReceipt ?? null
  // The validated values waiting on the re-post confirmation, so the dialog
  // only ever appears over a form that would actually save.
  const [confirmingRepost, setConfirmingRepost] = useState<SupplierDebitMemoFormValues | null>(null)
  const [saving, setSaving] = useState(false)
  // Held here while creating, then uploaded once the memo has an id — an
  // attachment needs an entityId to point at.
  const [stagedWaybills, setStagedWaybills] = useState<File[]>([])

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<SupplierDebitMemoFormValues>({
    resolver: zodResolver(SupplierDebitMemoFormSchema),
    defaultValues: {
      supplierId: memo?.supplierId ?? '',
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
          // it back — the account that actually posted, so it is kept and
          // sent back unchanged.
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
  const supplierId = useWatch({ control, name: 'supplierId' })
  const selectedWarehouseId = useWatch({ control, name: 'warehouseId' })

  // A line only means anything once it is settled who the goods go back to
  // and where they leave from — the item search lists that branch's stock
  // first.
  const contextReady = !!supplierId && !!selectedWarehouseId

  /** A picked item comes in at its cost on file — with no invoice to read a
   * price from, that is the honest default, and the person can type the
   * figure the supplier agreed to over it. The account showing belonged to
   * the item that was there before, so it is cleared for the prefill. */
  const applyItemCost = useCallback(
    (index: number, option: SearchComboboxOption): void => {
      setValue(`lines.${index}.accountId`, '')
      const meta = option.meta as ItemSearchMeta | undefined
      setValue(`lines.${index}.unitPrice`, Number(meta?.costPrice ?? 0))
    },
    [setValue]
  )

  // What each item is called, for lines loaded back off a saved memo.
  // SearchCombobox only ever learns a label by the user picking a search
  // result, so such a row would render as an empty "Search item…" box.
  const itemLabelById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const line of memo?.lines ?? []) {
      if (line.itemId && line.item) {
        map[line.itemId] = line.item.sku ? `${line.item.name} (${line.item.sku})` : line.item.name
      }
    }
    return map
  }, [memo?.lines])

  const pickedItemIds = useMemo(
    () => new Set((watchedLines ?? []).map((l) => l?.itemId).filter(Boolean) as string[]),
    [watchedLines]
  )

  // Which rows sit in which table. Read off `fields` rather than the watched
  // values: useFieldArray updates it synchronously, so a new line cannot
  // spend a render in the wrong table before its `kind` arrives. Indexes are
  // kept because every control on a row addresses itself as `lines.${index}.…`,
  // and filtering would otherwise renumber them.
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

  // What stands between this memo and a save, said in the bar at the bottom
  // rather than only as red text beside a field somebody has scrolled past.
  // Blocking issues are the ones the schema or the server will refuse;
  // cautions are the ones a person should look at and may still overrule.
  const blocking: string[] = []
  if (!supplierId) blocking.push('Pick the supplier the stock goes back to.')
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

  const cautions: string[] = []
  const unexplained = goodsRows.filter(
    ({ index }) => !watchedLines?.[index]?.description?.trim()
  ).length
  if (unexplained > 0) {
    cautions.push(
      `${unexplained} item ${unexplained === 1 ? 'line has' : 'lines have'} no reason — the supplier will ask.`
    )
  }
  const unpriced = goodsRows.filter(
    ({ index }) => watchedLines?.[index]?.itemId && !(Number(watchedLines[index].unitPrice) > 0)
  ).length
  if (unpriced > 0) {
    cautions.push(
      `${unpriced} item ${unpriced === 1 ? 'line has' : 'lines have'} no unit price — nothing is claimed for ${unpriced === 1 ? 'it' : 'them'}.`
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
      supplierId: data.supplierId,
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
            <span className="text-[11px] text-[#5b5b6b]">Claimed from the supplier</span>
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
                  Its journal entry is reversed and a revised one posted
                  {fromDr
                    ? ''
                    : ', and the stock it took out goes back and the new quantities come out'}
                  . It stays one memo under one number, and you become its approver.
                </p>
              </div>
            )}

            {fromDr && (
              <div className="rounded-xl border border-[#ddd0f7] bg-[#faf7ff] px-4 py-3 text-xs text-[#3f1490]">
                <p className="font-semibold">Drafted from delivery receipt {fromDr.drNumber}</p>
                <p className="mt-1 leading-relaxed text-[#5b5b6b]">
                  The units, the supplier and the branch are the DR&apos;s — edit the DR to change
                  them. You can change what each unit is claimed at and add charges here.
                  {fromDr.status === 'approved' || fromDr.status === 'posted'
                    ? ''
                    : ' It can be approved once the Branch Manager approves the DR.'}
                </p>
              </div>
            )}

            {/* ── Supplier & branch ────────────────────────────── */}
            <section className={`${cardClass} px-4 py-4 md:px-5`}>
              <div className="mb-4">
                <h3 className={sectionHeadClass}>Supplier &amp; branch</h3>
                <p className={sectionNoteClass}>
                  Who the stock goes back to, and where it leaves from. No invoice is picked here —
                  accounting applies the posted memo to one of the supplier&apos;s invoices from the
                  AP voucher.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`${labelClass} mb-1.5`}>
                    Supplier <span className="text-[#b42318]">*</span>
                  </label>
                  {fromDr ? (
                    <p className={`${fieldClass} bg-[#f7f7f8] text-[#5b5b6b]`}>
                      {memo?.supplier?.name ?? '—'}
                    </p>
                  ) : (
                    <Controller
                      name="supplierId"
                      control={control}
                      render={({ field }) => (
                        <SupplierSearchCombobox
                          value={field.value}
                          onChange={field.onChange}
                          initialLabel={memo?.supplier?.name}
                        />
                      )}
                    />
                  )}
                  {errors.supplierId && (
                    <p className="mt-1 text-[11px] text-[#b42318]">{errors.supplierId.message}</p>
                  )}
                </div>
                <div>
                  <label className={`${labelClass} mb-1.5`}>
                    Returning from <span className="text-[#b42318]">*</span>
                  </label>
                  {fromDr ? (
                    <p className={`${fieldClass} bg-[#f7f7f8] text-[#5b5b6b]`}>
                      {memo?.warehouse ? locationLabel(memo.warehouse) : '—'}
                    </p>
                  ) : (
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
                  )}
                  <p className="mt-1 text-[11px] text-[#8b8b9b]">
                    The branch the units physically leave.
                  </p>
                </div>
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
                <h3 className={sectionHeadClass}>Pick the supplier and branch first</h3>
                <p className={`${sectionNoteClass} max-w-md`}>
                  The branch is what a returned unit&apos;s stock is checked against, so the items
                  open once both are settled.
                </p>
              </section>
            ) : (
              <section className={cardClass}>
                <div className="border-b border-[#eeeef1] px-4 py-3.5 md:px-5">
                  <h3 className={sectionHeadClass}>What is going back?</h3>
                  <p className={sectionNoteClass}>
                    {fromDr
                      ? `The units on ${fromDr.drNumber}, at what each is claimed back at.`
                      : 'Search for each item going back. It comes in at its cost on file — type over it with what the supplier agreed to credit.'}
                  </p>
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
                      Nothing added yet — add a line to search for what is going back.
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
                      </div>

                      <div className="space-y-3">
                        {goodsRows.map(({ field, index }) => {
                          const description = watchedLines?.[index]?.description ?? ''
                          return (
                            <div key={field.id} className="space-y-1.5">
                              <LineRow
                                control={control}
                                index={index}
                                initialItemLabel={
                                  field.itemId ? itemLabelById[field.itemId] : undefined
                                }
                                onItemSelect={(option) => applyItemCost(index, option)}
                                stockWarehouseId={selectedWarehouseId}
                                locked={!!fromDr}
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
                                {/* Sits here rather than at the end of the row
                                    above: this line wraps to the container, so
                                    the control stays in view however far the
                                    columns have to scroll. A DR's units stay. */}
                                {!fromDr && (
                                  <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove line
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 ${fromDr ? 'hidden' : ''}`}
                  >
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
              <section className="rounded-xl border border-[#e4e4e9] bg-white px-4 py-4 md:px-5">
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
                  label="Claimed from the supplier"
                  note="Held in Due from Suppliers once approved, until accounting applies it to an invoice"
                  value={fmtMoney(totals.total)}
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
                    {fmtMoney(totals.total)} claimed from the supplier
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
                Its journal entry is reversed and a revised one posted
                {fromDr
                  ? ''
                  : ', and the stock it took out goes back and the new quantities come out'}{' '}
                — now for <strong>{fmtMoney(totals.total)}</strong> instead of{' '}
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

/** One returned-goods line: an item, how many, and what the supplier is
 * asked to credit for it. */
function LineRow({
  control,
  index,
  initialItemLabel,
  onItemSelect,
  stockWarehouseId,
  locked,
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
  /** What to show for an item loaded off a saved memo. Read once, when the
   * row mounts, which is why it comes down as a prop rather than being looked
   * up from the watched value. */
  initialItemLabel?: string
  /** Prefills this line's Unit Price from the picked item's cost on file. */
  onItemSelect: (option: SearchComboboxOption) => void
  /** The branch the units leave — its stock is listed first in the search. */
  stockWarehouseId?: string
  /** A DR-drafted memo: the item and quantity are the DR's, only the price
   * and the rest of the row can change. */
  locked: boolean
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
            onChange={field.onChange}
            onSelect={onItemSelect}
            initialLabel={initialItemLabel}
            placeholder="Search item…"
            stockWarehouseId={stockWarehouseId || undefined}
            disabled={locked}
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
            disabled={locked}
            className={`${cellClass} text-right disabled:bg-[#f7f7f8] disabled:text-[#5b5b6b]`}
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
