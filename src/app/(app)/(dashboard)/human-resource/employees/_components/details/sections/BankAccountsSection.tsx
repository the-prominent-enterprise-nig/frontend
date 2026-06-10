'use client'

import { EmployeeDetailDto } from '@/src/schema/human-resource/employees/details'
import { Landmark } from 'lucide-react'

interface Props {
  employee: EmployeeDetailDto
}

export function BankAccountsSection({ employee }: Props) {
  const accounts = employee.bankAccounts ?? []

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          Bank accounts
        </h3>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Landmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No bank accounts registered</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`flex items-center gap-4 px-4 py-4 rounded-lg border ${
                account.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  account.isPrimary ? 'bg-purple-100' : 'bg-gray-100'
                }`}
              >
                <Landmark
                  className={`w-5 h-5 ${account.isPrimary ? 'text-purple-700' : 'text-gray-400'}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-900">{account.bankName}</p>
                  {account.isPrimary && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{account.accountName}</p>
                <p className="text-xs font-mono text-gray-700 mt-0.5">{account.accountNumber}</p>
              </div>

              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  account.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {account.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
