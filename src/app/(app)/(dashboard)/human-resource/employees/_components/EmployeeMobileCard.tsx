import { Employee, EmployeeStatus } from '@/src/schema/human-resource/employees/list'

// Mobile Employee Card Component
interface EmployeeMobileCardProps {
  employee: Employee
  isPlaceholderData: boolean
  getFullName: (employee: EmployeeMobileCardProps['employee']) => string
  getStatusColor: (status: EmployeeStatus) => string
  formatStatus: (status: EmployeeStatus) => string
}

export function EmployeeMobileCard({
  employee,
  isPlaceholderData,
  getFullName,
  getStatusColor,
  formatStatus,
}: EmployeeMobileCardProps) {
  return (
    <div
      className="p-4 hover:bg-gray-50 transition-colors"
      style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <h3 className="font-semibold text-gray-900">{getFullName(employee)}</h3>
          <span className="flex items-center gap-2 text-gray-600">
            <p className="text-sm font-semibold">{employee.employeeCode}</p>
            {' • '}
            <p className="text-sm">{employee.position?.title}</p>
          </span>
        </div>
        <span
          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(
            employee?.status as EmployeeStatus
          )}`}
        >
          {formatStatus(employee?.status as EmployeeStatus)}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-gray-600 break-all">
          <span className="font-medium text-gray-700">Email:</span> {employee?.email}
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-gray-700">Department:</span> {employee.department?.name}
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-gray-700">Branch:</span> {employee.branch?.name}
        </p>
      </div>
    </div>
  )
}
