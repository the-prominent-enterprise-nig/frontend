'use client'

import { useState, useEffect } from 'react'
import { getLeaveBalance } from '@/src/libs/actions/leave.actions'

type LeaveBalanceViewProps = {
  employeeId: string
  year?: number
}

type LeaveBalance = {
  id: string
  leaveTypeId: string
  leaveType: {
    id: string
    name: string
    code: string
  }
  allocatedDays: number
  adjustedDays: number
  usedDays: number
  carryoverDays: number
}

export default function LeaveBalanceView({
  employeeId,
  year = new Date().getFullYear(),
}: LeaveBalanceViewProps) {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBalances = async () => {
    try {
      setLoading(true)
      const result = await getLeaveBalance(employeeId, year)
      if (result.success) {
        setBalances(result.data as LeaveBalance[])
        setError(null)
      } else {
        setError(result.error || 'Failed to load leave balances')
      }
    } catch (err) {
      setError('Failed to load leave balances')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBalances()
  }, [employeeId, year])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-zinc-600">Loading leave balances...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  if (balances.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
        <p className="text-zinc-600">No leave balances found for {year}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {balances.map((balance) => {
        const remaining =
          balance.allocatedDays + balance.carryoverDays + balance.adjustedDays - balance.usedDays

        return (
          <div key={balance.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-zinc-900">
                  {balance.leaveType.name} ({balance.leaveType.code})
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-900">{remaining} days left</p>
                <p className="text-xs text-zinc-600">
                  {balance.usedDays} of {balance.allocatedDays} used
                </p>
              </div>
            </div>

            {/* Balance Breakdown */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-zinc-600">Allocated</p>
                <p className="font-semibold text-zinc-900">{balance.allocatedDays}</p>
              </div>
              {balance.carryoverDays > 0 && (
                <div>
                  <p className="text-zinc-600">Carryover</p>
                  <p className="font-semibold text-zinc-900">{balance.carryoverDays}</p>
                </div>
              )}
              {balance.adjustedDays !== 0 && (
                <div>
                  <p className="text-zinc-600">Adjusted</p>
                  <p
                    className={`font-semibold ${balance.adjustedDays > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {balance.adjustedDays > 0 ? '+' : ''}
                    {balance.adjustedDays}
                  </p>
                </div>
              )}
              <div>
                <p className="text-zinc-600">Used</p>
                <p className="font-semibold text-zinc-900">{balance.usedDays}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
