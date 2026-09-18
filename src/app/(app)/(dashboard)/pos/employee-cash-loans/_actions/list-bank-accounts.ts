'use server'

import { api } from '@/src/libs/api/client'

export type EmployeeCashLoanBankAccount = {
  id: string
  name: string
  bankName: string
  accountNumber: string
}

export async function listEmployeeCashLoanBankAccounts() {
  return api.get<EmployeeCashLoanBankAccount[]>('/pos/employee-cash-loans/bank-accounts')
}
