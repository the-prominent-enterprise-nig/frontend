'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Pencil, Trash2, CheckCircle, Ban, X, Search } from 'lucide-react'
import { Expenses, type BusinessExpense, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, getVendors, type Account, type Vendor } from '@/src/libs/data/AccountingData'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CARD', 'E_WALLET']

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECORDED: 'bg-emerald-50 text-emerald-700',
  VOID: 'bg-red-50 text-red-600',
}

export default function ExpensesList() {
  const [items, setItems] = useState<BusinessExpense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editing, setEditing] = useState<BusinessExpense | null>(null)
  const [creating, setCreating] = useState(false)

  const expenseAccounts = accounts.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await Expenses.list({
      search: search || undefined,
      status: statusFilter || undefined,
      categoryAccountId: categoryFilter || undefined,
    })
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [search, statusFilter, categoryFilter])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) =>
      setAccounts(((r.data as any)?.items ?? r.data ?? []) as Account[])
    )
    getVendors().then((r) => setVendors(((r.data as any)?.items ?? r.data ?? []) as Vendor[]))
  }, [])

  const del = async (id: string) => {
    if (!confirm('Delete expense?')) return
    const res = await Expenses.remove(id)
    if (!res.success) alert(res.message || res.error || 'Delete failed')
    load()
  }
  const record = async (id: string) => {
    const res = await Expenses.record(id)
    if (!res.success)
      alert(res.message || res.error || 'Record failed — check Account Mapping settings')
    load()
  }
  const voidExpense = async (id: string) => {
    if (!confirm('Void this expense? Its journal entry will be reversed.')) return
    const res = await Expenses.void(id)
    if (!res.success) alert(res.message || res.error || 'Void failed')
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Expenses</h2>
          <p className="text-sm text-gray-500">
            Record and categorize business expenses. Recording posts a journal entry to the GL.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Expense
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search # / payee / description..."
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RECORDED">Recorded</option>
          <option value="VOID">Void</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="">All categories</option>
          {expenseAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Expense #</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              <th className="px-3 py-2 text-right">Tax</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  No expenses.
                </td>
              </tr>
            ) : (
              items.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2 font-mono text-xs">{x.expenseNumber}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(x.expenseDate)}</td>
                  <td className="px-3 py-2">{x.vendor?.name ?? x.payee ?? '—'}</td>
                  <td className="px-3 py-2">{x.categoryAccount?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(x.subtotal)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(x.taxAmount)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(x.totalAmount)}</td>
                  <td className="px-3 py-2 text-xs">{x.paymentMethod ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[x.status] ?? 'bg-purple-50 text-purple-700'}`}
                    >
                      {x.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {x.status === 'DRAFT' && (
                        <button
                          onClick={() => record(x.id)}
                          title="Record — posts to GL"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {x.status === 'RECORDED' && (
                        <button
                          onClick={() => voidExpense(x.id)}
                          title="Void — reverses journal entry"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {x.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => setEditing(x)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => del(x.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ExpenseForm
          initial={editing}
          vendors={vendors}
          expenseAccounts={expenseAccounts}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function ExpenseForm({
  initial,
  vendors,
  expenseAccounts,
  onClose,
  onSaved,
}: {
  initial: BusinessExpense | null
  vendors: Vendor[]
  expenseAccounts: Account[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    expenseDate: initial?.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    vendorId: initial?.vendorId ?? '',
    payee: initial?.payee ?? '',
    description: initial?.description ?? '',
    categoryAccountId: initial?.categoryAccountId ?? '',
    subtotal: String(initial?.subtotal ?? ''),
    taxAmount: String(initial?.taxAmount ?? ''),
    paymentMethod: initial?.paymentMethod ?? 'CASH',
    reference: initial?.reference ?? '',
    costCenter: initial?.costCenter ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = (Number(form.subtotal) || 0) + (Number(form.taxAmount) || 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      vendorId: form.vendorId || undefined,
      payee: form.payee || undefined,
      subtotal: Number(form.subtotal),
      taxAmount: Number(form.taxAmount || 0),
    }
    const res = initial
      ? await Expenses.update(initial.id, payload)
      : await Expenses.create(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Expense' : 'New Expense'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <input
                required
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Category (expense account) *">
              <select
                required
                value={form.categoryAccountId}
                onChange={(e) => setForm({ ...form, categoryAccountId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— Select —</option>
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor">
              <select
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— None —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payee (when no vendor)">
              <input
                value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
                placeholder="e.g. Meralco"
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
          <div className="grid grid-cols-3 gap-3">
            <Field label="Subtotal *">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Input VAT">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.taxAmount}
                onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Payment Method">
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reference (OR / receipt #)">
              <input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Cost Center">
              <input
                value={form.costCenter}
                onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>
          <div className="text-sm text-gray-600 text-right">
            Total: <span className="font-semibold">{fmtMoney(total)}</span>
          </div>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
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
