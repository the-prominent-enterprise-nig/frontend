'use client'

import { cn } from '@/src/libs/tailwind-merge/utils'
import { EmployeeDetailDto } from '@/src/schema/human-resource/employees/details'
import { CreditCard } from 'lucide-react'

interface Props {
  employee: EmployeeDetailDto
}

const GOV_ID_TYPES = ['SSS', 'PhilHealth', 'Pag-IBIG', 'TIN', 'UMID']

export function GovernmentIDsSection({ employee }: Props) {
  const ids = employee.governmentIDs ?? []

  const getById = (type: string) => ids.find((g) => g.type === type)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          Government IDs
        </h3>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">{ids.length} registered</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GOV_ID_TYPES.map((type) => {
          const record = getById(type)
          return (
            <div
              key={type}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-lg border ${
                record?.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  record?.isActive ? 'bg-purple-100' : 'bg-gray-200'
                }`}
              >
                <CreditCard
                  className={`w-4 h-4 ${record?.isActive ? 'text-purple-700' : 'text-gray-400'}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{type}</p>
                <p
                  className={`text-sm font-medium truncate ${
                    record ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {record?.number ?? 'Not provided'}
                </p>
              </div>
              {record && (
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                    record.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {record.isActive ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
