'use client'

import { X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTransaction } from '../../_actions/pos-actions'
import { TransactionDetail } from '../../_components/TransactionDetail'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { type SessionUser, can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

interface Props {
  id: string
  session: SessionUser
  onClose: () => void
}

/** Ticket #24 — one transaction, opened as a modal over the Transactions list
 * (NIG's mockup), so the list and its filters stay just as they were behind
 * it. Opened from a row, or from a /pos/transactions?id= link. */
export default function TransactionModal({ id, session, onClose }: Props): React.JSX.Element {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['pos-transaction', id],
    queryFn: () => getTransaction(id),
    staleTime: 60 * 1000,
  })

  if (isLoading || !data?.success || !data.data) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Transaction"
            data-testid="transaction-modal"
            className="pointer-events-auto relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute z-10 right-6 top-6 text-gray-400 hover:text-gray-700 sm:right-8 sm:top-8"
            >
              <X size={18} />
            </button>
            {isLoading ? (
              <div className="space-y-4" aria-label="Loading transaction">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-gray-500">
                {data?.error ?? 'This transaction could not be found.'}
              </p>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <TransactionDetail
      variant="full"
      transaction={data.data}
      session={session}
      canRefund={can(session, POS_PERMISSIONS.TRANSACTIONS_CREATE)}
      onClose={onClose}
      onRefunded={() => queryClient.invalidateQueries({ queryKey: ['pos-transactions'] })}
    />
  )
}
