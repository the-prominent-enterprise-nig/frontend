'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { showToast } from '@/src/components/ui/toast'
import { getCreditApplication } from '../_actions/get-application'
import { getCreditApplicationDocuments } from '../_actions/get-documents'
import { submitCreditApplication } from '../_actions/submit-application'
import { cancelCreditApplication } from '../_actions/cancel-application'
import { attachCreditApplicationDocument } from '../_actions/attach-document'
import { removeCreditApplicationDocument } from '../_actions/remove-document'
import { startCreditInvestigation } from '../_actions/start-investigation'
import { recordCreditInvestigation } from '../_actions/record-investigation'
import { approveCreditApplication } from '../_actions/approve-application'
import { declineCreditApplication } from '../_actions/decline-application'
import type {
  AttachCreditApplicationDocumentFormValues,
  CancelCreditApplicationFormValues,
  RecordCreditInvestigationFormValues,
  DeclineCreditApplicationFormValues,
} from '@/src/schema/credit/applications'

export function useCreditApplication(id: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const applicationQuery = useQuery({
    queryKey: ['credit-application', id],
    queryFn: () => getCreditApplication(id),
    staleTime: 15 * 1000,
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

  const approveMutation = useMutation({
    mutationFn: () => approveCreditApplication(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Approved', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const declineMutation = useMutation({
    mutationFn: (data: DeclineCreditApplicationFormValues) => declineCreditApplication(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Declined', description: result.message, status: 'success' })
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

    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,

    decline: declineMutation.mutateAsync,
    isDeclining: declineMutation.isPending,

    goToList: () => router.push('/pos/credit-applications'),
  }
}
