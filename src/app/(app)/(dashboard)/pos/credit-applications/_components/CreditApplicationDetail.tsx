'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useCreditApplication } from '../_hooks/useCreditApplication'
import { uploadCreditApplicationFile } from '../_actions/upload-document-file'
import { hasPermission } from '@/src/hooks/usePermission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  CREDIT_APPLICATION_STATUS_LABELS,
  CREDIT_APPLICATION_STATUS_COLORS,
  CREDIT_APPLICATION_DOCUMENT_TYPE_LABELS,
  CREDIT_INVESTIGATION_OUTCOME_LABELS,
  CREDIT_INVESTIGATION_OUTCOME_COLORS,
  CreditApplicationDocumentTypeSchema,
  CreditInvestigationOutcomeSchema,
  CancelCreditApplicationFormSchema,
  RecordCreditInvestigationFormSchema,
  DeclineCreditApplicationFormSchema,
  type CancelCreditApplicationFormValues,
  type RecordCreditInvestigationFormValues,
  type DeclineCreditApplicationFormValues,
} from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreditApplicationDetail({
  id,
  session,
}: {
  id: string
  session: SessionUser
}) {
  const canUpdate = hasPermission(session, CREDIT_PERMISSIONS.APPLICATION_UPDATE)
  const canCancel = hasPermission(session, CREDIT_PERMISSIONS.APPLICATION_CANCEL)
  const canStartInvestigation = hasPermission(session, CREDIT_PERMISSIONS.INVESTIGATION_START)
  const canRecordInvestigation = hasPermission(session, CREDIT_PERMISSIONS.INVESTIGATION_RECORD)
  const canApprove = hasPermission(session, CREDIT_PERMISSIONS.APPLICATION_APPROVE)

  const {
    application,
    isLoading,
    documents,
    isDocumentsLoading,
    submit,
    isSubmitting,
    cancel,
    isCancelling,
    attachDocument,
    isAttaching,
    removeDocument,
    startInvestigation,
    isStartingInvestigation,
    recordInvestigation,
    isRecordingInvestigation,
    approve,
    isApproving,
    decline,
    isDeclining,
    goToList,
  } = useCreditApplication(id)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<string>('applicant_id')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | undefined>(undefined)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isDeclineOpen, setIsDeclineOpen] = useState(false)

  const {
    control,
    handleSubmit: handleCancelSubmit,
    reset: resetCancelForm,
    formState: { errors: cancelErrors },
  } = useForm<CancelCreditApplicationFormValues>({
    resolver: zodResolver(CancelCreditApplicationFormSchema),
    defaultValues: { reason: '' },
  })

  const {
    control: declineControl,
    handleSubmit: handleDeclineSubmit,
    reset: resetDeclineForm,
    formState: { errors: declineErrors },
  } = useForm<DeclineCreditApplicationFormValues>({
    resolver: zodResolver(DeclineCreditApplicationFormSchema),
    defaultValues: { reason: '' },
  })

  const {
    control: investigationControl,
    handleSubmit: handleInvestigationSubmit,
    reset: resetInvestigationForm,
  } = useForm<RecordCreditInvestigationFormValues>({
    resolver: zodResolver(RecordCreditInvestigationFormSchema),
    defaultValues: { affordabilityOutcome: 'recommend_approve', notes: '' },
  })

  if (isLoading) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>
  }

  if (!application) {
    return <div className="p-8 text-sm text-zinc-500">Credit application not found.</div>
  }

  const isDraft = application.status === 'draft'

  async function handleAttach() {
    if (!pendingFile) return
    setUploadError(undefined)
    setIsUploading(true)
    const formData = new FormData()
    formData.set('file', pendingFile)
    const uploadResult = await uploadCreditApplicationFile(formData)
    if (!uploadResult.success || !uploadResult.data) {
      setUploadError(uploadResult.message ?? 'Upload failed')
      setIsUploading(false)
      return
    }
    await attachDocument({
      fileId: uploadResult.data.id,
      documentType: documentType as (typeof CreditApplicationDocumentTypeSchema.options)[number],
    })
    setPendingFile(null)
    setIsUploading(false)
  }

  async function handleCancelFormSubmit(data: CancelCreditApplicationFormValues) {
    await cancel(data)
    setIsCancelOpen(false)
    resetCancelForm()
  }

  async function handleInvestigationFormSubmit(data: RecordCreditInvestigationFormValues) {
    await recordInvestigation(data)
    resetInvestigationForm()
  }

  async function handleDeclineFormSubmit(data: DeclineCreditApplicationFormValues) {
    await decline(data)
    setIsDeclineOpen(false)
    resetDeclineForm()
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={goToList}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to applications
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900">{application.applicationNumber}</h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CREDIT_APPLICATION_STATUS_COLORS[application.status]}`}
              >
                {CREDIT_APPLICATION_STATUS_LABELS[application.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{application.branch.name}</p>
          </div>
          {isDraft && (
            <div className="flex items-center gap-2">
              {canUpdate && (
                <button
                  type="button"
                  onClick={() => submit()}
                  disabled={isSubmitting || documents.length === 0}
                  title={
                    documents.length === 0
                      ? 'Attach at least one document before submitting'
                      : undefined
                  }
                  className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit for Investigation
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(true)}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Cancel Application
                </button>
              )}
            </div>
          )}
          {application.status === 'pending_approval' && canApprove && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDeclineOpen(true)}
                disabled={isDeclining}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => approve()}
                disabled={isApproving}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Applicant</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Name</dt>
                <dd className="font-medium text-zinc-900">{application.applicantCustomer.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Customer Code</dt>
                <dd className="text-zinc-700">{application.applicantCustomer.customerCode}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Contact</dt>
                <dd className="text-zinc-700">
                  {application.applicantCustomer.phone ??
                    application.applicantCustomer.email ??
                    '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Co-Maker</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Name</dt>
                <dd className="font-medium text-zinc-900">{application.coMaker.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Relationship</dt>
                <dd className="text-zinc-700">{application.coMaker.relationship}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Contact</dt>
                <dd className="text-zinc-700">{application.coMaker.contactNumber}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Financing Request</h2>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-zinc-500">Requested Amount</dt>
              <dd className="mt-0.5 text-lg font-semibold text-zinc-900">
                ₱{application.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Item / Purpose</dt>
              <dd className="mt-0.5 text-zinc-900">{application.itemDescription ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Supporting Documents</h2>

          {isDocumentsLoading ? (
            <p className="text-sm text-zinc-500">Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-zinc-400">No documents attached yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-zinc-400" />
                    <div>
                      <p className="font-medium text-zinc-900">{doc.file.originalName}</p>
                      <p className="text-xs text-zinc-500">
                        {CREDIT_APPLICATION_DOCUMENT_TYPE_LABELS[doc.documentType]} ·{' '}
                        {formatBytes(doc.file.size)}
                      </p>
                    </div>
                  </div>
                  {isDraft && canUpdate && (
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isDraft && canUpdate && (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className={`${fieldClass} bg-white`}
                >
                  {CreditApplicationDocumentTypeSchema.options.map((t) => (
                    <option key={t} value={t}>
                      {CREDIT_APPLICATION_DOCUMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">File</label>
                <input
                  type="file"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-zinc-200"
                />
              </div>
              <button
                type="button"
                onClick={handleAttach}
                disabled={!pendingFile || isUploading || isAttaching}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                {(isUploading || isAttaching) && <Loader2 className="h-4 w-4 animate-spin" />}
                <Upload className="h-4 w-4" />
                Attach
              </button>
            </div>
          )}
          {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
        </div>

        {(application.status === 'submitted' ||
          application.status === 'under_investigation' ||
          application.investigation) && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Credit Investigation</h2>

            {application.investigation ? (
              <div className="space-y-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CREDIT_INVESTIGATION_OUTCOME_COLORS[application.investigation.affordabilityOutcome]}`}
                >
                  {
                    CREDIT_INVESTIGATION_OUTCOME_LABELS[
                      application.investigation.affordabilityOutcome
                    ]
                  }
                </span>
                {application.investigation.notes && (
                  <p className="text-sm text-zinc-700">{application.investigation.notes}</p>
                )}
              </div>
            ) : application.status === 'submitted' ? (
              canStartInvestigation && (
                <button
                  type="button"
                  onClick={() => startInvestigation()}
                  disabled={isStartingInvestigation}
                  className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                >
                  {isStartingInvestigation && <Loader2 className="h-4 w-4 animate-spin" />}
                  Start Investigation
                </button>
              )
            ) : (
              canRecordInvestigation && (
                <form
                  onSubmit={handleInvestigationSubmit(handleInvestigationFormSubmit)}
                  className="space-y-3"
                  noValidate
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">
                      Affordability Outcome
                    </label>
                    <Controller
                      name="affordabilityOutcome"
                      control={investigationControl}
                      render={({ field }) => (
                        <select {...field} className={`${fieldClass} bg-white`}>
                          {CreditInvestigationOutcomeSchema.options.map((o) => (
                            <option key={o} value={o}>
                              {CREDIT_INVESTIGATION_OUTCOME_LABELS[o]}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                    <Controller
                      name="notes"
                      control={investigationControl}
                      render={({ field }) => (
                        <textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={3}
                          placeholder="Affordability assessment notes"
                          className={fieldClass}
                        />
                      )}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isRecordingInvestigation}
                    className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                  >
                    {isRecordingInvestigation && <Loader2 className="h-4 w-4 animate-spin" />}
                    Record Outcome
                  </button>
                </form>
              )
            )}
          </div>
        )}

        {application.status === 'cancelled' && application.cancelReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Cancellation Reason</p>
            <p className="mt-1 text-sm text-red-700">{application.cancelReason}</p>
          </div>
        )}

        {application.status === 'declined' && application.declineReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Decline Reason</p>
            <p className="mt-1 text-sm text-red-700">{application.declineReason}</p>
          </div>
        )}

        {application.status === 'approved' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">Approved</p>
            <p className="mt-1 text-sm text-green-700">
              This application has been approved and is ready to proceed.
            </p>
          </div>
        )}
      </div>

      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <form onSubmit={handleCancelSubmit(handleCancelFormSubmit)} noValidate>
              <div className="space-y-3 px-6 py-5">
                <h2 className="text-lg font-semibold text-zinc-900">Cancel Application</h2>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Reason for cancelling"
                      className={fieldClass}
                    />
                  )}
                />
                {cancelErrors.reason && (
                  <p className="text-xs text-red-600">{cancelErrors.reason.message}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeclineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <form onSubmit={handleDeclineSubmit(handleDeclineFormSubmit)} noValidate>
              <div className="space-y-3 px-6 py-5">
                <h2 className="text-lg font-semibold text-zinc-900">Decline Application</h2>
                <Controller
                  name="reason"
                  control={declineControl}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Reason for declining"
                      className={fieldClass}
                    />
                  )}
                />
                {declineErrors.reason && (
                  <p className="text-xs text-red-600">{declineErrors.reason.message}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsDeclineOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isDeclining}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeclining && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
