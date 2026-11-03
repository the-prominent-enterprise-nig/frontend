import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { REPORTS_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Reports | NIG Central' }

export default function ReportsPage() {
  return redirectToFirstPosTab(REPORTS_HUB)
}
