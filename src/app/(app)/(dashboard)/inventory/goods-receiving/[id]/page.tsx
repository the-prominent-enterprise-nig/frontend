import { redirect } from 'next/navigation'

// Receiving report detail now lives under the Stock module — this route
// only exists so old links/bookmarks still land somewhere.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/inventory/stock/reports/${id}`)
}
