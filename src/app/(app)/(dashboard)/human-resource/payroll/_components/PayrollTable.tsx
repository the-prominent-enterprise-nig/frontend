'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Loader2, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { getEmployees } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/get-employee-list'
import { calculateWorkingDays } from '@/src/libs/payroll/calculations'
import {
  getHolidaysInRange,
  getWeekendsInRange,
  isThirteenthMonthPeriod,
  toDateStr,
} from '@/src/libs/payroll/holidays'
import { PayrollDataProvider, usePayrollDataContext } from './PayrollDataContext'
import PayrollRow from './PayrollRow'
import PayrollTotalRow from './PayrollTotalRow'
import {
  createPayrollPeriod,
  generatePayslips,
  deletePayslipsByPeriodId,
  updatePayrollPeriod,
  resetPayrollApproval,
} from '../_actions/payroll-actions'

const BATCH_SIZE = 7

interface PayrollTableProps {
  startDate: Date
  endDate: Date
  editPeriodId?: string
}

function PayrollTableInner({ startDate, endDate, editPeriodId }: PayrollTableProps) {
  const router = useRouter()
  const { getPayrollData } = usePayrollDataContext()

  const [searchTerm, setSearchTerm] = useState('')
  const [payrollCycle, setPayrollCycle] = useState(1)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const employeeDataRef = useRef<Record<string, Record<string, number>>>({})

  const { data: employeeResult, isLoading } = useQuery({
    queryKey: ['employees-for-payroll'],
    queryFn: () => getEmployees({ status: 'active', limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })

  const employees = employeeResult?.data?.data ?? []
  const fetchError =
    employeeResult && !employeeResult.success
      ? (employeeResult.error ?? 'Failed to load employees')
      : null

  const uniqueHolidays = useMemo(() => getHolidaysInRange(startDate, endDate), [startDate, endDate])

  const holidayDateSet = useMemo(() => new Set(uniqueHolidays.map((h) => h.date)), [uniqueHolidays])

  const actualDays = useMemo(
    () => calculateWorkingDays(startDate, endDate, holidayDateSet),
    [startDate, endDate, holidayDateSet]
  )

  const uniqueWeekends = useMemo(
    () => getWeekendsInRange(startDate, endDate, holidayDateSet),
    [startDate, endDate, holidayDateSet]
  )

  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp) =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [employees, searchTerm]
  )

  const handleDataChange = useCallback((employeeId: string, data: Record<string, number>) => {
    employeeDataRef.current[employeeId] = data
  }, [])

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const allData = getPayrollData()

      // Use all employees (not filtered) so a search term doesn't cause incomplete payroll
      const employeeRows = employees.map((emp) => {
        const row = allData[emp.id] ?? employeeDataRef.current[emp.id] ?? {}
        const loanBalance = Math.max(0, Number(row.loanBalance ?? 0))
        return { id: emp.id, salaryData: row, loanBalance }
      })

      const totalAmount = employeeRows.reduce((s, e) => s + (Number(e.salaryData.total) || 0), 0)
      const totalDeductions = employeeRows.reduce(
        (s, e) => s + (Number(e.salaryData.totalDeduction) || 0),
        0
      )
      const totalNetPay = employeeRows.reduce((s, e) => s + (Number(e.salaryData.netPay) || 0), 0)
      const totalDailyRate = employeeRows.reduce(
        (s, e) => s + (Number(e.salaryData.dailyRate) || 0),
        0
      )

      let periodId: string

      if (editPeriodId) {
        await deletePayslipsByPeriodId(editPeriodId)
        await updatePayrollPeriod(editPeriodId, {
          note,
          totalActualDays: employees.length * actualDays,
          totalDailyRate,
          totalAmount,
          totalDeductions,
          totalNetPay,
        })
        await resetPayrollApproval(editPeriodId)
        periodId = editPeriodId
      } else {
        const periodResult = await createPayrollPeriod({
          startDate: toDateStr(startDate),
          endDate: toDateStr(endDate),
          note,
          totalActualDays: employees.length * actualDays,
          totalDailyRate,
          totalAmount,
          totalDeductions,
          totalNetPay,
        })

        if (!periodResult.success || !periodResult.data) {
          throw new Error(periodResult.error ?? 'Failed to create payroll period')
        }
        periodId = periodResult.data.id
      }

      const totalBatches = Math.ceil(employeeRows.length / BATCH_SIZE)
      for (let i = 0; i < totalBatches; i++) {
        const batch = employeeRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
        const result = await generatePayslips({
          payrollPeriodId: periodId,
          startDate: toDateStr(startDate),
          endDate: toDateStr(endDate),
          cycle: payrollCycle,
          employees: batch,
        })
        if (!result.success) {
          throw new Error(result.error ?? 'Payslip generation failed')
        }
      }

      toast.success(
        editPeriodId ? 'Payroll re-generated successfully!' : 'Payroll generated successfully!'
      )

      setTimeout(() => {
        router.push(`/human-resource/payroll/${periodId}`)
      }, 1500)
    } catch (err) {
      toast.error(
        `Payroll generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {editPeriodId ? 'Re-generate Payroll' : 'Generate Payroll'}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded text-xs">
            {toDateStr(startDate)}
          </span>
          <span>—</span>
          <span className="bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded text-xs">
            {toDateStr(endDate)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 w-64"
            />
          </div>
          <select
            value={payrollCycle}
            onChange={(e) => setPayrollCycle(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
          >
            <option value={1}>1st Cycle</option>
            <option value={2}>2nd Cycle</option>
          </select>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          {isSubmitting ? 'Generating...' : editPeriodId ? 'Re-generate' : 'Generate Payroll'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-gray-200 max-h-[500px]">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-gray-50 border-b border-gray-300 sticky top-0 z-20">
            <tr>
              <th className="px-3 py-2 sticky left-0 z-30 bg-gray-50 min-w-[160px]">Employee</th>
              <th className="px-2 py-2 min-w-[80px]">Days Present</th>
              <th className="px-2 py-2 min-w-[80px]">Actual Days</th>
              <th className="px-2 py-2 min-w-[100px]">Daily Rate</th>
              <th className="px-2 py-2 min-w-[110px]">Gross Pay</th>
              <th className="px-2 py-2 min-w-[110px]">Total Amount</th>
              <th className="px-2 py-2 min-w-[110px]">Allowance</th>
              <th className="px-2 py-2 min-w-[110px]">Special Incentives</th>
              {uniqueHolidays.map((h) => (
                <th key={h.date} className="px-2 py-2 min-w-[110px] text-red-600 text-center">
                  {new Date(h.date + 'T00:00:00').toLocaleDateString()}
                  <br />
                  {h.name}
                </th>
              ))}
              {uniqueWeekends.map((w) => (
                <th key={w.date} className="px-2 py-2 min-w-[110px] text-red-600 text-center">
                  {new Date(w.date + 'T00:00:00').toLocaleDateString()}
                  <br />
                  {w.label}
                </th>
              ))}
              <th className="px-2 py-2 min-w-[110px]">Reconciliation</th>
              {isThirteenthMonthPeriod(startDate, endDate) && (
                <th className="px-2 py-2 min-w-[110px]">13th Month</th>
              )}
              <th className="px-2 py-2 min-w-[110px]">Total Income</th>
              <th className="px-2 py-2 min-w-[110px] bg-gray-200">Income Tax</th>
              <th className="px-2 py-2 min-w-[110px] bg-gray-200">Loan</th>
              <th className="px-2 py-2 min-w-[110px] bg-gray-200">SSS</th>
              <th className="px-2 py-2 min-w-[110px] bg-gray-200">PhilHealth</th>
              <th className="px-2 py-2 min-w-[110px] bg-gray-200">PagIbig</th>
              <th className="px-2 py-2 min-w-[110px] bg-gray-200">Total Deduction</th>
              <th className="px-2 py-2 min-w-[110px]">Net Pay</th>
              <th className="px-2 py-2 min-w-[110px]">Loan Balance</th>
              <th className="px-2 py-2 min-w-[120px]">Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={100} className="text-center py-8 text-gray-400">
                  <Loader2 size={20} className="animate-spin inline mr-2" />
                  Loading employees...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={100} className="text-center py-8 text-red-500">
                  Failed to load employees: {fetchError}
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={100} className="text-center py-8 text-gray-400">
                  {employees.length === 0
                    ? 'No active employees found. Add employees before generating payroll.'
                    : 'No employees match your search.'}
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee, index) => (
                <PayrollRow
                  key={employee.id}
                  employee={{
                    id: employee.id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    employeeCode: employee.employeeCode,
                    salary: employee.salary ?? 0,
                    allowance: employee.allowance ?? 0,
                    loan: employee.loan ?? 0,
                    loanDeduction: employee.loanDeduction ?? 0,
                    silc: employee.silc ?? 0,
                  }}
                  index={index}
                  actualDays={actualDays}
                  startDate={startDate}
                  endDate={endDate}
                  uniqueHolidays={uniqueHolidays}
                  uniqueWeekends={uniqueWeekends}
                  payrollCycle={payrollCycle}
                  onDataChange={handleDataChange}
                />
              ))
            )}
            <PayrollTotalRow
              uniqueHolidays={uniqueHolidays}
              uniqueWeekends={uniqueWeekends}
              startDate={startDate}
              endDate={endDate}
            />
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add notes for this payroll period..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
        />
      </div>
    </div>
  )
}

export default function PayrollTable(props: PayrollTableProps) {
  return (
    <PayrollDataProvider>
      <PayrollTableInner {...props} />
    </PayrollDataProvider>
  )
}
