import { CalendarDays, Clock3, FileText, FolderOpen, Receipt, Settings, Users } from 'lucide-react'

export type HrModule = {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export type AttendanceItem = {
  id: number
  title: string
  usedBy: string[]
  description: string
  href?: string
}

export const hrModules: HrModule[] = [
  {
    title: 'Attendance',
    description: 'View attendance logs, work sessions, and related requests.',
    href: '/human-resource/attendance',
    icon: Clock3,
  },
  {
    title: 'Employees',
    description: 'Manage employee records, assignments, and basic details.',
    href: '/human-resource/employees',
    icon: Users,
  },
  {
    title: 'Leave',
    description: 'Review leave requests, balances, and approval history.',
    href: '/human-resource/leave',
    icon: CalendarDays,
  },
  {
    title: 'Payroll',
    description: 'Access payroll periods, summaries, and payment-related data.',
    href: '/human-resource/payroll',
    icon: Receipt,
  },
  {
    title: 'Payslips',
    description: 'Manage generated payslips and employee payroll documents.',
    href: '/human-resource/payslips',
    icon: FileText,
  },
  {
    title: 'Documents',
    description: 'Store and organize HR files and employee-related documents.',
    href: '/human-resource/documents',
    icon: FolderOpen,
  },
  {
    title: 'Settings',
    description: 'Configure attendance rules, statuses, and HR-related options.',
    href: '/human-resource/settings',
    icon: Settings,
  },
]

export const attendanceItems: AttendanceItem[] = [
  {
    id: 1,
    title: 'Attendance Logs',
    usedBy: ['Employee', 'HR Officer', 'Manager', 'Payroll Officer'],
    description: 'Records employee attendance entries with date, clock in/out, status, and source.',
    href: '/human-resource/attendance/logs',
  },
  {
    id: 2,
    title: 'Attendance Summary',
    usedBy: ['HR Officer', 'Manager', 'Payroll Officer'],
    description: 'Shows attendance totals for HR and payroll review.',
    href: '/human-resource/attendance/summary',
  },
  {
    id: 3,
    title: 'Attendance Status Types',
    usedBy: ['HR Officer', 'Payroll Officer', 'Manager'],
    description:
      'Defines labels such as Present, Late, Absent, On Leave, Holiday, and Holiday Worked.',
    href: '/human-resource/attendance/status-type',
  },
  {
    id: 4,
    title: 'Overtime Requests',
    usedBy: ['Employee', 'Manager', 'HR Officer', 'Payroll Officer'],
    description: 'Tracks requests for work beyond regular scheduled hours.',
    href: '/human-resource/attendance/overtime-request',
  },
  {
    id: 5,
    title: 'Attendance Change Requests',
    usedBy: ['Employee', 'HR Officer', 'Manager'],
    description:
      'Employees can request fixes for missed, incorrect, or incomplete attendance records.',
    href: '/human-resource/attendance/change-requests',
  },
]
