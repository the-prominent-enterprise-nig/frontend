import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { APPROVALS_REVIEWS_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Approvals & Reviews | NIG Central' }

export default function ApprovalsReviewsPage() {
  return redirectToFirstPosTab(APPROVALS_REVIEWS_HUB)
}
