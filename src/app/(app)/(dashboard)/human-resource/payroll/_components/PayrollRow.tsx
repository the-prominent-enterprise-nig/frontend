'use client'

import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Calculator } from 'lucide-react'
import {
  calculateEmployeeSalary,
  calculateSemiMonthlyWithholdingTax,
  findSSSDeduction,
  findPagIbigDeduction,
  findPhilHealthDeduction,
} from '@/src/libs/payroll/calculations'
import { isThirteenthMonthPeriod } from '@/src/libs/payroll/holidays'
import { usePayrollDataContext } from './PayrollDataContext'

interface PayrollRowProps {
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    salary: number
    allowance: number
    loan: number
    loanDeduction: number
    silc: number
  }
  index: number
  actualDays: number
  startDate: Date
  endDate: Date
  uniqueHolidays: Array<{ date: string; name: string; type: string }>
  uniqueWeekends: Array<{ date: string; label: string }>
  payrollCycle: number
  onDataChange: (employeeId: string, data: Record<string, number>) => void
}

type FormValues = Record<string, number>

const inputCls =
  'w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500'

const PayrollRow = ({
  employee,
  index,
  actualDays,
  startDate,
  endDate,
  uniqueHolidays,
  uniqueWeekends,
  payrollCycle,
  onDataChange,
}: PayrollRowProps) => {
  const { updatePayrollData } = usePayrollDataContext()
  const isInitialized = useRef(false)
  const isCalculating = useRef(false)
  const isLoanManualEdit = useRef(false)
  const isIncomeTaxManualEdit = useRef(false)

  const { grossPay, dailyRate } = useMemo(
    () => calculateEmployeeSalary(employee, actualDays),
    [employee, actualDays]
  )

  const loanBalance = Math.max(0, (employee.loan || 0) - (employee.loanDeduction || 0))
  const is13thMonth = isThirteenthMonthPeriod(startDate, endDate)

  const buildDefaults = useCallback((): FormValues => {
    const total = Math.round(actualDays * dailyRate * 100) / 100
    const allowance = employee.allowance || 0
    const loanDed = employee.loan > 0 ? employee.loanDeduction || 0 : 0
    // grossTaxableIncome excludes 13th month pay (tax-exempt up to ₱90k)
    const grossTaxableIncome = total + allowance
    const incomeTax = Math.round(calculateSemiMonthlyWithholdingTax(grossTaxableIncome) * 100) / 100
    const totalIncome = grossTaxableIncome
    const totalDeduction = incomeTax + loanDed
    const netPay = totalIncome - totalDeduction

    const holidayDefaults = uniqueHolidays.reduce<FormValues>((acc, h) => {
      acc[`holiday_${h.date}_hours`] = 0
      return acc
    }, {})
    const weekendDefaults = uniqueWeekends.reduce<FormValues>((acc, w) => {
      acc[`weekend_${w.date}_hours`] = 0
      return acc
    }, {})

    return {
      numberOfDays: actualDays,
      actualNumberOfDays: actualDays,
      dailyRate: Math.round(dailyRate * 100) / 100,
      grossPay: Math.round(grossPay * 100) / 100,
      total: Math.round(total * 100) / 100,
      allowance: Math.round(allowance * 100) / 100,
      specialIncentives: 0,
      reconciliationPay: 0,
      thirteenthMonthPay: 0,
      totalIncome: Math.round(totalIncome * 100) / 100,
      incomeTaxDeduction: Math.round(incomeTax * 100) / 100,
      loan: Math.round(loanDed * 100) / 100,
      sss: 0,
      philHealth: 0,
      pagIbig: 0,
      totalDeduction: Math.round(totalDeduction * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
      loanBalance: Math.round(loanBalance * 100) / 100,
      notes: 0,
      ...holidayDefaults,
      ...weekendDefaults,
    }
  }, [
    actualDays,
    dailyRate,
    grossPay,
    employee,
    is13thMonth,
    loanBalance,
    uniqueHolidays,
    uniqueWeekends,
  ])

  const { register, getValues, setValue, watch, reset } = useForm<FormValues>({
    defaultValues: buildDefaults(),
  })

  const recalculate = useCallback(
    (values: FormValues) => {
      if (isCalculating.current) return
      isCalculating.current = true

      try {
        const days = Number(values.numberOfDays) || 0
        const actDays = Number(values.actualNumberOfDays) || actualDays
        const rate = Number(values.dailyRate) || dailyRate

        const newTotal =
          days === actDays ? Number(values.grossPay) : Math.round(days * rate * 100) / 100

        let holidaysPay = 0
        let weekendsPay = 0
        Object.keys(values).forEach((key) => {
          if (key.startsWith('holiday_') && key.endsWith('_hours'))
            holidaysPay += Number(values[key]) || 0
          if (key.startsWith('weekend_') && key.endsWith('_hours'))
            weekendsPay += Number(values[key]) || 0
        })

        const allowance = Number(values.allowance) || 0
        const specialIncentives = Number(values.specialIncentives) || 0
        const reconciliationPay = Number(values.reconciliationPay) || 0
        const thirteenthMonthPay = is13thMonth ? Number(values.thirteenthMonthPay) || 0 : 0

        // grossTaxableIncome excludes 13th month pay (tax-exempt up to ₱90k)
        const grossTaxableIncome =
          newTotal + allowance + specialIncentives + holidaysPay + weekendsPay + reconciliationPay
        const newTotalIncome = grossTaxableIncome + thirteenthMonthPay

        // BIR TRAIN: auto-calculate withholding tax unless user is manually editing
        const newIncomeTax = isIncomeTaxManualEdit.current
          ? Number(values.incomeTaxDeduction) || 0
          : Math.round(calculateSemiMonthlyWithholdingTax(grossTaxableIncome) * 100) / 100

        const newTotalDeduction =
          newIncomeTax +
          (Number(values.loan) || 0) +
          (Number(values.sss) || 0) +
          (Number(values.philHealth) || 0) +
          (Number(values.pagIbig) || 0)

        const newNetPay = newTotalIncome - newTotalDeduction
        const newLoanBalance = isLoanManualEdit.current
          ? Number(values.loanBalance)
          : Math.max(0, Math.round(((employee.loan || 0) - (Number(values.loan) || 0)) * 100) / 100)

        const rounded = (v: number) => Math.round(v * 100) / 100

        setValue('total', rounded(newTotal))
        if (!isIncomeTaxManualEdit.current) setValue('incomeTaxDeduction', rounded(newIncomeTax))
        setValue('totalIncome', rounded(newTotalIncome))
        setValue('totalDeduction', rounded(newTotalDeduction))
        setValue('netPay', rounded(newNetPay))
        if (!isLoanManualEdit.current) setValue('loanBalance', newLoanBalance)

        const updated = {
          ...getValues(),
          total: rounded(newTotal),
          incomeTaxDeduction: rounded(newIncomeTax),
          totalIncome: rounded(newTotalIncome),
          totalDeduction: rounded(newTotalDeduction),
          netPay: rounded(newNetPay),
          loanBalance: newLoanBalance,
        }
        updatePayrollData(employee.id, updated)
        onDataChange(employee.id, updated)
      } finally {
        setTimeout(() => {
          isCalculating.current = false
        }, 50)
      }
    },
    [
      actualDays,
      dailyRate,
      grossPay,
      employee,
      is13thMonth,
      setValue,
      getValues,
      updatePayrollData,
      onDataChange,
    ]
  )

  useEffect(() => {
    if (!isInitialized.current) {
      recalculate(buildDefaults())
      isInitialized.current = true
    }
  }, [])

  useEffect(() => {
    if (isInitialized.current) {
      reset(buildDefaults())
      setTimeout(() => recalculate(getValues()), 10)
    }
  }, [payrollCycle])

  useEffect(() => {
    const subscription = watch((values) => {
      if (isInitialized.current && !isCalculating.current) {
        setTimeout(() => recalculate(values as FormValues), 10)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, recalculate])

  const handleAutoSSS = () => {
    const vals = getValues()
    const sss = findSSSDeduction(employee.salary, payrollCycle)
    setValue('sss', Math.round(sss * 100) / 100)
    recalculate({ ...vals, sss: Math.round(sss * 100) / 100 })
  }

  const handleAutoPhilHealth = () => {
    const vals = getValues()
    const ph = findPhilHealthDeduction(employee.salary, payrollCycle)
    setValue('philHealth', Math.round(ph * 100) / 100)
    recalculate({ ...vals, philHealth: Math.round(ph * 100) / 100 })
  }

  const handleAutoPagIbig = () => {
    const vals = getValues()
    const pi = findPagIbigDeduction(employee.salary, payrollCycle)
    setValue('pagIbig', Math.round(pi * 100) / 100)
    recalculate({ ...vals, pagIbig: Math.round(pi * 100) / 100 })
  }

  const numInput = (name: string, disabled = false) => (
    <input
      type="number"
      step="0.01"
      disabled={disabled}
      className={inputCls}
      {...register(name, {
        valueAsNumber: true,
        onChange: () => {
          setTimeout(() => recalculate(getValues()), 10)
        },
      })}
    />
  )

  return (
    <tr
      className={`border-b text-xs text-gray-800 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50`}
    >
      <td className="px-3 py-1.5 sticky left-0 z-10 bg-inherit font-medium whitespace-nowrap">
        {employee.lastName}, {employee.firstName}
      </td>
      <td className="px-2 py-1.5">{numInput('numberOfDays')}</td>
      <td className="px-2 py-1.5">{numInput('actualNumberOfDays', true)}</td>
      <td className="px-2 py-1.5">{numInput('dailyRate', true)}</td>
      <td className="px-2 py-1.5">{numInput('grossPay', true)}</td>
      <td className="px-2 py-1.5">{numInput('total', true)}</td>
      <td className="px-2 py-1.5">{numInput('allowance')}</td>
      <td className="px-2 py-1.5">{numInput('specialIncentives')}</td>

      {uniqueHolidays.map((h) => (
        <td key={h.date} className="px-2 py-1.5">
          {numInput(`holiday_${h.date}_hours`)}
        </td>
      ))}
      {uniqueWeekends.map((w) => (
        <td key={w.date} className="px-2 py-1.5">
          {numInput(`weekend_${w.date}_hours`)}
        </td>
      ))}

      <td className="px-2 py-1.5">{numInput('reconciliationPay')}</td>

      {is13thMonth && <td className="px-2 py-1.5">{numInput('thirteenthMonthPay')}</td>}

      <td className="px-2 py-1.5">{numInput('totalIncome', true)}</td>
      <td className="px-2 py-1.5 bg-gray-100">
        <input
          type="number"
          step="0.01"
          className={inputCls}
          {...register('incomeTaxDeduction', {
            valueAsNumber: true,
            onChange: () => {
              isIncomeTaxManualEdit.current = true
              setTimeout(() => {
                isIncomeTaxManualEdit.current = false
              }, 300)
              setTimeout(() => recalculate(getValues()), 10)
            },
          })}
        />
      </td>
      <td className="px-2 py-1.5 bg-gray-100">{numInput('loan')}</td>
      <td className="px-2 py-1.5 bg-gray-100">
        <div className="flex items-center gap-1">
          {numInput('sss')}
          <button
            type="button"
            onClick={handleAutoSSS}
            title="Auto-calculate SSS"
            className="text-gray-400 hover:text-purple-600 flex-shrink-0"
          >
            <Calculator size={12} />
          </button>
        </div>
      </td>
      <td className="px-2 py-1.5 bg-gray-100">
        <div className="flex items-center gap-1">
          {numInput('philHealth')}
          <button
            type="button"
            onClick={handleAutoPhilHealth}
            title="Auto-calculate PhilHealth"
            className="text-gray-400 hover:text-purple-600 flex-shrink-0"
          >
            <Calculator size={12} />
          </button>
        </div>
      </td>
      <td className="px-2 py-1.5 bg-gray-100">
        <div className="flex items-center gap-1">
          {numInput('pagIbig')}
          <button
            type="button"
            onClick={handleAutoPagIbig}
            title="Auto-calculate PagIbig"
            className="text-gray-400 hover:text-purple-600 flex-shrink-0"
          >
            <Calculator size={12} />
          </button>
        </div>
      </td>
      <td className="px-2 py-1.5 bg-gray-100">{numInput('totalDeduction', true)}</td>
      <td className="px-2 py-1.5">{numInput('netPay', true)}</td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          className={inputCls}
          {...register('loanBalance', {
            valueAsNumber: true,
            onChange: () => {
              isLoanManualEdit.current = true
              setTimeout(() => {
                isLoanManualEdit.current = false
              }, 300)
            },
          })}
        />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" className={inputCls} {...register('notes' as string)} />
      </td>
    </tr>
  )
}

export default React.memo(
  PayrollRow,
  (prev, next) =>
    prev.employee.id === next.employee.id &&
    prev.actualDays === next.actualDays &&
    prev.payrollCycle === next.payrollCycle &&
    JSON.stringify(prev.uniqueHolidays) === JSON.stringify(next.uniqueHolidays) &&
    JSON.stringify(prev.uniqueWeekends) === JSON.stringify(next.uniqueWeekends)
)
