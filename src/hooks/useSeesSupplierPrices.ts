import { useMe } from '@/src/hooks/useMe'
import { canSeeSupplierPrices } from '@/src/libs/guards/permission'

/** Whether the printable RR and PO show prices for the signed-in user:
 * Business Owner and Mabini's Branch Manager only. False until the session loads. */
export function useSeesSupplierPrices(): boolean {
  const { data: me } = useMe()
  return !!me && canSeeSupplierPrices(me)
}
