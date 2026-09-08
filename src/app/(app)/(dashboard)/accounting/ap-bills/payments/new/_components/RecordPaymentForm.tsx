'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Loader2, PhilippinePeso, Plus, X } from 'lucide-react'
import {
  APBills,
  APBillSuppliers,
  BankAccounts,
  apOutstanding,
  fmtMoney,
  type APBill,
  type APDisbursementListItem,
  type APBillSupplierOption,
  type BankAccount,
  type APBillLineDiscount,
} from '@/src/libs/data/AccountingV2Data'
import { discountChainLabel } from '@/src/libs/format/discount-chain'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { Select } from '@/src/components/ui/Select'

const PAYABLE_STATUSES = ['RECEIVED', 'PARTIAL', 'OVERDUE']

// Mirrors ExpenseForm's TAX_CODE_OPTIONS — 'VAT' is what's stored, "Input VAT"
// is what's shown, since VAT on a purchase is the claimable kind.
const TAX_CODE_LABELS: Record<string, string> = {
  VAT: 'Input VAT',
  NON_VAT: 'Non-VAT',
  EXEMPT: 'Exempt',
}

// Scenario 46 — same two choices, same wording as the Expense form's own
// Cleared control, so the two screens read identically.
const CLEARED_OPTIONS = [
  { value: 'SAME_DATE', label: 'On the same date' },
  { value: 'LATER_DATE', label: 'On a later date' },
]

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

interface PaymentSource {
  method: string
  bankAccountId: string
  /** Free text for what this source was for — the halves of a split payment
   * need telling apart. Replaced the per-source Check # box, which duplicated
   * Reference Number: the cheque number was being typed into both. */
  description: string
  reference: string
  /** Blank on the only row — a single source funds the whole payment, so its
   * amount is the total and there is nothing to type. Filled in once a second
   * source exists and the money has to be divided. */
  amount: string
}

function blankSource(): PaymentSource {
  return { method: 'check', bankAccountId: '', description: '', reference: '', amount: '' }
}

/** MM/DD/YYYY, the format used across this module's date inputs. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function outstandingOf(b: APBill): number {
  // Withholding is already out of AP (reclassified to the BIR at receive), so
  // the cheque covers the invoice net of it — allocating the gross would
  // overpay the supplier and the server would reject it.
  return apOutstanding(b)
}

/** How much of an invoice's withholding no voucher has claimed yet.
 *
 * The withheld slice is a pot the invoice's vouchers draw down, not a figure
 * each of them reprints: an invoice that withheld ₱500 has ₱500 to give away
 * across however many vouchers settle it. Before this was tracked per voucher,
 * every voucher on an invoice showed the invoice's whole withholding, so two
 * vouchers documented ₱1,000 against ₱500 actually withheld.
 *
 * Cancelled vouchers release their claim, matching the server. `excludeId` is
 * the voucher being settled or amended, whose own claim is about to be replaced.
 */
/** What a voucher already claimed on this invoice, when one is being settled.
 *
 * Settling pays a voucher raised earlier: its invoices AND its withholding
 * claim were decided then, and the settle route resends neither. So that screen
 * reports the claim rather than offering to change it — returns null outside
 * settle mode, where the claim is still the user's to make. */
function claimOnVoucher(b: APBill, settleId?: string | null): string | null {
  if (!settleId) return null
  const mine = (b.disbursementAllocations ?? []).find((a) => a.disbursement.id === settleId)
  return (mine?.withholdingAmount ?? 0).toFixed(2)
}

function withholdingLeftOn(b: APBill, excludeId?: string | null): number {
  const claimed = (b.disbursementAllocations ?? [])
    .filter((a) => a.disbursement.status !== 'CANCELLED' && a.disbursement.id !== excludeId)
    .reduce((sum, a) => sum + (a.withholdingAmount ?? 0), 0)
  return Math.max(0, (b.withholdingAmount ?? 0) - claimed)
}

/** Scenario 46 — the voucher number the server will derive, previewed here so
 * the number is visible before saving rather than appearing only afterwards.
 * Mirrors generateDisbursementVoucherNumber() on the backend:
 * `<BANK>#<MMYY>-<last 4 of cheque>`. The server remains the authority — this
 * is a preview, which is why the field is read-only. */
function previewVoucher(
  bank: BankAccount | undefined,
  cheque: string,
  paymentDate: string
): string {
  const raw = bank?.bankName || bank?.name || ''
  const code =
    raw
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3) || 'CSH'
  const d = paymentDate ? new Date(paymentDate) : new Date()
  const mmyy = String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2)
  const tail = cheque
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-4)
    .toUpperCase()
  return tail ? `${code}#${mmyy}-${tail}` : `${code}#${mmyy}-••••`
}

/** One row of the read-only item table, from whichever side of the bill
 * actually carries the detail. */
type DisplayLine = {
  key: string
  item: string
  sku?: string | null
  quantity: number
  unitPrice: number
  // The supplier's stated pricing behind unitPrice, for the chain subline.
  srp?: number | null
  discounts?: APBillLineDiscount[] | null
  discountedCost?: number | null
  /** Pre-tax line value — quantity × unit price, matching APBillLine.lineTotal. */
  amount: number
  taxCode?: string | null
  taxAmount: number
}

/** What this invoice is billing for.
 *
 * A hand-entered bill carries its own APBillLine rows. A bill scaffolded from
 * receiving does not — createOrAttachDraftFromReceipt only writes the money
 * totals — so for those the item trail lives on the goods receipt it came
 * from, which since the PO→RR→SI parity work carries the same pricing and tax
 * the invoice states. Both are the same thing to a reader ("what am I paying
 * for"), so both render through one shape rather than two tables.
 *
 * Falling back rather than replacing: a bill that has real invoice lines shows
 * those, because the invoice is what is being paid and it is allowed to differ
 * from what was received. */
function displayLines(bill: APBill): DisplayLine[] {
  if (bill.lines?.length) {
    return bill.lines.map((l) => ({
      key: l.id,
      item: l.item?.name ?? l.description ?? '—',
      sku: l.item?.sku,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      srp: l.srp,
      discounts: l.discounts,
      discountedCost: l.discountedCost,
      amount: Number(l.lineTotal),
      taxCode: l.taxCode,
      taxAmount: Number(l.taxAmount ?? 0),
    }))
  }
  return (bill.goodsReceipts ?? []).flatMap((r) =>
    (r.lines ?? []).map((l) => {
      const quantity = Number(l.quantityReceived)
      // discountedCost is the post-discount unit cost; unitCost is what the
      // receipt actually costed the stock at. They agree unless the receipt
      // was priced off SRP, in which case the discounted figure is the one
      // the invoice states.
      const unitPrice = Number(l.discountedCost ?? l.unitCost ?? 0)
      return {
        key: l.id,
        item: l.item?.name ?? '—',
        sku: l.item?.sku,
        quantity,
        unitPrice,
        srp: l.srp,
        discounts: l.discounts,
        discountedCost: l.discountedCost,
        amount: Math.round(quantity * unitPrice * 100) / 100,
        taxCode: l.taxCode,
        taxAmount: Number(l.taxAmount ?? 0),
      }
    })
  )
}

export default function RecordPaymentForm() {
  const router = useRouter()
  // Scenario 46 — arriving from the AP Invoices list's multi-select. The
  // selection travels in the URL rather than in memory so a refresh or a
  // shared link lands on the same prefilled form. Everything stays editable
  // once here: the payee can be changed and other invoices ticked.
  const searchParams = useSearchParams()
  const presetSupplier = searchParams.get('supplier') ?? ''
  const presetBills = useMemo(
    () => (searchParams.get('bills') ?? '').split(',').filter(Boolean),
    [searchParams]
  )
  // Settling a voucher raised earlier. Which invoices and how much were
  // decided then, so this screen only collects the funding — the invoice set
  // is locked and Pay now is not a choice.
  const settleId = searchParams.get('settle')
  // Amending a voucher that has not been paid. It loads exactly like settling —
  // same voucher, same invoices, same funding — but everything stays editable
  // and saving amends the voucher instead of paying it. A voucher IS the
  // instruction to cut a cheque from a named account, so a wrong bank or a
  // wrong amount should be correctable without cancelling the number and
  // raising a new one.
  const editId = searchParams.get('edit')
  const editing = editId !== null
  /** The existing voucher this screen is acting on, whichever mode. */
  const voucherId = settleId ?? editId
  const [settling, setSettling] = useState<APDisbursementListItem | null>(null)
  const [presetApplied, setPresetApplied] = useState(false)
  const [presetNotice, setPresetNotice] = useState<string | null>(null)
  // The invoices this payment is settling, once they are decided. Non-null
  // means "decided": only these are shown, and with no checkboxes, because the
  // choosing already happened — either on the AP Invoices list before arriving
  // here, or by pressing Done below. The per-row amount stays editable either
  // way, since an invoice can be settled in instalments. Null means the
  // browse-and-pick mode, where the supplier's whole open list is tickable.
  //
  // Arriving with a selection and still being shown every other invoice read
  // as if the selection had been ignored (reported 2026-09-07: ticked one SI,
  // the form listed five).
  const [confirmedIds, setConfirmedIds] = useState<string[] | null>(
    presetBills.length > 0 ? presetBills : null
  )
  const locked = confirmedIds !== null
  const [suppliers, setSuppliers] = useState<APBillSupplierOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const [supplierId, setSupplierId] = useState(presetSupplier)
  const [bills, setBills] = useState<APBill[]>([])
  const [loadingBills, setLoadingBills] = useState(false)

  // billId -> amount being paid against it. Presence in this map IS the
  // selection, so unticking a row also drops whatever was typed in it.
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  // How much withholding this voucher carries. One figure for the whole
  // voucher, not one per invoice: a voucher is payable to one supplier and
  // produces one BIR 2307, so "the withholding I am paying on this" is a
  // property of the document. null means untouched — the field then offers
  // whatever the selected invoices still have unclaimed.
  const [voucherWht, setVoucherWht] = useState<string | null>(null)

  const [form, setForm] = useState({
    paymentDate: todayIso(),
    clearedType: 'SAME_DATE',
    clearedDate: '',
    notes: '',
  })
  // Where the money comes from. A cheque and a bank transfer can fund one
  // payment together, the same way an expense can be split — see
  // APDisbursement.sources. One row covers the ordinary case.
  const [sources, setSources] = useState<PaymentSource[]>([blankSource()])
  // A voucher is the authorisation to pay; paying is a separate act. Leaving
  // this off raises an UNPAID voucher — number issued, invoices recorded,
  // nothing posted to the GL and no bill touched. On, and it is raised and
  // settled in one go, which is what this screen always used to do.
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    APBillSuppliers.list().then((r) => setSuppliers(r.data?.data ?? []))
    BankAccounts.list().then((r) => setBankAccounts(r.data ?? []))
  }, [])

  useEffect(() => {
    if (!voucherId) return
    APBills.listDisbursements().then((r) => {
      const found = (r.data?.items ?? []).find((v) => v.id === voucherId)
      if (!found) return setError('That voucher could not be found.')
      setSettling(found)
      if (found.supplierId) setSupplierId(found.supplierId)
      setConfirmedIds(found.invoices.map((i) => i.billId))
      setAllocations(Object.fromEntries(found.invoices.map((i) => [i.billId, i.amount.toFixed(2)])))
      // A voucher IS the instruction to cut a cheque from a named account, so
      // the method, bank, reference and amounts were all decided when it was
      // raised — createDisbursement stores them on an unpaid voucher precisely
      // so they survive to here. Settling confirms them; it does not ask again.
      // Leaving them blank made the payer re-pick the account the voucher had
      // already authorised, and nothing stopped them picking a different one.
      if (found.sources.length) {
        setSources(
          found.sources.map((src) => ({
            method: src.method || 'check',
            bankAccountId: src.bankAccount?.id ?? '',
            description: src.description ?? '',
            reference: src.reference ?? '',
            amount: src.amount != null ? String(src.amount) : '',
          }))
        )
      }
      // Decided with the voucher too, for the same reason.
      setForm((f) => ({
        ...f,
        clearedType: found.clearedType ?? f.clearedType,
        clearedDate: found.clearedDate ? found.clearedDate.slice(0, 10) : f.clearedDate,
        notes: found.notes ?? f.notes,
      }))
    })
  }, [voucherId])

  // Beat 2 — choosing the payee loads their open bills. Selection resets with
  // it: an allocation against a previous supplier's bill must never survive.
  const loadBills = useCallback(async () => {
    if (!supplierId) {
      setBills([])
      // Settling takes its amounts from the voucher, not from the invoice list.
      // Clearing them here wiped what the voucher covered — and this load is
      // kicked off BY the settle effect naming the voucher's supplier, so it
      // always landed a beat after the seeding and always won. Each row then
      // fell back to the invoice's full outstanding balance: a ₱2,000 voucher
      // asked to be paid ₱3,900.
      if (!voucherId) setAllocations({})
      return
    }
    setLoadingBills(true)
    // withDetail because this screen shows what each invoice is billing for,
    // not just its total — see displayLines().
    const res = await APBills.list({ supplierId, withDetail: 'true' })
    const open = (res.data?.items ?? []).filter(
      (b) => PAYABLE_STATUSES.includes(b.status) && outstandingOf(b) > 0.005
    )
    setBills(open)
    if (!voucherId) setAllocations({})
    setLoadingBills(false)
  }, [supplierId, voucherId])

  useEffect(() => {
    loadBills()
  }, [loadBills])

  // Tick whatever the list sent over, once, after that supplier's invoices are
  // in. A bill that was settled by someone else in between simply isn't in
  // `bills` any more — it is dropped with a notice rather than failing the
  // whole payment.
  useEffect(() => {
    if (presetApplied || !presetBills.length || !bills.length) return
    const found = bills.filter((b) => presetBills.includes(b.id))
    if (found.length) {
      const next: Record<string, string> = {}
      for (const b of found) next[b.id] = String(outstandingOf(b).toFixed(2))
      setAllocations(next)
    } else {
      // Every selected invoice was settled elsewhere in the meantime. Staying
      // restricted would show an empty table and no way forward, so fall back
      // to the full list — the notice below explains why it looks different.
      setConfirmedIds(null)
    }
    const missing = presetBills.length - found.length
    if (missing > 0) {
      setPresetNotice(
        `${missing} of the ${presetBills.length} invoices you selected is no longer payable and was left out.`
      )
    }
    setPresetApplied(true)
  }, [bills, presetBills, presetApplied])

  // What this screen may pay. Restricted to the incoming selection until the
  // user deliberately widens it (or switches payee, below).
  const visibleBills = useMemo(
    () => (confirmedIds ? bills.filter((b) => confirmedIds.includes(b.id)) : bills),
    [bills, confirmedIds]
  )

  /** What is actually being paid, per bill.
   *
   * Once the invoices are decided there is no checkbox left to tick — that
   * choice already happened — but the amount stays editable, because the
   * client settles invoices in instalments ("allow staggered payment"). Each
   * row therefore defaults to its full outstanding balance and can be typed
   * down to a part payment; the bill is left PARTIAL for the remainder.
   *
   * Derived rather than pushed into state so an untouched row needs no effect
   * to seed it: a typed value wins, and the outstanding balance fills in for
   * every row that has not been touched. */
  const activeAllocations: Record<string, string> = useMemo(
    () =>
      locked
        ? Object.fromEntries(
            visibleBills.map((b) => [b.id, allocations[b.id] ?? outstandingOf(b).toFixed(2)])
          )
        : allocations,
    [locked, visibleBills, allocations]
  )

  const selectedBills = useMemo(
    () => visibleBills.filter((b) => b.id in activeAllocations),
    [visibleBills, activeAllocations]
  )

  /** The ceiling: what the selected invoices still have unclaimed between them.
   * An invoice's withholding is a pot its vouchers draw down, so once one
   * voucher takes the ₱500 there is nothing for the next to take. */
  const whtAvailable = useMemo(
    () => selectedBills.reduce((sum, b) => sum + withholdingLeftOn(b, voucherId), 0),
    [selectedBills, voucherId]
  )

  /** What this voucher already claims. Amending starts from it — the voucher
   * keeps what it holds unless the figure is changed — and whtAvailable already
   * excludes it, so it is free to re-claim it. */
  const ownClaim = useMemo(
    () =>
      voucherId
        ? selectedBills.reduce((sum, b) => sum + Number(claimOnVoucher(b, voucherId) ?? 0), 0)
        : 0,
    [selectedBills, voucherId]
  )

  /** Settling pays a voucher raised earlier, whose claim was fixed then and is
   * not resent — so that screen reports the figure instead of offering it.
   * Amending does resend it, so there it stays editable. */
  const settledWht = settleId ? ownClaim : null

  // A typed figure ALWAYS wins. The fallbacks decide only what an untouched
  // field offers.
  //
  // This used to clamp to 0 whenever nothing looked claimable, which meant a
  // figure someone had typed could be discarded without a word — the invoice's
  // withholding not being loaded for a moment was enough. A voucher then saved
  // with no withholding on it and nothing said so. Over-claiming is caught on
  // submit, by name and by amount; silently zeroing was never the safer half of
  // that trade.
  const whtValue: string =
    settledWht !== null
      ? settledWht.toFixed(2)
      : (voucherWht ?? (editing ? ownClaim : whtAvailable > 0 ? whtAvailable : 0).toFixed(2))

  /** Spread the voucher's withholding over the invoices it covers, each taking
   * up to what it still has unclaimed, in the order they are listed. The rows
   * are what the server stores — the figure has to land on an invoice for the
   * next voucher to know it is gone — but which row it lands on is bookkeeping,
   * not a decision worth asking for: one voucher pays one supplier and yields
   * one 2307. */
  const splitWithholding = (amount: number): Record<string, number> => {
    let left = Math.round(amount * 100) / 100
    const out: Record<string, number> = {}
    for (const b of selectedBills) {
      const take = Math.min(left, withholdingLeftOn(b, voucherId))
      out[b.id] = Math.round(take * 100) / 100
      left = Math.round((left - take) * 100) / 100
    }
    return out
  }

  const supplierOptions: CategorySelectOption[] = useMemo(
    () => suppliers.map((s) => ({ id: s.id, name: `${s.code} — ${s.name}`, depth: 0 })),
    [suppliers]
  )
  const bankOptions: CategorySelectOption[] = useMemo(
    () =>
      bankAccounts
        .filter((b) => b.isActive)
        .map((b) => ({ id: b.id, name: `${b.accountNumber} - ${b.name}`, depth: 0 })),
    [bankAccounts]
  )

  // The voucher number derives from the first source — the backend applies the
  // same rule, so the preview can't disagree with what gets minted.
  const primarySource = sources[0]
  const selectedBank = bankAccounts.find((b) => b.id === primarySource?.bankAccountId)

  const setSource = (idx: number, patch: Partial<PaymentSource>) =>
    setSources((prev) => prev.map((src, i) => (i === idx ? { ...src, ...patch } : src)))
  const selectedIds = Object.keys(activeAllocations)
  const total = selectedIds.reduce((sum, id) => sum + (Number(activeAllocations[id]) || 0), 0)
  /** What THIS voucher carries in withholding. Already out of AP (reclassified
   * to WHT Payable at receive()), so every amount on this screen is net of it;
   * the footer shows the working the way the client's own voucher does.
   * Reading the invoices' own withholding instead is what made a second voucher
   * reprint the first one's ₱500. */
  const withheld = Number(whtValue) || 0
  // A single source funds the whole payment; only a split needs typed amounts.
  const singleSource = sources.length === 1
  /** What a source funds. Blank on the only row means "all of it", so the
   * common single-method case needs no typing — but it stays a real input, so
   * a cheque written for a different figure can be entered and the mismatch
   * called out rather than silently overridden. Blank on a split row is 0:
   * there is no sensible whole to assume once the money is divided. */
  const sourceAmount = (src: PaymentSource): number =>
    src.amount !== '' ? Number(src.amount) || 0 : singleSource ? total : 0
  const sourceAmountValue = (src: PaymentSource): string =>
    src.amount !== '' ? src.amount : singleSource ? total.toFixed(2) : ''
  const fundedTotal =
    Math.round(sources.reduce((sum, src) => sum + sourceAmount(src), 0) * 100) / 100
  const unfunded = Math.round((total - fundedTotal) * 100) / 100

  const toggle = (bill: APBill, on: boolean) => {
    setAllocations((prev) => {
      const next = { ...prev }
      if (on) next[bill.id] = String(outstandingOf(bill).toFixed(2))
      else delete next[bill.id]
      return next
    })
  }

  const allOn = visibleBills.length > 0 && selectedIds.length === visibleBills.length
  const toggleAll = (on: boolean) => {
    if (!on) return setAllocations({})
    const next: Record<string, string> = {}
    for (const b of visibleBills) next[b.id] = String(outstandingOf(b).toFixed(2))
    setAllocations(next)
  }

  /** Raising a voucher and paying one collect the same thing — a voucher IS
   * the instruction to cut a cheque from a named account — so this is one form
   * and `pay` says whether the money moved. It comes from whichever button was
   * pressed rather than a checkbox chosen up front, which had to hide half the
   * fields to mean anything. */
  const submit = async (e: React.FormEvent, pay = true) => {
    e.preventDefault()
    setError(null)
    if (selectedIds.length === 0) return setError('Select at least one invoice to pay.')
    for (const src of pay ? sources : []) {
      if (src.method !== 'cash' && !src.bankAccountId)
        return setError(`Source of Fund is required for ${src.method.replace('_', ' ')} payments.`)
    }
    // Applies however many sources there are: an untouched single row defaults
    // to the full total, so this only fires on a figure someone actually typed.
    //
    // Both exits are named because a shortfall has two opposite causes and the
    // old wording — "not funded by any payment method yet" — only described
    // one. Someone paying ₱1,000 against a ₱3,900 invoice types it into the
    // cheque, leaves the invoice Amount alone, and is then told to add another
    // payment method: the opposite of the part payment they were making. The
    // figure to type is spelled out so it needs no arithmetic.
    if (Math.abs(unfunded) > 0.01)
      return setError(
        unfunded > 0
          ? `${fmtMoney(unfunded)} of the ${fmtMoney(total)} allocated is not funded yet. ` +
              `Add a payment method for the rest — or, for a part payment, lower the invoice ` +
              `Amount to ${fmtMoney(fundedTotal)}.`
          : `The payment methods add up to ${fmtMoney(-unfunded)} more than the invoices being settled.`
      )
    if (form.clearedType === 'LATER_DATE' && !form.clearedDate)
      return setError('Give the date the cheque clears, or set Cleared back to the same date.')

    // Half a centavo, matching the server's own cap — a full centavo of slack
    // there let a voucher claim ₱0.01 against an empty pot.
    if (withheld > whtAvailable + 0.005)
      return setError(
        whtAvailable > 0
          ? `Only ${fmtMoney(whtAvailable)} of withholding is left to claim on the selected invoices.`
          : 'The selected invoices have no withholding left to claim — another voucher already took it.'
      )
    const whtSplit = splitWithholding(withheld)
    const rows = selectedIds.map((id) => ({
      apBillId: id,
      amount: Number(activeAllocations[id]),
      withholdingAmount: whtSplit[id] ?? 0,
    }))
    for (const r of rows) {
      if (!(r.amount > 0)) return setError('Every selected invoice needs an amount above zero.')
      const bill = bills.find((b) => b.id === r.apBillId)!
      if (r.amount > outstandingOf(bill) + 0.01)
        return setError(
          `${bill.billNumber ?? 'An invoice'} only has ${fmtMoney(outstandingOf(bill))} outstanding.`
        )
    }

    setSaving(true)
    // Amending an unpaid voucher keeps its number — that is the whole point of
    // editing rather than cancelling — and replaces what it covers and how it
    // is to be funded. Nothing posts: an unpaid voucher never touched the GL.
    if (editing) {
      const amended = await APBills.updateDisbursement(editId, {
        allocations: rows,
        notes: form.notes || undefined,
        sources: sources.map((src) => ({
          method: src.method,
          bankAccountId: src.bankAccountId || undefined,
          reference: src.reference || undefined,
          description: src.description || undefined,
          amount: sourceAmount(src),
        })),
        voucherDate: new Date(form.paymentDate).toISOString(),
        clearedType: form.clearedType,
        clearedDate:
          form.clearedType === 'LATER_DATE' && form.clearedDate
            ? new Date(form.clearedDate).toISOString()
            : undefined,
      })
      setSaving(false)
      if (!amended.success) {
        return setError(amended.message || amended.error || 'Could not save the voucher')
      }
      router.push(
        rows.length === 1 ? `/accounting/ap-bills/${rows[0].apBillId}` : '/accounting/ap-bills'
      )
      return
    }

    // Settling an existing voucher keeps its number and its invoices; only the
    // funding is new, so it goes to the settle route rather than creating a
    // second voucher for the same bills (which the server would refuse).
    if (settling) {
      const settled = await APBills.settleDisbursement(settling.id, {
        paymentDate: new Date(form.paymentDate).toISOString(),
        clearedType: form.clearedType,
        clearedDate:
          form.clearedType === 'LATER_DATE' && form.clearedDate
            ? new Date(form.clearedDate).toISOString()
            : undefined,
        notes: form.notes || undefined,
        sources: sources.map((src) => ({
          method: src.method,
          bankAccountId: src.bankAccountId || undefined,
          reference: src.reference || undefined,
          description: src.description || undefined,
          amount: sourceAmount(src),
        })),
      })
      setSaving(false)
      if (!settled.success) {
        return setError(settled.message || settled.error || 'Could not record the payment')
      }
      router.push('/accounting/ap-bills/payments')
      return
    }

    const res = await APBills.createDisbursement({
      supplierId,
      payNow: pay,
      // The funding goes with the voucher whether or not it is being paid now:
      // a voucher that does not say which account the cheque is drawn on is
      // less than the paper it stands for, and whoever settles it would have
      // to retype what was already decided.
      //
      // Always sent as sources, even when there is one — the server records it
      // as source #1 and takes its bank/cheque as the primary.
      sources: sources.map((src) => ({
        method: src.method,
        bankAccountId: src.bankAccountId || undefined,
        reference: src.reference || undefined,
        description: src.description || undefined,
        amount: sourceAmount(src),
      })),
      voucherDate: new Date(form.paymentDate).toISOString(),
      // Same day when paying now, which is the common case; settling later
      // asks for the payment date on its own screen.
      ...(pay ? { paymentDate: new Date(form.paymentDate).toISOString() } : {}),
      clearedType: form.clearedType,
      clearedDate:
        form.clearedType === 'LATER_DATE' && form.clearedDate
          ? new Date(form.clearedDate).toISOString()
          : undefined,
      notes: form.notes || undefined,
      allocations: rows,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Could not record this payment')
      return
    }
    // Saving a voucher is not paying one, so it must not land on Payments:
    // that screen is PAID-only by design, and the voucher just raised would be
    // filtered straight out of the list it arrived at. Go where it is actually
    // visible — the invoice's own Vouchers panel, which offers Print and Pay on
    // the row, or the invoice list when the voucher spans several.
    router.push(
      pay
        ? '/accounting/ap-bills/payments'
        : rows.length === 1
          ? `/accounting/ap-bills/${rows[0].apBillId}`
          : '/accounting/ap-bills'
    )
  }

  return (
    <form onSubmit={submit} className="px-4 py-4 sm:px-6 lg:px-8">
      <Link
        href="/accounting/ap-bills"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AP Invoices
      </Link>

      <h1 className="mt-2 text-[19px] font-bold text-prominent-purple-900">
        {settling
          ? `${editing ? 'Edit' : 'Pay'} voucher ${settling.voucherNumber ?? ''}`.trim()
          : 'Voucher'}
      </h1>
      <p className="mb-4 text-[13px] text-gray-500">
        {editing
          ? 'It keeps its number. Nothing has posted yet, so anything on it can still change.'
          : settling
            ? 'The invoices were decided when this voucher was raised — add the cheque and the date.'
            : 'One cheque, one voucher. Save it to pay later, or record the payment now.'}
      </p>

      {/* Beat 1 — who are we paying. Nothing else shows until this is set. */}
      <div className="max-w-md">
        <label className="mb-1 block text-xs font-medium text-gray-600">Payee *</label>
        <CategorySelect
          compact
          aria-label="Select supplier"
          noun="suppliers"
          value={supplierId}
          onChange={(id) => {
            // A different payee can't be paying the invoices that came in on
            // the URL, so the restriction lifts with it and this becomes the
            // ordinary browse-and-pick form.
            setConfirmedIds(null)
            setSupplierId(id ?? '')
          }}
          options={supplierOptions}
          placeholder="— Select a supplier —"
        />
      </div>

      {supplierId && (
        <>
          {/* Beat 2 — their open invoices. */}
          <div className="mt-5 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <h2 className="text-[14px] font-semibold text-prominent-purple-900">
                {locked ? 'Selected invoices' : 'Open invoices'}
              </h2>
              {locked ? (
                // The only way back to the full list without leaving the page.
                // Without it, someone who selected the wrong invoice has to
                // navigate back to AP Invoices and start the selection again.
                <button
                  type="button"
                  onClick={() => {
                    // Carry the confirmed set into the tick boxes, so widening
                    // the list starts from what is already being paid rather
                    // than from nothing.
                    setAllocations(activeAllocations)
                    setConfirmedIds(null)
                  }}
                  className="text-[12px] font-medium text-purple-700 hover:underline"
                >
                  Choose from all open invoices
                </button>
              ) : (
                bills.length > 0 && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[12px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                      Select all
                    </label>
                    {/* Without this there is no way back to the confirmed
                        view — picking from the full list was a one-way door. */}
                    <button
                      type="button"
                      disabled={selectedIds.length === 0}
                      onClick={() => setConfirmedIds(selectedIds)}
                      className="rounded-md bg-purple-700 px-3 py-1 text-[12px] font-semibold text-white hover:bg-purple-800 disabled:opacity-40"
                    >
                      Done ({selectedIds.length})
                    </button>
                  </div>
                )
              )}
            </div>
            {loadingBills ? (
              <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
              </p>
            ) : visibleBills.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-gray-400">
                This supplier has no open invoices.
              </p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-600">
                  <tr>
                    {!locked && <th className="w-10 px-3 py-2"></th>}
                    <th className="px-3 py-2 text-left">SI #</th>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Due</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Withholding</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleBills.map((b) => {
                    const on = b.id in activeAllocations
                    const out = outstandingOf(b)
                    const amt = Number(activeAllocations[b.id] ?? 0)
                    const partial = on && amt > 0 && amt < out - 0.01
                    const whtPot = b.withholdingAmount ?? 0
                    const whtLeft = withholdingLeftOn(b, voucherId)
                    const whtClaimedElsewhere = whtPot - whtLeft
                    const lines = displayLines(b)
                    return (
                      /* One group per invoice: the SI as a header row, its own
                         line items nested beneath it — the same shape the
                         Expense form uses. The items are read-only here: you
                         are paying an invoice, not re-pricing it. */
                      <Fragment key={b.id}>
                        <tr className={on ? 'bg-emerald-50/60' : 'bg-gray-50/60'}>
                          {!locked && (
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                aria-label={`Pay ${b.billNumber ?? 'invoice'}`}
                                checked={on}
                                onChange={(e) => toggle(b, e.target.checked)}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-prominent-purple-900">
                            {b.billNumber ?? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-sans text-[11px] font-medium text-amber-700">
                                Pending SI
                              </span>
                            )}
                          </td>
                          {/* Always Accounts Payable — settling a payable is
                              what this screen does, so it isn't a choice. */}
                          <td className="px-3 py-2 text-gray-500">Accounts Payable</td>
                          <td className="px-3 py-2 text-xs">
                            {b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-US') : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(out)}</td>
                          <td className="px-3 py-2 text-right">
                            {/* What is LEFT to claim, not the invoice's whole
                                withholding — the same convention as Outstanding
                                beside it, which is net of what has been paid.
                                Showing the pot here while the field below
                                offered the remainder had the two disagreeing in
                                the same glance: ₱300 in the column, ₱150 in the
                                box. The pot is kept on the subline, since which
                                figure is actionable should not need working out.

                                Stated, not asked: how much of it this voucher
                                takes is one figure for the whole voucher, so it
                                is entered down with the voucher's own fields
                                rather than repeated on every invoice row. */}
                            <span className="tabular-nums text-gray-500">{fmtMoney(whtLeft)}</span>
                            {whtClaimedElsewhere > 0 && (
                              <p className="mt-0.5 text-[11px] text-gray-500">
                                of {fmtMoney(whtPot)} · {fmtMoney(whtClaimedElsewhere)} on another
                                voucher
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {/* Editable while the voucher is being built: an
                                invoice can be paid in instalments, so the
                                default is the full outstanding balance and
                                typing less leaves the bill PARTIAL for the
                                rest.

                                Fixed once it is raised. Settling pays the
                                voucher as authorised — the settle route takes
                                only the funding and never resends allocations
                                — so an editable box here would change nothing,
                                the same trap the withholding box was. */}
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`Amount for ${b.billNumber ?? 'invoice'}`}
                              disabled={settleId !== null || (!locked && !on)}
                              value={activeAllocations[b.id] ?? ''}
                              onChange={(e) =>
                                setAllocations((p) => ({ ...p, [b.id]: e.target.value }))
                              }
                              className="w-32 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                            />
                            {partial && (
                              <p className="mt-0.5 text-[11px] text-amber-600">
                                Partial — {fmtMoney(out - amt)} will remain
                              </p>
                            )}
                          </td>
                        </tr>

                        {lines.length > 0 && (
                          <tr className={on ? 'bg-emerald-50/20' : undefined}>
                            {!locked && <td />}
                            <td colSpan={6} className="px-3 pb-3 pt-0">
                              {/* The Expense form's line columns, as text
                                  rather than inputs — you are paying this
                                  invoice, not re-pricing it, so the amount on
                                  the parent row is the only editable figure.
                                  Its SI and Account columns are dropped: they
                                  are properties of the invoice, not of a line,
                                  so every row repeated the same two values. */}
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-140 text-[12px]">
                                  <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                                    <tr>
                                      <th className="py-1 pr-4 text-left font-medium">Item</th>
                                      <th className="py-1 pr-4 text-right font-medium">Qty</th>
                                      <th className="py-1 pr-4 text-right font-medium">
                                        Unit Price
                                      </th>
                                      <th className="py-1 pr-4 text-right font-medium">Amount</th>
                                      <th className="py-1 pr-4 text-left font-medium">Tax Code</th>
                                      <th className="py-1 pr-4 text-right font-medium">
                                        Tax Amount
                                      </th>
                                      <th className="py-1 text-right font-medium">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((l) => {
                                      const chain = discountChainLabel(l, fmtMoney)
                                      return (
                                        <tr key={l.key} className="text-gray-600">
                                          <td className="py-1 pr-4">
                                            {l.item}
                                            {l.sku && (
                                              <span className="ml-1 font-mono text-[10px] text-gray-400">
                                                {l.sku}
                                              </span>
                                            )}
                                            {/* The terms behind the unit price.
                                                Someone approving a cheque is
                                                checking the supplier honoured
                                                what was agreed, so the chain
                                                belongs on the payment screen
                                                too — same wording as the PO,
                                                the RR and the printed invoice. */}
                                            {chain && (
                                              <div className="mt-0.5 text-[11px] text-gray-400">
                                                {chain}
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {l.quantity}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {fmtMoney(l.unitPrice)}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {fmtMoney(l.amount)}
                                          </td>
                                          <td className="py-1 pr-4">
                                            {l.taxCode
                                              ? (TAX_CODE_LABELS[l.taxCode] ?? l.taxCode)
                                              : '—'}
                                          </td>
                                          <td className="py-1 pr-4 text-right tabular-nums">
                                            {fmtMoney(l.taxAmount)}
                                          </td>
                                          <td className="py-1 text-right tabular-nums">
                                            {fmtMoney(l.amount + l.taxAmount)}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}

                        {lines.length === 0 && (
                          <tr className={on ? 'bg-emerald-50/20' : undefined}>
                            {!locked && <td />}
                            <td
                              colSpan={5}
                              className="px-3 pb-2 pt-0 text-[11px] italic text-gray-400"
                            >
                              No item detail on this invoice — neither the invoice nor the receipt
                              behind it recorded lines, so it was keyed as a total only.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Beat 3 — the rest of the form appears only once something is
              selected, so an empty screen never asks for a cheque number. */}
          {selectedIds.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {settling ? 'Payment date *' : 'Voucher date *'}
                  </span>
                  <input
                    required
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Cleared</span>
                  <Select
                    compact
                    value={form.clearedType}
                    onChange={(clearedType) =>
                      setForm({
                        ...form,
                        clearedType,
                        // Switching back to same-date drops a date that no
                        // longer means anything, so it can't be submitted stale.
                        clearedDate: clearedType === 'LATER_DATE' ? form.clearedDate : '',
                      })
                    }
                    options={CLEARED_OPTIONS}
                  />
                </label>
                {form.clearedType === 'LATER_DATE' && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Clear date *
                    </span>
                    <input
                      required
                      type="date"
                      value={form.clearedDate}
                      onChange={(e) => setForm({ ...form, clearedDate: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Voucher #</span>
                  <input
                    readOnly
                    aria-label="Voucher number (generated)"
                    title="Generated from the bank and reference number of the first payment method"
                    value={previewVoucher(
                      selectedBank,
                      primarySource?.reference ?? '',
                      form.paymentDate
                    )}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[13px] text-zinc-500 outline-none"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Description</span>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </label>
                {/* The withholding this voucher carries — "what I am willing to
                    pay of it" — sitting with the voucher's own fields because
                    that is what it belongs to: one voucher, one payee, one BIR
                    2307. It offers whatever the selected invoices still have
                    unclaimed and can be typed down, so a staggered payment can
                    take part of it now and leave the rest for the next voucher.
                    Nothing posts either way; the withholding left AP at
                    receipt. */}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    Withholding tax
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={whtAvailable}
                    aria-label="Withholding tax carried by this voucher"
                    disabled={settledWht !== null}
                    value={whtValue}
                    onChange={(e) => setVoucherWht(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                  <span className="mt-1 block text-[11px] text-gray-500">
                    {settledWht !== null
                      ? 'Set when this voucher was raised'
                      : whtAvailable > 0
                        ? `${fmtMoney(whtAvailable)} unclaimed on the selected invoices`
                        : 'Nothing left to claim on the selected invoices'}
                  </span>
                </label>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <span className="mb-2 block text-xs font-medium text-gray-600">Paid from *</span>
                <div className="space-y-2">
                  {sources.map((src, idx) => (
                    <div key={idx} className="flex flex-wrap items-end gap-2">
                      <span className="pb-2 text-[13px] text-gray-400">{idx + 1}.</span>
                      <label className="block w-44">
                        <span className="sr-only">Payment method {idx + 1}</span>
                        <Select
                          compact
                          value={src.method}
                          onChange={(method) =>
                            setSource(idx, {
                              method,
                              bankAccountId: method === 'cash' ? '' : src.bankAccountId,
                            })
                          }
                          options={METHOD_OPTIONS}
                        />
                      </label>
                      {src.method !== 'cash' && (
                        <label className="block w-64">
                          <span className="mb-1 block text-[11px] text-gray-500">
                            Bank Account *
                          </span>
                          <CategorySelect
                            compact
                            aria-label={`Bank account for payment method ${idx + 1}`}
                            noun="bank accounts"
                            value={src.bankAccountId}
                            onChange={(id) => setSource(idx, { bankAccountId: id ?? '' })}
                            options={bankOptions}
                            placeholder="— Select —"
                          />
                        </label>
                      )}
                      <label className="block w-48">
                        <span className="mb-1 block text-[11px] text-gray-500">Description</span>
                        <input
                          value={src.description}
                          onChange={(e) => setSource(idx, { description: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </label>
                      <label className="block w-44">
                        <span className="mb-1 block text-[11px] text-gray-500">
                          Reference Number
                        </span>
                        <input
                          value={src.reference}
                          onChange={(e) => setSource(idx, { reference: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </label>
                      <label className="block w-36">
                        <span className="mb-1 block text-[11px] text-gray-500">Amount</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label={`Amount for payment method ${idx + 1}`}
                          value={sourceAmountValue(src)}
                          onChange={(e) => setSource(idx, { amount: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </label>
                      {!singleSource && (
                        <button
                          type="button"
                          aria-label={`Remove payment method ${idx + 1}`}
                          onClick={() => setSources((prev) => prev.filter((_, i) => i !== idx))}
                          className="mb-1.5 rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSources((prev) => [
                      // Seed the first row's amount as it stops being implicit.
                      ...prev.map((src, i) =>
                        i === 0 && prev.length === 1 && !src.amount
                          ? { ...src, amount: total.toFixed(2) }
                          : src
                      ),
                      blankSource(),
                    ])
                  }
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-purple-700 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add payment method
                </button>
                {Math.abs(unfunded) > 0.01 && (
                  <p className="mt-2 text-[12px] text-amber-600">
                    {unfunded > 0
                      ? `${fmtMoney(unfunded)} still unfunded — lower the invoice Amount for a part payment`
                      : `${fmtMoney(-unfunded)} more than the invoices being settled`}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-[13px] text-gray-500">
                  {selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected
                </span>
                {withheld > 0 ? (
                  <div className="text-right text-[13px]">
                    <div className="text-gray-500">
                      Total amount{' '}
                      <span className="tabular-nums text-gray-800">
                        {fmtMoney(total + withheld)}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      Less: withholding tax{' '}
                      <span className="tabular-nums text-gray-800">{fmtMoney(withheld)}</span>
                    </div>
                    <div className="mt-0.5 border-t border-gray-200 pt-0.5 text-[15px] font-semibold text-prominent-purple-900">
                      Net amount <span className="tabular-nums">{fmtMoney(total)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[15px] font-semibold text-prominent-purple-900">
                    Total <span className="tabular-nums">{fmtMoney(total)}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {presetNotice && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          {presetNotice}
        </p>
      )}
      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving || selectedIds.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhilippinePeso className="h-4 w-4" />
          )}
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Record Payment'}
        </button>
        {/* Same form, same fields — the button says whether the money moved.
            Settling a voucher raised earlier has only one outcome, and amending
            one is not a payment at all, so this is offered only when raising a
            new voucher. */}
        {!settling && !editing && (
          <button
            type="button"
            onClick={(e) => submit(e, false)}
            disabled={saving || selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-5 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            Save voucher
          </button>
        )}
        <Link
          href="/accounting/ap-bills"
          className="rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
