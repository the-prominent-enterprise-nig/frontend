import { z } from 'zod'

export const PayslipDataSchema = z
  .object({
    // Manual payslip fields
    basicPay: z.number().optional(),
    allowances: z.number().optional(),
    deductions: z.number().optional(),

    // Generated payslip fields
    numberOfDays: z.number().optional(),
    actualNumberOfDays: z.number().optional(),
    dailyRate: z.number().optional(),
    grossPay: z.number().optional(),
    total: z.number().optional(),
    allowance: z.number().optional(),
    specialIncentives: z.number().optional(),
    reconciliationPay: z.number().optional(),
    thirteenthMonthPay: z.number().optional(),
    totalIncome: z.number().optional(),
    incomeTaxDeduction: z.number().optional(),
    sss: z.number().optional(),
    philHealth: z.number().optional(),
    pagIbig: z.number().optional(),
    loan: z.number().optional(),
    totalDeduction: z.number().optional(),
    loanBalance: z.number().optional(),

    // Common
    netPay: z.number().optional(),
    notes: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()

export const PayslipSchema = z.object({
  id: z.string(),
  payrollPeriodId: z.string(),
  employeeId: z.string(),
  cycle: z.number(),
  visibility: z.boolean(),
  payslipData: PayslipDataSchema,
  cycleStartDate: z.string(),
  cycleEndDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      employeeCode: z.string(),
      allowance: z.number().nullable().optional(),
      loan: z.number().nullable().optional(),
      loanDeduction: z.number().nullable().optional(),
      salary: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
})

export type Payslip = z.infer<typeof PayslipSchema>
export type PayslipData = z.infer<typeof PayslipDataSchema>

export interface CreatePayslipInput {
  payrollPeriodId: string
  employeeId: string
  cycle: number
  visibility: boolean
  payslipData: Record<string, unknown>
  cycleStartDate: string
  cycleEndDate: string
}

export interface UpdatePayslipInput {
  visibility?: boolean
  payslipData?: Record<string, unknown>
  cycle?: number
  cycleStartDate?: string
  cycleEndDate?: string
}
