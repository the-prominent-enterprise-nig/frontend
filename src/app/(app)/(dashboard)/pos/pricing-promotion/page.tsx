import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { PRICING_PROMOTION_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Pricing & Promotion | NIG Central' }

export default function PricingPromotionPage() {
  return redirectToFirstPosTab(PRICING_PROMOTION_HUB)
}
