import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { CREDIT_COLLECTIONS_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Credit & Collections | NIG Central' }

export default function CreditCollectionsPage() {
  return redirectToFirstPosTab(CREDIT_COLLECTIONS_HUB)
}
