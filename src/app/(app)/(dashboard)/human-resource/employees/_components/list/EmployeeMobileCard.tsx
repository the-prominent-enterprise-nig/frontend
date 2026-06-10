import { Employee, EmployeeStatus } from '@/src/schema/human-resource/employees/list'
import { EmployeeActionsDropdown } from './EmployeeActionsDropdown'

// Mobile Employee Card Component
interface EmployeeMobileCardProps {
  employee: Employee
  isPlaceholderData: boolean
  onClick: (employeeId: string) => void
  getFullName: (employee: EmployeeMobileCardProps['employee']) => string
  getStatusColor: (status: EmployeeStatus) => string
  formatStatus: (status: EmployeeStatus) => string
  showActions?: boolean
  onEdit?: (employeeId: string) => void
}

export function EmployeeMobileCard({
  employee,
  isPlaceholderData,
  onClick,
  getFullName,
  getStatusColor,
  formatStatus,
  showActions = true,
  onEdit,
}: EmployeeMobileCardProps) {
  return (
    <div
      onClick={() => onClick(employee.id)}
      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{getFullName(employee)}</h3>
          <span className="flex items-center gap-2 text-gray-600">
            <p className="text-sm font-semibold">{employee.employeeCode}</p>
            {' • '}
            <p className="text-sm">{employee.position?.title}</p>
          </span>
        </div>
        {showActions && <EmployeeActionsDropdown onEdit={() => onEdit?.(employee.id)} />}
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-gray-600 break-all">
          <span className="font-medium text-gray-700">Email:</span> {employee.email}
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-gray-700">Department:</span> {employee.department?.name}
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-gray-700">Branch:</span> {employee.branch?.name}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            <span className="font-medium text-gray-700">Branch:</span> {employee.branch?.name}
          </p>
          <span
            className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(
              employee.status as EmployeeStatus
            )}`}
          >
            {formatStatus(employee.status as EmployeeStatus)}
          </span>
        </div>
      </div>
    </div>
  )
}
