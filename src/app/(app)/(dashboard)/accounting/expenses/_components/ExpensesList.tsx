'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, CheckCircle, Ban, Search, Printer, Eye } from 'lucide-react'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import { printExpenseVoucherDocument } from '@/src/libs/print/printInventoryDocument'
import { Expenses, type BusinessExpense, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import { BranchesApi, type BranchLite } from '@/src/libs/data/OrgStructureData'

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
  if (x.customer?.name) {
    // Only append the Sales Invoice # when one was actually picked — most
    // Customer-payee entries have no AR invoice linked at all.
    return x.salesInvoiceNumber ? `${x.customer.name} — ${x.salesInvoiceNumber}` : x.customer.name
  }
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
  // Payroll: generic lines that name people, each with its own Division —
  // "name / division", or a count once there are several.
  const named = x.lines.filter((l) => l.payee || l.employee)
  if (named.length > 0) {
    if (named.length === 1) {
      const l = named[0]
      const who = l.payee || `${l.employee!.firstName} ${l.employee!.lastName}`
      const division = l.divisionDepartment?.name ?? l.divisionBranch?.name
      return division ? `${who} / ${division}` : who
    }
    return `${named.length} recipients`
  }
  // Nobody named: fall back to whichever divisions the lines carry.
  const divisions = new Set(
    x.lines
      .map((l) => l.divisionDepartment?.name ?? l.divisionBranch?.name)
      .filter((n): n is string => Boolean(n))
  )
  if (divisions.size === 1) return [...divisions][0]
  if (divisions.size > 1) return `${divisions.size} divisions`
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
  // An entry matches when any of its lines carries the chosen branch.
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<BranchLite[]>([])

  const expenseAccounts = accounts.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await Expenses.list({
      search: search || undefined,
      status: statusFilter || undefined,
      categoryAccountId: categoryFilter || undefined,
      divisionBranchId: branchFilter || undefined,
    })
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [search, statusFilter, categoryFilter, branchFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    BranchesApi.list().then((r) => setBranches(r.data?.data ?? []))
  }, [])
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
  // Collapsed into one overflow menu rather than six icon buttons, the way
  // AP Bills already does it — the icons alone never said which was Record
  // and which was Void, and half the row's width went on actions.
  const rowMenu = (x: BusinessExpense): RowMenuItem[] => [
    { label: 'View', icon: Eye, onClick: () => router.push(`/accounting/expenses/${x.id}`) },
    { label: 'Print voucher', icon: Printer, onClick: () => printVoucher(x.id) },
    ...(x.status === 'DRAFT'
      ? [
          {
            label: 'Record',
            icon: CheckCircle,
            onClick: () => record(x.id),
            variant: 'success' as const,
          },
        ]
      : []),
    ...(x.status === 'RECORDED'
      ? [{ label: 'Void — reverses JE', icon: Ban, onClick: () => voidExpense(x.id) }]
      : []),
    ...(x.status === 'DRAFT'
      ? [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => router.push(`/accounting/expenses/${x.id}/edit`),
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => del(x.id),
            variant: 'danger' as const,
          },
        ]
      : []),
  ]

  const printVoucher = async (id: string) => {
    const res = await Expenses.getDocument(id)
    if (res.success && res.data) printExpenseVoucherDocument(res.data)
    else alert(res.message || res.error || 'Could not build the voucher')
  }

  const selectCls =
    'h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500'

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-prominent-purple-900">Expenses</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Record and categorize business expenses. Recording posts a journal entry to the GL.
          </p>
        </div>
        <Link
          href="/accounting/expenses/new"
          className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
        >
          <Plus className="h-4 w-4" /> New Expense
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={selectCls}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RECORDED">Recorded</option>
          <option value="VOID">Void</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by account"
          className={`${selectCls} max-w-[260px]`}
        >
          <option value="">All accounts</option>
          {expenseAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          aria-label="Filter by branch"
          className={selectCls}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-5 py-3 text-left font-semibold">Payee</th>
                <th className="px-5 py-3 text-right font-semibold">Amount</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="w-12 px-3 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-400">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-400">
                    No expenses.
                  </td>
                </tr>
              ) : (
                items.map((x) => {
                  const ref = referenceLabel(x)
                  return (
                    <tr
                      key={x.id}
                      onClick={() => router.push(`/accounting/expenses/${x.id}`)}
                      className="cursor-pointer transition-colors hover:bg-purple-50/40"
                    >
                      <td className="whitespace-nowrap px-5 py-2.5 text-zinc-600">
                        {fmtDate(x.expenseDate)}
                      </td>
                      {/* Voucher # is Supplier-only; the expense number stands
                          in for the rest, so every row still has an identifier.
                          It and the reference sit under the payee instead of
                          in columns of their own. */}
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-zinc-900">{payeeLabel(x)}</span>
                        <span className="ml-2 font-mono text-xs text-zinc-400">
                          {x.voucherNumber || x.expenseNumber}
                          {ref !== '—' && <span className="font-sans"> · Ref {ref}</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold tabular-nums text-zinc-900">
                        {fmtMoney(x.totalAmount)}
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[x.status] ?? 'bg-purple-50 text-purple-700'}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {x.status.charAt(0) + x.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      {/* Actions are inside a row that navigates on click — stop
                          the bubble so a Delete/Record press doesn't also open
                          the detail page behind the confirm dialog. */}
                      <td className="px-3 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowActionsMenu items={rowMenu(x)} />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
