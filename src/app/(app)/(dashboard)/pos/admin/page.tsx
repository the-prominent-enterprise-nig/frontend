import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { OPERATIONS_ADMIN_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Operations & Admin | NIG Central' }

export default function OperationsAdminPage() {
  return redirectToFirstPosTab(OPERATIONS_ADMIN_HUB)
}
