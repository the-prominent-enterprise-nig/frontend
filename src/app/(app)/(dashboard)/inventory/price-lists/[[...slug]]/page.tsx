import { redirect } from 'next/navigation'

// Price Lists moved under POS → Operations & Admin. This keeps old bookmarks and
// links to /inventory/price-lists, /inventory/price-lists/:id and the upload
// pages landing on the same screen at the new address.
export default async function LegacyPriceListsRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  redirect(`/pos/price-lists${slug?.length ? `/${slug.join('/')}` : ''}`)
}
