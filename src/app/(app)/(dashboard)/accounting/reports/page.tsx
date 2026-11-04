import { redirect } from 'next/navigation'

// Reports moved to its own module (/reports). Old links and bookmarks —
// including ?tab=customer-statement&customerId=… — land on the same report.
export default async function AccountingReportsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v)
  }
  const qs = params.toString()
  redirect(qs ? `/reports?${qs}` : '/reports')
}
