'use client'

import { EmployeeDetailDto } from '@/src/schema/human-resource/employees/details'
import { formatStatus, getStatusColor } from '../../../_utils'

interface Props {
  employee: EmployeeDetailDto
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  )
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
        {title}
      </h3>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

export function PersonalInfoSection({ employee }: Props) {
  return (
    <div className="space-y-8">
      {/* Basic */}
      <div>
        <SectionHeading title="Basic information" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
          <Field label="First name" value={employee.firstName} />
          <Field label="Middle name" value={employee.middleName} />
          <Field label="Last name" value={employee.lastName} />
          <Field label="Email" value={employee.email} />
          <Field label="Contact number" value={employee.contactNumber} />
          <Field
            label="Date of birth"
            value={
              employee.dateOfBirth
                ? new Date(employee.dateOfBirth).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : undefined
            }
          />
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Status</p>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}
            >
              {formatStatus(employee.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Organization */}
      <div>
        <SectionHeading title="Organization" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
          <Field label="Department" value={employee.department?.name} />
          <Field label="Position" value={employee.position?.title} />
          <Field label="Branch" value={employee.branch?.name} />
          <Field
            label="Hire date"
            value={
              employee.hireDate
                ? new Date(employee.hireDate).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : undefined
            }
          />
        </div>
      </div>

      {/* Additional */}
      <div>
        <SectionHeading title="Additional details" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
          <Field label="Blood type" value={employee.bloodType} />
          <Field label="Marital status" value={employee.maritalStatus} />
          <Field label="PWD type" value={employee.pwdType} />
          <Field label="Student" value={employee.isStudent ? 'Yes' : 'No'} />
        </div>
      </div>
    </div>
  )
}
