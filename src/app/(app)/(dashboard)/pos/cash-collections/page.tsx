import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { CASH_COLLECTIONS_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Cash & Collections | NIG Central' }

export default function CashCollectionsPage() {
  return redirectToFirstPosTab(CASH_COLLECTIONS_HUB)
}
