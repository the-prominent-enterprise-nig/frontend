import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { CASH_RECEIPTS_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Cash & Receipts | NIG Central' }

export default function CashReceiptsPage() {
  return redirectToFirstPosTab(CASH_RECEIPTS_HUB)
}
