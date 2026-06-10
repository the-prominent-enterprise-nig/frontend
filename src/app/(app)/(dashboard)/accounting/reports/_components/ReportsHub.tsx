'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Reports, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'

type Tab =
  | 'trial-balance'
  | 'pnl'
  | 'balance-sheet'
  | 'general-ledger'
  | 'cash-flow'
  | 'ar-aging'
  | 'ap-aging'
  | 'bi'

const VALID_TABS: Tab[] = [
  'trial-balance',
  'pnl',
  'balance-sheet',
  'general-ledger',
  'cash-flow',
  'ar-aging',
  'ap-aging',
  'bi',
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

  const load = async () => {
    setLoading(true)
    setData(null)
    let res: any
    if (tab === 'trial-balance') res = await Reports.trialBalance(asOf)
    else if (tab === 'pnl') res = await Reports.pnl(startDate, endDate)
    else if (tab === 'balance-sheet') res = await Reports.balanceSheet(asOf)
    else if (tab === 'general-ledger') res = await Reports.generalLedger({ startDate, endDate })
    else if (tab === 'cash-flow') res = await Reports.cashFlow(startDate, endDate)
    else if (tab === 'ar-aging') res = await Reports.aging('ar', asOf)
    else if (tab === 'ap-aging') res = await Reports.aging('ap', asOf)
    else if (tab === 'bi') res = await Reports.biSummary()
    setData(res?.data ?? null)
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [tab])

  const needsDateRange = ['pnl', 'general-ledger', 'cash-flow'].includes(tab)
  const needsAsOf = ['trial-balance', 'balance-sheet', 'ar-aging', 'ap-aging'].includes(tab)

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
            ['general-ledger', 'General Ledger'],
            ['ar-aging', 'AR Aging'],
            ['ap-aging', 'AP Aging'],
            ['bi', 'BI Summary'],
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

      <div className="flex flex-wrap gap-3 mb-4 items-end">
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
        <button
          onClick={load}
          className="px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800"
        >
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {!data ? (
          <div className="text-center text-gray-400 py-8">Run the report to see data.</div>
        ) : tab === 'trial-balance' ? (
          <TrialBalanceView data={data} />
        ) : tab === 'pnl' ? (
          <PnLView data={data} />
        ) : tab === 'balance-sheet' ? (
          <BalanceSheetView data={data} />
        ) : tab === 'general-ledger' ? (
          <GLView data={data} />
        ) : tab === 'cash-flow' ? (
          <CashFlowView data={data} />
        ) : tab === 'ar-aging' ? (
          <AgingView data={data} type="ar" />
        ) : tab === 'ap-aging' ? (
          <AgingView data={data} type="ap" />
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

function PnLView({ data }: { data: any }) {
  return (
    <>
      <div className="text-xs text-gray-500 mb-3">
        {fmtDate(data.startDate)} — {fmtDate(data.endDate)}
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

function GLView({ data }: { data: any }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">No posted transactions in this range.</div>
    )
  }
  return (
    <Table headers={['Date', 'Reference', 'Account', 'Description', 'Debit', 'Credit']}>
      {rows.map((t: any) => (
        <tr key={t.id}>
          <td className="px-3 py-2 text-xs">{fmtDate(t.date)}</td>
          <td className="px-3 py-2 font-mono text-xs">{t.reference || '—'}</td>
          <td className="px-3 py-2">
            {t.account?.number} {t.account?.name}
          </td>
          <td className="px-3 py-2 text-gray-500">{t.description || '—'}</td>
          <td className="px-3 py-2 text-right">{t.debit ? fmtMoney(t.debit) : '—'}</td>
          <td className="px-3 py-2 text-right">{t.credit ? fmtMoney(t.credit) : '—'}</td>
        </tr>
      ))}
    </Table>
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
        type === 'ar' ? 'Customer' : 'Vendor',
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
