'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { RecurringExpenseTypes } from '@/src/libs/data/AccountingV2Data'
import { getAccountOptions, type Account } from '@/src/libs/data/AccountingData'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { RECURRING_PATH } from './recurringListShared'

const INPUT =
  'w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/** Add to, or edit an entry of, the client's List of Recurring Expenses: what it is
 * called and the account it is filed under. */
export default function RecurringTypeForm({ id }: { id?: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState<string | undefined>(undefined)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [ready, setReady] = useState(!id)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAccountOptions().then((r) => {
      const list = ((r.data as any)?.items ?? r.data ?? []) as Account[]
      // Same accounts an expense line can post to: no headers, no Equity.
      setAccounts(
        list.filter((a) => {
          const isHeader =
            (a.number ?? '').endsWith('-000') || (a.description ?? '').startsWith('Header account')
          return !isHeader && (a.type ?? '').toUpperCase() !== 'EQUITY'
        })
      )
    })
  }, [])

  useEffect(() => {
    if (!id) return
    // A response that arrives after this effect was cleaned up (React runs effects twice
    // in development) must not land: it would overwrite what has been typed meanwhile.
    let stale = false
    RecurringExpenseTypes.get(id).then((res) => {
      if (stale) return
      if (res.success && res.data) {
        setName(res.data.name)
        setAccountId(res.data.accountId ?? undefined)
        setReady(true)
      } else setLoadError(res.message || res.error || 'Could not load this entry')
    })
    return () => {
      stale = true
    }
  }, [id])

  const accountOptions = useMemo<CategorySelectOption[]>(
    () =>
      [...accounts]
        .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))
        .map((a) => ({ id: a.id, name: a.number ? `${a.number} — ${a.name}` : a.name, depth: 0 })),
    [accounts]
  )

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the expense a name.')
    setSaving(true)
    setError(null)
    const res = id
      ? await RecurringExpenseTypes.update(id, { name: name.trim(), accountId: accountId ?? null })
      : await RecurringExpenseTypes.create({
          name: name.trim(),
          ...(accountId ? { accountId } : {}),
        })
    setSaving(false)
    if (!res.success) return setError(res.message || res.error || 'Could not save')
    router.push(RECURRING_PATH)
  }

  if (loadError)
    return (
      <div className="px-6 py-5 lg:px-10">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      </div>
    )
  if (!ready)
    return (
      <div className="flex items-center gap-2 px-6 py-8 text-sm text-gray-400 lg:px-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    )

  return (
    <form onSubmit={save} className="px-6 py-5 lg:px-10">
      <Link
        href={RECURRING_PATH}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to recurring expenses
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-prominent-purple-900">
          {id ? 'Edit recurring expense' : 'Add to the list'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={RECURRING_PATH}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Expense *</span>
          <input
            aria-label="Recurring expense name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Electricity bills"
            maxLength={150}
            className={INPUT}
          />
        </label>
        <div>
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Account</span>
          <CategorySelect
            aria-label="Expense account"
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
            placeholder="Picked each time"
            noun="accounts"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            The account this kind of expense is filed under. Leave it empty where it depends on the
            product (installation).
          </p>
        </div>
      </div>
    </form>
  )
}
