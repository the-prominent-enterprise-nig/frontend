import { redirectToFirstHubTab } from '../_shared/hub-entry'
import { PAYABLES_HUB } from '../_shared/hubs'

export const metadata = { title: 'Payables | NIG Central' }

export default function PayablesPage() {
  return redirectToFirstHubTab(PAYABLES_HUB)
}
