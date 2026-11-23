'use client'

import { manilaToday } from '@/src/libs/format/manila-date'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AcknowledgementReceipts,
  BankAccounts,
  fmtDate,
  fmtMoney,
  type AgingAccountOption,
  type BankAccountOption,
  type CreateAcknowledgementReceiptInput,
} from '@/src/libs/data/AccountingV2Data'
import { getAccountOptions, type Account } from '@/src/libs/data/AccountingData'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import SegmentedControl from '@/src/components/ui/SegmentedControl'
import CustomerField, { type PickedCustomer } from './CustomerField'

/** The Chart of Accounts parents Received in lists under, by number: every
 * bank, cash and e-wallet account is an account under 1-01-010 (Cash and Cash
 * Equivalents — held as a bank/fund record tagged on that one account), and the
 * clearing accounts are real accounts under 1-01-040. */
const CLEARING_PARENT_NUMBER = '1-01-040'
const CASH_GROUP = 'Cash and Cash Equivalents'
const CLEARING_GROUP = 'Payment Gateway and Collection Clearing Funds'
/** The seeded Cash on Hand fund — counter cash, not money that reached a bank. */
const CASH_ON_HAND_TYPE = 'Cash'
/** Where a customer deposit is held. A customer's receipt picks it through
 * "Customer deposit", never as a plain account: that entry is what saves the
 * deposit record the customer's profile reads. */
const CUSTOMER_DEPOSITS_ACCOUNT_NUMBER = '2-01-040'

const MONTHLY_INSTALMENT = 'MI'
const CUSTOMER_DEPOSIT = 'DEPOSIT'

const RECEIPT_TYPE_OPTIONS = [
  { value: 'ACKNOWLEDGEMENT', label: 'Acknowledgement' },
  { value: 'COLLECTION', label: 'Collection' },
]

type FieldKey =
  | 'branch'
  | 'date'
  | 'reference'
  | 'payer'
  | 'receivedIn'
  | 'creditEntry'
  | 'agingAccount'
  | 'amount'

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-800">
        {label} {required && <span className="text-red-600">*</span>}
        {optional && <span className="font-normal text-gray-500"> (optional)</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'

const bankLabel = (acc: BankAccountOption) =>
  acc.bankName && acc.bankName !== 'N/A'
    ? `${acc.name} — ${acc.bankName} (${acc.accountNumber})`
    : acc.name

/** Docket NIG #90 — the simplified New Receipt form for a Collection: only the
 * fields a cashier needs, in the order the client asked for. Receipt Type and
 * Branch come first, then Date and Reference, the payer (a customer search or a
 * typed name), Description, Received in, Credit entry and Amount.
 *
 * Credit entry is what the money is for. A customer's can be Monthly
 * instalment — paying down ONE of their aging accounts, picked in the Aging
 * account field that appears only then — or Customer deposit; any other pick is
 * a Chart of Accounts account the money posts straight to, leaving AR Aging and
 * the customer's balance alone. Other receipt types keep their own form. */
export default function CollectionReceiptForm({
  restrictedBranchId,
  restrictedBranchName,
  branches,
  branchesLoading,
  acknowledgementOnly,
  onReceiptTypeChange,
}: {
  restrictedBranchId: string | null
  restrictedBranchName: string | null
  branches: Array<{ id: string; name: string }>
  branchesLoading: boolean
  acknowledgementOnly: boolean
  onReceiptTypeChange: (type: 'COLLECTION' | 'ACKNOWLEDGEMENT') => void
}) {
  const router = useRouter()
  const [branchId, setBranchId] = useState(restrictedBranchId ?? '')
  const [paymentDate, setPaymentDate] = useState(manilaToday())
  const [reference, setReference] = useState('')
  const [payerKind, setPayerKind] = useState<'CUSTOMER' | 'NON_CUSTOMER'>('CUSTOMER')
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [payerName, setPayerName] = useState('')
  const [description, setDescription] = useState('')
  const [receivedIn, setReceivedIn] = useState('')
  const [creditEntry, setCreditEntry] = useState('')
  const [agingAccountId, setAgingAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => {
    BankAccounts.options().then((res) => setBankAccounts(res.data ?? []))
    getAccountOptions().then((res) => {
      setAccounts(((res.data as any)?.items ?? res.data ?? []) as Account[])
    })
  }, [])

  // The options call names a parent `parentAccountId`; older shapes say `parentId`.
  const parentOf = (a: Account) =>
    (a as Account & { parentAccountId?: string | null }).parentAccountId ?? a.parentId ?? null

  const receivedInOptions = useMemo<SearchableSelectOption[]>(() => {
    const clearingParent = accounts.find((a) => a.number === CLEARING_PARENT_NUMBER)
    const cash = bankAccounts
      .filter((b) => b.isActive !== false)
      .map((b) => ({ value: `bank:${b.id}`, label: bankLabel(b), group: CASH_GROUP }))
    const clearing = clearingParent
      ? accounts
          .filter((a) => parentOf(a) === clearingParent.id)
          .map((a) => ({
            value: `gl:${a.id}`,
            label: a.number ? `${a.number} — ${a.name}` : a.name,
            group: CLEARING_GROUP,
          }))
      : []
    return [...cash, ...clearing]
  }, [bankAccounts, accounts])

  // Cash on Hand is where counter cash goes, so it is what the form starts on.
  useEffect(() => {
    if (receivedIn || bankAccounts.length === 0) return
    const cashOnHand = bankAccounts.find(
      (b) => b.isActive !== false && b.accountType === CASH_ON_HAND_TYPE
    )
    if (cashOnHand) setReceivedIn(`bank:${cashOnHand.id}`)
  }, [bankAccounts, receivedIn])

  // Accounts a receipt can post straight to: real accounts, not the headings
  // that group them.
  const creditAccountOptions = useMemo<SearchableSelectOption[]>(() => {
    const parents = new Set(accounts.map(parentOf).filter((id): id is string => !!id))
    return accounts
      .filter(
        (a) => !parents.has(a.id) && (a as Account & { visibility?: boolean }).visibility !== false
      )
      .map((a) => ({
        value: `acct:${a.id}`,
        label: a.number ? `${a.number} — ${a.name}` : a.name,
      }))
  }, [accounts])

  const creditEntryOptions = useMemo<SearchableSelectOption[]>(() => {
    if (payerKind !== 'CUSTOMER') return creditAccountOptions
    // Customer deposit already is that account, and the only way to it that also
    // records the deposit — listing the account beside it left a receipt that
    // posted but showed nowhere on the customer's profile.
    const deposits = accounts.find((a) => a.number === CUSTOMER_DEPOSITS_ACCOUNT_NUMBER)
    return [
      { value: MONTHLY_INSTALMENT, label: 'Monthly instalment (MI)' },
      { value: CUSTOMER_DEPOSIT, label: 'Customer deposit' },
      ...creditAccountOptions.filter((o) => !deposits || o.value !== `acct:${deposits.id}`),
    ]
  }, [payerKind, creditAccountOptions, accounts])

  // The customer's open aging accounts, for the Aging account pick.
  const [agingAccounts, setAgingAccounts] = useState<AgingAccountOption[]>([])
  const [loadingAging, setLoadingAging] = useState(false)
  const needsAgingAccount = creditEntry === MONTHLY_INSTALMENT
  useEffect(() => {
    setAgingAccountId('')
    if (!needsAgingAccount || !customer) {
      setAgingAccounts([])
      return
    }
    let cancelled = false
    setLoadingAging(true)
    AcknowledgementReceipts.agingAccounts(customer.id).then((res) => {
      if (cancelled) return
      setAgingAccounts(res.data ?? [])
      setLoadingAging(false)
    })
    return () => {
      cancelled = true
    }
  }, [needsAgingAccount, customer?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const agingOptions = useMemo<SearchableSelectOption[]>(
    () =>
      agingAccounts.map((a) => ({
        value: a.id,
        label: `${a.siNo}${a.branchName ? ` · ${a.branchName}` : ''} — ${fmtMoney(a.outstanding)} outstanding, next due ${fmtDate(a.nextDueDate)}`,
      })),
    [agingAccounts]
  )

  const clearError = (key: FieldKey) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))

  const changeCustomer = (next: PickedCustomer | null) => {
    setCustomer(next)
    clearError('payer')
  }

  const changePayerKind = (next: 'CUSTOMER' | 'NON_CUSTOMER') => {
    if (next === payerKind) return
    // Each kind keeps nothing of the other: a typed name is not a customer, and
    // Monthly instalment / Customer deposit are for a customer only.
    setCustomer(null)
    setPayerName('')
    if (creditEntry === MONTHLY_INSTALMENT || creditEntry === CUSTOMER_DEPOSIT) setCreditEntry('')
    setPayerKind(next)
    clearError('payer')
  }

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {}
    if (!branchId) next.branch = 'Branch is required.'
    if (!paymentDate) next.date = 'Date is required.'
    if (!reference.trim()) next.reference = 'Reference is required.'
    if (payerKind === 'CUSTOMER' ? !customer : !payerName.trim())
      next.payer = 'Payer name is required.'
    if (!receivedIn) next.receivedIn = 'Received in is required.'
    if (!creditEntry) next.creditEntry = 'Credit entry is required.'
    if (needsAgingAccount && !agingAccountId) next.agingAccount = 'Aging account is required.'
    if (!(Number(amount) > 0)) next.amount = 'Amount is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    if (!validate()) return

    const input: CreateAcknowledgementReceiptInput = {
      receiptType: 'COLLECTION',
      branchId: restrictedBranchId ?? branchId,
      paymentDate,
      reference: reference.trim(),
      payerName: payerKind === 'CUSTOMER' ? customer!.name : payerName.trim(),
      customerId: payerKind === 'CUSTOMER' ? customer!.id : undefined,
      reason: description.trim() || undefined,
      amount: Number(amount),
    }

    // Received in: a bank/e-wallet/fund account is a tag on the one cash
    // account, a clearing account is an account of its own. Cash on Hand is the
    // counter cash a branch still has to bank, so it names no bank: left empty,
    // the receipt waits in the branch's cash for a deposit.
    if (receivedIn.startsWith('gl:')) {
      input.receivedInAccountId = receivedIn.slice(3)
    } else {
      const bankId = receivedIn.slice('bank:'.length)
      const bank = bankAccounts.find((b) => b.id === bankId)
      if (bank?.accountType !== CASH_ON_HAND_TYPE) input.bankAccountId = bankId
    }

    if (creditEntry === MONTHLY_INSTALMENT) {
      input.creditEntry = 'MONTHLY_INSTALMENT'
      input.installmentAccountId = agingAccountId
    } else if (creditEntry === CUSTOMER_DEPOSIT) {
      input.creditEntry = 'CUSTOMER_DEPOSIT'
    } else {
      input.accountId = creditEntry.slice('acct:'.length)
    }

    setSaving(true)
    const res = await AcknowledgementReceipts.create(input)
    setSaving(false)
    if (!res.success || !res.data) {
      setSaveError(res.message || res.error || 'Save failed')
      return
    }
    router.push(`/pos/collections/acknowledgement/view?id=${res.data.id}`)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/pos/collections"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Collections
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">New Collection Receipt</h1>
      <p className="mt-1 text-sm text-gray-500">
        Record money received from a customer or from someone who is not a customer.
      </p>

      <form
        onSubmit={submit}
        noValidate
        className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5"
      >
        <Field label="Receipt Type" required>
          <SearchableSelect
            value="COLLECTION"
            onChange={(value) => onReceiptTypeChange(value as 'COLLECTION' | 'ACKNOWLEDGEMENT')}
            options={
              acknowledgementOnly
                ? RECEIPT_TYPE_OPTIONS.filter((o) => o.value === 'ACKNOWLEDGEMENT')
                : RECEIPT_TYPE_OPTIONS
            }
            placeholder="Select receipt type…"
          />
        </Field>

        <Field label="Branch" required error={errors.branch}>
          {restrictedBranchId ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {restrictedBranchName}
            </p>
          ) : (
            <SearchableSelect
              value={branchId}
              onChange={(value) => {
                setBranchId(value)
                clearError('branch')
              }}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              placeholder={branchesLoading ? 'Loading branches…' : 'Select branch…'}
              disabled={branchesLoading}
              ariaLabel="Branch"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required error={errors.date}>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => {
                setPaymentDate(e.target.value)
                clearError('date')
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Reference" required error={errors.reference}>
            <input
              value={reference}
              maxLength={100}
              onChange={(e) => {
                setReference(e.target.value)
                clearError('reference')
              }}
              placeholder="e.g. CRPMIB004512"
              className={inputClass}
            />
          </Field>
        </div>

        {/* Not a <label>: wrapped in one, the first radio would take the whole
            label as its name and a click on the word "Payer" would pick it. */}
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-800">Payer</span>
          <SegmentedControl
            name="Payer"
            value={payerKind}
            onChange={changePayerKind}
            options={[
              { value: 'CUSTOMER', label: 'Customer' },
              { value: 'NON_CUSTOMER', label: 'Non-customer' },
            ]}
          />
        </div>

        {payerKind === 'CUSTOMER' ? (
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-800">
              Payer name <span className="text-red-600">*</span>
            </span>
            <CustomerField value={customer} onChange={changeCustomer} />
            {errors.payer && (
              <span className="mt-1 block text-xs text-red-600">{errors.payer}</span>
            )}
          </div>
        ) : (
          <Field label="Payer name" required error={errors.payer}>
            <input
              value={payerName}
              maxLength={255}
              onChange={(e) => {
                setPayerName(e.target.value)
                clearError('payer')
              }}
              placeholder="Who paid"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Description" optional>
          <input
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Advance payment"
            className={inputClass}
          />
        </Field>

        <Field label="Received in" required error={errors.receivedIn}>
          <SearchableSelect
            value={receivedIn}
            onChange={(value) => {
              setReceivedIn(value)
              clearError('receivedIn')
            }}
            options={receivedInOptions}
            placeholder="Select where the money was received…"
            ariaLabel="Received in"
          />
        </Field>

        <Field label="Credit entry" required error={errors.creditEntry}>
          <SearchableSelect
            value={creditEntry}
            onChange={(value) => {
              setCreditEntry(value)
              clearError('creditEntry')
            }}
            options={creditEntryOptions}
            placeholder="Select credit entry…"
            ariaLabel="Credit entry"
          />
        </Field>

        {needsAgingAccount && (
          <Field label="Aging account" required error={errors.agingAccount}>
            <SearchableSelect
              value={agingAccountId}
              onChange={(value) => {
                setAgingAccountId(value)
                clearError('agingAccount')
              }}
              options={agingOptions}
              placeholder={
                !customer
                  ? 'Pick the customer first'
                  : loadingAging
                    ? 'Loading aging accounts…'
                    : agingOptions.length === 0
                      ? 'No open aging accounts for this customer'
                      : 'Select aging account…'
              }
              disabled={!customer || loadingAging}
              ariaLabel="Aging account"
            />
          </Field>
        )}

        <Field label="Amount" required error={errors.amount}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              clearError('amount')
            }}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>

        {saveError && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {saveError}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
