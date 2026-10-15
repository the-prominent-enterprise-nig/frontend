import { redirectToFirstHubTab } from '../_shared/hub-entry'
import { EXPENSES_HUB } from '../_shared/hubs'

export const metadata = { title: 'Expenses | NIG Central' }

export default function ExpensesHubPage() {
  return redirectToFirstHubTab(EXPENSES_HUB)
}
