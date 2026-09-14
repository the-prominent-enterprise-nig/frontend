'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Expenses, EmployeesApi, type EmployeeLite } from '@/src/libs/data/AccountingV2Data'
import {
  getAccounts,
  getCustomers,
  type Account,
  type Customer,
} from '@/src/libs/data/AccountingData'

/**
 * Opens a named balance under a control account.
 *
 * Until this existed a Special Account came into being sideways — the first
 * expense line that typed a name under a control account created it. So an
 * advance agreed today could not be set up until its disbursement was
 * encoded, and the register could not be used to check a name before typing
 * it into an entry.
 *
 * The name is the identity (lines are matched to it by name, not by id), so
 * it is asked for plainly and the duplicate check is the server's — case
 * differences included, since the register groups case-insensitively.
 */
export default function NewSpecialAccountModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [employees, setEmployees] = useState<EmployeeLite[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState({
    name: '',
    controlAccountId: '',
    linkType: 'none' as 'none' | 'employee' | 'customer',
    employeeId: '',
    customerId: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only accounts that keep a subsidiary ledger can carry a named balance,
    // and the server rejects the rest — so offering the whole chart here
    // would only invite an error.
    getAccounts({ limit: 500 }).then((r) => {
      // /accounts answers with a bare array, not the paginated envelope its
      // return type promises — same unwrap the Expense form does.
      const list = ((r.data as { items?: Account[] })?.items ??
        (r.data as unknown as Account[]) ??
        []) as Account[]
      setAccounts(list.filter((a) => a.isSpecialAccountControl))
    })
    EmployeesApi.search().then((r) => setEmployees(r.data ?? []))
    getCustomers({ limit: 200 }).then((r) => {
      const payload = r.data
      setCustomers(Array.isArray(payload) ? payload : (payload?.items ?? []))
    })
  }, [])

  const controlAccount = useMemo(
    () => accounts.find((a) => a.id === form.controlAccountId),
    [accounts, form.controlAccountId]
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) return setError('Enter the name the balance is carried against.')
    if (!form.controlAccountId) return setError('Pick the control account carrying it.')

    setSaving(true)
    setError(null)
    const res = await Expenses.createSpecialAccount({
      name,
      controlAccountId: form.controlAccountId,
      employeeId: form.linkType === 'employee' ? form.employeeId || undefined : undefined,
      customerId: form.linkType === 'customer' ? String(form.customerId) || undefined : undefined,
      notes: form.notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Could not open the account')
      return
    }
    onCreated(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="mt-12 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New Special Account</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              A named balance under a control account. It lists at zero until something is posted to
              it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name *">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Juan Dela Cruz"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Expense lines are matched to this account by name, so spell it the way it will be
              encoded.
            </p>
          </Field>

          <Field label="Control account *">
            <select
              value={form.controlAccountId}
              onChange={(e) => setForm({ ...form, controlAccountId: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number ?? a.code} {a.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              {accounts.length === 0
                ? 'No account is marked as keeping a subsidiary ledger yet — set one in the Chart of Accounts first.'
                : 'The same name can be carried under more than one account — an advance and a loan stay separate balances.'}
            </p>
          </Field>

          <Field label="Who this is">
            <div className="flex gap-2">
              {(['none', 'employee', 'customer'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, linkType: t })}
                  className={`rounded-lg border px-3 py-1.5 text-xs capitalize ${
                    form.linkType === t
                      ? 'border-purple-300 bg-purple-50 text-purple-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t === 'none' ? 'Not on file' : t}
                </button>
              ))}
            </div>
            {form.linkType === 'employee' && (
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— Select employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            )}
            {form.linkType === 'customer' && (
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-[11px] text-gray-500">
              Optional. The ledger is assembled by name either way — linking only lets it point back
              at their record.
            </p>
          </Field>

          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Terms, agreement reference…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <p className="text-[11px] text-gray-400">
            {controlAccount ? `Opens under ${controlAccount.name}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Opening…' : 'Open account'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}
