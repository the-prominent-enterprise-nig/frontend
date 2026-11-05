'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTransaction } from '../../_actions/pos-actions'
import { TransactionDetail } from '../../_components/TransactionDetail'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { type SessionUser, can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

interface Props {
  id: string
  session: SessionUser
}

/** Ticket #24 — one transaction on its own page (it used to open as a modal
 * over the list), so a Sales Admin Clerk can link to it, open it in a new tab
 * and keep the list where it was. */
export default function TransactionPage({ id, session }: Props): React.JSX.Element {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['pos-transaction', id],
    queryFn: () => getTransaction(id),
    staleTime: 60 * 1000,
  })

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      {isLoading ? (
        <div className="space-y-4" aria-label="Loading transaction">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : !data?.success || !data.data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-16 text-gray-500 shadow-sm">
          <p className="text-sm">{data?.error ?? 'This transaction could not be found.'}</p>
          <Link
            href="/pos/transactions"
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            Back to Transactions
          </Link>
        </div>
      ) : (
        <TransactionDetail
          variant="page"
          transaction={data.data}
          session={session}
          canRefund={can(session, POS_PERMISSIONS.TRANSACTIONS_CREATE)}
          onClose={() => router.push('/pos/transactions')}
          onRefunded={() => queryClient.invalidateQueries({ queryKey: ['pos-transactions'] })}
        />
      )}
    </div>
  )
}
