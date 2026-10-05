'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Printer, RefreshCw } from 'lucide-react'
import {
  BankAccounts,
  BankTransfers,
  type BankAccount,
  type FundTransfer,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'
import { printInterAccountTransferVoucherDocument } from '@/src/libs/print/printInventoryDocument'

const d = (v: string | null) => (v ? v.slice(0, 10) : '—')

// Scenario 61 — Inter-Account Transfer history. Before this, a transfer
// existed only as its journal entry, and saving one bounced back to Bank
// Accounts with no record of it anywhere on screen.
export default function FundTransfersList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<FundTransfer[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    bankAccountId: '',
    startDate: '',
    endDate: '',
    search: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await BankTransfers.list({
      bankAccountId: filters.bankAccountId || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      search: filters.search.trim() || undefined,
    })
    setItems(res.data ?? [])
    setLoading(false)
  }, [filters])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])
  useEffect(() => {
    BankAccounts.list().then((res) => setAccounts(res.data ?? []))
  }, [])

  const printVoucher = async (id: string) => {
    const res = await BankTransfers.getDocument(id)
    if (res.success && res.data) printInterAccountTransferVoucherDocument(res.data)
  }

  const total = items.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Inter-Account Transfers</h2>
          <p className="text-sm text-gray-500">
            Money moved between bank and fund accounts. Open one to edit its clearing date or
            reference, or to print its voucher.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canCreate && (
            <Link
              href="/accounting/fund-transfers/new"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
            >
              <Plus className="w-4 h-4" /> New Transfer
            </Link>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Account</span>
          <select
            value={filters.bankAccountId}
            onChange={(e) => setFilters({ ...filters, bankAccountId: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">From</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">To</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </label>
        <label className="block flex-1 min-w-[200px]">
          <span className="block text-xs font-medium text-gray-600 mb-1">Search</span>
          <input
            placeholder="Voucher #, reference, account…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Voucher #</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Clearing Date</th>
              <th className="px-3 py-2 text-left">From</th>
              <th className="px-3 py-2 text-left">To</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  No transfers found.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/accounting/fund-transfers/${t.id}`)}
                  className="border-t border-gray-100 hover:bg-purple-50/40 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-purple-700">{t.transferNumber}</td>
                  <td className="px-3 py-2">{d(t.date)}</td>
                  <td className="px-3 py-2">
                    {t.clearingDate ? (
                      d(t.clearingDate)
                    ) : (
                      <span className="text-amber-600">Not yet cleared</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{t.sourceBankAccount.name}</td>
                  <td className="px-3 py-2">{t.destinationBankAccount.name}</td>
                  <td className="px-3 py-2 text-gray-600">{t.reference ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(t.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        printVoucher(t.id)
                      }}
                      title="Print voucher"
                      aria-label="Print voucher"
                      className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                <td colSpan={6} className="px-3 py-2">
                  {items.length} transfer{items.length === 1 ? '' : 's'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
