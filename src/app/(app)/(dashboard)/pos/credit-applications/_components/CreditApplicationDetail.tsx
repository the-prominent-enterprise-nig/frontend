'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, FileText, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react'
import { useCreditApplication } from '../_hooks/useCreditApplication'
import { uploadCreditApplicationFile } from '../_actions/upload-document-file'
import { CreditApplicationItemFields } from './CreditApplicationItemFields'
import { hasPermission } from '@/src/hooks/usePermission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  CREDIT_APPLICATION_STATUS_LABELS,
  CREDIT_APPLICATION_STATUS_COLORS,
  CREDIT_APPLICATION_ITEM_STATUS_LABELS,
  CREDIT_APPLICATION_ITEM_STATUS_COLORS,
  CREDIT_APPLICATION_DOCUMENT_TYPE_LABELS,
  CREDIT_INVESTIGATION_OUTCOME_LABELS,
  CREDIT_INVESTIGATION_OUTCOME_COLORS,
  CreditApplicationDocumentTypeSchema,
  CreditInvestigationOutcomeSchema,
  CancelCreditApplicationFormSchema,
  RecordCreditInvestigationFormSchema,
  UpdateCreditApplicationFormSchema,
  type CancelCreditApplicationFormValues,
  type RecordCreditInvestigationFormValues,
  type UpdateCreditApplicationFormValues,
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
    update,
    isUpdating,
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
    decideItems,
    isDeciding,
    goToList,
  } = useCreditApplication(id)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<string>('applicant_id')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | undefined>(undefined)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editError, setEditError] = useState<string | undefined>(undefined)

  // Scenario 29 POS-02 — per-item decision state while status is
  // pending_approval. Defaults every item to 'approve' — the common case —
  // the reviewer flips specific ones to 'decline' rather than starting blank.
  const [itemDecisions, setItemDecisions] = useState<Record<string, 'approve' | 'decline'>>({})
  const [isDecisionReasonOpen, setIsDecisionReasonOpen] = useState(false)
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionError, setDecisionError] = useState<string | undefined>(undefined)

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
    control: investigationControl,
    handleSubmit: handleInvestigationSubmit,
    reset: resetInvestigationForm,
  } = useForm<RecordCreditInvestigationFormValues>({
    resolver: zodResolver(RecordCreditInvestigationFormSchema),
    defaultValues: { affordabilityOutcome: 'recommend_approve', notes: '' },
  })

  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    setValue: editSetValue,
    reset: resetEditForm,
    formState: { errors: editErrors },
  } = useForm<UpdateCreditApplicationFormValues>({
    resolver: zodResolver(UpdateCreditApplicationFormSchema),
  })

  useEffect(() => {
    if (!isEditOpen || !application) return
    resetEditForm({
      items: application.items.map((i) => ({
        itemId: i.itemId,
      })),
      itemDescription: application.itemDescription ?? '',
    })
  }, [isEditOpen, application, resetEditForm])

  useEffect(() => {
    if (application?.status !== 'pending_approval') return
    setItemDecisions(Object.fromEntries(application.items.map((i) => [i.id, 'approve'])))
  }, [application?.status, application?.items])

  async function handleEditFormSubmit(data: UpdateCreditApplicationFormValues) {
    setEditError(undefined)
    const result = await update(data)
    if (result.success) {
      setIsEditOpen(false)
    } else {
      setEditError(result.message)
    }
  }

  function itemIdsByDecision(decision: 'approve' | 'decline'): string[] {
    return Object.entries(itemDecisions)
      .filter(([, d]) => d === decision)
      .map(([itemId]) => itemId)
  }

  async function submitDecision(declineReasonValue?: string) {
    setDecisionError(undefined)
    const result = await decideItems({
      approveItemIds: itemIdsByDecision('approve'),
      declineItemIds: itemIdsByDecision('decline'),
      declineReason: declineReasonValue,
    })
    if (result.success) {
      setIsDecisionReasonOpen(false)
      setDecisionReason('')
    } else {
      setDecisionError(result.message)
    }
  }

  function handleSubmitDecisionClick() {
    if (itemIdsByDecision('decline').length > 0) {
      setIsDecisionReasonOpen(true)
    } else {
      submitDecision(undefined)
    }
  }

  async function handleDecisionReasonSubmit() {
    if (!decisionReason.trim()) {
      setDecisionError('A reason is required for the declined item(s).')
      return
    }
    await submitDecision(decisionReason.trim())
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>
  }

  if (!application) {
    return <div className="p-8 text-sm text-zinc-500">Credit application not found.</div>
  }

  const isDraft = application.status === 'draft'
  // Editable (items/notes/documents) any time before a decision is made —
  // matches CreditApplicationService.update()'s widened window on the
  // backend. Submitting/cancelling stay draft-only (isDraft, above).
  const isEditable = (
    ['draft', 'submitted', 'under_investigation', 'pending_approval'] as string[]
  ).includes(application.status)

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
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">
                {itemIdsByDecision('approve').length} to approve ·{' '}
                {itemIdsByDecision('decline').length} to decline
              </span>
              <button
                type="button"
                onClick={handleSubmitDecisionClick}
                disabled={isDeciding}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                {isDeciding && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Decision
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
                <dt className="text-zinc-500">Phone</dt>
                <dd className="text-zinc-700">{application.applicantCustomer.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Email</dt>
                <dd className="text-zinc-700">{application.applicantCustomer.email ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Co-Maker</h2>
            {application.coMaker ? (
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
                  <dt className="text-zinc-500">Phone</dt>
                  <dd className="text-zinc-700">{application.coMaker.contactNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Email</dt>
                  <dd className="text-zinc-700">{application.coMaker.email ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-zinc-400">No co-maker on this application.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Financing Request</h2>
            {isEditable && canUpdate && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-prominent-purple-700 hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Items / Models</dt>
              <dd className="mt-1 space-y-1">
                {application.items.length === 0 ? (
                  <span className="text-zinc-400">—</span>
                ) : (
                  application.items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 py-0.5">
                      <span className="font-medium text-zinc-900">{i.item?.name ?? '—'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">
                          ₱{i.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                        {application.status === 'pending_approval' && canApprove ? (
                          <div className="flex overflow-hidden rounded-lg border border-zinc-200 text-xs">
                            <button
                              type="button"
                              onClick={() => setItemDecisions((d) => ({ ...d, [i.id]: 'approve' }))}
                              className={`px-2.5 py-1 font-medium ${itemDecisions[i.id] === 'approve' ? 'bg-green-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemDecisions((d) => ({ ...d, [i.id]: 'decline' }))}
                              className={`px-2.5 py-1 font-medium ${itemDecisions[i.id] === 'decline' ? 'bg-red-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          i.status !== 'pending' && (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CREDIT_APPLICATION_ITEM_STATUS_COLORS[i.status]}`}
                            >
                              {CREDIT_APPLICATION_ITEM_STATUS_LABELS[i.status]}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Requested Amount</dt>
              <dd className="mt-0.5 text-lg font-semibold text-zinc-900">
                ₱{application.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            {application.itemDescription && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Notes</dt>
                <dd className="mt-0.5 text-zinc-900">{application.itemDescription}</dd>
              </div>
            )}
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
                  {isEditable && canUpdate && (
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

          {isEditable && canUpdate && (
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

        {(application.status === 'declined' || application.status === 'partially_approved') &&
          application.declineReason && (
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

        {application.status === 'partially_approved' && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-medium text-orange-800">Partially Approved</p>
            <p className="mt-1 text-sm text-orange-700">
              Some items were approved and some were declined — see each item&apos;s status above.
              Checkout will only accept the approved items.
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

      {isDecisionReasonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="space-y-3 px-6 py-5">
              <h2 className="text-lg font-semibold text-zinc-900">Reason for Declined Item(s)</h2>
              <p className="text-xs text-zinc-500">
                Applies to the {itemIdsByDecision('decline').length} item(s) marked Decline.
              </p>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                rows={3}
                placeholder="Reason for declining these items"
                className={fieldClass}
              />
              {decisionError && <p className="text-xs text-red-600">{decisionError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsDecisionReasonOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleDecisionReasonSubmit}
                disabled={isDeciding}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeciding && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Edit Financing Request</h2>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit(handleEditFormSubmit)} noValidate>
              <div className="space-y-5 px-6 py-5">
                <CreditApplicationItemFields
                  control={editControl}
                  setValue={editSetValue}
                  errors={editErrors}
                  initialItems={application.items.map((i) => ({
                    itemId: i.itemId,
                    itemLabel: i.item?.name ?? '',
                    itemMeta: {
                      sellingPrice: i.item?.sellingPrice ?? null,
                      modelNumber: i.item?.modelNumber ?? null,
                    },
                  }))}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Notes (optional)
                  </label>
                  <Controller
                    name="itemDescription"
                    control={editControl}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={2}
                        placeholder="e.g. with installation, specific color preference"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>
                {editError && <p className="text-sm text-red-600">{editError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isUpdating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
                >
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
