'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import MoneyInput from '@/src/components/ui/MoneyInput'
import { Select } from '@/src/components/ui/Select'
import { ArrowLeft } from 'lucide-react'
import { BranchesApi, type BranchLite } from '@/src/libs/data/OrgStructureData'
import { CLEARED_OPTIONS, type ClearedType } from '../../_components/clearedOptions'
import { showToast } from '@/src/components/ui/toast'
import FundTransferAttachmentsPanel, {
  uploadStagedFundTransferAttachments,
} from '../../_components/FundTransferAttachmentsPanel'
import {
  BankAccounts,
  BankTransfers,
  type BankAccount,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({
  date: today(),
  clearedType: 'SAME_DATE' as ClearedType,
  clearingDate: '',
  sourceBankAccountId: '',
  destinationBankAccountId: '',
  amount: '',
  reference: '',
  description: '',
  branchId: '',
})

// Scenario 40 Gap 5 (Option B) — a real inter-account transfer, e.g.
// funding a branch's Petty Cash Fund or the Revolving Fund from the main
// operating account. Full page from the start, per the same developer
// feedback that moved the Expense form off a modal (2026-08-31).
//
// Scenario 61 — renamed from "Fund Transfer", gains a Clearing Date, and on
// success lands on the new transfer's own page with a "Transfer recorded"
// banner and its printable voucher — a page, not a pop-up (client UI/UX
// direction: no modals).
export default function FundTransferForm({
  ownBranch,
}: {
  /** Set for a branch-assigned user: the form records for this branch and the
   * field is locked to it. Null for the Owner, who picks (or leaves it blank). */
  ownBranch: { id: string; name: string } | null
}) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [form, setForm] = useState(() => ({ ...emptyForm(), branchId: ownBranch?.id ?? '' }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Scenario 72 Part 5 — supporting documents, held here until the transfer
  // exists (an attachment needs its id) and uploaded right after it is saved.
  const [stagedAttachments, setStagedAttachments] = useState<File[]>([])

  const loadAccounts = () =>
    BankAccounts.list().then((res) => {
      if (res.success && res.data) setAccounts(res.data)
    })
  useEffect(() => {
    loadAccounts()
  }, [])
  useEffect(() => {
    if (ownBranch) return
    BranchesApi.list().then((r) =>
      setBranches((r.data?.data ?? []).filter((b) => ('isActive' in b ? b.isActive : true)))
    )
  }, [ownBranch])

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.accountType})`,
  }))
  const source = accounts.find((a) => a.id === form.sourceBankAccountId)
  const destination = accounts.find((a) => a.id === form.destinationBankAccountId)
  const amount = Number(form.amount) || 0

  const validate = (): string | null => {
    if (!form.sourceBankAccountId) return 'Pick the source account.'
    if (!form.destinationBankAccountId) return 'Pick the destination account.'
    if (form.sourceBankAccountId === form.destinationBankAccountId)
      return 'Source and destination must be different accounts.'
    if (amount <= 0) return 'Enter an amount greater than 0.'
    if (form.clearedType === 'LATER_DATE' && !form.clearingDate)
      return 'Pick the date this transfer is expected to clear.'
    if (form.clearedType === 'LATER_DATE' && form.clearingDate < form.date)
      return 'Clearing date cannot be earlier than the transfer date.'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    const res = await BankTransfers.create({
      sourceBankAccountId: form.sourceBankAccountId,
      destinationBankAccountId: form.destinationBankAccountId,
      amount,
      date: form.date,
      clearingDate: form.clearedType === 'LATER_DATE' ? form.clearingDate : form.date,
      reference: form.reference || undefined,
      description: form.description || undefined,
      branchId: form.branchId || undefined,
    })
    if (!res.success || !res.data) {
      setSaving(false)
      setError(res.message || res.error || 'Transfer failed — check Account Mapping settings')
      return
    }
    // The transfer is posted either way; a scan that would not upload is
    // reported, not a reason to hide the transfer.
    if (stagedAttachments.length > 0) {
      const failed = await uploadStagedFundTransferAttachments(res.data.id, stagedAttachments)
      if (failed > 0) {
        showToast({
          title: `${failed} attachment${failed === 1 ? '' : 's'} failed to upload`,
          description: 'The transfer was recorded. Attach the file again from the transfer itself.',
          status: 'error',
        })
      }
    }
    setSaving(false)
    router.push(`/accounting/fund-transfers/${res.data.id}?created=1`)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/fund-transfers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to transfer history
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">Inter-Account Transfer</h1>
      <p className="mt-1 text-sm text-gray-500">
        Move money between two bank/fund accounts — e.g. funding a branch&apos;s Petty Cash Fund or
        the Revolving Fund. Posts a journal entry and updates both accounts&apos; balances.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div
          className={`grid gap-4 ${form.clearedType === 'LATER_DATE' ? 'max-w-2xl grid-cols-3' : 'max-w-md grid-cols-2'}`}
        >
          <Field label="Date *">
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Cleared">
            <Select
              compact
              value={form.clearedType}
              onChange={(value) =>
                setForm({
                  ...form,
                  clearedType: value as ClearedType,
                  clearingDate: value === 'LATER_DATE' ? form.clearingDate || form.date : '',
                })
              }
              options={CLEARED_OPTIONS}
            />
          </Field>
          {form.clearedType === 'LATER_DATE' && (
            <Field label="Cleared Date *">
              <input
                required
                type="date"
                min={form.date}
                value={form.clearingDate}
                onChange={(e) => setForm({ ...form, clearingDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="From (source) *">
            <SearchableSelect
              portal
              value={form.sourceBankAccountId}
              onChange={(id) => setForm({ ...form, sourceBankAccountId: id })}
              options={accountOptions}
              placeholder="— Select —"
            />
            {source && (
              <p className="mt-1 text-[12px] text-gray-500">
                Current balance: {fmtMoney(source.currentBalance)}
              </p>
            )}
          </Field>
          <Field label="To (destination) *">
            <SearchableSelect
              portal
              value={form.destinationBankAccountId}
              onChange={(id) => setForm({ ...form, destinationBankAccountId: id })}
              options={accountOptions}
              placeholder="— Select —"
            />
            {destination && (
              <p className="mt-1 text-[12px] text-gray-500">
                Current balance: {fmtMoney(destination.currentBalance)}
              </p>
            )}
          </Field>
        </div>

        <div className="max-w-xs">
          <Field label="Amount *">
            <MoneyInput
              required
              value={form.amount}
              onChange={(amount) => setForm({ ...form, amount })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
        </div>

        <Field label="Reference">
          <input
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </Field>
        <Field label="Description">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </Field>

        <div className="max-w-md">
          <Field label="Branch / Location">
            {ownBranch ? (
              <input
                readOnly
                value={ownBranch.name}
                aria-label="Branch / Location"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
              />
            ) : (
              <SearchableSelect
                portal
                clearable
                value={form.branchId}
                onChange={(id) => setForm({ ...form, branchId: id })}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="— Head office (no branch) —"
              />
            )}
          </Field>
        </div>

        <div className="pt-3 border-t">
          <FundTransferAttachmentsPanel
            staged={stagedAttachments}
            onStagedChange={setStagedAttachments}
          />
        </div>

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Link
            href="/accounting/fund-transfers"
            className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg text-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Transferring' : 'Transfer'}
          </button>
        </div>
      </form>
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
