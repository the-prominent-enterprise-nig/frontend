import { Employee, EmployeeStatus } from '@/src/schema/human-resource/employees/list'

export function getUniqueByKey(items: Employee[], key: keyof Employee) {
  const map = new Map()

  items.forEach((item) => {
    const value = item[key]

    if (value && typeof value === 'object' && 'id' in value && !map.has(value.id)) {
      map.set(value.id, value)
    }
  })

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// Status color mapping
export function getStatusColor(status: EmployeeStatus) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border border-green-200'
    case 'inactive':
      return 'bg-gray-100 text-gray-800 border border-gray-200'
    case 'resigned':
      return 'bg-blue-100 text-blue-800 border border-blue-200'
    case 'terminated':
      return 'bg-red-100 text-red-800 border border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200'
  }
}

export function getFullName(employee: Employee): string {
  const parts = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean)
  return parts.join(' ')
}

export function formatStatus(status: EmployeeStatus): string {
  const statusMap = {
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    resigned: 'RESIGNED',
    terminated: 'TERMINATED',
  }
  return statusMap[status] || status
}
