export const metadata = {
  title: 'Sales & Orders - Prominent Enterprise',
  description: 'Manage B2B sales, orders, deliveries, invoices and customer relationships',
}

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <section className="min-h-full">{children}</section>
}
