'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Loader2, Pencil, X } from 'lucide-react'
import {
  AcknowledgementReceipts,
  BankAccounts,
  fmtMoney,
  type BankAccount,
  type PaymentMethod,
  type AcknowledgementReceipt,
  PAYMENT_METHOD_OPTIONS,
} from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import { downloadElementAsPdf } from '@/src/libs/print/htmlToPdf'
import SegmentedControl from '@/src/components/ui/SegmentedControl'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { useBranches } from '@/src/app/(app)/(dashboard)/pos/_hooks/usePos'

function accountLabel(account: AcknowledgementReceipt['account']): string {
  if (!account) return 'Miscellaneous Collections'
  return account.number ? `${account.number} — ${account.name}` : account.name
}

function longDate(v: string | null | undefined) {
  return v
    ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
}

function MetaPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <p className="font-bold text-prominent-purple-900">{label}</p>
      <p className="mb-3 text-gray-700">{value}</p>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-800">{label}</span>
      {children}
    </label>
  )
}

// Same helper NewAcknowledgementReceiptForm.tsx uses for its own Account
// picker — duplicated rather than shared, matching how this app's small
// per-form helpers (e.g. Field) are usually kept local to each file.
function accountsToCategoryOptions(accounts: Account[]): CategorySelectOption[] {
  const idsInList = new Set(accounts.map((a) => a.id))
  const childrenByParent = new Map<string, Account[]>()
  const roots: Account[] = []
  for (const a of accounts) {
    if (a.parentId && idsInList.has(a.parentId)) {
      const siblings = childrenByParent.get(a.parentId) ?? []
      siblings.push(a)
      childrenByParent.set(a.parentId, siblings)
    } else {
      roots.push(a)
    }
  }
  const options: CategorySelectOption[] = []
  const walk = (list: Account[], depth: number) => {
    for (const a of list) {
      options.push({ id: a.id, name: a.number ? `${a.number} — ${a.name}` : a.name, depth })
      const children = childrenByParent.get(a.id)
      if (children) walk(children, depth + 1)
    }
  }
  walk(roots, 0)
  return options
}

/** The letterhead sheet, matching the client's own real document exactly
 * (developer-shared reference, 2026-09-21): payer/date-reference/enterprise
 * in a 3-column header, the description as a bold title line, a single
 * #/Account/Total row, and two signature blocks (Prepared by / Certified by
 * — no "Approved by," unlike the AP voucher's 3-block signature line).
 * Originally always rendered twice — once as "Acknowledgement Receipt", once
 * titled "Collection Receipt" — off the same data (developer decision,
 * 2026-09-21). Now the user picks one via receiptType at creation, so only
 * the matching title renders; a legacy record with no receiptType stored
 * still falls back to showing both. */
function ReceiptSheet({ receipt, title }: { receipt: AcknowledgementReceipt; title: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold uppercase text-prominent-purple-900">{title}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nig-logo.png"
          alt="NIG Marketing"
          className="h-16 w-auto object-contain sm:h-20"
        />
      </div>

      <div className="mt-6 grid gap-7 md:grid-cols-3">
        <div>
          <p className="font-bold text-prominent-purple-900">{receipt.payerName}</p>
        </div>
        <div className="text-right">
          <MetaPair label="Date" value={longDate(receipt.paymentDate)} />
          <MetaPair label="Reference" value={receipt.reference || receipt.number || '—'} />
          {receipt.clearedType === 'LATER_DATE' && (
            <MetaPair label="Clearing Date" value={longDate(receipt.clearedDate)} />
          )}
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-7">
          <p className="font-bold text-prominent-purple-900">
            {receipt.enterprise?.companyLegalName ?? '—'}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-700">
            {receipt.enterprise?.address || '—'}
          </p>
        </div>
      </div>

      {receipt.reason && (
        <p className="mb-4 mt-6 font-bold uppercase text-prominent-purple-900">{receipt.reason}</p>
      )}

      <div className={`overflow-x-auto ${receipt.reason ? '' : 'mt-6'}`}>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="w-9 border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-center font-bold">
                #
              </th>
              <th className="border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-left font-bold">
                Account
              </th>
              <th className="w-40 border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-right font-bold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-2.5 py-[7px] text-center align-top">1</td>
              <td className="border border-gray-300 px-2.5 py-[7px] align-top">
                {accountLabel(receipt.account)} — {receipt.payerName}
              </td>
              <td className="border border-gray-300 px-2.5 py-[7px] text-right align-top tabular-nums">
                {fmtMoney(receipt.amount)}
              </td>
            </tr>
            <tr className="font-bold">
              <td className="border border-gray-300 px-2.5 py-[7px] text-right" colSpan={2}>
                Total
              </td>
              <td className="border border-gray-300 px-2.5 py-[7px] text-right tabular-nums">
                {fmtMoney(receipt.amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <p className="font-semibold text-gray-700">Prepared by:</p>
          <div className="mt-8 border-t border-gray-400 pt-1 text-center text-[11px] text-gray-500">
            Name and Signature
          </div>
        </div>
        <div>
          <p className="font-semibold text-gray-700">Certified by:</p>
          <div className="mt-8 border-t border-gray-400 pt-1 text-center text-[11px] text-gray-500">
            Name and Signature
          </div>
        </div>
      </div>
    </div>
  )
}

function AcknowledgementReceiptDetailBody({
  restrictedBranchId,
}: {
  restrictedBranchId: string | null
}) {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [receipt, setReceipt] = useState<AcknowledgementReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingAck, setDownloadingAck] = useState(false)
  const [downloadingCr, setDownloadingCr] = useState(false)
  const ackSheetRef = useRef<HTMLDivElement>(null)
  const crSheetRef = useRef<HTMLDivElement>(null)

  // Everything is editable (developer decision, 2026-09-27). amount/account
  // are the two fields that drive the already-posted journal entry — editing
  // either requires correctionReason and the backend posts a new adjusting
  // entry for the delta, same as the create form's own field set.
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    payerName: string
    accountId: string
    reason: string
    amount: string
    correctionReason: string
    paymentDate: string
    receiptType: 'COLLECTION' | 'ACKNOWLEDGEMENT'
    method: PaymentMethod
    clearedType: string
    clearedDate: string
    bankAccountId: string
    reference: string
    branchId: string
  } | null>(null)

  const { data: branchesData, isLoading: branchesLoading } = useBranches()
  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>
  const restrictedBranchName = restrictedBranchId
    ? (branches.find((b) => b.id === restrictedBranchId)?.name ?? 'your branch')
    : null
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [accountOptions, setAccountOptions] = useState<CategorySelectOption[]>([])
  useEffect(() => {
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
    getAccounts({ limit: 500 }).then((res) => {
      const list = ((res.data as any)?.items ?? res.data ?? []) as Account[]
      setAccountOptions(accountsToCategoryOptions(list))
    })
  }, [])

  useEffect(() => {
    if (!id) {
      setError('No receipt specified.')
      setLoading(false)
      return
    }
    let cancelled = false
    AcknowledgementReceipts.get(id).then((res) => {
      if (cancelled) return
      if (!res.success || !res.data) {
        setError(res.message || res.error || 'Could not load this receipt.')
        setLoading(false)
        return
      }
      setReceipt(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Real .pdf files, not the print-dialog "Save as PDF" every other document
  // in this app relies on (developer decision, 2026-09-21: "both should
  // download a .pdf file") — captures the already-on-screen sheet below,
  // same downloadElementAsPdf() utility Purchase Orders' own Download button
  // uses. Defined above the loading/error guards (rather than as inline
  // handlers further down) so the row menu's ?action= auto-trigger effect
  // below can call them too.
  const downloadAck = async () => {
    if (!ackSheetRef.current || !receipt) return
    setDownloadingAck(true)
    try {
      await downloadElementAsPdf(ackSheetRef.current, receipt.number || 'acknowledgement-receipt')
    } finally {
      setDownloadingAck(false)
    }
  }
  const downloadCr = async () => {
    if (!crSheetRef.current || !receipt) return
    setDownloadingCr(true)
    try {
      await downloadElementAsPdf(
        crSheetRef.current,
        `${receipt.number || 'receipt'}-collection-receipt`
      )
    } finally {
      setDownloadingCr(false)
    }
  }

  const startEdit = () => {
    if (!receipt) return
    setEditForm({
      payerName: receipt.payerName,
      accountId: receipt.accountId ?? '',
      reason: receipt.reason ?? '',
      amount: String(receipt.amount),
      correctionReason: '',
      paymentDate: receipt.paymentDate.slice(0, 10),
      receiptType: receipt.receiptType ?? 'ACKNOWLEDGEMENT',
      method: receipt.method ?? 'CASH',
      clearedType: receipt.clearedType ?? 'SAME_DATE',
      clearedDate: receipt.clearedDate ? receipt.clearedDate.slice(0, 10) : '',
      bankAccountId: receipt.bankAccountId ?? '',
      reference: receipt.reference ?? '',
      branchId: receipt.branchId ?? '',
    })
    setEditError(null)
    setEditing(true)
  }

  // The row menu on the list page (RowActionsMenu: View/Edit/Download) links
  // here with ?action=edit or ?action=download instead of duplicating the
  // capture/edit-panel logic per row — this page already has the loaded
  // receipt, the rendered sheet to capture, and the edit form. Fires once
  // per navigation (autoActionRef), not on every re-render (e.g. the one
  // saveEdit() triggers via setReceipt()).
  const autoActionRef = useRef(false)
  useEffect(() => {
    if (!receipt || autoActionRef.current) return
    autoActionRef.current = true
    const action = searchParams.get('action')
    if (action === 'edit') startEdit()
    else if (action === 'download') {
      if (receipt.receiptType === 'COLLECTION') void downloadCr()
      else void downloadAck()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
      </div>
    )
  }

  // Legacy records saved before receiptType existed still fall back to
  // showing both, matching the original always-both behavior.
  const showCollection = receipt ? receipt.receiptType !== 'ACKNOWLEDGEMENT' : false
  const showAcknowledgement = receipt ? receipt.receiptType !== 'COLLECTION' : false

  if (error || !receipt) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/pos/collections/acknowledgement"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Acknowledgement Receipts
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  // Mirrors the backend's own check — amount/accountId are the two fields
  // that drove the journal entry already posted at create(), so changing
  // either needs a correction reason and posts a new adjusting entry for
  // just the delta (the original is never touched).
  const financialChange =
    !!editForm &&
    (Number(editForm.amount) !== receipt.amount ||
      (editForm.accountId || null) !== receipt.accountId)

  const saveEdit = async () => {
    if (!editForm) return
    if (financialChange && !editForm.correctionReason.trim()) {
      setEditError('A correction reason is required when amount or account changes.')
      return
    }
    setSavingEdit(true)
    setEditError(null)
    const res = await AcknowledgementReceipts.update(receipt.id, {
      payerName: editForm.payerName,
      accountId: editForm.accountId || undefined,
      reason: editForm.reason || undefined,
      amount: Number(editForm.amount),
      correctionReason: editForm.correctionReason || undefined,
      paymentDate: editForm.paymentDate,
      receiptType: editForm.receiptType,
      method: editForm.method,
      clearedType: editForm.clearedType,
      clearedDate:
        editForm.clearedType === 'LATER_DATE' ? editForm.clearedDate || undefined : undefined,
      bankAccountId: editForm.bankAccountId || undefined,
      reference: editForm.reference || undefined,
      branchId: restrictedBranchId ?? (editForm.branchId || undefined),
    })
    setSavingEdit(false)
    if (!res.success || !res.data) {
      setEditError(res.message || res.error || 'Save failed')
      return
    }
    setReceipt(res.data)
    setEditing(false)
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/pos/collections/acknowledgement"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Acknowledgement Receipts
        </Link>
        <div className="flex items-center gap-2">
          {/* Scenario 57 — not a real CollectionReceipt row (no
              customer/invoice here to satisfy that model) and not wired into
              cash reconciliation. Which of the two buttons/sheets shows is
              driven by receiptType, picked at creation (developer decision,
              2026-09-26 — was always-both before). Both download a real .pdf
              (developer decision, 2026-09-21: "both should download a .pdf
              file") captured from the on-screen sheet below, not the
              print-dialog "Save as PDF" every other document in this app
              relies on. */}
          {showCollection && (
            <button
              onClick={() => void downloadCr()}
              disabled={downloadingCr}
              className="inline-flex items-center gap-1.5 rounded-md border border-prominent-purple-700 px-3 py-1.5 text-[13px] font-semibold text-prominent-purple-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingCr ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download{showAcknowledgement ? ' Collection Receipt' : ''}
            </button>
          )}
          {showAcknowledgement && (
            <button
              onClick={() => void downloadAck()}
              disabled={downloadingAck}
              className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingAck ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download{showCollection ? ' Acknowledgement Receipt' : ''}
            </button>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          RECEIVED
        </span>
        <span>Receipt {receipt.number ?? '—'}</span>
        <span>{longDate(receipt.paymentDate)}</span>
        <span>Received {fmtMoney(receipt.amount)}</span>
      </div>

      {editing && editForm && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-prominent-purple-900">Edit receipt</p>
            <button
              onClick={() => setEditing(false)}
              disabled={savingEdit}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed"
              aria-label="Cancel edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Receipt Type">
                <SegmentedControl
                  name="Receipt Type"
                  value={editForm.receiptType}
                  onChange={(value) => setEditForm({ ...editForm, receiptType: value })}
                  options={[
                    { value: 'ACKNOWLEDGEMENT', label: 'Acknowledgement' },
                    { value: 'COLLECTION', label: 'Collection' },
                  ]}
                />
              </Field>
              <Field label="Branch">
                {restrictedBranchId ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {restrictedBranchName}
                  </p>
                ) : (
                  <SearchableSelect
                    value={editForm.branchId}
                    onChange={(value) => setEditForm({ ...editForm, branchId: value })}
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    placeholder={branchesLoading ? 'Loading branches…' : '— Not tracked —'}
                    disabled={branchesLoading}
                    clearable
                  />
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  value={editForm.paymentDate}
                  onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Reference">
                <input
                  value={editForm.reference}
                  onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cleared">
                <SegmentedControl
                  name="Cleared"
                  value={editForm.clearedType}
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      clearedType: value,
                      clearedDate: value === 'LATER_DATE' ? editForm.clearedDate : '',
                    })
                  }
                  options={[
                    { value: 'SAME_DATE', label: 'Same date' },
                    { value: 'LATER_DATE', label: 'Later date' },
                  ]}
                />
              </Field>
              <Field label="Clear Date">
                <input
                  type="date"
                  disabled={editForm.clearedType !== 'LATER_DATE'}
                  value={editForm.clearedDate}
                  onChange={(e) => setEditForm({ ...editForm, clearedDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
              </Field>
            </div>

            <Field label="Paid by">
              <input
                value={editForm.payerName}
                onChange={(e) => setEditForm({ ...editForm, payerName: e.target.value })}
                placeholder="Payer name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Received in">
              <SearchableSelect
                value={editForm.bankAccountId}
                onChange={(value) => setEditForm({ ...editForm, bankAccountId: value })}
                options={bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.name} — ${acc.bankName} (${acc.accountNumber})`,
                }))}
                placeholder="— Not tracked —"
                clearable
              />
            </Field>

            <Field label="Account">
              <CategorySelect
                value={editForm.accountId || undefined}
                onChange={(value) => setEditForm({ ...editForm, accountId: value ?? '' })}
                options={accountOptions}
                placeholder="Select account…"
                noun="accounts"
              />
            </Field>

            <Field label="Description">
              <input
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Method">
                <select
                  value={editForm.method}
                  onChange={(e) =>
                    setEditForm({ ...editForm, method: e.target.value as PaymentMethod })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {financialChange && (
              <Field label="Correction Reason">
                <input
                  required
                  value={editForm.correctionReason}
                  onChange={(e) => setEditForm({ ...editForm, correctionReason: e.target.value })}
                  placeholder="Why is the amount/account changing? — becomes the adjusting entry's label"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
            )}
          </div>

          {editError && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {editError}
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              onClick={() => setEditing(false)}
              disabled={savingEdit}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void saveEdit()}
              disabled={savingEdit}
              className="rounded-lg bg-purple-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingEdit ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {showAcknowledgement && (
        <div ref={ackSheetRef} className="mt-2.5">
          <ReceiptSheet receipt={receipt} title="Acknowledgement Receipt" />
        </div>
      )}
      {showCollection && (
        <div ref={crSheetRef} className={showAcknowledgement ? 'mt-6' : 'mt-2.5'}>
          <ReceiptSheet receipt={receipt} title="Collection Receipt" />
        </div>
      )}
    </div>
  )
}

export default function AcknowledgementReceiptDetail({
  restrictedBranchId,
}: {
  restrictedBranchId: string | null
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
        </div>
      }
    >
      <AcknowledgementReceiptDetailBody restrictedBranchId={restrictedBranchId} />
    </Suspense>
  )
}
