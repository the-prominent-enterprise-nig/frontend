'use client'

import { useRequirePermission } from '@/src/libs/guards/useRequirePermission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { ProductCatalog } from './_components/ProductCatalog'

export default function PosCatalogPage() {
  const { session, status } = useRequirePermission(POS_PERMISSIONS.TRANSACTIONS_READ)
  const { branchId, branchName } = usePosBranchContext()

  if (status !== 'authorized' || !session) return null

  return <ProductCatalog session={session} branchId={branchId} branchName={branchName} />
}
