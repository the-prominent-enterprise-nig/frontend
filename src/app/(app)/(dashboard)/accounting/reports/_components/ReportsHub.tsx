'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Reports, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getCustomers, type Customer } from '@/src/libs/data/AccountingData'
import {
  getBranches,
  type BranchDetail,
} from '@/src/app/(app)/(dashboard)/settings/_actions/get-branches'
import GlReconciliationView from './GlReconciliationView'
import AgingReportView from '@/src/app/(app)/(dashboard)/crm/installment-accounts/aging-report/_components/AgingReportView'

type Tab =
  | 'trial-balance'
  | 'pnl'
  | 'balance-sheet'
  | 'cash-flow'
  | 'ar-aging'
  | 'ap-aging'
  | 'grni'
  | 'customer-statement'
  | 'cost-center'
  | 'bi'
  | 'reconciliation'

const VALID_TABS: Tab[] = [
  'trial-balance',
  'pnl',
  'balance-sheet',
  'cash-flow',
  'ar-aging',
  'ap-aging',
  'grni',
  'customer-statement',
  'cost-center',
  'bi',
  'reconciliation',
]

const TODAY = new Date().toISOString().slice(0, 10)
const YEAR_START = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

export default function ReportsHub() {
  const searchParams = useSearchParams()
  const initTab = VALID_TABS.includes(searchParams.get('tab') as Tab)
    ? (searchParams.get('tab') as Tab)
    : 'trial-balance'
  const [tab, setTab] = useState<Tab>(initTab)
  const [asOf, setAsOf] = useState(TODAY)
  const [startDate, setStartDate] = useState(YEAR_START)
  const [endDate, setEndDate] = useState(TODAY)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  // Customer statement: deep-linkable via ?tab=customer-statement&customerId=...
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState(searchParams.get('customerId') ?? '')
  // P&L branch scoping (SCEN-14 Closing Gap 2) — empty means all branches
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [branchId, setBranchId] = useState(searchParams.get('branchId') ?? '')
  // P&L internal-vs-net view (SCEN-14 Closing Gap 3)
  const [pnlView, setPnlView] = useState<'internal' | 'net'>(
    searchParams.get('view') === 'internal' ? 'internal' : 'net'
  )

  const load = async () => {
    // Reconciliation and AR Aging are self-contained (each fetches its own
    // data) — nothing for this hub's shared data state to do. AR Aging used
    // to be the generic invoice-bucketed Reports.aging('ar', asOf) view;
    // it's now AgingReportView, the installment-account-based report
    // matching the client's real "AGING OF ACCOUNTS RECEIVABLE" sheet —
    // Reports.aging('ar', ...) itself is untouched, just no longer called
    // from here.
    if (tab === 'reconciliation' || tab === 'ar-aging') return
    setLoading(true)
    setData(null)
    let res: any
    if (tab === 'trial-balance') res = await Reports.trialBalance(asOf)
    else if (tab === 'pnl')
      res = await Reports.pnl(startDate, endDate, branchId || undefined, pnlView)
    else if (tab === 'balance-sheet') res = await Reports.balanceSheet(asOf)
    else if (tab === 'cash-flow') res = await Reports.cashFlow(startDate, endDate)
    else if (tab === 'ap-aging') res = await Reports.aging('ap', asOf)
    else if (tab === 'grni') res = await Reports.grni()
    else if (tab === 'customer-statement') {
      if (!customerId) {
        setLoading(false)
        return
      }
      res = await Reports.customerStatement(customerId)
    } else if (tab === 'cost-center') res = await Reports.costCenter(startDate, endDate)
    else if (tab === 'bi') res = await Reports.biSummary()
    setData(res?.data ?? null)
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [tab])

  // Customer list is only needed for the statement picker
  useEffect(() => {
    if (tab !== 'customer-statement' || customers.length) return
    getCustomers({ limit: 500 }).then((r) =>
      setCustomers(((r.data as any)?.items ?? r.data ?? []) as Customer[])
    )
  }, [tab, customers.length])

  // Branch list is only needed for the P&L branch scope picker
  useEffect(() => {
    if (tab !== 'pnl' || branches.length) return
    getBranches().then((r) => setBranches(r.success && r.data ? r.data : []))
  }, [tab, branches.length])

  const needsDateRange = ['pnl', 'cash-flow', 'cost-center'].includes(tab)
  const needsAsOf = ['trial-balance', 'balance-sheet', 'ap-aging'].includes(tab)
  const needsCustomer = tab === 'customer-statement'
  const needsBranch = tab === 'pnl'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Reports</h2>
      <p className="text-sm text-gray-500 mb-4">
        Financial reports based on posted journal entries.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
        {(
          [
            ['trial-balance', 'Trial Balance'],
            ['pnl', 'Profit & Loss'],
            ['balance-sheet', 'Balance Sheet'],
            ['cash-flow', 'Cash Flow'],
            ['ar-aging', 'AR Aging'],
            ['ap-aging', 'AP Aging'],
            ['grni', 'GRNI'],
            ['customer-statement', 'Customer Statement'],
            ['cost-center', 'Cost Center'],
            ['bi', 'BI Summary'],
            ['reconciliation', 'GL Reconciliation'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === k ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div
        className={`flex flex-wrap gap-3 mb-4 items-end ${tab === 'reconciliation' || tab === 'ar-aging' ? 'hidden' : ''}`}
      >
        {needsAsOf && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">As of</label>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
        )}
        {needsDateRange && (
          <>
            <div>
              <label className="block text-xs text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </>
        )}
        {needsBranch && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Branch</label>
            <select
              aria-label="Branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-48"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {needsBranch && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">View</label>
            <select
              aria-label="View"
              value={pnlView}
              onChange={(e) => setPnlView(e.target.value as 'internal' | 'net')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-48"
            >
              <option value="net">Net (Adjusted — external reporting)</option>
              <option value="internal">Internal (Unadjusted — management)</option>
            </select>
          </div>
        )}
        {needsCustomer && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-56"
            >
              <option value="">— Select a customer —</option>
              {customers.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.name}
                  {c.customerCode ? ` (${c.customerCode})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={load}
          disabled={needsCustomer && !customerId}
          className="px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>

      <div
        className={
          tab === 'reconciliation' || tab === 'ar-aging'
            ? ''
            : 'bg-white border border-gray-200 rounded-lg p-4'
        }
      >
        {tab === 'reconciliation' ? (
          <GlReconciliationView />
        ) : tab === 'ar-aging' ? (
          <AgingReportView />
        ) : !data ? (
          <div className="text-center text-gray-400 py-8">
            {needsCustomer && !customerId
              ? 'Select a customer to view their statement.'
              : 'Run the report to see data.'}
          </div>
        ) : tab === 'customer-statement' ? (
          <CustomerStatementView data={data} />
        ) : tab === 'trial-balance' ? (
          <TrialBalanceView data={data} />
        ) : tab === 'pnl' ? (
          <PnLView data={data} branchName={branches.find((b) => b.id === data.branchId)?.name} />
        ) : tab === 'balance-sheet' ? (
          <BalanceSheetView data={data} />
        ) : tab === 'cash-flow' ? (
          <CashFlowView data={data} />
        ) : tab === 'ap-aging' ? (
          <AgingView data={data} type="ap" />
        ) : tab === 'grni' ? (
          <GrniView data={data} />
        ) : tab === 'cost-center' ? (
          <CostCenterView data={data} />
        ) : tab === 'bi' ? (
          <BIView data={data} />
        ) : null}
      </div>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: any }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  )
}

const STATEMENT_STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  SENT: 'bg-blue-50 text-blue-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function CustomerStatementView({ data }: { data: any }) {
  const invoices: any[] = Array.isArray(data?.invoices) ? data.invoices : []
  const openBalance = data?.openBalance ?? data?.balance ?? 0

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data?.customer?.name ?? '—'}</h3>
          <p className="text-xs text-gray-500">
            {data?.customer?.customerCode ?? ''}
            {data?.customer?.email ? ` · ${data.customer.email}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Open Balance</div>
          <div className="text-2xl font-bold text-purple-700">{fmtMoney(openBalance)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total Billed" value={data?.totalBilled ?? 0} />
        <Stat label="Cash Received" value={data?.totalCashReceived ?? data?.totalPaid ?? 0} />
        <Stat label="Credit Memos" value={data?.totalCredited ?? 0} />
        <Stat label="Open Invoices" value={data?.openInvoices?.length ?? 0} isCount />
      </div>

      {invoices.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No invoices for this customer.</div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const open = inv.totalAmount - inv.amountPaid
            const history = [
              ...(inv.payments ?? []).map((p: any) => ({
                kind: 'Payment',
                date: p.paymentDate,
                amount: p.amount + (p.withholdingAmount ?? 0),
                detail: [p.method, p.reference].filter(Boolean).join(' · ') || 'Payment received',
              })),
              ...(inv.creditMemos ?? []).map((m: any) => ({
                kind: 'Credit Memo',
                date: m.memoDate,
                amount: m.amount,
                detail: [m.memoNumber, m.reason].filter(Boolean).join(' · '),
              })),
            ].sort((a, b) => String(a.date).localeCompare(String(b.date)))

            return (
              <div key={inv.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${STATEMENT_STATUS_STYLES[inv.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {inv.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      Issued {fmtDate(inv.invoiceDate)} · Due {fmtDate(inv.dueDate)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-500">
                      Total <span className="text-gray-900">{fmtMoney(inv.totalAmount)}</span>
                    </span>
                    <span className="text-gray-500">
                      Settled <span className="text-gray-900">{fmtMoney(inv.amountPaid)}</span>
                    </span>
                    <span className="text-gray-500">
                      Open{' '}
                      <span className={open > 0 ? 'font-semibold text-red-600' : 'text-gray-900'}>
                        {fmtMoney(open)}
                      </span>
                    </span>
                  </div>
                </div>
                {history.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">No payments yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {history.map((h, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-xs text-gray-500 w-24">
                            {fmtDate(h.date)}
                          </td>
                          <td className="px-3 py-1.5 w-28">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${h.kind === 'Credit Memo' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                            >
                              {h.kind}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-600">{h.detail}</td>
                          <td className="px-3 py-1.5 text-right">{fmtMoney(h.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, isCount }: { label: string; value: number; isCount?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{isCount ? value : fmtMoney(value)}</div>
    </div>
  )
}

function TrialBalanceView({ data }: { data: any }) {
  const rows = Array.isArray(data?.rows) ? data.rows : []
  return (
    <>
      <div className="text-xs text-gray-500 mb-2">As of {fmtDate(data?.asOf)}</div>
      <Table headers={['Account #', 'Name', 'Type', 'Debit', 'Credit']}>
        {rows.map((r: any) => (
          <tr key={r.accountId}>
            <td className="px-3 py-2 font-mono text-xs">{r.number}</td>
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2 text-xs">{r.type}</td>
            <td className="px-3 py-2 text-right">{r.balance > 0 ? fmtMoney(r.balance) : '—'}</td>
            <td className="px-3 py-2 text-right">{r.balance < 0 ? fmtMoney(-r.balance) : '—'}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end gap-8 text-sm font-semibold">
        <div>Total Debit: {fmtMoney(data?.totalDebit ?? 0)}</div>
        <div>Total Credit: {fmtMoney(data?.totalCredit ?? 0)}</div>
      </div>
    </>
  )
}

function Section({ title, items, total }: { title: string; items?: any[]; total?: number }) {
  const rows = Array.isArray(items) ? items : []
  return (
    <div className="mb-4">
      <div className="font-semibold text-gray-800 mb-1">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-400 italic pl-3">None</div>
      ) : (
        rows.map((r: any) => (
          <div
            key={r.accountId}
            className="flex justify-between text-sm py-1 pl-3 border-l-2 border-gray-100"
          >
            <span>
              {r.number} — {r.name}
            </span>
            <span>{fmtMoney(Math.abs(r.balance ?? 0))}</span>
          </div>
        ))
      )}
      <div className="flex justify-between text-sm font-semibold mt-1 pl-3 border-t border-gray-200 pt-1">
        <span>Total {title}</span>
        <span>{fmtMoney(total ?? 0)}</span>
      </div>
    </div>
  )
}

function PnLView({ data, branchName }: { data: any; branchName?: string }) {
  return (
    <>
      <div className="text-xs text-gray-500 mb-3">
        {fmtDate(data.startDate)} — {fmtDate(data.endDate)}
        {data.branchId && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
            {branchName ?? 'Branch-scoped'}
          </span>
        )}
        {data.view === 'internal' && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
            Internal (Unadjusted)
          </span>
        )}
      </div>
      <Section title="Revenue" items={data.revenue} total={data.totalRevenue} />
      <Section title="Cost of Goods Sold" items={data.cogs} total={data.totalCogs} />
      <div className="flex justify-between text-sm font-semibold py-2 border-y border-gray-300 bg-gray-50 px-3">
        <span>Gross Profit</span>
        <span>{fmtMoney(data.grossProfit)}</span>
      </div>
      <Section title="Operating Expenses" items={data.opEx} total={data.totalOpEx} />
      <div className="flex justify-between text-base font-bold py-2 border-y-2 border-gray-700 bg-emerald-50 px-3 mt-2">
        <span>Net Income</span>
        <span>{fmtMoney(data.netIncome)}</span>
      </div>
    </>
  )
}

function BalanceSheetView({ data }: { data: any }) {
  return (
    <>
      <div className="text-xs text-gray-500 mb-3">As of {fmtDate(data.asOf)}</div>
      <Section title="Assets" items={data.assets} total={data.totalAssets} />
      <Section title="Liabilities" items={data.liabilities} total={data.totalLiabilities} />
      <Section title="Equity" items={data.equity} total={data.totalEquity} />
      <div className="flex justify-between text-sm font-semibold py-2 border-y-2 border-gray-700 bg-gray-50 px-3 mt-2">
        <span>Liabilities + Equity</span>
        <span>{fmtMoney(data.totalLiabilities + data.totalEquity)}</span>
      </div>
    </>
  )
}

function CashFlowView({ data }: { data: any }) {
  return (
    <>
      <div className="text-xs text-gray-500 mb-3">
        {fmtDate(data.startDate)} — {fmtDate(data.endDate)}
      </div>
      <Section title="Operating Activities" items={data.operating} total={data.operatingTotal} />
      <Section title="Investing Activities" items={data.investing} total={data.investingTotal} />
      <Section title="Financing Activities" items={data.financing} total={data.financingTotal} />
      <div className="flex justify-between text-base font-bold py-2 border-y-2 border-gray-700 bg-gray-50 px-3 mt-2">
        <span>Net Change in Cash</span>
        <span>{fmtMoney(data.netCashChange)}</span>
      </div>
    </>
  )
}

function AgingView({ data, type }: { data: any; type: 'ar' | 'ap' }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No outstanding {type === 'ar' ? 'invoices' : 'bills'}.
      </div>
    )
  }
  return (
    <Table
      headers={[
        type === 'ar' ? 'Invoice #' : 'Bill #',
        type === 'ar' ? 'Customer' : 'Supplier',
        'Due Date',
        'Outstanding',
        'Days Overdue',
        'Bucket',
      ]}
    >
      {rows.map((r: any) => (
        <tr key={r.id}>
          <td className="px-3 py-2 font-mono text-xs">{r.invoiceNumber || r.billNumber}</td>
          <td className="px-3 py-2">{r.customer || r.vendor}</td>
          <td className="px-3 py-2 text-xs">{fmtDate(r.dueDate)}</td>
          <td className="px-3 py-2 text-right">{fmtMoney(r.outstanding)}</td>
          <td className="px-3 py-2 text-right">{r.daysOverdue}</td>
          <td className="px-3 py-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${r.bucket === 'Current' ? 'bg-emerald-50 text-emerald-700' : r.bucket === '90+' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
            >
              {r.bucket}
            </span>
          </td>
        </tr>
      ))}
    </Table>
  )
}

// Scenario 36 Gap 2 — receipts already posted to the GL but not yet matched
// to a supplier bill/invoice. Oldest-received-first (backend-sorted).
function GrniView({ data }: { data: any }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No receipts pending a matching supplier bill.
      </div>
    )
  }
  return (
    <Table
      headers={[
        'Receipt #',
        'Supplier',
        'Warehouse',
        'Received',
        'DR #',
        'SI #',
        'Amount',
        'Days Outstanding',
      ]}
    >
      {rows.map((r: any) => (
        <tr key={r.id}>
          <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
          <td className="px-3 py-2">{r.supplier?.name ?? '—'}</td>
          <td className="px-3 py-2 text-xs">{r.warehouse?.name ?? '—'}</td>
          <td className="px-3 py-2 text-xs">{fmtDate(r.receivedAt)}</td>
          <td className="px-3 py-2 text-xs">{r.deliveryReceiptNumber ?? '—'}</td>
          <td className="px-3 py-2 text-xs">{r.supplierInvoiceNumber ?? '—'}</td>
          <td className="px-3 py-2 text-right">{fmtMoney(r.total)}</td>
          <td className="px-3 py-2 text-right">
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${r.daysOutstanding > 30 ? 'bg-red-50 text-red-700' : r.daysOutstanding > 7 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
            >
              {r.daysOutstanding}d
            </span>
          </td>
        </tr>
      ))}
    </Table>
  )
}

// SCEN-14 Closing Gap 4: costCenter was captured on AR invoices/AP bills/
// expenses/fixed assets but never surfaced in any report — this reads it.
function CostCenterView({ data }: { data: any }) {
  const rows: any[] = Array.isArray(data?.rows) ? data.rows : []
  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No cost-center-tagged records in this range.
      </div>
    )
  }
  const totals = rows.reduce(
    (acc, r) => ({
      arInvoiceTotal: acc.arInvoiceTotal + r.arInvoiceTotal,
      apBillTotal: acc.apBillTotal + r.apBillTotal,
      expenseTotal: acc.expenseTotal + r.expenseTotal,
      fixedAssetTotal: acc.fixedAssetTotal + r.fixedAssetTotal,
      total: acc.total + r.total,
    }),
    { arInvoiceTotal: 0, apBillTotal: 0, expenseTotal: 0, fixedAssetTotal: 0, total: 0 }
  )
  return (
    <Table
      headers={[
        'Cost Center',
        'AR Invoiced (Revenue)',
        'AP Invoices',
        'Expenses',
        'Fixed Assets',
        'Total Cost',
      ]}
    >
      {rows.map((r) => (
        <tr key={r.costCenter} className={r.costCenter === 'Unassigned' ? 'text-gray-400' : ''}>
          <td className="px-3 py-2 font-medium">{r.costCenter}</td>
          <td className="px-3 py-2 text-right">{fmtMoney(r.arInvoiceTotal)}</td>
          <td className="px-3 py-2 text-right">{fmtMoney(r.apBillTotal)}</td>
          <td className="px-3 py-2 text-right">{fmtMoney(r.expenseTotal)}</td>
          <td className="px-3 py-2 text-right">{fmtMoney(r.fixedAssetTotal)}</td>
          <td className="px-3 py-2 text-right font-semibold">{fmtMoney(r.total)}</td>
        </tr>
      ))}
      <tr className="font-semibold bg-gray-50">
        <td className="px-3 py-2">Total</td>
        <td className="px-3 py-2 text-right">{fmtMoney(totals.arInvoiceTotal)}</td>
        <td className="px-3 py-2 text-right">{fmtMoney(totals.apBillTotal)}</td>
        <td className="px-3 py-2 text-right">{fmtMoney(totals.expenseTotal)}</td>
        <td className="px-3 py-2 text-right">{fmtMoney(totals.fixedAssetTotal)}</td>
        <td className="px-3 py-2 text-right">{fmtMoney(totals.total)}</td>
      </tr>
    </Table>
  )
}

function BIView({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        ['Total Assets', data.totalAssets],
        ['Total Liabilities + Equity', data.totalLiabilitiesEquity],
        ['AR Outstanding', data.arOutstanding],
        ['AP Outstanding', data.apOutstanding],
      ].map(([label, val]) => (
        <div key={label as string} className="p-4 bg-purple-50 rounded-lg">
          <div className="text-xs text-purple-600 mb-1">{label}</div>
          <div className="text-2xl font-bold text-gray-900">{fmtMoney(val as number)}</div>
        </div>
      ))}
    </div>
  )
}
