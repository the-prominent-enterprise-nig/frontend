'use client'

import { EmployeeDetailDto } from '@/src/schema/human-resource/employees/details'
import { PhoneCall } from 'lucide-react'

interface Props {
  employee: EmployeeDetailDto
}

export function EmergencyContactsSection({ employee }: Props) {
  const contacts = employee.emergencyContacts ?? []

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          Emergency contacts
        </h3>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <PhoneCall className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No emergency contacts registered</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => {
            const initials = contact.name
              .split(' ')
              .map((n: string) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <div
                key={contact.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-4 rounded-lg border bg-white border-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-sm font-medium text-purple-700">
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                    {contact.isPrimary && (
                      <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium shrink-0">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{contact.relationship}</p>
                </div>

                <a
                  href={`tel:${contact.contactNumber}`}
                  className="flex items-center gap-1.5 text-xs text-purple-700 font-medium hover:text-purple-900 transition-colors shrink-0 w-full sm:w-auto"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  {contact.contactNumber}
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
