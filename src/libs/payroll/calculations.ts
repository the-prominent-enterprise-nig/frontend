export interface SSSDataMap {
  [key: string]: number
}

export const SSSData: SSSDataMap = {
  'Below 5,250': 250.0,
  '5250.0 - 5749.99': 275.0,
  '5750.0 - 6249.99': 300.0,
  '6250.0 - 6749.99': 325.0,
  '6750.0 - 7249.99': 350.0,
  '7250.0 - 7749.99': 375.0,
  '7750.0 - 8249.99': 400.0,
  '8250.0 - 8749.99': 425.0,
  '8750.0 - 9249.99': 450.0,
  '9250.0 - 9749.99': 475.0,
  '9750.0 - 10249.99': 500.0,
  '10250.0 - 10749.99': 525.0,
  '10750.0 - 11249.99': 550.0,
  '11250.0 - 11749.99': 575.0,
  '11750.0 - 12249.99': 600.0,
  '12250.0 - 12749.99': 625.0,
  '12750.0 - 13249.99': 650.0,
  '13250.0 - 13749.99': 675.0,
  '13750.0 - 14249.99': 700.0,
  '14250.0 - 14749.99': 725.0,
  '14750.0 - 15249.99': 750.0,
  '15250.0 - 15749.99': 775.0,
  '15750.0 - 16249.99': 800.0,
  '16250.0 - 16749.99': 825.0,
  '16750.0 - 17249.99': 850.0,
  '17250.0 - 17749.99': 875.0,
  '17750.0 - 18249.99': 900.0,
  '18250.0 - 18749.99': 925.0,
  '18750.0 - 19249.99': 950.0,
  '19250.0 - 19749.99': 975.0,
  '19750.0 - 20249.99': 1000.0,
  '20250.0 - 20749.99': 1025.0,
  '20750.0 - 21249.99': 1050.0,
  '21250.0 - 21749.99': 1075.0,
  '21750.0 - 22249.99': 1100.0,
  '22250.0 - 22749.99': 1125.0,
  '22750.0 - 23249.99': 1150.0,
  '23250.0 - 23749.99': 1175.0,
  '23750.0 - 24249.99': 1200.0,
  '24250.0 - 24749.99': 1225.0,
  '24750.0 - 25249.99': 1250.0,
  '25250.0 - 25749.99': 1275.0,
  '25750.0 - 26249.99': 1300.0,
  '26250.0 - 26749.99': 1325.0,
  '26750.0 - 27249.99': 1350.0,
  '27250.0 - 27749.99': 1375.0,
  '27750.0 - 28249.99': 1400.0,
  '28250.0 - 28749.99': 1425.0,
  '28750.0 - 29249.99': 1450.0,
  '29250.0 - 29749.99': 1475.0,
  '29750.0 - 30249.99': 1500.0,
  '30250.0 - 30749.99': 1525.0,
  '30750.0 - 31249.99': 1550.0,
  '31250.0 - 31749.99': 1575.0,
  '31750.0 - 32249.99': 1600.0,
  '32250.0 - 32749.99': 1625.0,
  '32750.0 - 33249.99': 1650.0,
  '33250.0 - 33749.99': 1675.0,
  '33750.0 - 34249.99': 1700.0,
  '34250.0 - 34749.99': 1725.0,
  '34750.0 - Over': 1750.0,
}

export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidayDates?: Set<string>
): number {
  let count = 0
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      const y = current.getFullYear()
      const m = String(current.getMonth() + 1).padStart(2, '0')
      const d = String(current.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      if (!holidayDates || !holidayDates.has(dateStr)) count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

// BIR TRAIN Law graduated annual income tax table (effective 2023+)
export function calculateAnnualIncomeTax(annualTaxableIncome: number): number {
  if (annualTaxableIncome <= 250000) return 0
  if (annualTaxableIncome <= 400000) return (annualTaxableIncome - 250000) * 0.15
  if (annualTaxableIncome <= 800000) return 22500 + (annualTaxableIncome - 400000) * 0.2
  if (annualTaxableIncome <= 2000000) return 102500 + (annualTaxableIncome - 800000) * 0.25
  if (annualTaxableIncome <= 8000000) return 402500 + (annualTaxableIncome - 2000000) * 0.3
  return 2202500 + (annualTaxableIncome - 8000000) * 0.35
}

// Annualize semi-monthly taxable income × 24, apply BIR table, divide by 24
export function calculateSemiMonthlyWithholdingTax(semiMonthlyTaxableIncome: number): number {
  const annual = semiMonthlyTaxableIncome * 24
  return calculateAnnualIncomeTax(annual) / 24
}

export function calculateEmployeeSalary(employee: { salary: number }, actualDays: number) {
  const semiMonthlyBase = employee.salary / 2
  const dailyRate = actualDays > 0 ? semiMonthlyBase / actualDays : 0
  return { grossPay: semiMonthlyBase, dailyRate }
}

// SSS: bracket lookup on monthly salary; Cycle 1 = half, Cycle 2 = remainder
export function findSSSDeduction(
  monthlySalary: number,
  payrollCycle: number,
  latestPayslip?: { sss?: number } | null
): number {
  let bracketValue = 0

  const ranges = Object.keys(SSSData).map((range) => {
    if (range.startsWith('Below')) {
      return {
        start: 0,
        end: parseFloat(range.split(' ')[1].replace(',', '')) - 0.01,
        deduction: SSSData[range],
      }
    } else if (range.includes('-')) {
      const [start, end] = range.split(' - ').map(Number)
      return { start, end, deduction: SSSData[range] }
    } else {
      return { start: parseFloat(range.split(' ')[0]), end: Infinity, deduction: SSSData[range] }
    }
  })

  for (const { start, end, deduction } of ranges) {
    if (monthlySalary >= start && monthlySalary <= end) {
      bracketValue = deduction
      break
    }
  }

  if (payrollCycle === 1) return bracketValue / 2
  if (payrollCycle === 2) {
    return latestPayslip?.sss != null ? bracketValue - latestPayslip.sss : bracketValue / 2
  }
  return 0
}

// PagIBIG: employee share = min(monthlySalary × 2%, ₱100); deducted Cycle 2 only
export function findPagIbigDeduction(monthlySalary: number, payrollCycle: number): number {
  if (payrollCycle !== 2) return 0
  return Math.min(monthlySalary * 0.02, 100)
}

// PhilHealth: employee share = min(salary, ₱100,000) × 5% ÷ 2; deducted Cycle 1 only
export function findPhilHealthDeduction(monthlySalary: number, payrollCycle: number): number {
  if (payrollCycle !== 1) return 0
  const capped = Math.min(monthlySalary, 100000)
  return (capped * 0.05) / 2
}
