'use client'

/** Print/document envelope for one goods receipt
 * (GET /reports/receiving-reports/:id/document) — the receipt plus the
 * letterhead's enterprise block and the resolved receiver/branch names.
 * Same shape the AP Bill and AR Invoice documents use. */
export interface ReceivingReportDocument {
  documentType: string
  documentNumber: string | null
  generatedAt: string
  enterprise?: {
    companyLegalName?: string | null
    companyTradingName?: string | null
    address?: string | null
    taxId?: string | null
  } | null
  document: {
    id: string
    code: string
    receivedAt: string
    receivedByName?: string | null
    supplier?: { name?: string | null } | null
    warehouse?: { name?: string | null; branch?: { name?: string | null } | null } | null
    purchaseOrderNumber?: string | null
    deliveryReceiptNumber?: string | null
    supplierInvoiceNumber?: string | null
    lines?: {
      id: string
      quantityReceived: number | string
      unitCost?: number | string | null
      isFreebie?: boolean
      serialNumbers?: string[] | null
      item?: {
        name?: string | null
        modelNumber?: string | null
        brand?: { name?: string | null } | null
        type?: { name?: string | null } | null
      } | null
    }[]
  }
}

// Same cell chrome as buildReceivingReportHtml()'s `th, td { border: 1px
// solid #ccc }` so the on-screen document and the printed one read as the
// same paper — the layout APBillDetail already uses for the Purchase
// Invoice. The sheet carries exactly what that builder prints, nothing
// more: anything the paper doesn't say belongs outside it.
const TH = 'border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-center font-bold'
const TD = 'border border-gray-300 px-2.5 py-[7px] align-top'

/** Plain 2-decimal amounts, no currency mark — what the printed receiving
 * report shows (unlike the invoices, which print ₱). */
function fmtAmount(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** en-PH numeric date (09/02/2026) — the format the printed document uses. */
function docDate(v: string | Date | undefined | null): string {
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

export default function ReceivingReportSheet({ doc }: { doc: ReceivingReportDocument }) {
  const rr = doc.document
  const enterprise = doc.enterprise
  const lines = rr.lines ?? []

  // The print builder's own running totals: units always, money only when
  // at least one line carries a cost (a transfer-sourced receipt has none).
  let totalQty = 0
  let totalAmount = 0
  let hasAnyCost = false
  for (const l of lines) {
    const qty = Number(l.quantityReceived ?? 0)
    totalQty += qty
    if (l.unitCost != null) {
      hasAnyCost = true
      totalAmount += qty * Number(l.unitCost)
    }
  }

  return (
    <div className="bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-prominent-purple-900">Receiving Report</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nig-logo.png"
          alt="NIG Marketing"
          className="h-16 w-auto object-contain sm:h-20"
        />
      </div>

      <div className="mt-6 grid gap-7 md:grid-cols-3">
        <div>
          <p className="font-bold text-prominent-purple-900">{rr.supplier?.name ?? '—'}</p>
          <p className="mt-1 text-gray-700">Driver/Helper: —</p>
        </div>
        <div className="text-right">
          <MetaPair label="No." value={doc.documentNumber ?? rr.code} />
          <MetaPair label="Date" value={docDate(rr.receivedAt)} />
          <MetaPair
            label="Ref"
            value={rr.deliveryReceiptNumber || rr.supplierInvoiceNumber || '—'}
          />
          <MetaPair label="Dated" value="—" />
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-7">
          <p className="font-bold text-prominent-purple-900">
            {enterprise?.companyLegalName ?? '—'}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-700">{enterprise?.address || '—'}</p>
          <p className="mt-1 text-gray-700">
            Branch: {rr.warehouse?.branch?.name ?? rr.warehouse?.name ?? '—'}
          </p>
        </div>
      </div>

      <div className="mt-7 overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th rowSpan={2} className={`${TH} w-[14%]`}>
                Part No. / Serial No.
              </th>
              <th colSpan={3} className={TH}>
                Description
              </th>
              <th rowSpan={2} className={`${TH} w-[8%]`}>
                Qty
              </th>
              <th rowSpan={2} className={`${TH} w-[12%]`}>
                Unit price
              </th>
              <th rowSpan={2} className={`${TH} w-[14%]`}>
                Amount
              </th>
            </tr>
            <tr>
              <th className={TH}>Brand</th>
              <th className={TH}>Model</th>
              <th className={TH}>Type</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const qty = Number(l.quantityReceived ?? 0)
              const unitCost = l.unitCost != null ? Number(l.unitCost) : null
              return (
                <tr key={l.id}>
                  <td className={`${TD} font-mono`}>{(l.serialNumbers ?? []).join(', ')}</td>
                  <td className={TD}>{l.item?.brand?.name ?? ''}</td>
                  <td className={TD}>{l.item?.modelNumber || l.item?.name || ''}</td>
                  <td className={TD}>{l.item?.type?.name ?? ''}</td>
                  <td className={`${TD} text-right tabular-nums`}>{qty}</td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {unitCost != null ? fmtAmount(unitCost) : ''}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {unitCost != null ? fmtAmount(qty * unitCost) : ''}
                  </td>
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
              <td className={`${TD} min-w-[120px] text-right tabular-nums`}>
                {totalQty} unit{totalQty === 1 ? '' : 's'}
                {hasAnyCost ? ` — ${fmtAmount(totalAmount)}` : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-10 max-w-xs">
        <p className="mb-8 font-bold text-prominent-purple-900">Received by:</p>
        <div className="border-b border-gray-700" />
        {rr.receivedByName && <p className="mt-1 text-[12px] text-gray-700">{rr.receivedByName}</p>}
      </div>
    </div>
  )
}
