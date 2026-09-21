'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { showToast } from '@/src/components/ui/toast'
import { createCreditApplication } from '../_actions/create-application'
import type { CreateCreditApplicationFormValues } from '@/src/schema/credit/applications'

/**
 * Create-only counterpart to useCreditApplications. The create flow is its
 * own route now (2026-09-18) rather than a modal over the queue, and pulling
 * in the queue hook there would also start its 10s polling query for a list
 * the page never renders.
 *
 * On success it lands the user on the application they just submitted, which
 * is where they attach documents and submit for investigation next.
 */
export function useCreateCreditApplication() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: CreateCreditApplicationFormValues) => createCreditApplication(data),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
        return
      }
      showToast({
        title: 'Credit application submitted',
        description: result.message,
        status: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['credit-applications'] })
      if (result.data?.id) {
        router.push(`/pos/credit-applications/${result.data.id}`)
      } else {
        router.push('/pos/credit-applications')
      }
    },
  })

  return {
    createApplication: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}
