'use client'

import { discountChainLabel } from '@/src/libs/format/discount-chain'
import { locationLabel } from '@/src/libs/format/locationLabel'

/** Print/document envelope for one purchase order
 * (GET /procurement/purchase-orders/:id/document) — the order plus the
 * letterhead's enterprise block. Same shape buildPurchaseOrderHtml() (the
 * popup print/download builder) consumes, so this on-screen sheet and that
 * printed paper can never quietly disagree. */
export interface PurchaseOrderPrintDocument {
  documentNumber: string
  enterprise?: {
    companyLegalName?: string | null
    address?: string | null
  } | null
  document: {
    code: string
    orderDate: string
    totalAmount: number | string
    deliveryInstructions?: string | null
    shippingAddress?: string | null
    preparedByName?: string | null
    approvedByName?: string | null
    supplier?: { name?: string | null; address?: string | null; taxId?: string | null } | null
    warehouse?: {
      name: string
      address?: string | null
      branchId?: string | null
      branch?: { name?: string | null; addressLine1?: string | null; city?: string | null } | null
    } | null
    branch?: { name?: string | null; addressLine1?: string | null; city?: string | null } | null
    lines?: {
      id: string
      quantity: number | string
      unitPrice: number | string
      lineTotal?: number | string | null
      isFreebie?: boolean | null
      description?: string | null
      srp?: number | string | null
      discounts?: { name?: string | null; type: string; value: number }[] | null
      discountedCost?: number | string | null
      item?: { name?: string | null } | null
    }[]
  }
}

const TH = 'border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-center font-bold'
const TD = 'border border-gray-300 px-2.5 py-[7px] align-top'

function fmtPeso(n: number): string {
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })
}

function docDate(v: string | undefined | null): string {
  return v ? new Date(v).toLocaleDateString('en-PH') : '—'
}

function MetaPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <p className="font-bold text-prominent-purple-900">{label}</p>
      <p className="mb-3 text-gray-700">{value}</p>
    </>
  )
}

export default function PurchaseOrderSheet({ doc }: { doc: PurchaseOrderPrintDocument }) {
  const po = doc.document
  const enterprise = doc.enterprise
  const lines = po.lines ?? []
  const supplier = po.supplier

  // Same branch-over-warehouse preference as buildPurchaseOrderHtml() —
  // Warehouse.address is null for every warehouse in the data, while the
  // branch carries the real street address.
  const branch = po.warehouse?.branch ?? po.branch
  const destinationName = po.warehouse
    ? locationLabel(po.warehouse as Parameters<typeof locationLabel>[0], '')
    : ''
  const destinationAddress =
    po.warehouse?.address ||
    [branch?.addressLine1, branch?.city].filter(Boolean).join(', ') ||
    po.shippingAddress ||
    ''

  const total = Number(po.totalAmount ?? 0)

  return (
    <div className="bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-prominent-purple-900">Purchase Order</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nig-logo.png"
          alt="NIG Marketing"
          className="h-16 w-auto object-contain sm:h-20"
        />
      </div>

      <div className="mt-6 grid gap-7 md:grid-cols-3">
        <div>
          <p className="font-bold text-prominent-purple-900">{supplier?.name ?? '—'}</p>
          <p className="mt-1 text-gray-700">{supplier?.address || '—'}</p>
        </div>
        <div>
          <MetaPair label="Issue date" value={docDate(po.orderDate)} />
          <MetaPair label="Reference" value={po.code} />
          <MetaPair label="Payee's TIN" value={supplier?.taxId || '—'} />
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-7">
          <p className="font-bold text-prominent-purple-900">
            {enterprise?.companyLegalName ?? '—'}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-700">{enterprise?.address || '—'}</p>
        </div>
      </div>

      {(destinationName || destinationAddress || po.deliveryInstructions) && (
        <div className="mt-6">
          <p className="font-bold text-prominent-purple-900">
            Deliver to{destinationName ? ` ${destinationName}` : ''}
          </p>
          {destinationAddress && <p className="mt-0.5 text-gray-700">{destinationAddress}</p>}
          {po.deliveryInstructions && (
            <p className="mt-0.5 text-gray-700">{po.deliveryInstructions}</p>
          )}
        </div>
      )}

      <div className="mt-7 overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${TH} w-[32px]`}>#</th>
              <th className={TH}>Item</th>
              <th className={TH}>Description</th>
              <th className={`${TH} w-[8%]`}>Qty</th>
              <th className={`${TH} w-[13%]`}>Unit price</th>
              <th className={`${TH} w-[14%]`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const qty = Number(l.quantity ?? 0)
              const unitPrice = Number(l.unitPrice ?? 0)
              const lineTotal = Number(l.lineTotal ?? qty * unitPrice)
              const discountNote = discountChainLabel(l, fmtPeso)
              return (
                <tr key={l.id}>
                  <td className={`${TD} text-center`}>{i + 1}</td>
                  <td className={TD}>
                    {l.item?.name ?? '—'}
                    {l.isFreebie && ' (Freebie)'}
                    {discountNote && (
                      <p className="mt-0.5 text-[11px] text-gray-600">{discountNote}</p>
                    )}
                  </td>
                  <td className={TD}>{l.description || '—'}</td>
                  <td className={`${TD} text-right tabular-nums`}>{qty}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtPeso(unitPrice)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtPeso(lineTotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <table className="border-collapse text-[12.5px] font-bold">
          <tbody>
            <tr>
              <td className={`${TD} text-right`}>Total</td>
              <td className={`${TD} min-w-[120px] text-right tabular-nums`}>{fmtPeso(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <div className="max-w-xs">
          <p className="mb-8 font-bold text-prominent-purple-900">Prepared By:</p>
          <div className="border-b border-gray-700" />
          {po.preparedByName && (
            <p className="mt-1 text-[12px] text-gray-700">{po.preparedByName}</p>
          )}
        </div>
        <div className="max-w-xs">
          <p className="mb-8 font-bold text-prominent-purple-900">Approved by:</p>
          <div className="border-b border-gray-700" />
          {po.approvedByName && (
            <p className="mt-1 text-[12px] text-gray-700">{po.approvedByName}</p>
          )}
        </div>
      </div>
    </div>
  )
}
