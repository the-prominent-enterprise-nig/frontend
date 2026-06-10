'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

type AddAdjustmentRecordModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave?: (data: {
    employee: string
    relatedAttendanceRecord: string
    adjustmentType: string
    adjustedValue: string
    reason: string
    adjustmentDate: string
    requestedBy: string
    approvedBy: string
    referenceDocument: string
    remarks: string
  }) => void
}

export default function AddAdjustmentRecordModal({
  isOpen,
  onClose,
  onSave,
}: AddAdjustmentRecordModalProps) {
  const [employee, setEmployee] = useState('')
  const [relatedAttendanceRecord, setRelatedAttendanceRecord] = useState('')
  const [adjustmentType, setAdjustmentType] = useState('')
  const [adjustedValue, setAdjustedValue] = useState('')
  const [reason, setReason] = useState('')
  const [adjustmentDate, setAdjustmentDate] = useState('')
  const [requestedBy, setRequestedBy] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [referenceDocument, setReferenceDocument] = useState('')
  const [remarks, setRemarks] = useState('')

  if (!isOpen) return null

  const handleSave = () => {
    onSave?.({
      employee,
      relatedAttendanceRecord,
      adjustmentType,
      adjustedValue,
      reason,
      adjustmentDate,
      requestedBy,
      approvedBy,
      referenceDocument,
      remarks,
    })

    // reset
    setEmployee('')
    setRelatedAttendanceRecord('')
    setAdjustmentType('')
    setAdjustedValue('')
    setReason('')
    setAdjustmentDate('')
    setRequestedBy('')
    setApprovedBy('')
    setReferenceDocument('')
    setRemarks('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Add Adjustment Record</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Record a new manual adjustment for an attendance entry.
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

        {/* FORM */}
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Employee</label>
            <input
              type="text"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              placeholder="e.g. Maria Santos"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Related Attendance Record
            </label>
            <input
              type="text"
              value={relatedAttendanceRecord}
              onChange={(e) => setRelatedAttendanceRecord(e.target.value)}
              placeholder="e.g. LOG-2026-03-21-002"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Adjustment Type</label>
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            >
              <option value="">Select Type</option>
              <option value="Time Adjustment">Time Adjustment</option>
              <option value="Overtime Adjustment">Overtime Adjustment</option>
              <option value="Attendance Status Adjustment">Attendance Status Adjustment</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Adjusted Value</label>
            <input
              type="text"
              value={adjustedValue}
              onChange={(e) => setAdjustedValue(e.target.value)}
              placeholder="e.g. +0.33 hours"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Adjustment Date</label>
            <input
              type="date"
              value={adjustmentDate}
              onChange={(e) => setAdjustmentDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Reference Document
            </label>
            <input
              type="text"
              value={referenceDocument}
              onChange={(e) => setReferenceDocument(e.target.value)}
              placeholder="e.g. Correction Request CR-001"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Requested By</label>
            <input
              type="text"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              placeholder="e.g. Maria Santos"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Approved By</label>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="e.g. Angela Cruz"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved correction request for late clock-in"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks"
              rows={3}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
