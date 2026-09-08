import ReceivingReportDetail from './_components/ReceivingReportDetail'

export const metadata = { title: 'Receiving Report' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ReceivingReportDetail id={id} />
    </div>
  )
}
