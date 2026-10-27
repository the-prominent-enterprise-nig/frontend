'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import {
  APBills,
  APBillMatching,
  type APBill,
  type APBillPurchaseOrderOption,
  type APBillGoodsReceiptOption,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { discountChainLabel } from '@/src/libs/format/discount-chain'
import { EwtCodeSelect } from '@/src/components/accounting/EwtCodeSelect'
import { TaxOverrideBox, TaxOverrideSummary } from '@/src/components/accounting/TaxOverride'
import { useMe } from '@/src/hooks/useMe'
import { can } from '@/src/libs/guards/permission'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { useEwtCodes } from '@/src/hooks/useEwtCodes'
import { useInputVatCodes } from '@/src/hooks/useInputVatCodes'
import { fmtPercent, supplierEwtCode } from '@/src/libs/tax/ewt'
import {
  TAX_OVERRIDE_PERMISSION,
  changeOf,
  freshChanges,
  reasonMissingMessage,
  reasonOk,
  standingFor,
  type TaxOverrideChange,
} from '@/src/libs/tax/tax-override'
import {
  INPUT_VAT_EXEMPT,
  INPUT_VAT_NON_VAT,
  INPUT_VAT_STANDARD,
  SUPPLIER_VAT_STATUS_LABEL,
  claimsInputVat,
  defaultInputVatCode,
  inputVatOn,
  inputVatOptionLabel,
  isCapexAccount,
  isMasterInputVatCode,
  needsLineAccount,
  needsProjectAssetRef,
  supplierMayChargeVat,
  supplierVatStatus,
  type SupplierVatStatus,
} from '@/src/libs/tax/input-vat'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import { getSupplier } from '@/src/app/(app)/(dashboard)/accounting/suppliers/_actions/get-supplier'

// Scenario 41 — same treatment Scenario 40 gave Expenses (developer
// feedback, 2026-08-31): this used to be a modal, now its own full page,
// matching the reference accounting tool. Same fields/flow as before, just
// its own route now: /accounting/ap-bills/new and /accounting/ap-bills/[id]/edit
// both render this one component, the latter passing billId to load the
// draft first.
/** The voucher this bill was paid on, once a payment has actually been made. */
function paidVoucherIdOf(bill: APBill): string | undefined {
  return bill.disbursementAllocations?.find(
    (a) => a.disbursement.status === 'PAID' || a.disbursement.status === 'PARTIAL'
  )?.disbursement.id
}

export default function BillForm({ billId }: { billId?: string }) {
  const router = useRouter()
  // ?details=1 is the way back from the payment screen to the invoice's own
  // paperwork — without it, Edit on a paid bill opens the payment.
  const wantsDetails = useSearchParams().get('details') === '1'
  const [initial, setInitial] = useState<APBill | null>(null)
  const [ready, setReady] = useState(!billId)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!billId) return
    APBills.get(billId).then((res) => {
      if (res.success && res.data) {
        // Only a cancelled bill is shut. Every other status reaches this form,
        // PAID included (the client wants a bill's own paperwork editable
        // after Record Payment) — how much of it is editable is decided below
        // (BillFormFields' isLocked), not gated here.
        const paidOn = paidVoucherIdOf(res.data)
        if (res.data.status === 'CANCELLED') {
          setLoadError('This bill is cancelled and can no longer be edited.')
        } else if (paidOn && !wantsDetails) {
          // A bill that has been paid opens on the screen it was paid on —
          // the Voucher, filled in, with a warning — not on a second, different
          // form for the same payment. Left loading while the page swaps.
          router.replace(`/accounting/ap-bills/payments/new?edit=${paidOn}`)
          return
        } else {
          setInitial(res.data)
        }
      } else {
        setLoadError(res.message || res.error || 'Bill not found.')
      }
      setReady(true)
    })
  }, [billId, wantsDetails, router])

  if (!ready) {
    return <div className="px-6 py-8 lg:px-10 text-sm text-gray-400">Loading…</div>
  }
  if (loadError) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/accounting/ap-bills"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AP Invoices
        </Link>
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {loadError}
        </div>
      </div>
    )
  }

  return <BillFormFields initial={initial} onSaved={() => router.push('/accounting/ap-bills')} />
}

/** Scenario 46 — one editable invoice line in the bill form. */
interface BillLineState {
  itemId: string
  itemLabel: string
  description: string
  quantity: string
  unitPrice: string
  discountValue: string
  discountType: 'percentage' | 'amount'
  isFreebie: boolean
  notes: string
  /** Scenario 69 Part G — the input VAT code someone picked for the line, from
   * the tax code master. Blank means "whatever the supplier starts on", so a
   * line follows its supplier until a code is chosen (see codeOf). */
  taxCode: string
  /** The project or asset a VAT-IN-CAPEX line is for. */
  projectAssetRef: string
  /** The account this line's net posts to, when it is not the bill's own. */
  accountId: string
}
function emptyBillLine(): BillLineState {
  return {
    itemId: '',
    itemLabel: '',
    description: '',
    quantity: '',
    unitPrice: '',
    discountValue: '',
    discountType: 'percentage',
    isFreebie: false,
    notes: '',
    taxCode: '',
    projectAssetRef: '',
    accountId: '',
  }
}
function billLineTotal(l: BillLineState): number {
  // A freebie was billed as a line but costs nothing, matching how PO and RR
  // lines have always treated it.
  if (l.isFreebie) return 0
  return (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
}

/** A line saved before input VAT codes existed carries nothing, or one of the
 * older spellings: show it as the master's own code so the picker has a value.
 * Nothing at all stays blank, and takes the supplier's default once that is
 * known. */
function masterCodeFor(stored: string | null | undefined): string {
  if (!stored) return ''
  if (isMasterInputVatCode(stored)) return stored.toUpperCase()
  switch (stored.toUpperCase()) {
    case 'VAT':
    case 'INPUT_VAT':
      return INPUT_VAT_STANDARD
    case 'NON_VAT':
    case 'NON_TAXABLE':
      return INPUT_VAT_NON_VAT
    case 'EXEMPT':
      return INPUT_VAT_EXEMPT
    default:
      return ''
  }
}

function BillFormFields({ initial, onSaved }: { initial: APBill | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    supplierId: initial?.supplierId ?? '',
    purchaseOrderId: initial?.purchaseOrderId ?? '',
    goodsReceiptIds: initial?.goodsReceipts?.map((r) => r.id) ?? ([] as string[]),
    billDate: initial?.billDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate:
      initial?.dueDate?.slice(0, 10) ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: initial?.description ?? '',
    // Scenario 41 — the supplier's own invoice number; never generated by
    // this system. Required to create a bill by hand; may still be blank
    // when editing a DRAFT auto-generated off a receipt, filled in here
    // once the real invoice arrives.
    billNumber: initial?.billNumber ?? '',
    subtotal: String(initial?.subtotal ?? ''),
    taxAmount: String(initial?.taxAmount ?? ''),
    // Left blank on a new bill so the backend auto-calculates it from the
    // withholding tax code's rate; pre-filled here so editing an existing
    // bill shows (and can override) what was actually computed.
    withholdingAmount: initial?.withholdingAmount != null ? String(initial.withholdingAmount) : '',
    // Scenario 69 Part D — the EWT code the withholding is computed at. Blank
    // means the supplier's own default; a bill that already carries a code
    // starts on it.
    withholdingTaxCode: initial?.withholdingTaxCode ?? '',
  })
  const ewt = useEwtCodes()
  const inputVat = useInputVatCodes()
  // Scenario 69 Part I — a code kept away from the supplier's default is an
  // override: it needs this permission, and a reason.
  const { data: me } = useMe()
  const canOverride = !!me && can(me, TAX_OVERRIDE_PERMISSION)
  const [overrideReason, setOverrideReason] = useState('')
  // The supplier's VAT status decides what each line starts as and whether a
  // claimable code is allowed at all (Scenario 69 Part G).
  const [supplierVat, setSupplierVat] = useState<{
    name: string
    status: SupplierVatStatus
    /** The code the supplier's bills are withheld at unless one is chosen. */
    ewtCode: string
  } | null>(null)
  const supplierStatus: SupplierVatStatus = supplierVat?.status ?? 'VAT'
  const lineDefaultCode = defaultInputVatCode(supplierStatus)
  const mayClaim = supplierMayChargeVat(supplierStatus)
  // A capital line posts to a property / equipment account; an out-of-scope
  // one to the balance-sheet account it belongs to.
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const list = ((r.data as any)?.items ?? r.data ?? []) as Account[]
      setAccounts(
        list.filter(
          (a) =>
            !(a.number ?? '').endsWith('-000') &&
            !(a.description ?? '').startsWith('Header account')
        )
      )
    })
  }, [])
  const accountOptions = useMemo(() => {
    const toOptions = (list: Account[]): CategorySelectOption[] =>
      list.map((a) => ({
        id: a.id,
        name: a.number ? `${a.number} — ${a.name}` : a.name,
        depth: 0,
      }))
    return {
      capex: toOptions(accounts.filter(isCapexAccount)),
      balanceSheet: toOptions(
        accounts.filter((a) => ['ASSET', 'LIABILITY'].includes((a.type ?? '').toUpperCase()))
      ),
    }
  }, [accounts])
  // A bill made from a receiving report is withheld at whatever the receipt
  // was — the code belongs to the report, like its amounts.
  const isReceiptSourced = (initial?.goodsReceipts?.length ?? 0) > 0
  const pickedWithholding = ewt.options.find((o) => o.code === form.withholdingTaxCode)
  // Scenario 46 — the invoice's own lines. An AP bill IS the SI, so when lines
  // are present they ARE the invoice and the subtotal/tax/total are computed
  // from them; the typed figures below only apply to a bill with no lines
  // (a header-only entry, or one scaffolded from a receipt before the real
  // invoice arrives).
  const [billLines, setBillLines] = useState<BillLineState[]>(
    (initial?.lines ?? []).map((l) => ({
      itemId: l.itemId ?? '',
      itemLabel: l.item?.name ?? '',
      description: l.description ?? '',
      quantity: String(Number(l.quantity ?? 0) || ''),
      unitPrice: String(Number(l.unitPrice ?? 0) || ''),
      discountValue: l.discounts?.[0] ? String(l.discounts[0].value) : '',
      discountType: (l.discounts?.[0]?.type ?? 'percentage') as 'percentage' | 'amount',
      isFreebie: l.isFreebie ?? false,
      notes: l.notes ?? '',
      taxCode: masterCodeFor(l.taxCode),
      projectAssetRef: l.projectAssetRef ?? '',
      accountId: l.accountId ?? '',
    }))
  )
  useEffect(() => {
    if (!form.supplierId) {
      setSupplierVat(null)
      return
    }
    let cancelled = false
    getSupplier(form.supplierId).then((r) => {
      if (cancelled || !r.success || !r.data) return
      setSupplierVat({
        name: r.data.name,
        status: supplierVatStatus(r.data),
        ewtCode: supplierEwtCode(r.data),
      })
    })
    return () => {
      cancelled = true
    }
  }, [form.supplierId])
  /** The code a line is on: the one someone picked, else what its supplier
   * starts on. Derived, not stored, so a line added before the supplier's
   * status arrives (or under another supplier) still follows it. */
  const codeOf = (line: BillLineState): string => line.taxCode || lineDefaultCode
  // A claimable code someone picked cannot stay on a supplier that charges no
  // VAT (the server refuses it): the line goes back to following the supplier.
  useEffect(() => {
    if (!supplierVat || mayClaim) return
    setBillLines((prev) =>
      prev.some((l) => claimsInputVat(l.taxCode))
        ? prev.map((l) =>
            claimsInputVat(l.taxCode)
              ? { ...l, taxCode: '', projectAssetRef: '', accountId: '' }
              : l
          )
        : prev
    )
  }, [supplierVat, mayClaim])
  /** Recoding a line: the tag and the account belong to the code that asked
   * for them, so they do not carry across a change either way. */
  const withCode = (line: BillLineState, code: string): BillLineState => ({
    ...line,
    taxCode: code,
    projectAssetRef: needsProjectAssetRef(code) ? line.projectAssetRef : '',
    accountId:
      code !== codeOf(line) && (needsLineAccount(code) || needsLineAccount(codeOf(line)))
        ? ''
        : line.accountId,
  })
  /** What the server will derive for a line: the code's rate on its net. */
  const lineVat = (line: BillLineState): number =>
    inputVatOn(billLineTotal(line), inputVat.rateFor(codeOf(line)))
  const linesVat = Math.round(billLines.reduce((sum, l) => sum + lineVat(l), 0) * 100) / 100
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A repeated SI is a question, not a mistake: one supplier invoice can cover
  // several POs, each received into its own bill. The server refuses once and
  // says what the number clashes with; this holds that message until the person
  // decides, and Save again re-sends with the confirmation.
  const [duplicateSi, setDuplicateSi] = useState<string | null>(null)
  // Scenario 43 — a bill that's left DRAFT (already received/posted to the
  // GL) locks everything except how it's paid. See ap-bills.service.ts's
  // update() for the matching backend guard.
  const isLocked = !!initial && initial.status !== 'DRAFT'
  // The changes this bill would carry from its supplier's defaults: each line's
  // input VAT code, and the withholding code. Worked out only once the supplier
  // is known (before that the defaults are guesses), and never on a bill that is
  // locked or whose code is its receiving report's.
  const allChanges: TaxOverrideChange[] = []
  if (!isLocked && supplierVat) {
    billLines.forEach((l, i) => {
      const c = changeOf('INPUT_VAT_CODE', lineDefaultCode, codeOf(l), i + 1)
      if (c) allChanges.push(c)
    })
    if (!isReceiptSourced && form.withholdingTaxCode) {
      const w = changeOf('WITHHOLDING_CODE', supplierVat.ewtCode, form.withholdingTaxCode)
      if (w) allChanges.push(w)
    }
  }
  const freshOverrides = freshChanges(allChanges, initial?.taxOverride)
  const standingOverrides = (initial?.taxOverride ?? []).filter((e) =>
    allChanges.some((c) => standingFor([e], c))
  )
  const overrideBlocked = freshOverrides.length > 0 && !canOverride
  const [purchaseOrders, setPurchaseOrders] = useState<APBillPurchaseOrderOption[]>([])
  const [receipts, setReceipts] = useState<APBillGoodsReceiptOption[]>([])
  const supplierIdOnMount = useRef(form.supplierId)

  useEffect(() => {
    if (!form.supplierId) {
      setPurchaseOrders([])
      return
    }
    // Only reset the previously-picked PO when the supplier actually
    // changes after mount — not on the initial load of an existing bill.
    if (form.supplierId !== supplierIdOnMount.current) {
      // A different supplier is withheld at its own default, not at whatever
      // the last one's code was.
      setForm((f) => ({
        ...f,
        purchaseOrderId: '',
        goodsReceiptIds: [],
        withholdingTaxCode: '',
      }))
    }
    APBillMatching.purchaseOrders(form.supplierId).then((r) =>
      setPurchaseOrders(r.data?.data ?? [])
    )
  }, [form.supplierId])

  useEffect(() => {
    if (!form.purchaseOrderId) {
      setReceipts([])
      return
    }
    APBillMatching.receipts(form.purchaseOrderId).then((r) => setReceipts(r.data?.data ?? []))
  }, [form.purchaseOrderId])

  const toggleReceipt = (id: string) => {
    setForm((f) => ({
      ...f,
      goodsReceiptIds: f.goodsReceiptIds.includes(id)
        ? f.goodsReceiptIds.filter((r) => r !== id)
        : [...f.goodsReceiptIds, id],
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLocked && !form.supplierId) {
      setError('Supplier is required')
      return
    }
    // Scenario 69 Part G — what a capital or out-of-scope line needs, said
    // here (the server checks it too) so it is not found after the save.
    for (const [i, l] of billLines.entries()) {
      const code = codeOf(l)
      if (needsProjectAssetRef(code) && !l.projectAssetRef.trim()) {
        setError(`Line ${i + 1}: a capital purchase needs the project or asset it is for.`)
        return
      }
      if (needsLineAccount(code) && !l.accountId) {
        setError(
          `Line ${i + 1}: pick the account this ${
            needsProjectAssetRef(code)
              ? 'capital purchase posts to (a property or equipment account)'
              : 'out-of-scope item posts to'
          }.`
        )
        return
      }
    }
    if (freshOverrides.length > 0 && !reasonOk(overrideReason)) {
      setError(reasonMissingMessage(freshOverrides))
      return
    }
    // Scenario 41 required the SI number to create a bill by hand; Scenario 46
    // relaxes that (client: "allow create w/o SI just add flag/warning") — the
    // goods often arrive days before the invoice, and the bill is flagged
    // "Pending SI" in the list until the number is filled in.
    setSaving(true)
    setError(null)
    // A received bill has nothing left to write except its own paperwork —
    // dates, description, SI number. Its supplier/PO/matched-receipts links
    // and its goods-cost figures (Subtotal, VAT, Withholding) are the
    // Receiving Report's to own once one is attached; the backend now
    // refuses anything beyond this narrower set here (see
    // ap-bills.service.ts's update()).
    const payload = isLocked
      ? {
          billDate: form.billDate,
          dueDate: form.dueDate,
          description: form.description,
          billNumber: form.billNumber.trim() || undefined,
        }
      : {
          ...form,
          purchaseOrderId: form.purchaseOrderId || undefined,
          goodsReceiptIds: form.purchaseOrderId ? form.goodsReceiptIds : undefined,
          billNumber: form.billNumber.trim() || undefined,
          subtotal: Number(form.subtotal),
          taxAmount: Number(form.taxAmount || 0),
          // Omit entirely when blank so the backend auto-calculates from the
          // supplier's withholding rate instead of overriding it with 0.
          withholdingAmount:
            form.withholdingAmount === '' ? undefined : Number(form.withholdingAmount),
          // Only a code someone picked is sent: blank is the supplier's default,
          // and one the bill already carried needs no repeating.
          withholdingTaxCode:
            !isReceiptSourced &&
            form.withholdingTaxCode &&
            form.withholdingTaxCode !== (initial?.withholdingTaxCode ?? '')
              ? form.withholdingTaxCode
              : undefined,
          // Why a code was kept off its supplier's default (Part I); only what
          // is new needs saying.
          taxOverrideReason: freshOverrides.length > 0 ? overrideReason.trim() : undefined,
          // Scenario 46 — when the invoice is itemised, the lines ARE the invoice
          // and the backend recomputes subtotal/tax/total from them, ignoring the
          // figures above. Omitted entirely when the table is empty, so a
          // header-only bill keeps its typed subtotal.
          lines: billLines.length
            ? billLines.map((l) => ({
                itemId: l.itemId || undefined,
                description: l.description || undefined,
                quantity: Number(l.quantity) || 0,
                unitPrice: l.isFreebie ? 0 : Number(l.unitPrice) || 0,
                isFreebie: l.isFreebie,
                notes: l.notes || undefined,
                // The code only: the server derives each line's tax from it.
                taxCode: codeOf(l) || undefined,
                projectAssetRef: needsProjectAssetRef(codeOf(l))
                  ? l.projectAssetRef.trim() || undefined
                  : undefined,
                accountId: l.accountId || undefined,
                discounts: l.discountValue
                  ? [{ type: l.discountType, value: Number(l.discountValue) }]
                  : undefined,
              }))
            : undefined,
        }
    const body = { ...payload, confirmDuplicateBillNumber: duplicateSi !== null }
    const res = initial ? await APBills.update(initial.id, body) : await APBills.create(body)
    if (!res.success) {
      setSaving(false)
      if (res.errorCode === 'duplicate_supplier_invoice_number') {
        // Not an error yet — the same SI across several POs is normal. Show what
        // it clashes with and let them look before deciding.
        setDuplicateSi(res.message || 'This supplier already has a bill under that SI.')
        setError(null)
        return
      }
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/ap-bills"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AP Invoices
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">
        {!initial ? 'New Bill' : isLocked ? 'Bill Details' : 'Edit Bill'}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isReceiptSourced
          ? "The receiving report is shown for reference and can't be changed here. Fill in the supplier's invoice below."
          : 'Record a supplier bill. Receiving posts a journal entry to the GL.'}
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-5"
      >
        {isReceiptSourced && initial && (
          <>
            <ReceivingReportReadOnly bill={initial} />
            <h2 className="pt-1 text-[13px] font-semibold text-prominent-purple-900">AP Bill</h2>
          </>
        )}
        {isLocked ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {initial?.status === 'PAID'
                ? 'This bill is fully paid and posted to the GL, so its goods-cost figures (Subtotal, VAT) are fixed — they only change by correcting the Receiving Report. Its own paperwork below can still be edited.'
                : 'This bill has been received and posted to the GL, so its goods-cost figures (Subtotal, VAT) are fixed — they only change by correcting the Receiving Report. Its own paperwork below can still be edited. How it gets paid is decided on its voucher — use Record Payment from the invoice.'}
            </div>
            {!isReceiptSourced && (
              <>
                <InfoRow label="Supplier" value={initial?.supplier?.name ?? '—'} />
                {initial?.purchaseOrder && (
                  <InfoRow label="Purchase Order" value={initial.purchaseOrder.code} />
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bill Date *">
                <input
                  required
                  type="date"
                  value={form.billDate}
                  onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </Field>
              <Field label="Due Date *">
                <input
                  required
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Supplier Invoice Number">
              <input
                value={form.billNumber}
                onChange={(e) => {
                  // Changing the number withdraws the question — otherwise the
                  // next Save would carry a confirmation for a number nobody
                  // was asked about.
                  setDuplicateSi(null)
                  setForm({ ...form, billNumber: e.target.value })
                }}
                placeholder="The Supplier Invoice (SI) number printed on the supplier's own invoice"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <TaxOverrideSummary entries={initial?.taxOverride} testId="bill-override-summary" />
            <div className="grid grid-cols-3 gap-3">
              <InfoRow label="Subtotal" value={fmtMoney(initial?.subtotal ?? 0)} />
              <InfoRow label="Input Tax (VAT)" value={fmtMoney(initial?.taxAmount ?? 0)} />
              <InfoRow
                label="Withholding Tax"
                value={`${fmtMoney(initial?.withholdingAmount ?? 0)}${
                  initial?.withholdingTaxCode ? ` · ${initial.withholdingTaxCode}` : ''
                }`}
              />
            </div>
          </div>
        ) : (
          <>
            {!isReceiptSourced && (
              <>
                <Field label="Supplier *">
                  <SupplierSearchCombobox
                    value={form.supplierId}
                    onChange={(id) => setForm({ ...form, supplierId: id })}
                    initialLabel={
                      initial?.supplier
                        ? `${initial.supplier.code} — ${initial.supplier.name}`
                        : undefined
                    }
                  />
                </Field>
                {form.supplierId && (
                  <Field label="Purchase Order (for the 3-way match)">
                    <select
                      value={form.purchaseOrderId}
                      onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    >
                      <option value="">— None —</option>
                      {purchaseOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.code} — {fmtMoney(po.totalAmount)} ({po.status})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {form.purchaseOrderId && (
                  <Field label="Receiving Reports matched to this bill">
                    {receipts.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No receiving reports posted against this PO yet.
                      </p>
                    ) : (
                      <div className="space-y-1 border border-gray-200 rounded-lg p-2 max-h-28 overflow-y-auto">
                        {receipts.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={form.goodsReceiptIds.includes(r.id)}
                              onChange={() => toggleReceipt(r.id)}
                            />
                            {r.code} — {fmtDate(r.receivedAt)}
                          </label>
                        ))}
                      </div>
                    )}
                  </Field>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bill Date *">
                <input
                  required
                  type="date"
                  value={form.billDate}
                  onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </Field>
              <Field label="Due Date *">
                <input
                  required
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label={initial ? 'Supplier Invoice Number' : 'Supplier Invoice Number *'}>
              <input
                required={!initial}
                value={form.billNumber}
                onChange={(e) => {
                  // Changing the number withdraws the question — otherwise the
                  // next Save would carry a confirmation for a number nobody
                  // was asked about.
                  setDuplicateSi(null)
                  setForm({ ...form, billNumber: e.target.value })
                }}
                placeholder="The Supplier Invoice (SI) number printed on the supplier's own invoice"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
              {initial && !form.billNumber && (
                <p className="mt-1 text-xs text-amber-600">
                  Required before this bill can be received.
                </p>
              )}
            </Field>
            {/* Scenario 46 — the invoice's own line items. Present them and
                the money figures below are computed from them; leave the table
                empty and the bill stays a header-only entry with a typed
                subtotal, which is how a receipt-scaffolded draft starts. */}
            <div className="rounded-lg border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <span className="text-[13px] font-semibold text-prominent-purple-900">
                  Invoice lines
                </span>
                <button
                  type="button"
                  onClick={() => setBillLines((p) => [...p, emptyBillLine()])}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-4 w-4" /> Add line
                </button>
              </div>
              {billLines.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-gray-400">
                  {isReceiptSourced
                    ? "No lines — this bill carries the receiving report's figures. Add lines only if the supplier's invoice differs from what was received."
                    : 'No lines — the subtotal below is used as-is. Add lines to itemise this invoice and have its totals computed.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Item / description</th>
                        <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                        <th className="px-2 py-1.5 text-right font-medium">Unit Price</th>
                        <th className="px-2 py-1.5 text-right font-medium">Discount</th>
                        <th className="px-2 py-1.5 text-left font-medium">Input VAT code</th>
                        <th className="px-2 py-1.5 text-left font-medium">Notes</th>
                        <th className="px-2 py-1.5 text-center font-medium">Free</th>
                        <th className="px-2 py-1.5 text-right font-medium">Total</th>
                        <th className="px-2 py-1.5 text-right font-medium">VAT</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {billLines.map((l, i) => (
                        <Fragment key={i}>
                          <tr>
                            <td className="px-2 py-1.5">
                              <input
                                aria-label={`Line ${i + 1} description`}
                                value={l.description}
                                onChange={(e) =>
                                  setBillLines((p) =>
                                    p.map((x, n) =>
                                      n === i ? { ...x, description: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-full rounded border border-gray-200 px-2 py-1"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                aria-label={`Line ${i + 1} quantity`}
                                value={l.quantity}
                                onChange={(e) =>
                                  setBillLines((p) =>
                                    p.map((x, n) =>
                                      n === i ? { ...x, quantity: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-20 rounded border border-gray-200 px-2 py-1 text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                aria-label={`Line ${i + 1} unit price`}
                                value={l.unitPrice}
                                onChange={(e) =>
                                  setBillLines((p) =>
                                    p.map((x, n) =>
                                      n === i ? { ...x, unitPrice: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-28 rounded border border-gray-200 px-2 py-1 text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  aria-label={`Line ${i + 1} discount`}
                                  value={l.discountValue}
                                  onChange={(e) =>
                                    setBillLines((p) =>
                                      p.map((x, n) =>
                                        n === i ? { ...x, discountValue: e.target.value } : x
                                      )
                                    )
                                  }
                                  className="w-20 rounded border border-gray-200 px-2 py-1 text-right"
                                />
                                <select
                                  aria-label={`Line ${i + 1} discount type`}
                                  value={l.discountType}
                                  onChange={(e) =>
                                    setBillLines((p) =>
                                      p.map((x, n) =>
                                        n === i
                                          ? {
                                              ...x,
                                              discountType: e.target.value as
                                                | 'percentage'
                                                | 'amount',
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  className="rounded border border-gray-200 px-1 py-1"
                                >
                                  <option value="percentage">%</option>
                                  <option value="amount">₱</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <select
                                aria-label={`Line ${i + 1} input VAT code`}
                                value={codeOf(l)}
                                onChange={(e) =>
                                  setBillLines((p) =>
                                    p.map((x, n) => (n === i ? withCode(x, e.target.value) : x))
                                  )
                                }
                                className="w-40 rounded border border-gray-200 px-1 py-1"
                              >
                                {inputVat.options.map((o) => (
                                  <option
                                    key={o.code}
                                    value={o.code}
                                    disabled={
                                      (!mayClaim &&
                                        claimsInputVat(o.code) &&
                                        o.code !== codeOf(l)) ||
                                      // a code other than the supplier's default needs the
                                      // override permission, unless the line already has it
                                      (!canOverride &&
                                        o.code !== lineDefaultCode &&
                                        o.code !== codeOf(l))
                                    }
                                  >
                                    {inputVatOptionLabel(o)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                aria-label={`Line ${i + 1} notes`}
                                placeholder="Optional"
                                value={l.notes}
                                onChange={(e) =>
                                  setBillLines((p) =>
                                    p.map((x, n) => (n === i ? { ...x, notes: e.target.value } : x))
                                  )
                                }
                                className="w-full rounded border border-gray-200 px-2 py-1"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Line ${i + 1} is a free item`}
                                title="Promotional/zero-cost unit that was still billed as a line"
                                checked={l.isFreebie}
                                onChange={(e) =>
                                  setBillLines((p) =>
                                    p.map((x, n) =>
                                      n === i ? { ...x, isFreebie: e.target.checked } : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">
                              {fmtMoney(billLineTotal(l))}
                            </td>
                            <td
                              aria-label={`Line ${i + 1} input VAT`}
                              className="px-2 py-1.5 text-right tabular-nums text-gray-500"
                            >
                              {lineVat(l) > 0 ? fmtMoney(lineVat(l)) : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                aria-label={`Remove line ${i + 1}`}
                                onClick={() => setBillLines((p) => p.filter((_, n) => n !== i))}
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          {/* Scenario 69 Part G — what a capital or out-of-scope
                            line needs: the account its net posts to, and for a
                            capital purchase the project or asset it is for. */}
                          {(needsLineAccount(codeOf(l)) || l.accountId) && (
                            <tr data-testid={`line-${i + 1}-posting`} className="bg-gray-50/60">
                              <td colSpan={10} className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-gray-600">
                                      Posts to
                                    </span>
                                    <div className="w-72">
                                      <CategorySelect
                                        compact
                                        aria-label={`Line ${i + 1} account`}
                                        noun="accounts"
                                        value={l.accountId || undefined}
                                        onChange={(id) =>
                                          setBillLines((p) =>
                                            p.map((x, n) =>
                                              n === i ? { ...x, accountId: id ?? '' } : x
                                            )
                                          )
                                        }
                                        options={
                                          needsProjectAssetRef(codeOf(l))
                                            ? accountOptions.capex
                                            : accountOptions.balanceSheet
                                        }
                                        placeholder={
                                          needsProjectAssetRef(codeOf(l))
                                            ? '— Property / equipment account —'
                                            : '— Account —'
                                        }
                                      />
                                    </div>
                                  </div>
                                  {needsProjectAssetRef(codeOf(l)) && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-medium text-gray-600">
                                        Project / asset
                                      </span>
                                      <input
                                        aria-label={`Line ${i + 1} project or asset`}
                                        value={l.projectAssetRef}
                                        maxLength={100}
                                        placeholder="e.g. FA-0007, or the CIP / project reference"
                                        onChange={(e) =>
                                          setBillLines((p) =>
                                            p.map((x, n) =>
                                              n === i
                                                ? { ...x, projectAssetRef: e.target.value }
                                                : x
                                            )
                                          )
                                        }
                                        className="w-72 rounded border border-gray-200 px-2 py-1"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-gray-100 px-3 py-2 text-right text-[13px] font-semibold text-prominent-purple-900">
                    Lines total{' '}
                    <span className="tabular-nums">
                      {fmtMoney(billLines.reduce((sum, l) => sum + billLineTotal(l), 0))}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  billLines.length
                    ? 'Subtotal (from lines)'
                    : isReceiptSourced
                      ? 'Subtotal (from the receiving report)'
                      : 'Subtotal *'
                }
              >
                <input
                  required={billLines.length === 0 && !isReceiptSourced}
                  readOnly={billLines.length > 0 || isReceiptSourced}
                  type="number"
                  step="0.01"
                  value={
                    billLines.length
                      ? billLines.reduce((sum, l) => sum + billLineTotal(l), 0).toFixed(2)
                      : form.subtotal
                  }
                  onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg ${
                    billLines.length > 0 || isReceiptSourced ? 'bg-zinc-50 text-zinc-500' : ''
                  }`}
                />
              </Field>
              <Field
                label={
                  billLines.length
                    ? 'Input Tax (VAT, from lines)'
                    : isReceiptSourced
                      ? 'Input Tax (VAT, from the receiving report)'
                      : 'Input Tax (VAT)'
                }
              >
                <input
                  type="number"
                  step="0.01"
                  readOnly={billLines.length > 0 || isReceiptSourced}
                  value={billLines.length ? linesVat.toFixed(2) : form.taxAmount}
                  onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg ${
                    billLines.length > 0 || isReceiptSourced ? 'bg-zinc-50 text-zinc-500' : ''
                  }`}
                />
                {billLines.length > 0 && !mayClaim && supplierVat && (
                  <p className="mt-1 text-xs text-gray-400">
                    {supplierVat.name} is {SUPPLIER_VAT_STATUS_LABEL[supplierStatus].toLowerCase()}:
                    no input VAT is claimed on its lines.
                  </p>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Withholding Tax Code">
                <EwtCodeSelect
                  ariaLabel="Withholding tax code"
                  value={form.withholdingTaxCode}
                  // A different code means "withhold at that rate": the amount
                  // worked out for the old one is dropped so the server works it
                  // out again, instead of the stale figure riding along.
                  onChange={(code) =>
                    setForm({ ...form, withholdingTaxCode: code, withholdingAmount: '' })
                  }
                  options={ewt.options}
                  loading={ewt.isLoading}
                  blankLabel="Supplier's default"
                  disabled={isReceiptSourced || !canOverride}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-zinc-50 disabled:text-zinc-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {isReceiptSourced
                    ? 'Set by the receiving report this bill came from.'
                    : !canOverride
                      ? "Withheld at the supplier's own code; another code needs the tax-code override permission."
                      : !form.withholdingTaxCode
                        ? "Withheld at the supplier's own code."
                        : pickedWithholding
                          ? `Held back at ${fmtPercent(pickedWithholding.ratePercent)} of the subtotal.`
                          : null}
                </p>
              </Field>
              <Field label="Withholding Tax">
                <input
                  type="number"
                  step="0.01"
                  readOnly={isReceiptSourced}
                  value={form.withholdingAmount}
                  onChange={(e) => setForm({ ...form, withholdingAmount: e.target.value })}
                  placeholder="Auto-calculated from the code's rate if left blank"
                  className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg ${
                    isReceiptSourced ? 'bg-zinc-50 text-zinc-500' : ''
                  }`}
                />
              </Field>
            </div>
            {(freshOverrides.length > 0 || standingOverrides.length > 0) && (
              <TaxOverrideBox
                testId="bill-override"
                changes={freshOverrides}
                standing={standingOverrides}
                canOverride={canOverride}
                reason={overrideReason}
                onReason={setOverrideReason}
              />
            )}
          </>
        )}
        {initial && paidVoucherIdOf(initial) && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px]">
            <span className="text-gray-600">This bill has a recorded payment.</span>
            <Link
              href={`/accounting/ap-bills/payments/new?edit=${paidVoucherIdOf(initial)}`}
              className="font-medium text-prominent-purple-700 hover:underline"
            >
              Edit payment
            </Link>
          </div>
        )}
        {/* "How this bill will be paid" — Source of Payment, Reference Number
            and Cheque No. — used to sit here. They predate the voucher model
            and now duplicate it: how a bill is paid is decided when a voucher
            is raised or a payment recorded, per payment method, and a voucher
            can be part cheque and part transfer. One method stamped on the
            invoice cannot describe that, and nothing downstream reads it except
            as a last-resort default. Removed rather than left to disagree with
            the voucher. */}
        {duplicateSi && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            {duplicateSi} Press <span className="font-semibold">Save anyway</span> to keep it.
          </div>
        )}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
          <Link
            href="/accounting/ap-bills"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || overrideBlocked}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : duplicateSi ? 'Save anyway' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** A receiving-report value shown the way a form field would be, but not
 * editable: the receipt owns it, and this bill only ever reads it. */
function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <div className="w-full rounded-lg border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        {value || '—'}
      </div>
    </div>
  )
}

type BillReceipt = NonNullable<APBill['goodsReceipts']>[number]

/** The receiving report(s) this bill was raised from, laid out as the report's
 * own fields and lines but with nothing to type into. The figures belong to the
 * report — the server ignores them from this form — so correcting one means
 * correcting the report and pulling the change over (see the notice on the
 * bill's page). */
function ReceivingReportReadOnly({ bill }: { bill: APBill }) {
  const receipts = bill.goodsReceipts ?? []
  return (
    <section
      data-testid="bill-rr-readonly"
      className="rounded-lg border border-gray-200 bg-gray-50/50"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <span className="text-[13px] font-semibold text-prominent-purple-900">
          Receiving Report{receipts.length > 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
          <Lock className="h-3 w-3" /> Read-only — correct it on the Receiving Report
        </span>
      </div>
      <div className="space-y-4 p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField
            label="Supplier"
            value={bill.supplier ? `${bill.supplier.code} — ${bill.supplier.name}` : null}
          />
          <ReadOnlyField label="Purchase Order" value={bill.purchaseOrder?.code} />
        </div>
        {receipts.map((rr) => (
          <ReceivingReportBlock key={rr.id} rr={rr} />
        ))}
      </div>
    </section>
  )
}

function ReceivingReportBlock({ rr }: { rr: BillReceipt }) {
  const lines = rr.lines ?? []
  const hasCost = lines.some((l) => l.unitCost != null)
  const total = lines.reduce(
    (sum, l) => sum + Number(l.quantityReceived ?? 0) * Number(l.unitCost ?? 0),
    0
  )
  // The same running figures the report's own sheet prints: the tax only
  // shows once the report carries some.
  const vat = Number(rr.vatAmount ?? 0)
  const withheld = Number(rr.withheldAmount ?? 0)
  const hasTax = hasCost && (vat > 0 || withheld > 0)
  return (
    <div className="space-y-3" data-testid={`bill-rr-${rr.code}`}>
      <div className="grid gap-3 md:grid-cols-4">
        <ReadOnlyField
          label="RR No."
          value={
            <span className="flex items-center justify-between gap-2">
              {rr.code}
              <Link
                href={`/accounting/receiving-reports/${rr.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${rr.code}`}
                className="text-prominent-purple-600 hover:text-prominent-purple-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </span>
          }
        />
        <ReadOnlyField
          label="Date received"
          value={rr.receivedAt ? fmtDate(rr.receivedAt) : null}
        />
        <ReadOnlyField label="DR No." value={rr.deliveryReceiptNumber} />
        <ReadOnlyField label="Supplier Invoice on the report" value={rr.supplierInvoiceNumber} />
      </div>
      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Item</th>
                <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium">Unit cost</th>
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-zinc-600">
              {lines.map((l) => {
                const chain = discountChainLabel(l, fmtMoney)
                return (
                  <tr key={l.id}>
                    <td className="px-2 py-1.5">
                      {l.item?.name ?? '—'}
                      {l.isFreebie && (
                        <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          Freebie
                        </span>
                      )}
                      {chain && <div className="mt-0.5 text-[11px] text-gray-500">{chain}</div>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {Number(l.quantityReceived ?? 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {l.unitCost != null ? fmtMoney(Number(l.unitCost)) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {l.unitCost != null
                        ? fmtMoney(Number(l.quantityReceived ?? 0) * Number(l.unitCost))
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hasCost && (
            <dl className="ml-auto w-full max-w-xs space-y-1 border-t border-gray-100 px-3 py-2 text-[12px] text-zinc-600">
              <div className="flex justify-between gap-4">
                <dt>Total</dt>
                <dd className="tabular-nums">{fmtMoney(total)}</dd>
              </div>
              {hasTax && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt>Input VAT</dt>
                    <dd className="tabular-nums">{fmtMoney(vat)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Less: Withholding tax</dt>
                    <dd className="tabular-nums">{fmtMoney(withheld)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 font-semibold text-zinc-800">
                    <dt>Net payable</dt>
                    <dd className="tabular-nums">{fmtMoney(total + vat - withheld)}</dd>
                  </div>
                </>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

// Scenario 43 — read-only counterpart to Field, for a locked bill's fields.
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}
