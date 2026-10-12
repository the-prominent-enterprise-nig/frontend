'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  createAccount,
  getAccountById,
  getAccounts,
  updateAccount,
  type Account,
  type AccountInput,
} from '@/src/libs/data/AccountingData'
import {
  ACCOUNT_CLASSES,
  CASH_FLOW_CLASSES,
  CATEGORIES_BY_GROUP,
  DEFAULT_CATEGORY_OF_CLASS,
  DEFAULT_CATEGORY_OF_GROUP,
  GROUPS_BY_CLASS,
  groupOfCategory,
  type AccountClass,
  type AccountGroup,
  type CashFlowClass,
} from '@/src/libs/accounting/account-classification'
import { Select } from '@/src/components/ui/Select'
import { SearchCombobox } from '@/src/components/ui/SearchCombobox'

const LIST_HREF = '/accounting/chart-of-accounts'

// A header row of the client's chart (1-00-000 "ASSETS" …) carries the general
// category of its type. The form never offers it for a new account, but an
// existing header has to be editable without losing it.
const GENERAL_CATEGORIES = ['ASSET', 'LIABILITY', 'EQUITY']

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

// An account saved before the client's types existed has none; its base type is
// the nearest thing. Expenses can't be told apart without the number, so they
// start at Operating Expenses and the user is shown it.
const CLASS_OF_BASE_TYPE: Record<string, AccountClass> = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'OPERATING_EXPENSES',
}

type FormState = {
  number: string
  name: string
  accountClass: AccountClass | ''
  group: AccountGroup | ''
  /** Never asked for: set from the group, or from the type when it has none. */
  category: string
  cashFlowClass: CashFlowClass | ''
  parentId: string
  parentClass: string
  description: string
}

const EMPTY: FormState = {
  number: '',
  name: '',
  accountClass: '',
  group: '',
  category: '',
  cashFlowClass: '',
  parentId: '',
  parentClass: '',
  description: '',
}

function stateFrom(a: Account): FormState {
  const accountClass = (a.accountClass ?? CLASS_OF_BASE_TYPE[a.type] ?? '') as AccountClass | ''
  return {
    number: a.number ?? a.code ?? '',
    name: a.name,
    accountClass,
    group: groupOfCategory(a.category) ?? '',
    category: a.category ?? '',
    cashFlowClass: a.cashFlowClass ?? '',
    parentId: a.parentAccount?.id ?? a.parentAccountId ?? '',
    parentClass: a.parentAccount?.accountClass ?? '',
    description: a.description ?? '',
  }
}

function Field({
  label,
  action,
  className = '',
  children,
}: {
  label: string
  /** Sits at the right of the label — e.g. a Clear link. */
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="block text-xs font-medium text-zinc-600">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

/**
 * New / Edit Account, as a page. The Chart of Accounts had this as a modal; the
 * client wants create and edit flows on their own page. The fields and their
 * order are the client's mockup: Account No. and Name; Account Type and
 * Group / Category; Cash Flow Classification; Description; Cancel / Save.
 * Parent Account is the one addition, kept at the user's say-so.
 *
 * Account Type is the client's eight (Asset … Non-Operating Expenses).
 * Group / Category is one select holding the client's four balance-sheet groups,
 * so it applies to an asset or a liability only (to an asset, the two asset
 * groups) and is greyed for the other types. The finer category the reports read
 * is never asked for: it is set from the group (DEFAULT_CATEGORY_OF_GROUP) or the
 * type (DEFAULT_CATEGORY_OF_CLASS), and an existing account keeps its own.
 * Cash Flow Classification is optional; left blank, the account follows its
 * category, as the Cash Flow report always did.
 */
export default function AccountForm({ accountId }: { accountId?: string }) {
  const router = useRouter()
  const [initial, setInitial] = useState<Account | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [ready, setReady] = useState(!accountId)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    getAccountById(accountId).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setInitial(res.data)
        setForm(stateFrom(res.data))
      } else {
        setLoadError(res.message || res.error || 'Could not load this account.')
      }
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [accountId])

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  // Only an asset or a liability has groups; the rest have none to pick.
  const groups = form.accountClass ? GROUPS_BY_CLASS[form.accountClass] : undefined
  const noGroupApplies = !!form.accountClass && !groups
  // An existing header keeps its general category; it needs no group.
  const keepsGeneral =
    !!initial?.category &&
    GENERAL_CATEGORIES.includes(initial.category) &&
    form.category === initial.category

  const onClass = (value: string) => {
    const next = value as AccountClass
    // Back on the type the account started with: give it back the group and
    // category it had, rather than the default a different type would start from.
    const backToStart =
      !!initial && next === (initial.accountClass ?? CLASS_OF_BASE_TYPE[initial.type])
    set({
      accountClass: next,
      group: backToStart ? (groupOfCategory(initial.category) ?? '') : '',
      category: backToStart ? (initial.category ?? '') : (DEFAULT_CATEGORY_OF_CLASS[next] ?? ''),
      // A parent has to sit in the same section.
      ...(form.parentClass && form.parentClass !== next ? { parentId: '', parentClass: '' } : {}),
    })
  }

  const onGroup = (value: string) => {
    const next = value as AccountGroup
    set({
      group: next,
      // Keep the finer category an existing account already has, while it still
      // belongs to the group; otherwise the group's own default.
      category: CATEGORIES_BY_GROUP[next].includes(form.category)
        ? form.category
        : DEFAULT_CATEGORY_OF_GROUP[next],
    })
  }

  const validate = (): string | null => {
    if (!form.number.trim()) return 'Enter the account number.'
    if (!form.name.trim()) return 'Enter the account name.'
    if (!form.accountClass) return 'Select the account type.'
    if (groups && !form.group && !keepsGeneral) return 'Select the group — current or non-current.'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setSaving(true)
    const payload: AccountInput = {
      number: form.number.trim(),
      name: form.name.trim(),
      accountClass: form.accountClass as AccountClass,
      category: form.category || null,
      cashFlowClass: form.cashFlowClass || null,
      parentAccountId: form.parentId || null,
      description: form.description.trim() || null,
    }
    const res = initial ? await updateAccount(initial.id, payload) : await createAccount(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Could not save this account.')
      return
    }
    router.push(LIST_HREF)
  }

  const searchParents = async (q: string) => {
    const res = await getAccounts({
      search: q || undefined,
      accountClass: form.accountClass || undefined,
      limit: 30,
    })
    const data = res.data as Account[] | { items?: Account[] } | undefined
    const rows = Array.isArray(data) ? data : (data?.items ?? [])
    return rows
      .filter((a) => a.id !== initial?.id)
      .map((a) => ({
        id: a.id,
        primary: `${a.number ?? a.code} ${a.name}`,
        meta: a.accountClass ?? '',
      }))
  }

  if (!ready) {
    return <div className="px-6 py-8 text-sm text-gray-400 lg:px-10">Loading…</div>
  }
  if (loadError) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href={LIST_HREF}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chart of accounts
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-5 lg:px-10">
      <Link
        href={LIST_HREF}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to chart of accounts
      </Link>
      <h1 className="text-2xl font-semibold text-prominent-purple-900">
        {initial ? 'Edit Account' : 'New Account'}
      </h1>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        {initial
          ? `${initial.number ?? initial.code} · ${initial.name}`
          : 'Add an account to the chart of accounts.'}
      </p>

      <form onSubmit={submit} noValidate>
        <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-2">
          <Field label="Account No. *">
            <input
              value={form.number}
              onChange={(e) => set({ number: e.target.value })}
              placeholder="e.g. 1-01-010"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
          <Field label="Account Name *">
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Enter account name"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Account Type *">
            <Select
              value={form.accountClass}
              onChange={onClass}
              options={ACCOUNT_CLASSES}
              placeholder="Select account type"
            />
          </Field>
          <Field label={noGroupApplies ? 'Group / Category' : 'Group / Category *'}>
            <Select
              value={form.group}
              onChange={onGroup}
              options={groups ?? []}
              disabled={!groups}
              placeholder={
                noGroupApplies
                  ? 'Not applicable'
                  : keepsGeneral
                    ? 'Header — no group'
                    : 'Select group or category'
              }
            />
          </Field>

          <Field
            label="Cash Flow Classification"
            className="md:col-span-2"
            action={
              form.cashFlowClass ? (
                <button
                  type="button"
                  onClick={() => set({ cashFlowClass: '' })}
                  className="text-xs text-zinc-500 hover:text-zinc-800"
                >
                  Clear
                </button>
              ) : undefined
            }
          >
            <Select
              value={form.cashFlowClass}
              onChange={(v) => set({ cashFlowClass: v as CashFlowClass })}
              options={CASH_FLOW_CLASSES}
              placeholder="Select classification"
            />
          </Field>

          <Field label="Parent Account" className="md:col-span-2">
            <SearchCombobox
              value={form.parentId}
              onChange={(id) => set(id ? { parentId: id } : { parentId: '', parentClass: '' })}
              onSelect={(o) => set({ parentClass: typeof o.meta === 'string' ? o.meta : '' })}
              queryKey={`coa-parent-${form.accountClass}`}
              search={searchParents}
              initialLabel={
                initial?.parentAccount && initial.parentAccount.id === form.parentId
                  ? `${initial.parentAccount.number} ${initial.parentAccount.name}`
                  : undefined
              }
              placeholder={form.accountClass ? 'None — top level' : 'Select account type first'}
              disabled={!form.accountClass}
            />
          </Field>

          <Field label="Description" className="md:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Enter description (optional)"
              rows={3}
              className={INPUT_CLASS}
            />
          </Field>

          <div className="mt-2 border-t border-zinc-100 pt-4 md:col-span-2">
            {error && (
              <div
                role="alert"
                className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
              >
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Link
                href={LIST_HREF}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
