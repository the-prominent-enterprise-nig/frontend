'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getLeaveRequests,
  approveLeaveRequest,
  getLeaveTypes,
  getMySession,
} from '@/src/libs/actions/leave.actions'
import { getEmployees } from '@/src/libs/actions/employee.actions'
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  CalendarClock,
  Archive,
} from 'lucide-react'
import LeaveAdjustmentModal from './LeaveAdjustmentModal'

// ─── Types ───────────────────────────────────────────────────────────────────

type Employee = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  department?: { id: string; name: string } | null
}

type LeaveType = {
  id: string
  name: string
  code: string
}

type LeaveRequest = {
  id: string
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
  }
  leaveType: { id: string; name: string; code: string; isPaidLeave?: boolean }
  startDate: string | Date
  endDate: string | Date
  totalDaysRequested: number
  reason: string
  status: string
  submittedDate: string | Date | null
  reviewedBy: string | null
  remarks: string | null
}

type LeaveRequestListProps = {
  onRequestsUpdated?: () => void
}

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

// ─── Constants ────────────────────────────────────────────────────────────────

const DISPLAY_STATUS: Record<string, string> = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
}

const STATUS_ORDER: Record<string, number> = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  Cancelled: 3,
}

const STATUS_FILTER_MAP: Record<StatusFilter, string | null> = {
  All: null,
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-zinc-100 text-zinc-500',
}

const STATUS_LEFT_BORDER: Record<string, string> = {
  Pending: 'border-l-amber-400',
  Approved: 'border-l-green-400',
  Rejected: 'border-l-red-400',
  Cancelled: 'border-l-zinc-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(date: string | Date): string {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getCurrentMonthKey(): string {
  return getMonthKey(new Date())
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-')
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

function formatDate(date: string | Date): string {
  const d = new Date(date)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = getMonthKey(d)
    options.push({ value: key, label: formatMonthLabel(key) })
  }
  return options
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  count,
  label,
  colorClass,
  badgeClass,
}: {
  icon: React.ReactNode
  count: number
  label: string
  colorClass: string
  badgeClass: string
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${colorClass}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className={`text-2xl font-bold ${badgeClass}`}>{count}</p>
        <p className="text-xs opacity-75">{label}</p>
      </div>
    </div>
  )
}

function RequestCard({
  request,
  isExpanded,
  actionLoading,
  isSelf,
  onToggle,
  onApprove,
  onReject,
}: {
  request: LeaveRequest
  isExpanded: boolean
  actionLoading: string | null
  isSelf: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const isPending = request.status === 'Pending'
  // Show warning banner for all pending requests — they need HR action
  const showWarning = isPending
  const displayStatus = DISPLAY_STATUS[request.status] ?? request.status
  const leftBorder = STATUS_LEFT_BORDER[request.status] ?? 'border-l-zinc-200'

  return (
    <div
      className={`overflow-hidden rounded-xl border border-l-4 bg-white transition dark:bg-zinc-900 dark:border-zinc-800 ${leftBorder}`}
    >
      {/* Warning banner */}
      {showWarning && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 dark:bg-amber-950/40">
          <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Leave request upcoming, needs action
          </span>
        </div>
      )}

      {/* Card header */}
      <div
        className="cursor-pointer p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            {getInitials(request.employee.firstName, request.employee.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">
                  {request.employee.firstName} {request.employee.lastName}
                </p>
                <p className="text-xs text-zinc-500">{request.employee.employeeCode}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[request.status] ?? ''}`}
                >
                  {displayStatus}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                {request.leaveType.code} — {request.leaveType.name}
              </span>
              <span className="text-xs">
                {formatDate(request.startDate)}
                {request.startDate !== request.endDate && ` – ${formatDate(request.endDate)}`}
              </span>
              <span className="text-xs font-medium">
                {request.totalDaysRequested} day{request.totalDaysRequested !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Reason</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{request.reason}</p>
          </div>
          {request.remarks && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                Remarks
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{request.remarks}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            {request.submittedDate && <span>Submitted: {formatDate(request.submittedDate)}</span>}
            {request.reviewedBy && <span>Reviewed by: {request.reviewedBy}</span>}
          </div>

          {isPending &&
            (isSelf ? (
              <p className="pt-1 text-xs text-zinc-400 italic">
                You cannot approve your own leave request.
              </p>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onApprove}
                  disabled={actionLoading === request.id}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={onReject}
                  disabled={actionLoading === request.id}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaveRequestList({ onRequestsUpdated }: LeaveRequestListProps) {
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionEmployeeId, setSessionEmployeeId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonthKey())
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  const monthOptions = useMemo(() => generateMonthOptions(), [])

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [requestsResult, leaveTypesResult, employeesResult, sessionResult] = await Promise.all([
      getLeaveRequests(), // returns all requests; component handles month filtering client-side
      getLeaveTypes(),
      getEmployees(),
      getMySession(),
    ])
    if (sessionResult.success) setSessionEmployeeId(sessionResult.data.employeeId ?? null)

    if (requestsResult.success) {
      const sorted = [...(requestsResult.data as LeaveRequest[])].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
      )
      setAllRequests(sorted)
    } else {
      setError(requestsResult.error || 'Failed to fetch leave requests')
    }

    if (leaveTypesResult.success) {
      setLeaveTypes(leaveTypesResult.data as LeaveType[])
    }

    if (employeesResult?.data) {
      const empList = Array.isArray(employeesResult.data)
        ? employeesResult.data
        : ((employeesResult.data as { data?: Employee[] }).data ?? [])
      setEmployees(
        (empList as Employee[]).map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          firstName: e.firstName,
          lastName: e.lastName,
          department: e.department ?? null,
        }))
      )
    }

    setLoading(false)
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    setAllRequests((prev) =>
      [
        ...prev.map((r) => (r.id === id ? { ...r, status: 'Approved', reviewedBy: 'You' } : r)),
      ].sort((a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5))
    )
    onRequestsUpdated?.()
    await approveLeaveRequest({ leaveRequestId: id, decision: 'Approved', remarks: '' })
    setActionLoading(null)
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    setAllRequests((prev) =>
      [
        ...prev.map((r) => (r.id === id ? { ...r, status: 'Rejected', reviewedBy: 'You' } : r)),
      ].sort((a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5))
    )
    onRequestsUpdated?.()
    await approveLeaveRequest({ leaveRequestId: id, decision: 'Rejected', remarks: '' })
    setActionLoading(null)
  }

  const matchesSearch = (req: LeaveRequest) => {
    if (!search) return true
    const fullName = `${req.employee.firstName} ${req.employee.lastName}`.toLowerCase()
    const q = search.toLowerCase()
    return fullName.includes(q) || req.employee.employeeCode.toLowerCase().includes(q)
  }

  const matchesLeaveType = (req: LeaveRequest) =>
    leaveTypeFilter === 'all' || req.leaveType.id === leaveTypeFilter

  // Requests in selected month
  const monthRequests = useMemo(
    () => allRequests.filter((r) => getMonthKey(r.startDate) === monthFilter),
    [allRequests, monthFilter]
  )

  // Requests in months before selected month
  const archivedRequests = useMemo(
    () => allRequests.filter((r) => getMonthKey(r.startDate) < monthFilter),
    [allRequests, monthFilter]
  )

  const filterStatus = STATUS_FILTER_MAP[statusFilter]

  const visibleRequests = monthRequests.filter((req) => {
    const matchStatus = !filterStatus || req.status === filterStatus
    return matchesSearch(req) && matchStatus && matchesLeaveType(req)
  })

  const visibleArchived = archivedRequests.filter(
    (req) => matchesSearch(req) && matchesLeaveType(req)
  )

  // Stats scoped to selected month only
  const pendingCount = monthRequests.filter((r) => r.status === 'Pending').length
  const approvedCount = monthRequests.filter((r) => r.status === 'Approved').length
  const rejectedCount = monthRequests.filter((r) => r.status === 'Rejected').length

  if (loading) {
    return (
      <div className="p-6 py-16 text-center text-sm text-zinc-500">Loading leave requests…</div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6 space-y-5">
        {/* Summary stats — scoped to selected month */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
            count={pendingCount}
            label={`Pending — ${formatMonthLabel(monthFilter)}`}
            colorClass="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
            badgeClass="text-amber-700 dark:text-amber-400"
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            count={approvedCount}
            label={`Approved — ${formatMonthLabel(monthFilter)}`}
            colorClass="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
            badgeClass="text-green-700 dark:text-green-400"
          />
          <StatCard
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            count={rejectedCount}
            label={`Rejected — ${formatMonthLabel(monthFilter)}`}
            colorClass="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
            badgeClass="text-red-700 dark:text-red-400"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Row 1: search + month + buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or employee code…"
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:ring-purple-900"
              />
            </div>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                showFilters
                  ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>

            <button
              onClick={() => setShowAdjustModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-800"
            >
              Adjust Leave
            </button>
          </div>

          {/* Row 2: filter chips + leave type (shown when expanded) */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex flex-wrap gap-1.5">
                {(['All', 'Pending', 'Approved', 'Rejected'] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`relative rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      statusFilter === s
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {s}
                    {s === 'Pending' && pendingCount > 0 && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                          statusFilter === 'Pending'
                            ? 'bg-white/25 text-white'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 outline-none focus:border-purple-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <option value="all">All Leave Types</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Current month requests */}
        {visibleRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No leave requests for {formatMonthLabel(monthFilter)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                isExpanded={expandedId === request.id}
                actionLoading={actionLoading}
                isSelf={!!sessionEmployeeId && request.employee.id === sessionEmployeeId}
                onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
                onApprove={() => handleApprove(request.id)}
                onReject={() => handleReject(request.id)}
              />
            ))}
          </div>
        )}

        {/* Archived section */}
        {visibleArchived.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
            >
              <span className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archived — Previous Months
                <span className="ml-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {visibleArchived.length}
                </span>
              </span>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${showArchived ? 'rotate-90' : ''}`}
              />
            </button>

            {showArchived && (
              <div className="mt-3 space-y-3">
                {visibleArchived.map((request) => (
                  <div key={request.id} className="opacity-80">
                    <RequestCard
                      request={request}
                      isExpanded={expandedId === request.id}
                      actionLoading={actionLoading}
                      isSelf={!!sessionEmployeeId && request.employee.id === sessionEmployeeId}
                      onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
                      onApprove={() => handleApprove(request.id)}
                      onReject={() => handleReject(request.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adjust Leave Modal */}
      {showAdjustModal && (
        <LeaveAdjustmentModal
          employees={employees}
          leaveTypes={leaveTypes}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={() => {
            setShowAdjustModal(false)
            onRequestsUpdated?.()
          }}
        />
      )}
    </>
  )
}
