import { z } from 'zod'

export type EmployeeCashLoanEmployee = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  middleName?: string | null
  branch?: { id: string; name: string } | null
}

export type EmployeeCashLoanScheduleLine = {
  id: string
  lineNumber: number
  dueDate: string
  principalAmount: number
  interestAmount: number
  totalAmount: number
}

export type EmployeeCashLoanPayment = {
  id: string
  amount: number
  paymentDate: string
  bankAccountId: string
  bankAccount?: { id: string; name: string; bankName: string } | null
  referenceNumber?: string | null
  note?: string | null
  createdAt: string
}

export type EmployeeCashLoanStatus = 'ACTIVE' | 'PAID_OFF' | 'CANCELLED'

// EMPLOYEE — a real HR Employee, recovered later via payroll/Accounting (no
// Pay action here). OTHER — a personal loan from the owners to someone with
// no payroll to deduct from: no schedule, no monthly figure, paid back via
// the Pay action any amount/any time.
export type EmployeeCashLoanBorrowerType = 'EMPLOYEE' | 'OTHER'

export type EmployeeCashLoan = {
  id: string
  loanNumber: string
  borrowerType: EmployeeCashLoanBorrowerType
  employeeId?: string | null
  employee?: EmployeeCashLoanEmployee | null
  borrowerName?: string | null
  principal: number
  interestRate: number
  totalInterest: number
  totalReceivable: number
  termMonths?: number | null
  monthlyPrincipal?: number | null
  monthlyInterest?: number | null
  monthlyDeduction?: number | null
  loanDate: string
  firstDeductionDate?: string | null
  finalDueDate?: string | null
  disbursementMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK'
  bankAccountId?: string | null
  bankAccount?: { id: string; name: string; bankName: string } | null
  referenceNumber?: string | null
  note?: string | null
  openingBalance: number
  currentBalance: number
  status: EmployeeCashLoanStatus
  journalEntryId?: string | null
  scheduleLines: EmployeeCashLoanScheduleLine[]
  payments: EmployeeCashLoanPayment[]
  createdAt: string
}

export type EmployeeCashLoanListResponse = {
  items: EmployeeCashLoan[]
  total: number
}

const disbursementFields = {
  disbursementMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
  bankAccountId: z.string().min(1, 'Pick a Bank / Cash Account'),
  referenceNumber: z.string().max(50).optional(),
  note: z.string().max(500).optional(),
}

function requireInterestRateWhenCharged(
  v: { borrowerType: string; chargeInterest?: boolean; interestRate?: number },
  ctx: z.RefinementCtx
) {
  if (v.borrowerType === 'OTHER' && v.chargeInterest && !(v.interestRate && v.interestRate > 0)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter an interest rate, or turn off "Charge interest?"',
      path: ['interestRate'],
    })
  }
}

export const IssueEmployeeCashLoanFormSchema = z
  .discriminatedUnion('borrowerType', [
    z.object({
      borrowerType: z.literal('EMPLOYEE'),
      employeeId: z.string().min(1, 'Pick an employee'),
      principal: z
        .number({ error: 'Loan Principal is required' })
        .positive('Must be greater than 0'),
      termMonths: z.number({ error: 'Term is required' }).int().min(1, 'Must be at least 1 month'),
      interestRate: z.number({ error: 'Interest Rate / Loan Factor is required' }).min(0),
      loanDate: z.string().min(1, 'Loan Date is required'),
      firstDeductionDate: z.string().min(1, 'First Deduction Date is required'),
      ...disbursementFields,
    }),
    z.object({
      borrowerType: z.literal('OTHER'),
      borrowerName: z.string().min(1, 'Enter who this loan is for'),
      principal: z
        .number({ error: 'Loan Principal is required' })
        .positive('Must be greater than 0'),
      chargeInterest: z.boolean(),
      interestRate: z.number().min(0).optional(),
      loanDate: z.string().min(1, 'Loan Date is required'),
      ...disbursementFields,
    }),
  ])
  .superRefine(requireInterestRateWhenCharged)

export type IssueEmployeeCashLoanFormValues = z.infer<typeof IssueEmployeeCashLoanFormSchema>

// Scenario 56, Part 2 — every field is editable, and loanNumber/loanDate
// lose Issue's "server can default/auto-generate" optionality since an
// edit always has an existing value to send back. borrowerType itself is
// not editable — switching a loan between Employee and Others after
// issuance isn't supported; the form pre-fills it from the existing loan
// and keeps it fixed.
export const UpdateEmployeeCashLoanFormSchema = z
  .discriminatedUnion('borrowerType', [
    z.object({
      borrowerType: z.literal('EMPLOYEE'),
      loanNumber: z.string().min(1, 'Loan number is required'),
      employeeId: z.string().min(1, 'Pick an employee'),
      principal: z
        .number({ error: 'Loan Principal is required' })
        .positive('Must be greater than 0'),
      termMonths: z.number({ error: 'Term is required' }).int().min(1, 'Must be at least 1 month'),
      interestRate: z.number({ error: 'Interest Rate / Loan Factor is required' }).min(0),
      loanDate: z.string().min(1, 'Loan Date is required'),
      firstDeductionDate: z.string().min(1, 'First Deduction Date is required'),
      ...disbursementFields,
    }),
    z.object({
      borrowerType: z.literal('OTHER'),
      loanNumber: z.string().min(1, 'Loan number is required'),
      borrowerName: z.string().min(1, 'Enter who this loan is for'),
      principal: z
        .number({ error: 'Loan Principal is required' })
        .positive('Must be greater than 0'),
      chargeInterest: z.boolean(),
      interestRate: z.number().min(0).optional(),
      loanDate: z.string().min(1, 'Loan Date is required'),
      ...disbursementFields,
    }),
  ])
  .superRefine(requireInterestRateWhenCharged)

export type UpdateEmployeeCashLoanFormValues = z.infer<typeof UpdateEmployeeCashLoanFormSchema>

// Others only — any amount up to the remaining balance, any time.
export const PayEmployeeCashLoanFormSchema = z.object({
  amount: z.number({ error: 'Payment amount is required' }).positive('Must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  bankAccountId: z.string().min(1, 'Pick a Bank / Cash Account'),
  referenceNumber: z.string().max(50).optional(),
  note: z.string().max(500).optional(),
})

export type PayEmployeeCashLoanFormValues = z.infer<typeof PayEmployeeCashLoanFormSchema>
