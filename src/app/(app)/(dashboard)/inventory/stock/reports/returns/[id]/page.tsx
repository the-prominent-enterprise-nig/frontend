import { CustomerReturnReceiptDetail } from '../../../../returns/_components/CustomerReturnReceiptDetail'

export const metadata = { title: 'Receiving Report' }

/** Ticket #27 — a Return row in Receiving Reports opens its RRC receipt here. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerReturnReceiptDetail id={id} />
    </div>
  )
}
