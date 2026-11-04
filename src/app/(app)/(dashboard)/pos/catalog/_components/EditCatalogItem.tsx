'use client'

import EditItemModal from '../../../inventory/items/_components/EditItemModal'
import { useItemEditor } from '../../../inventory/items/_hooks/useItemEditor'
import { POS_CATALOG_KEY } from '../../_hooks/posCatalogQuery'

/**
 * Edit item, opened from a POS Product Catalog row — the Item Master's own
 * form (the Items tab moved out of Inventory → Catalog). Loads the full item
 * on open; a save refreshes the catalog. An item still under review is
 * refused by the server, which says so in the toast.
 */
export function EditCatalogItem({
  itemId,
  canReadAttributes,
  onClose,
}: {
  itemId: string | null
  canReadAttributes: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const editor = useItemEditor(itemId, [[POS_CATALOG_KEY]])
  if (!itemId) return null
  return (
    <EditItemModal
      isOpen={!!editor.item}
      item={editor.item}
      onClose={onClose}
      // The form closes itself once the item, its attributes and tags are saved.
      onSubmit={editor.update}
      isSubmitting={editor.isUpdating}
      categories={editor.categories}
      uomOptions={editor.uomOptions}
      onAttributeSubmit={editor.updateAttributes}
      isAttributeSubmitting={editor.isUpdatingAttributes}
      canReadAttributes={canReadAttributes}
      brandOptions={editor.brandOptions}
      typeOptions={editor.typeOptions}
    />
  )
}
