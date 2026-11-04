import { redirect } from 'next/navigation'

// Data Query Center moved to the Reports module.
export default function AccountingQueryCenterRedirect() {
  redirect('/reports/query-center')
}
