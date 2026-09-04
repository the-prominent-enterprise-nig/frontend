'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  CheckCircle,
  Ban,
  Search,
  Printer,
  Eye,
} from 'lucide-react'
import { printExpenseVoucherDocument } from '@/src/libs/print/printInventoryDocument'
import { Expenses, type BusinessExpense, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECORDED: 'bg-emerald-50 text-emerald-700',
  VOID: 'bg-red-50 text-red-600',
}

// Scenario 40 Part 6 — payee is fixed at the header for CUSTOMER/SUPPLIER
// (and OTHER/Utilities, OTHER/Salaries & Wages), but varies per line for
// OTHER/Special Accounts (each line has its own recipient).
function payeeLabel(x: BusinessExpense): string {
  if (x.supplier?.name) return x.supplier.name
  if (x.customer?.name) return x.customer.name
  if (x.employee) return `${x.employee.firstName} ${x.employee.lastName}`
  if (x.payee) return x.payee
  if (x.payeeType === 'OTHER' && x.otherCategory === 'SPECIAL_ACCOUNTS' && x.lines.length > 0) {
    if (x.lines.length === 1) {
      const l = x.lines[0]
      if (l.employee) return `${l.employee.firstName} ${l.employee.lastName}`
      if (l.payee) return l.payee
    } else {
      return `${x.lines.length} recipients`
    }
  }
  return '—'
}

// Category is fixed at the header for OTHER (every line shares it), but
// varies per line for CUSTOMER/SUPPLIER.
function categoryLabel(x: BusinessExpense): string {
  if (x.lines.length === 0) return '—'
  const first = x.lines[0].categoryAccount?.name ?? '—'
  return x.lines.length > 1 ? `${first} +${x.lines.length - 1} more` : first
}

// One entry can be paid through several methods at once (e.g. part Cash,
// part Bank Transfer), so both of these summarise the first row and count
// the rest — the full breakdown is on the detail page.
function extra(x: BusinessExpense): string {
  return x.payments.length > 1 ? ` +${x.payments.length - 1} more` : ''
}

// Where the money left from: the named bank when it was a transfer, the
// method itself otherwise (Cash has no account to name).
function paidFromLabel(x: BusinessExpense): string {
  if (x.payments.length === 0) return '—'
  const p = x.payments[0]
  return (p.bankAccount || p.paymentMethod.replace(/_/g, ' ')) + extra(x)
}

function referenceLabel(x: BusinessExpense): string {
  const first = x.payments.find((p) => p.reference)?.reference
  return first ? first + extra(x) : '—'
}

export default function ExpensesList() {
  const router = useRouter()
  const [items, setItems] = useState<BusinessExpense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [printingFor, setPrintingFor] = useState<string | null>(null)

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
  const printVoucher = async (id: string) => {
    setPrintingFor(id)
    try {
      const res = await Expenses.getDocument(id)
      if (res.success && res.data) printExpenseVoucherDocument(res.data)
      else alert(res.message || res.error || 'Could not build the voucher')
    } finally {
      setPrintingFor(null)
    }
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
          <Link
            href="/accounting/expenses/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Expense
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search # / reference / payee / description..."
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
          <option value="">All accounts</option>
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
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Paid from</th>
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-left">Accounts</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Voucher #</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No expenses.
                </td>
              </tr>
            ) : (
              items.map((x) => (
                <tr
                  key={x.id}
                  onClick={() => router.push(`/accounting/expenses/${x.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 text-xs">{fmtDate(x.expenseDate)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{referenceLabel(x)}</td>
                  <td className="px-3 py-2 text-xs">{paidFromLabel(x)}</td>
                  <td className="px-3 py-2">{payeeLabel(x)}</td>
                  <td className="px-3 py-2">
                    {categoryLabel(x)}
                    {x.specialAccountType === 'CA_LIQUIDATION' && (
                      <span className="ml-1 text-[11px] text-purple-600">(Liquidation)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(x.totalAmount)}</td>
                  {/* Voucher # is Supplier-only; the expense number stands in
                      for the rest, so every row still has an identifier. */}
                  <td className="px-3 py-2 font-mono text-xs text-purple-700">
                    {x.voucherNumber || x.expenseNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[x.status] ?? 'bg-purple-50 text-purple-700'}`}
                    >
                      {x.status}
                    </span>
                  </td>
                  {/* Actions are inside a row that navigates on click — stop
                      the bubble so a Delete/Record press doesn't also open
                      the detail page behind the confirm dialog. */}
                  <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/accounting/expenses/${x.id}`}
                        title="View"
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => printVoucher(x.id)}
                        disabled={printingFor === x.id}
                        title="Print voucher"
                        className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
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
                          <Link
                            href={`/accounting/expenses/${x.id}/edit`}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
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
    </div>
  )
}
