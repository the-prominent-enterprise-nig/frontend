import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { getSupplierById } from '../_actions/get-supplier-by-id'
import { formatStatus, getOnboardingColor, getStatusColor, formatCurrency } from '../_utils'

interface PageProps {
  params: Promise<{ supplierId: string }>
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.SUPPLIERS_READ)) redirect('/403')

  const { supplierId } = await params
  const { data: supplier, success } = await getSupplierById(supplierId)
  if (!success || !supplier) notFound()

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/procurement/suppliers"
          className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to suppliers
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-gray-500">{supplier.code}</span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${getStatusColor(supplier.status)}`}
                >
                  {formatStatus(supplier.status)}
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${getOnboardingColor(supplier.onboardingStatus)}`}
                >
                  {formatStatus(supplier.onboardingStatus)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
              {supplier.legalName && (
                <p className="text-sm text-gray-500 mt-1">{supplier.legalName}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Payment terms</p>
              <p className="font-medium text-gray-900">{supplier.paymentTerms}</p>
              <p className="text-xs text-gray-500 mt-1 font-mono">{supplier.currency}</p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailCard title="Contact">
            <DetailRow label="Contact person" value={supplier.contactPerson} />
            <DetailRow label="Email" value={supplier.email} />
            <DetailRow label="Phone" value={supplier.phone} />
            <DetailRow label="Address" value={supplier.address} />
          </DetailCard>

          <DetailCard title="Tax & Banking">
            <DetailRow label="Tax ID" value={supplier.taxId} />
            <DetailRow
              label="Credit limit"
              value={formatCurrency(supplier.creditLimit ?? null, supplier.currency)}
            />
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Bank accounts ({supplier.bankAccounts?.length ?? 0})
              </p>
              {!supplier.bankAccounts || supplier.bankAccounts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No bank accounts on file.</p>
              ) : (
                <ul className="space-y-2">
                  {supplier.bankAccounts.map((bank) => (
                    <li
                      key={bank.id}
                      className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{bank.bankName}</p>
                        {bank.isPrimary && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{bank.accountNumber}</p>
                      {bank.accountName && (
                        <p className="text-xs text-gray-500 mt-0.5">{bank.accountName}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DetailCard>

          <DetailCard title="Terms" wide>
            <DetailRow label="Payment terms" value={supplier.paymentTerms} />
            <DetailRow label="Discount terms" value={supplier.discountTerms} />
            {supplier.notes && <DetailRow label="Notes" value={supplier.notes} />}
          </DetailCard>

          <DetailCard title={`Documents (${supplier.documents?.length ?? 0})`} wide>
            {!supplier.documents || supplier.documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No documents attached yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {supplier.documents.map((doc) => {
                  const expired = doc.expiryDate && new Date(doc.expiryDate).getTime() < Date.now()
                  return (
                    <li
                      key={doc.id}
                      className="py-3 flex items-center justify-between flex-wrap gap-2"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {formatStatus(doc.documentType)}
                          {doc.isMandatory && <span className="ml-2 text-amber-600">Required</span>}
                        </p>
                      </div>
                      {doc.expiryDate && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md border ${
                            expired
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {expired ? 'Expired' : 'Expires'}{' '}
                          {new Date(doc.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

function DetailCard({
  title,
  children,
  wide,
}: {
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-6 ${wide ? 'md:col-span-2' : ''}`}
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value || '—'}</span>
    </div>
  )
}
