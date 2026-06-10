import { Employee, EmployeeStatus } from '@/src/schema/human-resource/employees/list'
import { EmployeeActionsDropdown } from './EmployeeActionsDropdown'

interface EmployeeTableRowProps {
  employee: Employee
  isPlaceholderData: boolean
  onClick: (employeeId: string) => void
  getFullName: (employee: Employee) => string
  getStatusColor: (status: EmployeeStatus) => string
  formatStatus: (status: EmployeeStatus) => string
  showActions?: boolean
  onEdit?: (employeeId: string) => void
}

export function EmployeeTableRow({
  employee,
  isPlaceholderData,
  onClick,
  getFullName,
  getStatusColor,
  formatStatus,
  showActions = true,
  onEdit,
}: EmployeeTableRowProps) {
  return (
    <tr
      key={employee.id}
      onClick={() => onClick(employee.id)}
      className="hover:bg-gray-50 transition-colors cursor-pointer"
      style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {employee.employeeCode}
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{getFullName(employee)}</div>
        <div className="text-sm text-gray-400">{employee.position?.title ?? 'No position'}</div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {employee.email ?? <span className="text-gray-400 italic">No email</span>}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {employee.department?.name ?? <span className="text-gray-400 italic">Unassigned</span>}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {employee.branch?.name ?? <span className="text-gray-400 italic">Unassigned</span>}
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(
            employee.status as EmployeeStatus
          )}`}
        >
          {formatStatus(employee.status as EmployeeStatus)}
        </span>
      </td>

      {showActions && (
        <td className="px-6 py-4 whitespace-nowrap text-center">
          <EmployeeActionsDropdown
            onView={() => onClick(employee.id)}
            onEdit={() => onEdit?.(employee.id)}
          />
        </td>
      )}
    </tr>
  )
}
