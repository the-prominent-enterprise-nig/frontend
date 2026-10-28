import { redirect } from 'next/navigation'

/**
 * Stock transfers live under Stock Transaction now. This old address only
 * forwards there, keeping its query (?transfer=, the prefill and Item 360
 * deep links) so bookmarks and older links still open the right transfer.
 */
export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<never> {
  const query = new URLSearchParams({ tab: 'transfers' })
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key === 'tab') continue
    for (const v of [value].flat()) if (v != null) query.append(key, v)
  }
  redirect(`/inventory/stock-transaction?${query.toString()}`)
}
