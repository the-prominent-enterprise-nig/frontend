import { EmployeeDetailShell } from '../_components/details'

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { employeeId } = await params
  return <EmployeeDetailShell id={employeeId} />
}
