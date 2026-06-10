'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { QueueStatsAPI, fmtWait, type HourlyReportRow } from '@/src/libs/data/QueueData'

const TODAY = new Date().toISOString().slice(0, 10)
const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

export default function QueueReports() {
  const [startDate, setStartDate] = useState(SEVEN_DAYS_AGO)
  const [endDate, setEndDate] = useState(TODAY)
  const [rows, setRows] = useState<HourlyReportRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await QueueStatsAPI.hourly(startDate, endDate)
    setRows(res.data ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const totalIssued = rows.reduce((s, r) => s + r.issued, 0)
  const totalServed = rows.reduce((s, r) => s + r.served, 0)
  const avgWait = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.avgWaitSec, 0) / rows.length)
    : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/queue-management" className="p-2 rounded hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Queue Reports</h2>
          <p className="text-sm text-gray-500">Hourly throughput and average wait times.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="block">
          <span className="block text-xs text-gray-600 mb-1">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-600 mb-1">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </label>
        <button
          onClick={load}
          className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
        >
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">Total Issued</div>
          <div className="text-2xl font-bold">{totalIssued}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">Total Served</div>
          <div className="text-2xl font-bold">{totalServed}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">Avg Wait</div>
          <div className="text-2xl font-bold">{fmtWait(avgWait)}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Hour</th>
              <th className="px-3 py-2 text-right">Issued</th>
              <th className="px-3 py-2 text-right">Served</th>
              <th className="px-3 py-2 text-right">Avg Wait</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  No queue activity in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.hour}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {new Date(r.hour).toLocaleString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">{r.issued}</td>
                  <td className="px-3 py-2 text-right">{r.served}</td>
                  <td className="px-3 py-2 text-right">{fmtWait(r.avgWaitSec)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
