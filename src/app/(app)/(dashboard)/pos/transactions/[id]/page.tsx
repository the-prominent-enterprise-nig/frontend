import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

/** Ticket #24 — a transaction opens as a modal over the Transactions list
 * (NIG's mockup), so a link to its old page lands there with it open. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<never> {
  requirePermission(await getSessionOrNull(), POS_PERMISSIONS.TRANSACTIONS_READ)
  const { id } = await params
  redirect(`/pos/transactions?id=${encodeURIComponent(id)}`)
}
