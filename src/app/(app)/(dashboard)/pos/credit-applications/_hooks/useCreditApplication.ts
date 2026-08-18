'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { showToast } from '@/src/components/ui/toast'
import { getCreditApplication } from '../_actions/get-application'
import { getCreditApplicationDocuments } from '../_actions/get-documents'
import { updateCreditApplication } from '../_actions/update-application'
import { submitCreditApplication } from '../_actions/submit-application'
import { cancelCreditApplication } from '../_actions/cancel-application'
import { attachCreditApplicationDocument } from '../_actions/attach-document'
import { removeCreditApplicationDocument } from '../_actions/remove-document'
import { startCreditInvestigation } from '../_actions/start-investigation'
import { recordCreditInvestigation } from '../_actions/record-investigation'
import { decideCreditApplicationItems } from '../_actions/decide-application'
import type {
  AttachCreditApplicationDocumentFormValues,
  CancelCreditApplicationFormValues,
  RecordCreditInvestigationFormValues,
  DecideCreditApplicationItemsFormValues,
  UpdateCreditApplicationFormValues,
} from '@/src/schema/credit/applications'

export function useCreditApplication(id: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const applicationQuery = useQuery({
    queryKey: ['credit-application', id],
    queryFn: () => getCreditApplication(id),
    staleTime: 15 * 1000,
    // Scenario 26 — same reasoning as useCreditApplications.ts's poll: this
    // page is exactly where a resolution notification's click-through
    // lands, so a stale status here (e.g. still showing
    // under_investigation after the Branch Manager already approved it in
    // another tab) directly undercuts the point of the notification.
    refetchInterval: 10 * 1000,
  })

  const documentsQuery = useQuery({
    queryKey: ['credit-application-documents', id],
    queryFn: () => getCreditApplicationDocuments(id),
    staleTime: 15 * 1000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['credit-application', id] })
    queryClient.invalidateQueries({ queryKey: ['credit-application-documents', id] })
    queryClient.invalidateQueries({ queryKey: ['credit-applications'] })
  }

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCreditApplicationFormValues) => updateCreditApplication(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Updated', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => submitCreditApplication(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Submitted', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (data: CancelCreditApplicationFormValues) => cancelCreditApplication(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Cancelled', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const attachMutation = useMutation({
    mutationFn: (data: AttachCreditApplicationDocumentFormValues) =>
      attachCreditApplicationDocument(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Document attached', status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const removeMutation = useMutation({
    mutationFn: (documentId: string) => removeCreditApplicationDocument(id, documentId),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Document removed', status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const startInvestigationMutation = useMutation({
    mutationFn: () => startCreditInvestigation(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Investigation started',
          description: result.message,
          status: 'success',
        })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const recordInvestigationMutation = useMutation({
    mutationFn: (data: RecordCreditInvestigationFormValues) => recordCreditInvestigation(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Investigation recorded',
          description: result.message,
          status: 'success',
        })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const decideMutation = useMutation({
    mutationFn: (data: DecideCreditApplicationItemsFormValues) =>
      decideCreditApplicationItems(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Decision recorded', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  return {
    application: applicationQuery.data?.data,
    isLoading: applicationQuery.isLoading,
    error: applicationQuery.error,

    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    documents: documentsQuery.data?.data ?? [],
    isDocumentsLoading: documentsQuery.isLoading,

    submit: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,

    cancel: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    attachDocument: attachMutation.mutateAsync,
    isAttaching: attachMutation.isPending,

    removeDocument: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,

    startInvestigation: startInvestigationMutation.mutateAsync,
    isStartingInvestigation: startInvestigationMutation.isPending,

    recordInvestigation: recordInvestigationMutation.mutateAsync,
    isRecordingInvestigation: recordInvestigationMutation.isPending,

    decideItems: decideMutation.mutateAsync,
    isDeciding: decideMutation.isPending,

    goToList: () => router.push('/pos/credit-applications'),
  }
}
