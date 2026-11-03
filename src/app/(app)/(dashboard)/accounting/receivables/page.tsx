import { redirectToFirstHubTab } from '../_shared/hub-entry'
import { RECEIVABLES_HUB } from '../_shared/hubs'

export const metadata = { title: 'Receivables | NIG Central' }

export default function ReceivablesPage() {
  return redirectToFirstHubTab(RECEIVABLES_HUB)
}
