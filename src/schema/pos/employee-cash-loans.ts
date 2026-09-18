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

export type EmployeeCashLoanStatus = 'ACTIVE' | 'PAID_OFF' | 'CANCELLED'

export type EmployeeCashLoan = {
  id: string
  loanNumber: string
  employeeId: string
  employee?: EmployeeCashLoanEmployee | null
  principal: number
  interestRate: number
  totalInterest: number
  totalReceivable: number
  termMonths: number
  monthlyPrincipal: number
  monthlyInterest: number
  monthlyDeduction: number
  loanDate: string
  firstDeductionDate: string
  finalDueDate: string
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
  createdAt: string
}

export type EmployeeCashLoanListResponse = {
  items: EmployeeCashLoan[]
  total: number
}

export const IssueEmployeeCashLoanFormSchema = z
  .object({
    employeeId: z.string().min(1, 'Pick an employee'),
    principal: z.number({ error: 'Loan Principal is required' }).positive('Must be greater than 0'),
    termMonths: z.number({ error: 'Term is required' }).int().min(1, 'Must be at least 1 month'),
    interestRate: z.number({ error: 'Interest Rate / Loan Factor is required' }).min(0),
    loanDate: z.string().min(1, 'Loan Date is required'),
    firstDeductionDate: z.string().min(1, 'First Deduction Date is required'),
    disbursementMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
    bankAccountId: z.string().optional(),
    referenceNumber: z.string().max(50).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.disbursementMethod !== 'BANK_TRANSFER' || !!v.bankAccountId, {
    message: 'Pick a Bank / Cash Account for a bank transfer',
    path: ['bankAccountId'],
  })

export type IssueEmployeeCashLoanFormValues = z.infer<typeof IssueEmployeeCashLoanFormSchema>
