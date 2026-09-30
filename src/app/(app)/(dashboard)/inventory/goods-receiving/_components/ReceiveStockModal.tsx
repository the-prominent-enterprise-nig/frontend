'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus, Plus, X } from 'lucide-react'
import {
  ReceiveStockFormSchema,
  type ReceiveStockFormValues,
} from '@/src/schema/inventory/goods-receiving'
import {
  MANUAL_RR_TAX_CODES,
  MANUAL_RR_WITHHOLDING_CLASSES,
} from '@/src/schema/inventory/manual-receiving-reports'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import type { RepossessedSerialMeta } from '@/src/components/inventory/RepossessedSerialSearchCombobox'
import type { InstallmentAccountMeta } from '@/src/components/inventory/InstallmentAccountSearchCombobox'
import {
  getInstallmentAccount,
  type InstallmentAccountUnitItem,
} from '../_actions/get-installment-account'
import type { ItemSearchMeta } from '../../purchase-requests/_components/ItemSearchCombobox'
import { MONO, PLEX, fmtPeso } from '../../purchase-orders/_components/procurementTokens'
import { ReceiveActionBar } from '../../purchase-orders/_components/receive-po/ReceiveActionBar'
import { itemTitle } from '../../purchase-orders/_components/receive-po/itemTitle'
import {
  isDuplicateSerial,
  type Blocker,
  type IssueFix,
} from '../../purchase-orders/_components/receive-po/receiveIssues'
import { PoLinkPicker, outstandingOf } from './create-rr/PoLinkPicker'
import { RepossessedItemsPanel } from './create-rr/RepossessedItemsPanel'
import { RrDeliveryPanel, type WarehouseOption } from './create-rr/RrDeliveryPanel'
import { RrLineRow } from './create-rr/RrLineRow'
import { collectRrBlockers, rrLineIssues, toIssueLines } from './create-rr/rrChecks'
import { costFromPricing, rrTotals, type RrLine } from './create-rr/rrTotals'
import { PANEL, RR_LINE_GRID } from './create-rr/rrTokens'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReceiveStockFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseOption[]
  items: ItemSummary[]
  /** The receiver's own branch — a repossession line drops the Location
   * field entirely and lands silently in this branch's own warehouse
   * instead (developer-confirmed 2026-09-28). Null/undefined (unrestricted,
   * e.g. Business Owner) falls back to one of the 2 real warehouses. */
  actorBranchId?: string | null
  /** Unit cost is sensitive pricing data — hidden from Branch Manager/Stock
   * Controller, restricted to Business Owner/Accountant (Scenario 05 followup).
   * Server-side enforcement in receiveStock() is the real guard; this just
   * keeps the field out of view for roles who can't set it anyway. */
  canViewCost: boolean
  /** This form always does the same thing underneath (create a GoodsReceipt
   * — a receiving report — and post it to the ledger), but reads oddly as
   * "Receive Stock" when opened from the Receiving Reports list rather than
   * the stock-balances screen it was written for. Let the caller reframe
   * the copy instead of forking the form. */
  title?: string
  subtitle?: string
  submitLabel?: string
  submittingLabel?: string
}

/** What the form payload has no room for but the screen has to know: the item
 * facts behind a line's bare `itemId`. */
type ItemMeta = {
  name: string
  sku?: string
  isSerialTracked: boolean
  costPrice?: number | null
  modelNumber?: string | null
  brand?: { name: string } | null
  primaryCategory?: { name: string; parentCategory?: { name: string } | null } | null
}

const defaultValues: ReceiveStockFormValues = {
  purchaseOrderNumber: '',
  supplierId: '',
  newSourceName: '',
  warehouseId: '',
  modeOfTransfer: '',
  receivedAt: '',
  notes: '',
  deliveryReceiptNumber: '',
  supplierInvoiceNumber: '',
  reason: '',
  // Scenario 55 (Stock-side Manual RR parity) — mirrors ManualRrForm.tsx's
  // own defaultValues.lines exactly: one line ready for input on open, not
  // an empty list waiting on "+ Add Line". Goods + VAT is the common case
  // (same reasoning as Manual RR's own comment) — a receiver overrides per
  // line only for the exception.
  lines: [{ quantityReceived: 1, taxCode: 'VAT', withholdingClass: 'goods' }],
}

const emptyLine = (itemId: string): RrLine => ({
  itemId,
  quantityReceived: 1,
  isFreebie: false,
  qualityHold: false,
  batchNumber: '',
  notes: '',
})

/**
 * Create Receiving Report — the standalone half of receiving, for a delivery
 * that arrives without being received against a purchase order from the
 * Procurement side.
 *
 * Built on the same parts as that screen (checks card, serial capture, totals,
 * action bar) rather than beside them: both produce the same GoodsReceipt and
 * the same stock movement, and two hand-rolled receiving surfaces is how they
 * came to disagree about what a complete receipt looks like.
 *
 * What's different here is only what a free-standing delivery genuinely adds —
 * the receiver chooses the supplier, the destination and the items, and may
 * link a PO after the fact rather than starting from one.
 */
export default function ReceiveStockModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  items,
  actorBranchId,
  canViewCost,
  title = 'Receive Stock',
  subtitle = 'Record incoming stock into inventory.',
  submitLabel = 'Receive Stock',
  submittingLabel = 'Receiving…',
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<ReceiveStockFormValues>({
    resolver: zodResolver(ReceiveStockFormSchema),
    defaultValues,
  })

  const { fields, append, insert, remove } = useFieldArray({ control, name: 'lines' })

  const [submitted, setSubmitted] = useState(false)
  // Scenario 55 (Stock-side Manual RR parity) — this and the maps below are
  // all keyed by field.id (useFieldArray's own stable per-row identity),
  // mirroring ManualRrForm.tsx exactly: a line is added blank now, so two
  // simultaneously-blank rows would otherwise collide on any key derived
  // from their (empty) data instead.
  const [pickedItems, setPickedItems] = useState<Record<string, ItemMeta>>({})
  const [lineModes, setLineModes] = useState<Record<string, 'catalog' | 'other'>>({})
  // Scenario 55 (Stock-side Manual RR parity, follow-up) — a "Something
  // else" line has no catalog isSerialTracked flag to read, so whether it's
  // tracked is its own explicit toggle instead, mirroring ManualRrForm.tsx's
  // own lineTrackSerial exactly.
  const [otherLineTrackSerial, setOtherLineTrackSerial] = useState<Record<string, boolean>>({})
  const [installmentAccountLabels, setInstallmentAccountLabels] = useState<Record<string, string>>(
    {}
  )
  // Repossessed-from-account (developer-confirmed 2026-09-28) — who a
  // repossession line's unit is coming from, picked before the account
  // (which is then scoped to them). Local-only, like the other display maps
  // here: never submitted, just narrows the account search.
  const [repossessionCustomerIds, setRepossessionCustomerIds] = useState<Record<string, string>>({})
  const [repossessionCustomerLabels, setRepossessionCustomerLabels] = useState<
    Record<string, string>
  >({})
  // The picked account's own sold units (resolved via installmentSchedule ->
  // posTransactionLines), fetched once an account is selected. undefined =
  // nothing picked yet or still loading; [] = a hand-entered/imported
  // account with no linked schedule to resolve from (the fallback path).
  const [unitItemsByField, setUnitItemsByField] = useState<
    Record<string, InstallmentAccountUnitItem[] | undefined>
  >({})
  const [unitItemsLoadingByField, setUnitItemsLoadingByField] = useState<Record<string, boolean>>(
    {}
  )
  // True when the picked account DID have a linked schedule but every one
  // of its units has already been repossessed — distinct from a
  // hand-entered/imported account, which never had one at all. Both read as
  // "unitItemsByField[key] is []", so the fallback message needs this to
  // say the right thing instead of "no linked catalog sale" for an account
  // that very much had one.
  const [accountExhaustedByField, setAccountExhaustedByField] = useState<Record<string, boolean>>(
    {}
  )
  // Repossession, fallback path only (a hand-entered/imported account with
  // no unitItems to resolve from) — the manually-searched serial's display
  // label. One per line, not per unit: a repossession row is always exactly
  // one unit (developer-confirmed 2026-09-28), unlike a purchase line's
  // quantity-many serial slots.
  const [fallbackSerialLabels, setFallbackSerialLabels] = useState<Record<string, string>>({})
  const [linkedPo, setLinkedPo] = useState<PurchaseOrderSummary | null>(null)
  const [poPickerOpen, setPoPickerOpen] = useState(false)
  const [supplierName, setSupplierName] = useState<string | undefined>(undefined)
  // Scenario 55 (Stock-side Manual RR parity) — mirrors ManualRrForm.tsx's
  // own sourceMode: which of Source's two inputs is live. Decides what
  // post() below actually sends.
  const [sourceMode, setSourceMode] = useState<'registered' | 'new'>('registered')
  // Applied to every NEW line going forward, not retroactively to existing
  // ones — same convention and reasoning as ManualRrForm.tsx's own Defaults
  // bar, including the starting value: Goods + VAT is the common case.
  const [defaultTaxCode, setDefaultTaxCode] = useState('VAT')
  const [defaultWithholdingClass, setDefaultWithholdingClass] = useState('goods')

  useEffect(() => {
    if (isOpen) return
    reset(defaultValues)
    setSubmitted(false)
    setPickedItems({})
    setLineModes({})
    setOtherLineTrackSerial({})
    setInstallmentAccountLabels({})
    setRepossessionCustomerIds({})
    setRepossessionCustomerLabels({})
    setUnitItemsByField({})
    setUnitItemsLoadingByField({})
    setAccountExhaustedByField({})
    setFallbackSerialLabels({})
    setLinkedPo(null)
    setPoPickerOpen(false)
    setSupplierName(undefined)
    setSourceMode('registered')
    setDefaultTaxCode('VAT')
    setDefaultWithholdingClass('goods')
  }, [isOpen, reset])

  const watched = watch()
  // NOT memoised, deliberately. `watch()` shallow-copies the form values, so
  // `watched.lines` is the same array instance every render while setValue
  // mutates the objects inside it — anything derived from it with a useMemo
  // keyed on that reference computes once and then freezes, which is how a
  // checks card comes to report serials as missing that are typed and visible.
  // Every derivation below is a plain expression over a handful of rows.
  const lines = (watched.lines ?? []) as RrLine[]

  const metaFor = (itemId?: string): ItemMeta | undefined => {
    if (!itemId) return undefined
    if (pickedItems[itemId]) return pickedItems[itemId]
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item) return undefined
    return {
      name: item.name,
      sku: item.sku,
      isSerialTracked: item.isSerialTracked ?? false,
      costPrice: item.costPrice,
      modelNumber: item.modelNumber,
      brand: item.brand,
      primaryCategory: item.primaryCategory,
    }
  }

  const poLineOf = (line: RrLine): PurchaseOrderSummary['lines'][number] | undefined =>
    line.purchaseOrderLineId
      ? linkedPo?.lines.find((candidate) => candidate.id === line.purchaseOrderLineId)
      : undefined

  const contextFor = (index: number) => {
    const line = lines[index]
    const poLine = line ? poLineOf(line) : undefined
    const fieldId = fields[index]?.id ?? ''
    const mode = lineModeFor(fieldId, line)
    return {
      // Scenario 55 (Stock-side Manual RR parity, follow-up) — a "Something
      // else" line has no catalog meta to read isSerialTracked from; its own
      // "Track by serial number" toggle decides instead, same as
      // ManualRrForm.tsx's own isLineSerialTracked() — including that
      // function's own fallback: a field.id with no explicit toggle state
      // yet (a just-duplicated line) reads its copied serialNumbers instead,
      // so a duplicated tracked line doesn't silently lose tracking.
      isSerialTracked:
        !line || mode !== 'catalog'
          ? (otherLineTrackSerial[fieldId] ?? (line?.serialNumbers?.length ?? 0) > 0)
          : (metaFor(line.itemId)?.isSerialTracked ?? false),
      outstanding: poLine
        ? Math.max(Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0), 0)
        : null,
      poCode: linkedPo?.code,
    }
  }

  const labelFor = (index: number): string => {
    const line = lines[index]
    if (!line) return 'Line'
    // Scenario 55 (Stock-side Manual RR parity) — a "Something else" line
    // has no catalog meta to read a title from; its typed name is the title.
    if (!line.itemId && line.newItemName) return line.newItemName
    const meta = metaFor(line.itemId)
    return itemTitle(meta) || meta?.name || 'Line'
  }

  /** Scenario 55 (Stock-side Manual RR parity) — mirrors ManualRrForm.tsx's
   * own lineModeFor(): falls back to whichever of itemId/newItemName is
   * actually populated, so a PO-pulled line (always a real itemId) reads as
   * 'catalog' with zero extra bookkeeping. */
  function lineModeFor(fieldId: string, line?: RrLine): 'catalog' | 'other' {
    if (fieldId in lineModes) return lineModes[fieldId]
    return line?.newItemName ? 'other' : 'catalog'
  }

  const issueLines = toIssueLines(lines, contextFor, watched.reason)
  const totals = rrTotals(watched)
  // ReceiveActionBar speaks the PO screen's totals shape; the two extra flags
  // there are "does this delivery charge/withhold at all", read off the
  // already-derived per-line totals now that there's no header treatment to
  // ask instead (Scenario 55, Stock-side Manual RR parity).
  const barTotals = {
    ...totals,
    chargesInputVat: totals.vat > 0,
    withholdsTax: totals.withheld > 0,
  }

  const blockers = collectRrBlockers(
    {
      supplierId: watched.supplierId,
      newSourceName: watched.newSourceName,
      warehouseId: watched.warehouseId,
      deliveryReceiptNumber: watched.deliveryReceiptNumber,
      hasPoLink: lines.some((line) => !!line.purchaseOrderLineId),
      reason: watched.reason,
    },
    issueLines,
    labelFor
  )
  // receiveStock() rejects a submitted unitCost that isn't positive (a real
  // stored 0, not just "blank" — see get-installment-account.ts's own
  // unitCost, which can genuinely be a recorded zero for a historical sale).
  // Caught here rather than left for the server to reject after the fact:
  // RepossessedUnitRow already offers a Cost field the moment this applies.
  if (watched.reason === 'repossession') {
    lines.forEach((line, index) => {
      if (!line.itemId || Number(line.unitCost) > 0) return
      blockers.push({
        key: `repossession-cost-${index}`,
        kind: 'error',
        lineIndex: index,
        text: `${labelFor(index)}: needs a cost before it can be received.`,
      } satisfies Blocker)
    })
  }

  // Unit cost follows SRP through the discount chain, the same rule the PO
  // form and the receive-against-PO screen apply. Without it the two could
  // disagree on the same line: a receipt showing "3000 less 3% less 500"
  // beside a hand-typed cost of something else is worse than no discount at
  // all, because the numbers look reconciled and aren't.
  const pricingKey = JSON.stringify(
    lines.map((line) => [line?.srp, line?.discounts, line?.isFreebie])
  )
  useEffect(() => {
    lines.forEach((line, index) => {
      const next = costFromPricing(line)
      if (next == null || next === Number(line?.unitCost)) return
      setValue(`lines.${index}.unitCost`, next, { shouldValidate: false })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey])

  // Scenario 55 — PO Number/Supplier Invoice No. disappear once a reason is
  // picked (a reasoned receipt isn't fulfilling a PO or reconciling against a
  // supplier invoice), so a stale value entered before switching Reason on
  // would otherwise ride along invisibly instead of being what the
  // now-hidden field last showed. Source is deliberately NOT cleared here
  // (Scenario 55, Stock-side Manual RR parity) — it stays visible and
  // optional once reasoned, same as ManualRrForm.tsx's own Source field, so
  // a receiver who knows where a repair return or repossession actually came
  // from can still say so.
  useEffect(() => {
    if (!watched.reason) return
    if (watched.purchaseOrderNumber) setValue('purchaseOrderNumber', '', { shouldValidate: false })
    if (watched.supplierInvoiceNumber)
      setValue('supplierInvoiceNumber', '', { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.reason])

  // Repossession drops Location from the form entirely (developer-confirmed
  // 2026-09-28) — the destination still has to be a real warehouseId
  // server-side (receiveStock() requires one unconditionally), so it's set
  // here instead: the receiver's own branch warehouse, same one
  // stock.service.ts already forces a branch-scoped reasoned receipt into
  // regardless of what's submitted. Never overwrites an already-set value —
  // a PO link, or a Location picked before switching Reason on, both stay.
  useEffect(() => {
    if (watched.reason !== 'repossession' || watched.warehouseId) return
    const ownBranch = actorBranchId
      ? warehouses.find((w) => w.branchId === actorBranchId)
      : undefined
    const target = ownBranch ?? warehouses.find((w) => !w.branchId)
    if (target) setValue('warehouseId', target.id, { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.reason, watched.warehouseId, actorBranchId, warehouses])

  const outstandingNotPulled = useMemo(() => {
    if (!linkedPo) return []
    return linkedPo.lines.filter(
      (poLine) =>
        Math.max(Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0), 0) > 0 &&
        !lines.some((line) => line.purchaseOrderLineId === poLine.id)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedPo, lines.length])

  if (!isOpen) return null

  const showErrors = submitted

  // ─── Line mutations ───────────────────────────────────────────────────────

  /** Resizes the serial array alongside the quantity: RHF does not clear a
   * hidden index's value when the array shrinks, so a lowered qty otherwise
   * leaves stale slots that silently fail the length refine. */
  function setQuantity(index: number, raw: number): void {
    const qty = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0
    const line = lines[index]
    setValue(`lines.${index}.quantityReceived`, qty, { shouldValidate: showErrors })
    if (!line || !contextFor(index).isSerialTracked) return
    const serials = (line.serialNumbers ?? []).slice(0, qty)
    while (serials.length < qty) serials.push('')
    setValue(`lines.${index}.serialNumbers`, serials, { shouldValidate: showErrors })
    // Scenario 55 Part 4 — same resize, for a repossession line's picked ids.
    const existingSerials = (line.existingSerialNumberIds ?? []).slice(0, qty)
    while (existingSerials.length < qty) existingSerials.push('')
    setValue(`lines.${index}.existingSerialNumberIds`, existingSerials, {
      shouldValidate: showErrors,
    })
  }

  function setSerial(index: number, unitIndex: number, value: string): void {
    const next = (lines[index]?.serialNumbers ?? []).slice()
    while (next.length <= unitIndex) next.push('')
    next[unitIndex] = value
    setValue(`lines.${index}.serialNumbers`, next, { shouldValidate: showErrors })
  }

  /** Repossession, fallback path only (developer-confirmed 2026-09-28) — a
   * hand-entered/imported account has no unitItems to resolve from, so the
   * item and serial are searched manually instead. An account is always
   * already picked by the time this fires (that's what put the row into
   * this fallback in the first place), so there's nothing left to
   * auto-resolve here, just the pick itself. Always the row's one and only
   * unit (index 0) — a repossession row is never more than one unit. */
  function setFallbackSerial(
    index: number,
    id: string,
    _meta?: RepossessedSerialMeta,
    label?: string
  ): void {
    const key = fields[index]?.id ?? ''
    setValue(`lines.${index}.existingSerialNumberIds`, id ? [id] : undefined, {
      shouldValidate: showErrors,
    })
    setFallbackSerialLabels((prev) => ({ ...prev, [key]: label ?? '' }))
  }

  /** Repossession — the cost typed in by hand, either because there's no
   * original-sale record to pull one from (fallback path) or because there
   * is one but it's not usable (missing or a recorded zero — see
   * RepossessedUnitRow's own resolved-but-no-cost branch). */
  function setUnitCost(index: number, value: number | undefined): void {
    setValue(`lines.${index}.unitCost`, value, { shouldValidate: false })
  }

  /** Repossession, Part 1 — who a repossessed unit is coming from, picked
   * before the account (InstallmentAccountSearchCombobox's own customerId
   * prop scopes to them). Changing this clears whatever account/unit/cost
   * were already resolved under a different customer, so a stale pick can't
   * ride along pointing at someone no longer shown. */
  function setRepossessionCustomer(index: number, id: string, label?: string): void {
    const key = fields[index]?.id ?? ''
    setRepossessionCustomerIds((prev) => ({ ...prev, [key]: id }))
    setRepossessionCustomerLabels((prev) => ({ ...prev, [key]: label ?? '' }))
    if (!lines[index]?.installmentAccountId) return
    setValue(`lines.${index}.installmentAccountId`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.itemId`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.existingSerialNumberIds`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.unitCost`, undefined, { shouldValidate: false })
    setInstallmentAccountLabels((prev) => ({ ...prev, [key]: '' }))
    setUnitItemsByField((prev) => ({ ...prev, [key]: undefined }))
    setAccountExhaustedByField((prev) => ({ ...prev, [key]: false }))
  }

  /** Repossession, Part 2 — picking the account (whether via the
   * "Installment" field itself or the "Invoice #" one — both are the same
   * search, just framed differently) fetches its own sold unit(s)
   * (installmentSchedule -> posTransactionLines) so the item, serial, AND
   * cost can be shown rather than asked for: exactly one unit auto-fills
   * outright (cost = what it was actually sold at, so a real cost layer gets
   * created on receiving — a blank/zero cost silently created none at all),
   * several are left for the row's own unit picker (a shared-term account
   * can span more than one DIFFERENT item — Scenario 23), and none at all (a
   * hand-entered/imported account has no linked schedule to resolve from)
   * falls back to the old manual item+serial+cost entry.
   *
   * Also fills in "Repossessed From" from meta.customerName when the
   * account was found some other way than searching for the customer first
   * (by invoice #, item, or serial) — resolving the account this way is
   * just as authoritative about who it belongs to. */
  function setInstallmentAccount(
    index: number,
    id: string,
    meta?: InstallmentAccountMeta,
    label?: string
  ): void {
    const key = fields[index]?.id ?? ''
    setValue(`lines.${index}.installmentAccountId`, id || undefined, { shouldValidate: false })
    setValue(`lines.${index}.itemId`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.existingSerialNumberIds`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.unitCost`, undefined, { shouldValidate: false })
    setInstallmentAccountLabels((prev) => ({ ...prev, [key]: label ?? '' }))
    setUnitItemsByField((prev) => ({ ...prev, [key]: undefined }))
    setAccountExhaustedByField((prev) => ({ ...prev, [key]: false }))
    if (meta?.customerId) {
      setRepossessionCustomerIds((prev) => ({ ...prev, [key]: meta.customerId }))
      setRepossessionCustomerLabels((prev) => ({ ...prev, [key]: meta.customerName ?? '' }))
    }
    if (!id) return

    setUnitItemsLoadingByField((prev) => ({ ...prev, [key]: true }))
    void (async () => {
      const res = await getInstallmentAccount(id)
      const allUnitItems = res.data?.unitItems ?? []
      // Only a unit still actually out with the customer (serialStatus
      // 'sold') is available to repossess again — one already brought back
      // by an earlier receipt (status now in_stock) has nothing left to
      // resolve and must not be offered a second time. allUnitItems.length
      // vs this filtered count is also how "genuinely no linked sale"
      // (hand-entered/imported account) is told apart from "linked, but
      // every unit already repossessed" below — the fallback message reads
      // differently for each.
      const unitItems = allUnitItems.filter((u) => u.serialNumberId && u.serialStatus === 'sold')
      setUnitItemsByField((prev) => ({ ...prev, [key]: unitItems }))
      setAccountExhaustedByField((prev) => ({
        ...prev,
        [key]: allUnitItems.length > 0 && unitItems.length === 0,
      }))
      setUnitItemsLoadingByField((prev) => ({ ...prev, [key]: false }))
      if (unitItems.length !== 1) return
      applyRepossessionUnit(index, unitItems[0])
    })()
  }

  /** Shared by the auto-fill-on-single-match path above and the row's own
   * unit picker (>1-unit case) below — resolves a picked unit into the
   * line's itemId/existingSerialNumberIds/unitCost, and remembers the item's
   * display meta the same way a catalog pick would. */
  function applyRepossessionUnit(index: number, unit: InstallmentAccountUnitItem): void {
    if (!unit.serialNumberId) return
    rememberItem(unit.itemId, {
      name: unit.itemName ?? unit.itemId,
      isSerialTracked: true,
      modelNumber: unit.modelNumber,
      brand: unit.brand ? { name: unit.brand } : null,
    })
    setValue(`lines.${index}.itemId`, unit.itemId, { shouldValidate: false })
    setValue(`lines.${index}.existingSerialNumberIds`, [unit.serialNumberId], {
      shouldValidate: false,
    })
    // Repo Cost, not the original sale cost — the client's formula.
    setValue(`lines.${index}.unitCost`, unit.repoCost > 0 ? unit.repoCost : undefined, {
      shouldValidate: false,
    })
  }

  /** The form only ever stores a picked serial's id — this resolves its
   * display string back out of the account's own unitItems, so the summary
   * row can show which serial was picked, not just the item. */
  function serialLabelFor(fieldId: string, serialNumberId?: string): string | undefined {
    if (!serialNumberId) return undefined
    return (
      unitItemsByField[fieldId]?.find((u) => u.serialNumberId === serialNumberId)?.serialNumber ??
      undefined
    )
  }

  /** Whether the RESOLVED unit itself had a usable recorded cost — read off
   * unitItemsByField, never off the line's own (live-edited) unitCost. A
   * row with no original cost still needs a Cost input once the receiver
   * starts typing a positive number into it; deciding "editable or not" off
   * the value being typed would yank the input away mid-keystroke the
   * moment it crosses 0. */
  function hasOriginalCost(fieldId: string, serialNumberId?: string): boolean {
    if (!serialNumberId) return false
    const repoCost = unitItemsByField[fieldId]?.find(
      (u) => u.serialNumberId === serialNumberId
    )?.repoCost
    return repoCost != null && repoCost > 0
  }

  function toggleFreebie(index: number): void {
    const next = !lines[index]?.isFreebie
    setValue(`lines.${index}.isFreebie`, next, { shouldValidate: false })
    // The server forces a freebie's cost to 0 whatever is submitted, so the
    // form says the same thing rather than posting a number it knows is void.
    if (next) setValue(`lines.${index}.unitCost`, 0, { shouldValidate: false })
  }

  function toggleQualityHold(index: number): void {
    const next = !lines[index]?.qualityHold
    setValue(`lines.${index}.qualityHold`, next, { shouldValidate: false })
    // Dropping the hold drops its reason with it — a stale explanation on an
    // un-held line would post as a plain line note saying the opposite.
    if (!next) setValue(`lines.${index}.notes`, '', { shouldValidate: false })
  }

  function rememberItem(itemId: string, meta: ItemMeta): void {
    setPickedItems((prev) => ({ ...prev, [itemId]: meta }))
  }

  /** Scenario 55 (Stock-side Manual RR parity) — mirrors ManualRrForm.tsx's
   * own addLine(): a blank row, priced and taxed with whatever the Defaults
   * bar currently says. The receiver picks or types the item inside the row
   * itself afterward — this screen no longer adds a line by scanning
   * straight into a header search box. */
  function addLine(): void {
    append({
      quantityReceived: 1,
      isFreebie: false,
      qualityHold: false,
      batchNumber: '',
      notes: '',
      taxCode: defaultTaxCode || undefined,
      withholdingClass: defaultWithholdingClass || undefined,
    })
  }

  /** Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
   * ManualRrForm.tsx's own duplicateLine() exactly. The copy's own
   * mode/serial-tracked-ness needs no explicit bookkeeping — lineModeFor()/
   * contextFor() already fall back to reading it off the copied itemId/
   * newItemName/serialNumbers for a field.id that has no map entry yet. */
  function duplicateLine(index: number): void {
    const line = lines[index]
    if (!line) return
    insert(index + 1, { ...line, discounts: line.discounts ? [...line.discounts] : undefined })
  }

  function setLineMode(index: number, fieldId: string, mode: 'catalog' | 'other'): void {
    setLineModes((prev) => ({ ...prev, [fieldId]: mode }))
    setValue(`lines.${index}.itemId`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.newItemName`, '', { shouldValidate: false })
    setValue(`lines.${index}.serialNumbers`, undefined, { shouldValidate: false })
    setValue(`lines.${index}.existingSerialNumberIds`, undefined, { shouldValidate: false })
    setOtherLineTrackSerial((prev) => ({ ...prev, [fieldId]: false }))
  }

  /** Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
   * ManualRrForm.tsx's own toggleLineTrackSerial() exactly. */
  function toggleOtherLineTrackSerial(index: number, fieldId: string): void {
    const next = !(otherLineTrackSerial[fieldId] ?? false)
    setOtherLineTrackSerial((prev) => ({ ...prev, [fieldId]: next }))
    const qty = Number(lines[index]?.quantityReceived) || 0
    setValue(
      `lines.${index}.serialNumbers`,
      next ? Array.from({ length: qty }, () => '') : undefined,
      { shouldValidate: showErrors }
    )
  }

  /** Scenario 55 (Stock-side Manual RR parity) — picking a catalog item now
   * happens inside an already-added row (mirrors
   * ManualRrForm.tsx's own onSelectCatalogItem), not at an add step that
   * merges into an existing line — two rows can end up pointing at the same
   * item with nothing reconciling them, same accepted tradeoff Manual RR
   * already ships with. */
  function onSelectCatalogItem(index: number, option: SearchComboboxOption): void {
    const meta = option.meta as ItemSearchMeta | undefined
    const isSerialTracked = meta?.isSerialTracked ?? false
    rememberItem(option.id, {
      name: option.primary,
      sku: option.secondary,
      isSerialTracked,
      costPrice: meta?.costPrice ?? null,
    })
    if (meta?.costPrice != null) {
      setValue(`lines.${index}.unitCost`, meta.costPrice, { shouldValidate: false })
    }
    if (isSerialTracked) {
      const qty = Number(lines[index]?.quantityReceived) || 1
      setValue(
        `lines.${index}.serialNumbers`,
        Array.from({ length: qty }, () => ''),
        {
          shouldValidate: false,
        }
      )
      // Serial inputs render inline as soon as isSerialTracked is true (see
      // RrLineRow.tsx) — nothing left to open.
    }
  }

  /** Repossession, fallback path only — picking the item by hand (no
   * account-resolved unit to derive it from). Unlike an ordinary catalog
   * pick, this never touches unitCost: the catalog's current cost price
   * means nothing for a unit re-entering stock from a customer, not a
   * supplier — the receiver types the actual figure themselves (see
   * setUnitCost). */
  function onSelectFallbackItem(index: number, option: SearchComboboxOption): void {
    rememberItem(option.id, {
      name: option.primary,
      sku: option.secondary,
      isSerialTracked: true,
    })
    setValue(`lines.${index}.itemId`, option.id, { shouldValidate: false })
    setValue(`lines.${index}.existingSerialNumberIds`, undefined, { shouldValidate: false })
  }

  /** Repossession rows have no quantity of their own (always exactly one
   * unit) and none of the purchase-pricing/tax fields a normal line
   * defaults — see addLine() below for the ordinary case this mirrors. */
  function addRepossessionUnit(): void {
    append({ quantityReceived: 1 })
  }

  function pullPoLines(): void {
    if (!linkedPo) return
    let pulled = 0
    linkedPo.lines.forEach((poLine) => {
      const outstanding = Math.max(
        Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0),
        0
      )
      if (outstanding <= 0) return
      if (lines.some((line) => line.purchaseOrderLineId === poLine.id)) return
      const isSerialTracked = poLine.item?.isSerialTracked ?? false
      rememberItem(poLine.itemId, {
        name: poLine.item?.name ?? poLine.itemId,
        sku: poLine.item?.sku,
        isSerialTracked,
        costPrice: Number(poLine.unitPrice),
        modelNumber: poLine.item?.modelNumber,
        brand: poLine.item?.brand,
        primaryCategory: poLine.item?.primaryCategory,
      })
      append({
        ...emptyLine(poLine.itemId),
        purchaseOrderLineId: poLine.id,
        quantityReceived: outstanding,
        unitCost: Number(poLine.unitPrice) > 0 ? Number(poLine.unitPrice) : undefined,
        srp: poLine.srp != null ? Number(poLine.srp) : undefined,
        discounts: poLine.discounts ?? undefined,
        isFreebie: poLine.isFreebie ?? false,
        ...(isSerialTracked && { serialNumbers: Array.from({ length: outstanding }, () => '') }),
      })
      pulled += 1
    })
    if (pulled > 0) {
      showToast({
        title: `${pulled} outstanding ${pulled === 1 ? 'line' : 'lines'} pulled from ${linkedPo.code}`,
        status: 'success',
      })
    }
  }

  function linkPo(po: PurchaseOrderSummary): void {
    setLinkedPo(po)
    setPoPickerOpen(false)
    setValue('purchaseOrderNumber', po.code, { shouldValidate: false })
    setValue('supplierId', po.supplierId, { shouldValidate: showErrors })
    setSupplierName(po.supplier.name)
    // Only adopt the PO's destination when it is one this form can actually
    // post to — receiving is restricted to the real warehouses, and a PO
    // raised for a branch's own location is not in this list.
    if (!watched.warehouseId && po.warehouseId && warehouses.some((w) => w.id === po.warehouseId)) {
      setValue('warehouseId', po.warehouseId, { shouldValidate: showErrors })
    }
  }

  function unlinkPo(): void {
    setLinkedPo(null)
    setValue('purchaseOrderNumber', '', { shouldValidate: false })
    // The goods stay on the receipt — only what they answer to is dropped.
    lines.forEach((line, index) => {
      if (!line.purchaseOrderLineId) return
      setValue(`lines.${index}.purchaseOrderLineId`, undefined, { shouldValidate: false })
    })
  }

  function applyLineFix(index: number, fix?: IssueFix): void {
    const line = lines[index]
    if (!line) return
    if (fix === 'qty') setQuantity(index, Math.max(1, line.quantityReceived || 0))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /** Posts straight from the entry screen — there is no review step. The two
   * gates below are all that stand between this and a stock movement that can
   * only be undone with a debit memo, so neither may fail silently. */
  async function postNow(): Promise<void> {
    setSubmitted(true)
    if (blockers.length > 0) {
      showToast({
        title: `${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'} must be resolved first`,
        description: blockers[0].text,
        status: 'error',
      })
      return
    }
    // Belt and braces: the checks card is derived from watched values, the
    // resolver is what the post actually has to satisfy. Failing silently here
    // would look like a dead button.
    if (!(await trigger())) {
      showToast({
        title: 'Some lines still need attention',
        description: 'Check the highlighted quantities and serial numbers.',
        status: 'error',
      })
      return
    }
    void handleSubmit(post)()
  }

  async function post(data: ReceiveStockFormValues): Promise<void> {
    const reason = data.reason || undefined
    const result = await onSubmit({
      ...data,
      reason,
      // Scenario 55 (Stock-side Manual RR parity) — mirrors
      // ManualRrForm.tsx's own handleSubmit: sourceMode decides which of the
      // two ever actually goes out, whatever the other field is still
      // holding from before a toggle. A PO link always wins regardless of
      // mode — its supplierId is the one already set by linkPo().
      supplierId:
        linkedPo || sourceMode === 'registered' ? data.supplierId || undefined : undefined,
      newSourceName:
        !linkedPo && sourceMode === 'new' ? data.newSourceName?.trim() || undefined : undefined,
      lines: data.lines.map((line) => ({
        ...line,
        // Same either-or as the header Source field, per line: a catalog
        // pick wins outright, otherwise the typed name goes out.
        newItemName: line.itemId ? undefined : line.newItemName?.trim() || undefined,
        batchNumber: line.batchNumber?.trim() || undefined,
        notes: line.notes?.trim() || undefined,
        taxCode: line.taxCode || undefined,
        discounts: line.discounts && line.discounts.length > 0 ? line.discounts : undefined,
        // Mutually exclusive on the wire (receiveStock() rejects a line that
        // sets both) — only one of these two is ever real per line, gated on
        // the same reason check.
        serialNumbers:
          reason !== 'repossession' && line.serialNumbers && line.serialNumbers.length > 0
            ? line.serialNumbers
            : undefined,
        existingSerialNumberIds:
          reason === 'repossession' &&
          line.existingSerialNumberIds &&
          line.existingSerialNumberIds.length > 0
            ? line.existingSerialNumberIds
            : undefined,
        // Only meaningful for a repossession line — dropped otherwise so a
        // stale pick from switching reasons mid-form can't ride along.
        installmentAccountId:
          reason === 'repossession' ? line.installmentAccountId || undefined : undefined,
      })),
    })
    if (result.success) onClose()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasLines = fields.length > 0

  return (
    // absolute, not fixed: the working surface fills the content column (the
    // app shell's `main` is the positioning frame) so the nav sidebar and top
    // bar stay usable while a delivery is being received. Same shell as the
    // receive-against-PO screen.
    <div
      className={`${PLEX} absolute inset-0 z-50 flex flex-col overflow-y-auto bg-[#f2f2f3] text-[#17171c]`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-5 border-b border-[#e4e4e9] bg-white px-4 py-3.5 lg:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
            Inventory › Receiving › New
          </div>
          <h2 className="text-[21px] font-semibold tracking-[-.02em]">{title}</h2>
          <p className="text-[12.5px] text-[#5b5b6b]">{subtitle}</p>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[11px] text-[#5b5b6b]">Receiving</span>
            <span
              className={`${MONO} text-[18px] font-semibold tracking-[-.02em] ${
                totals.units > 0 ? 'text-[#17171c]' : 'text-[#a3a3b2]'
              }`}
            >
              {totals.units} {totals.units === 1 ? 'unit' : 'units'} · {totals.lines}{' '}
              {totals.lines === 1 ? 'line' : 'lines'}
            </span>
          </div>
          <Tooltip label="Close" side="bottom" align="end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-3.5 px-3.5 py-4 lg:px-5">
        <RrDeliveryPanel
          control={control}
          errors={errors}
          warehouses={warehouses}
          showErrors={showErrors}
          supplierId={watched.supplierId ?? ''}
          supplierName={supplierName}
          linkedPo={linkedPo}
          reason={watched.reason || undefined}
          sourceMode={sourceMode}
          onSourceModeChange={setSourceMode}
          onSupplierChange={(id, name) => {
            setValue('supplierId', id, { shouldValidate: showErrors })
            setSupplierName(name)
          }}
          onBrowsePo={() => setPoPickerOpen(true)}
          onUnlinkPo={unlinkPo}
        />

        {watched.reason === 'repossession' ? (
          <RepossessedItemsPanel
            fields={fields}
            lines={lines}
            canViewCost={canViewCost}
            showErrors={showErrors}
            issuesFor={(index) =>
              rrLineIssues(issueLines, index, contextFor(index), lines[index] ?? {}).filter(
                (issue) => showErrors || issue.kind === 'warn'
              )
            }
            itemNameFor={(itemId) => (itemId ? metaFor(itemId)?.name : undefined)}
            serialLabelFor={serialLabelFor}
            hasOriginalCostFor={hasOriginalCost}
            customerIdFor={(fieldId) => repossessionCustomerIds[fieldId]}
            customerLabelFor={(fieldId) => repossessionCustomerLabels[fieldId]}
            onCustomerChange={(index, id, label) => setRepossessionCustomer(index, id, label)}
            installmentAccountLabelFor={(fieldId) => installmentAccountLabels[fieldId]}
            onInstallmentAccountChange={(index, id, meta, label) =>
              setInstallmentAccount(index, id, meta, label)
            }
            unitItemsFor={(fieldId) => unitItemsByField[fieldId]}
            unitItemsLoadingFor={(fieldId) => unitItemsLoadingByField[fieldId]}
            accountExhaustedFor={(fieldId) => accountExhaustedByField[fieldId]}
            onPickUnit={(index, unitItem) => applyRepossessionUnit(index, unitItem)}
            onSelectFallbackItem={(index, option) => onSelectFallbackItem(index, option)}
            fallbackSerialLabelFor={(fieldId) => fallbackSerialLabels[fieldId]}
            onFallbackSerialChange={(index, id, meta, label) =>
              setFallbackSerial(index, id, meta, label)
            }
            onCostChange={(index, value) => setUnitCost(index, value)}
            onAdd={addRepossessionUnit}
            onRemove={(index) => remove(index)}
          />
        ) : (
          <div className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3.5">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13.5px] font-semibold">
                    Items received <span className="text-[#b42318]">*</span>
                  </span>
                  <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
                    {fields.length} {fields.length === 1 ? 'line' : 'lines'} · {totals.units} units
                  </span>
                </div>
                <span className="text-[11.5px] text-[#8b8b9b]">
                  Pick a catalog item, or mark it &ldquo;Non-catalog items&rdquo; for anything not
                  in the catalog.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {outstandingNotPulled.length > 0 && (
                  <button
                    type="button"
                    onClick={pullPoLines}
                    className="rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                  >
                    Pull {outstandingNotPulled.length} outstanding{' '}
                    {outstandingNotPulled.length === 1 ? 'line' : 'lines'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </button>
              </div>
            </div>

            {/* Scenario 55 (Stock-side Manual RR parity) — mirrors
              ManualRrForm.tsx's own Defaults bar exactly: applied to every
              new line going forward, not retroactively. */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-2">
              <span className="text-[11px] text-[#8b8b9b]">Defaults</span>
              <select
                value={defaultTaxCode}
                onChange={(e) => setDefaultTaxCode(e.target.value)}
                aria-label="Default tax code"
                className="h-6.5 rounded-md border border-[#d3d3db] bg-white px-1.5 text-[11.5px] text-[#5b5b6b] outline-none focus:border-[#5b21b6]"
              >
                {MANUAL_RR_TAX_CODES.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <select
                value={defaultWithholdingClass}
                onChange={(e) => setDefaultWithholdingClass(e.target.value)}
                aria-label="Default withholding"
                className="h-6.5 rounded-md border border-[#d3d3db] bg-white px-1.5 text-[11.5px] text-[#5b5b6b] outline-none focus:border-[#5b21b6]"
              >
                {MANUAL_RR_WITHHOLDING_CLASSES.map((cls) => (
                  <option key={cls.value} value={cls.value}>
                    {cls.label}
                  </option>
                ))}
              </select>
            </div>

            {!hasLines ? (
              <div className="flex flex-col items-center gap-2 px-5.5 py-10 text-center">
                <PackagePlus className="h-7 w-7 text-[#d3d3db]" />
                <span className="text-[13.5px] font-semibold">No items added yet.</span>
                <span className="max-w-[430px] text-[12px] leading-[1.55] text-[#5b5b6b]">
                  {linkedPo
                    ? `Add a line, or pull the lines ${linkedPo.code} is still waiting on.`
                    : 'Add a line, then pick a catalog item or name what arrived.'}
                </span>
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
                  className={`${MONO} ${RR_LINE_GRID} hidden border-b border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-2.5 text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] lg:grid`}
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
                  const line = lines[index]
                  if (!line) return null
                  const context = contextFor(index)
                  const mode = lineModeFor(field.id, line)
                  return (
                    <RrLineRow
                      key={field.id}
                      control={control}
                      lineIndex={index}
                      line={line}
                      mode={mode}
                      onSetMode={(m) => setLineMode(index, field.id, m)}
                      itemName={line.itemId ? metaFor(line.itemId)?.name : undefined}
                      isSerialTracked={context.isSerialTracked}
                      poChip={
                        context.outstanding != null && linkedPo
                          ? `${context.outstanding} outstanding on ${linkedPo.code}`
                          : undefined
                      }
                      canViewCost={canViewCost}
                      showErrors={showErrors}
                      itemError={errors.lines?.[index]?.itemId?.message}
                      issues={rrLineIssues(issueLines, index, context, line).filter(
                        (issue) => showErrors || issue.kind === 'warn'
                      )}
                      isDuplicateSerial={(unit) => isDuplicateSerial(issueLines, index, unit)}
                      onSelectCatalogItem={(option) => onSelectCatalogItem(index, option)}
                      onQtyChange={(raw) => setQuantity(index, raw)}
                      onSerialChange={(unit, value) => setSerial(index, unit, value)}
                      onClearSerials={() =>
                        setValue(
                          `lines.${index}.serialNumbers`,
                          Array.from({ length: line.quantityReceived || 0 }, () => ''),
                          { shouldValidate: showErrors }
                        )
                      }
                      onToggleTrackSerial={() => toggleOtherLineTrackSerial(index, field.id)}
                      onToggleFreebie={() => toggleFreebie(index)}
                      onToggleQualityHold={() => toggleQualityHold(index)}
                      onQcReasonChange={(value) =>
                        setValue(`lines.${index}.notes`, value, { shouldValidate: false })
                      }
                      onDuplicate={() => duplicateLine(index)}
                      onRemove={() => remove(index)}
                      onFixIssue={(fix) => applyLineFix(index, fix)}
                    />
                  )
                })}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-[#e4e4e9] bg-[#fbfbfc] px-4.5 py-3">
                  <span className="text-[11.5px] text-[#8b8b9b]">
                    Held lines land in quarantine, not as sellable stock. Freebies are received at
                    zero cost.
                  </span>
                  <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>
                    {totals.units} units{canViewCost && ` · ${fmtPeso(totals.invoice)} invoiced`}
                  </span>
                </div>
              </>
            )}
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
          {errors.notes && (
            <span className="text-[11.5px] text-[#b42318]">{errors.notes.message}</span>
          )}
        </div>
      </div>

      <ReceiveActionBar
        blockerCount={blockers.length}
        showBlockers={showErrors}
        totals={barTotals}
        deliveryReceiptNumber={watched.deliveryReceiptNumber ?? ''}
        isSubmitting={isSubmitting}
        onCancel={onClose}
        onPrimary={postNow}
        primaryLabel={submitLabel}
        submittingLabel={submittingLabel}
      />

      {poPickerOpen && (
        <PoLinkPicker
          supplierId={watched.supplierId || undefined}
          supplierName={supplierName}
          onPick={linkPo}
          onClose={() => setPoPickerOpen(false)}
        />
      )}
    </div>
  )
}

/** Re-exported for the tests and callers that reach for it. */
export { outstandingOf }
