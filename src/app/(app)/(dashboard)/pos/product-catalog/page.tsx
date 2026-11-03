import { redirectToFirstPosTab } from '../_shared/pos-hub-entry'
import { PRODUCT_CATALOG_HUB } from '../_shared/pos-hubs'

export const metadata = { title: 'Product Catalog | NIG Central' }

export default function ProductCatalogPage() {
  return redirectToFirstPosTab(PRODUCT_CATALOG_HUB)
}
