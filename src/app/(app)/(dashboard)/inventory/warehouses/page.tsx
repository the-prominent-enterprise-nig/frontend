import { redirect } from 'next/navigation'

// Warehouses moved beside the branches (Branches → Warehouses). The old
// address stays so bookmarks and links keep working.
export default function WarehousesPage() {
  redirect('/settings/branches?tab=warehouses')
}
