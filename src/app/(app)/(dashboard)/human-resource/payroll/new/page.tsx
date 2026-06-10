'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ArrowRight } from 'lucide-react'
import dynamic from 'next/dynamic'

const PayrollTable = dynamic(() => import('../_components/PayrollTable'), {
  ssr: false,
  loading: () => <p className="text-center py-8 text-gray-400">Loading payroll table...</p>,
})

export default function NewPayrollPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const startParam = searchParams.get('startDate')
  const endParam = searchParams.get('endDate')

  const [startDate, setStartDate] = useState(startParam ?? '')
  const [endDate, setEndDate] = useState(endParam ?? '')
  const [error, setError] = useState('')

  const hasParams = !!startParam && !!endParam

  const handleSetDates = () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates.')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date.')
      return
    }
    setError('')
    router.push(`/human-resource/payroll/new?startDate=${startDate}&endDate=${endDate}`)
  }

  if (hasParams) {
    return (
      <div className="min-h-full bg-white">
        <PayrollTable
          startDate={new Date(startParam + 'T00:00:00')}
          endDate={new Date(endParam + 'T00:00:00')}
        />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <CalendarDays size={22} className="text-purple-600" />
            <h1 className="text-xl font-semibold text-gray-900">New Payroll Period</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay Period Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pay Period End</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSetDates}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-700 text-white text-sm font-medium rounded-lg hover:bg-purple-800 transition-colors"
            >
              Continue to Compute
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
