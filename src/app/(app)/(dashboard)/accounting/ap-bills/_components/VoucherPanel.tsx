'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Paperclip, Trash2, Download } from 'lucide-react'
import {
  APBills,
  FileAttachments,
  type APBill,
  type FileAttachment,
} from '@/src/libs/data/AccountingV2Data'
import type { ApiResponse } from '@/src/libs/api/client'
import { uploadVoucherAttachment } from '../_actions/upload-voucher-attachment'

const ENTITY_TYPE = 'APBill'

const STATUS_LABEL: Record<string, string> = {
  pending_online_approval: 'Pending Online Approval',
  pending_onsite_approval: 'Pending Onsite Approval',
  approved: 'Approved',
  rejected: 'Rejected',
}
const STATUS_COLOR: Record<string, string> = {
  pending_online_approval: 'bg-amber-50 text-amber-700',
  pending_onsite_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

export default function VoucherPanel({
  bill,
  onClose,
  onSaved,
}: {
  bill: APBill
  onClose: () => void
  onSaved: () => void
}) {
  const [voucherNumber, setVoucherNumber] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [uploading, setUploading] = useState(false)

  const loadAttachments = useCallback(async () => {
    const res = await FileAttachments.listForEntity(ENTITY_TYPE, bill.id)
    setAttachments(res.data ?? [])
  }, [bill.id])
  useEffect(() => {
    loadAttachments()
  }, [loadAttachments])

  const run = async (action: () => Promise<ApiResponse<APBill>>) => {
    setSaving(true)
    setError(null)
    const res = await action()
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Action failed')
      return
    }
    onSaved()
  }

  const raiseVoucher = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => APBills.createVoucher(bill.id, voucherNumber))
  }
  const approveOnline = () => run(() => APBills.approveVoucherOnline(bill.id))
  const approveOnsite = () => run(() => APBills.approveVoucherOnsite(bill.id))
  const reject = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => APBills.rejectVoucher(bill.id, rejectReason))
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.set('file', file)
    const uploadRes = await uploadVoucherAttachment(form)
    if (!uploadRes.success || !uploadRes.data) {
      setError(uploadRes.message || uploadRes.error || 'Upload failed')
      setUploading(false)
      return
    }
    const attachRes = await FileAttachments.attach(uploadRes.data.id, ENTITY_TYPE, bill.id)
    setUploading(false)
    if (!attachRes.success) {
      setError(attachRes.message || attachRes.error || 'Failed to attach file')
      return
    }
    loadAttachments()
  }
  const detach = async (id: string) => {
    if (!confirm('Remove this attachment?')) return
    await FileAttachments.detach(id)
    loadAttachments()
  }

  const status = bill.voucherApprovalStatus

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Voucher — {bill.billNumber}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {!bill.voucherNumber ? (
            <form onSubmit={raiseVoucher} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">
                  Voucher Number *
                </span>
                <input
                  required
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  placeholder="e.g. V-2026-0001"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Raising...' : 'Raise Voucher'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono">{bill.voucherNumber}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${status ? STATUS_COLOR[status] : ''}`}
                >
                  {status ? STATUS_LABEL[status] : '—'}
                </span>
              </div>
              {status === 'rejected' && bill.voucherRejectedReason && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  {bill.voucherRejectedReason}
                </p>
              )}
              {status === 'pending_online_approval' && !showReject && (
                <div className="flex gap-2">
                  <button
                    onClick={approveOnline}
                    disabled={saving}
                    className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                  >
                    Approve Online
                  </button>
                  <button
                    onClick={() => setShowReject(true)}
                    className="px-4 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              )}
              {status === 'pending_onsite_approval' && !showReject && (
                <div className="flex gap-2">
                  <button
                    onClick={approveOnsite}
                    disabled={saving}
                    className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                  >
                    Approve Onsite (Final)
                  </button>
                  <button
                    onClick={() => setShowReject(true)}
                    className="px-4 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              )}
              {showReject && (
                <form onSubmit={reject} className="space-y-2">
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">
                      Rejection Reason *
                    </span>
                    <input
                      required
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 px-4 py-2 text-sm font-semibold bg-red-700 text-white rounded-lg disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReject(false)}
                      className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Attachments</span>
              <label className="flex items-center gap-1 text-xs text-purple-700 hover:underline cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Attach file'}
                <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-gray-400">No attachments yet.</p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5"
                  >
                    <a
                      href={`/api/files/${a.file.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-purple-700 hover:underline truncate"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{a.file.originalName}</span>
                    </a>
                    <button
                      onClick={() => detach(a.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
