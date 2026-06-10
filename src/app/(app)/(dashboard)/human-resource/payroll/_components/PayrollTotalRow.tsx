'use client'

import React, { useEffect, useState } from 'react'
import { usePayrollDataContext } from './PayrollDataContext'
import { isThirteenthMonthPeriod } from '@/src/libs/payroll/holidays'

interface PayrollTotalRowProps {
  uniqueHolidays: Array<{ date: string; name: string }>
  uniqueWeekends: Array<{ date: string; label: string }>
  startDate: Date
  endDate: Date
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(v)

const tdCls = 'px-3 py-2 text-right font-semibold text-xs'

export default function PayrollTotalRow({
  uniqueHolidays,
  uniqueWeekends,
  startDate,
  endDate,
}: PayrollTotalRowProps) {
  const { getPayrollData } = usePayrollDataContext()
  const [totals, setTotals] = useState<Record<string, number>>({})
  const is13thMonth = isThirteenthMonthPeriod(startDate, endDate)

  useEffect(() => {
    const interval = setInterval(() => {
      const data = getPayrollData()
      const sums: Record<string, number> = {}

      Object.values(data).forEach((row) => {
        Object.entries(row).forEach(([key, val]) => {
          const n = Number(val) || 0
          sums[key] = (sums[key] || 0) + n
        })
      })

      setTotals(sums)
    }, 300)

    return () => clearInterval(interval)
  }, [getPayrollData])

  const t = (key: string) => totals[key] || 0

  return (
    <tr className="border-t-2 border-gray-400 bg-purple-50 font-bold text-xs text-gray-900">
      <td className="px-3 py-2 sticky left-0 z-10 bg-purple-50 font-bold">TOTALS</td>
      <td className={tdCls}>{t('numberOfDays')}</td>
      <td className={tdCls}>{t('actualNumberOfDays')}</td>
      <td className={tdCls}>{fmt(t('dailyRate'))}</td>
      <td className={tdCls}>{fmt(t('grossPay'))}</td>
      <td className={tdCls}>{fmt(t('total'))}</td>
      <td className={tdCls}>{fmt(t('allowance'))}</td>
      <td className={tdCls}>{fmt(t('specialIncentives'))}</td>

      {uniqueHolidays.map((h) => (
        <td key={h.date} className={tdCls}>
          {fmt(t(`holiday_${h.date}_hours`))}
        </td>
      ))}
      {uniqueWeekends.map((w) => (
        <td key={w.date} className={tdCls}>
          {fmt(t(`weekend_${w.date}_hours`))}
        </td>
      ))}

      <td className={tdCls}>{fmt(t('reconciliationPay'))}</td>
      {is13thMonth && <td className={tdCls}>{fmt(t('thirteenthMonthPay'))}</td>}
      <td className={tdCls}>{fmt(t('totalIncome'))}</td>
      <td className={`${tdCls} bg-gray-100`}>{fmt(t('incomeTaxDeduction'))}</td>
      <td className={`${tdCls} bg-gray-100`}>{fmt(t('loan'))}</td>
      <td className={`${tdCls} bg-gray-100`}>{fmt(t('sss'))}</td>
      <td className={`${tdCls} bg-gray-100`}>{fmt(t('philHealth'))}</td>
      <td className={`${tdCls} bg-gray-100`}>{fmt(t('pagIbig'))}</td>
      <td className={`${tdCls} bg-gray-100`}>{fmt(t('totalDeduction'))}</td>
      <td className={tdCls}>{fmt(t('netPay'))}</td>
      <td className={tdCls}>{fmt(t('loanBalance'))}</td>
      <td className="px-2 py-2" />
    </tr>
  )
}
