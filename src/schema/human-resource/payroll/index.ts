import { z } from 'zod'

export const PayrollStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'])

export const PayslipDataSchema = z.record(z.string(), z.unknown())

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

export const ApprovalStepSchema = z.object({
  id: z.string(),
  payrollPeriodId: z.string(),
  approverId: z.string(),
  approvalRole: z.string(),
  isSignedStatus: z.boolean(),
  label: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approver: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
    })
    .nullable()
    .optional(),
})

export const PayrollPeriodSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().nullable().optional(),
  status: PayrollStatusSchema,
  totalActualDays: z.number(),
  totalDailyRate: z.number(),
  totalAmount: z.number(),
  totalDeductions: z.number(),
  totalNetPay: z.number(),
  approvalDate: z.string().nullable().optional(),
  approvalNote: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  payslips: z.array(PayslipSchema).optional(),
  approvalSteps: z.array(ApprovalStepSchema).optional(),
})

export const PayrollListResponseSchema = z.array(PayrollPeriodSchema)

export type PayrollStatus = z.infer<typeof PayrollStatusSchema>
export type Payslip = z.infer<typeof PayslipSchema>
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>
export type PayrollPeriod = z.infer<typeof PayrollPeriodSchema>

export interface CreatePayrollPeriodInput {
  startDate: string
  endDate: string
  note?: string
  totalActualDays: number
  totalDailyRate: number
  totalAmount: number
  totalDeductions: number
  totalNetPay: number
  finalApproverId?: string
}

export interface GeneratePayslipsInput {
  payrollPeriodId: string
  startDate: string
  endDate: string
  cycle: number
  employees: Array<{
    id: string
    salaryData: Record<string, unknown>
    loanBalance: number
  }>
}
