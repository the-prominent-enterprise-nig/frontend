import { redirectToFirstHubTab } from '../_shared/hub-entry'
import { CASH_BANKING_HUB } from '../_shared/hubs'

export const metadata = { title: 'Cash & Banking | NIG Central' }

export default function CashBankingPage() {
  return redirectToFirstHubTab(CASH_BANKING_HUB)
}
