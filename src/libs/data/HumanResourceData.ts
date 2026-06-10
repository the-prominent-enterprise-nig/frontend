export type HrItem = {
  id: number
  title: string
  usedBy: string[]
  definition: string
  fields: string[]
}

export const attendanceTimekeepingItems: HrItem[] = [
  {
    id: 1,
    title: 'Attendance Logs',
    usedBy: ['Employee', 'HR Officer', 'Manager', 'Payroll Officer'],
    definition:
      'Attendance Logs record employee attendance entries with date, clock in/out times when available, status, and source.',
    fields: [
      'Employee',
      'Work date',
      'Start time',
      'End time',
      'Total tracked hours',
      'Session status',
      'Log source (mobile, web, manual)',
      'Location (optional)',
      'Related project or task (optional)',
      'Notes or description',
    ],
  },
  {
    id: 2,
    title: 'Attendance Summary',
    usedBy: ['HR Officer', 'Manager', 'Payroll Officer'],
    definition:
      'The Attendance Summary aggregates multiple attendance logs within a payroll cutoff or reporting period. It provides a quick overview of total worked hours and attendance metrics for payroll processing and workforce monitoring.',
    fields: [
      'Employee',
      'Payroll cutoff period',
      'Total tracked hours',
      'Total days worked',
      'Total absences',
      'Total tardiness',
      'Total overtime hours',
      'Leave days recorded',
      'Summary status',
    ],
  },
  {
    id: 3,
    title: 'Attendance Status Types',
    usedBy: ['HR Officer', 'Payroll Officer', 'Manager'],
    definition:
      'Attendance Status Types define standardized classifications used across attendance logs and summaries.',
    fields: [
      'Status name',
      'Status code',
      'Description',
      'Status category',
      'Payroll impact',
      'Active or inactive flag',
    ],
  },
  {
    id: 4,
    title: 'Overtime Requests',
    usedBy: ['Employee', 'Manager', 'HR Officer', 'Payroll Officer'],
    definition:
      'Overtime Requests record employee requests to perform work beyond regular scheduled hours. Approved overtime may be included in attendance summaries and payroll computations.',
    fields: [
      'Employee',
      'Overtime date',
      'Requested start time',
      'Requested end time',
      'Total overtime hours',
      'Reason for overtime',
      'Approval status',
      'Approved by',
      'Approval date',
      'Remarks',
    ],
  },
  {
    id: 5,
    title: 'Attendance Change Requests',
    usedBy: ['Employee', 'HR Officer', 'Manager'],
    definition:
      'Attendance Change Requests let employees request fixes for missed, incorrect, or incomplete attendance records.',
    fields: [
      'Employee',
      'Attendance date',
      'Issue type',
      'Requested time or status change',
      'Reason',
      'Request status',
      'Remarks',
    ],
  },
]

export const attendanceRelationshipSummary =
  'Attendance Logs capture employee time entries, Attendance Status Types classify those entries, and Attendance Summary consolidates totals for HR and payroll review. Overtime Requests handle additional work hours, while Attendance Change Requests provide one simple queue for missed, incorrect, or incomplete attendance fixes.'
