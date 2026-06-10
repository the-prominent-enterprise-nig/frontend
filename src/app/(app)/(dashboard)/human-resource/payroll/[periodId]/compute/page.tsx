'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { getPayrollPeriod } from '../../_actions/payroll-actions'

const PayrollTable = dynamic(() => import('../../_components/PayrollTable'), {
  ssr: false,
  loading: () => <p className="text-center py-8 text-gray-400">Loading payroll table...</p>,
})

export default function ComputePayrollPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = use(params)

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-period', periodId],
    queryFn: () => getPayrollPeriod(periodId),
    staleTime: 2 * 60 * 1000,
  })

  const period = data?.data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    )
  }

  if (error || !period) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Failed to load payroll period.
      </div>
    )
  }

  return (
    <div className="min-h-full bg-white">
      <PayrollTable
        startDate={new Date(period.startDate + 'T00:00:00')}
        endDate={new Date(period.endDate + 'T00:00:00')}
        editPeriodId={periodId}
      />
    </div>
  )
}
