import { redirect } from 'next/navigation'

// Same as goods-receiving/[id]: the receipt lives under the Stock module.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<never> {
  const { id } = await params
  redirect(`/inventory/stock/reports/returns/${id}`)
}
