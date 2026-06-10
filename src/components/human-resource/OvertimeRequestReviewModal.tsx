'use client'

import { X, CalendarDays, Clock3, User2, FileText, CheckCircle2, XCircle } from 'lucide-react'

type OvertimeRequest = {
  id: string
  employee: { firstName: string; lastName: string }
  date: string
  startTime: string
  endTime: string
  totalHours: number
  reason?: string | null
  status: string
  reviewedBy?: string | null
}

type OvertimeRequestReviewModalProps = {
  isOpen: boolean
  request: OvertimeRequest | null
  onClose: () => void
  onApprove: (id: string) => void
  onDecline: (id: string) => void
}

export default function OvertimeRequestReviewModal({
  isOpen,
  request,
  onClose,
  onApprove,
  onDecline,
}: OvertimeRequestReviewModalProps) {
  if (!isOpen || !request) return null

  const isPending = request.status === 'PENDING'
  const isApproved = request.status === 'APPROVED'
  const isRejected = request.status === 'REJECTED'
  const employeeName = `${request.employee.firstName} ${request.employee.lastName}`
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Overtime Request Details</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Review and update the status of this overtime request.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* DETAILS */}
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <User2 className="h-3.5 w-3.5" />
              Employee
            </p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
              {employeeName}
            </p>
          </div>

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Date
            </p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
              {formatDate(request.date)}
            </p>
          </div>

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Clock3 className="h-3.5 w-3.5" />
              Start Time
            </p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-900">
              {request.startTime}
            </p>
          </div>

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Clock3 className="h-3.5 w-3.5" />
              End Time
            </p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-900">
              {request.endTime}
            </p>
          </div>

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Clock3 className="h-3.5 w-3.5" />
              Total Hours
            </p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
              {request.totalHours} hr{request.totalHours !== 1 ? 's' : ''}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  isApproved
                    ? 'bg-green-100 text-green-700'
                    : isPending
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {isApproved ? 'Approved' : isPending ? 'Pending' : 'Rejected'}
              </span>
            </p>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <FileText className="h-3.5 w-3.5" />
              Reason
            </p>
            <p className="min-h-16 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-900">
              {request.reason ?? '—'}
            </p>
          </div>

          {request.reviewedBy && (
            <div className="sm:col-span-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <User2 className="h-3.5 w-3.5" />
                {isApproved ? 'Approved By' : 'Declined By'}
              </p>
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  isApproved
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {isApproved ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                {request.reviewedBy}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>

          {(isPending || isApproved) && (
            <button
              type="button"
              onClick={() => onDecline(request.id)}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              {isPending ? 'Decline' : 'Change to Declined'}
            </button>
          )}

          {(isPending || isRejected) && (
            <button
              type="button"
              onClick={() => onApprove(request.id)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {isPending ? 'Approve' : 'Change to Approved'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
