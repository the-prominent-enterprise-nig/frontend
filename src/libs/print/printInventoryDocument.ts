export interface PrintDocumentEnvelope {
  documentType: string
  documentNumber: string
  generatedAt: string
  enterprise: {
    companyLegalName: string
    companyTradingName?: string
    registrationNumber?: string
    taxId?: string
    contactPerson?: string
    address?: string
  } | null
  document: Record<string, unknown>
}

/**
 * Shared print shell for inventory documents (goods receipts, transfers, etc).
 * Renders the enterprise header/meta block and hands off the document-type-
 * specific content to `renderBody`.
 */
export function printInventoryDocument(
  data: unknown,
  label: string,
  renderBody: (doc: PrintDocumentEnvelope) => string
): void {
  const doc = data as PrintDocumentEnvelope

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return

  win.document.write(`<!DOCTYPE html><html><head><title>${doc.documentNumber}</title><style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 12px; }
    .label { color: #888; font-size: 11px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 6px 8px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; }
    td { padding: 6px 8px; border-top: 1px solid #eee; }
    .footer { margin-top: 32px; font-size: 11px; color: #999; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
    <p class="label">${label}</p>
    <h1>${doc.documentNumber}</h1>
    <p style="font-size:12px;color:#666">Generated: ${new Date(doc.generatedAt).toLocaleString('en-PH')}</p>
    ${
      doc.enterprise
        ? `<h2>Enterprise</h2><div class="meta">
      <div><p class="label">Company</p><p>${doc.enterprise.companyLegalName}</p></div>
      ${doc.enterprise.companyTradingName ? `<div><p class="label">Trading Name</p><p>${doc.enterprise.companyTradingName}</p></div>` : ''}
      ${doc.enterprise.registrationNumber ? `<div><p class="label">Reg. No.</p><p>${doc.enterprise.registrationNumber}</p></div>` : ''}
      ${doc.enterprise.taxId ? `<div><p class="label">Tax ID</p><p>${doc.enterprise.taxId}</p></div>` : ''}
      ${doc.enterprise.contactPerson ? `<div><p class="label">Contact</p><p>${doc.enterprise.contactPerson}</p></div>` : ''}
    </div>`
        : ''
    }
    ${renderBody(doc)}
    <button onclick="window.print()" style="margin:12px 0;padding:6px 16px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`)
  win.document.close()
}

/**
 * Purpose-built layout for the Receiving Report print/download — replicates
 * NIG's pre-printed paper Receiving Report pad (ruled ledger table with a
 * Brand/Model/Type description block) rather than reusing
 * printInventoryDocument()'s generic "Enterprise" meta-grid shell.
 */
export function printReceivingReportDocument(data: unknown): void {
  const doc = data as PrintDocumentEnvelope
  const rr = doc.document as Record<string, unknown>
  const supplier = rr.supplier as { name?: string } | undefined
  const warehouse = rr.warehouse as { name?: string; branch?: { name?: string } | null } | undefined
  const lines = Array.isArray(rr.lines) ? (rr.lines as Record<string, unknown>[]) : []

  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-PH') : '')
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

  const ref = (rr.deliveryReceiptNumber ?? rr.supplierInvoiceNumber ?? '') as string

  let totalQty = 0
  let totalAmount = 0
  let hasAnyCost = false

  const rows = lines
    .map((l) => {
      const item = l.item as
        | {
            name?: string
            modelNumber?: string
            brand?: { name?: string }
            type?: { name?: string }
          }
        | undefined
      const serials = (l.serialNumbers as string[] | undefined) ?? []
      const qty = Number(l.quantityReceived ?? 0)
      const unitCost = l.unitCost != null ? Number(l.unitCost) : null
      totalQty += qty
      if (unitCost != null) {
        hasAnyCost = true
        totalAmount += qty * unitCost
      }
      return `<tr>
        <td class="mono">${serials.length > 0 ? esc(serials.join(', ')) : ''}</td>
        <td>${esc(item?.brand?.name) || ''}</td>
        <td>${esc(item?.modelNumber) || esc(item?.name) || ''}</td>
        <td>${esc(item?.type?.name) || ''}</td>
        <td class="right">${qty}</td>
        <td class="right">${unitCost != null ? fmt(unitCost) : ''}</td>
        <td class="right">${unitCost != null ? fmt(qty * unitCost) : ''}</td>
      </tr>`
    })
    .join('')

  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) return

  win.document.write(`<!DOCTYPE html><html><head><title>${esc(doc.documentNumber)}</title><style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 4px; }
    .brand-logo { height: 56px; width: auto; object-fit: contain; }
    .doc-title { text-align: center; flex: 1; }
    .doc-title h1 { font-size: 20px; letter-spacing: 2px; margin: 0; }
    .doc-no { text-align: right; font-size: 13px; }
    .doc-no .no { font-weight: 700; font-size: 15px; }
    .fields { border-bottom: 3px solid #111; padding: 10px 0 12px; margin-bottom: 0; }
    .field-row { display: flex; gap: 24px; margin: 3px 0; }
    .field-row > div { flex: 1; }
    .field-label { font-weight: 700; }
    .field-value { border-bottom: 1px solid #999; display: inline-block; min-width: 220px; padding-bottom: 1px; }
    table { width: 100%; border-collapse: collapse; margin-top: 0; }
    th, td { border: 1px solid #333; padding: 6px 8px; font-size: 12.5px; }
    thead th { background: #f2f2f2; text-align: center; font-weight: 700; }
    td.right, th.right { text-align: right; }
    td.mono { font-family: "Courier New", monospace; }
    tbody tr td { height: 26px; }
    .filler-row td { border-left: 1px solid #333; border-right: 1px solid #333; border-bottom: none; }
    .footer-row { display: flex; border: 1px solid #333; border-top: none; }
    .footer-row > div { padding: 8px 10px; }
    .footer-branch { flex: 1; border-right: 1px solid #333; }
    .footer-total { width: 160px; border-right: 1px solid #333; display: flex; align-items: center; gap: 8px; }
    .footer-total .value { font-weight: 700; }
    .footer-receivedby { width: 220px; }
    .footer-label { font-weight: 700; margin-right: 6px; }
    .footer-value { border-bottom: 1px solid #999; display: inline-block; min-width: 90px; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
    <div class="top">
      <img class="brand-logo" src="${window.location.origin}/nig-logo.png" alt="NIG logo" />
      <div class="doc-title"><h1>RECEIVING REPORT</h1></div>
      <div class="doc-no">
        <p class="no">No. ${esc(doc.documentNumber)}</p>
        <p>Date: ${fmtDate(rr.receivedAt)}</p>
      </div>
    </div>

    <div class="fields">
      <div class="field-row">
        <div><span class="field-label">Received from:</span> <span class="field-value">${esc(supplier?.name) || '&nbsp;'}</span></div>
        <div><span class="field-label">Driver/Helper:</span> <span class="field-value">&nbsp;</span></div>
      </div>
      <div class="field-row">
        <div><span class="field-label">Ref:</span> <span class="field-value">${esc(ref) || '&nbsp;'}</span></div>
        <div><span class="field-label">Dated:</span> <span class="field-value">&nbsp;</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width:14%">PART NO. / Serial No.</th>
          <th colspan="3">DESCRIPTION</th>
          <th rowspan="2" style="width:8%">QTY.</th>
          <th rowspan="2" style="width:12%">UNIT PRICE</th>
          <th rowspan="2" style="width:14%">AMOUNT</th>
        </tr>
        <tr>
          <th>BRAND</th>
          <th>MODEL</th>
          <th>TYPE</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${Array.from({ length: Math.max(0, 4 - lines.length) })
          .map(
            () =>
              '<tr class="filler-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
          )
          .join('')}
      </tbody>
    </table>
    <div class="footer-row">
      <div class="footer-branch"><span class="footer-label">BRANCH</span> ${esc(warehouse?.branch?.name ?? warehouse?.name) || ''}</div>
      <div class="footer-total"><span class="footer-label">TOTAL</span> <span class="value">${totalQty}</span>${hasAnyCost ? `<span class="value">₱${fmt(totalAmount)}</span>` : ''}</div>
      <div class="footer-receivedby"><span class="footer-label">RECEIVED BY:</span> <span class="footer-value">${esc((rr.receivedByName as string | null) ?? '') || '&nbsp;'}</span></div>
    </div>

    <button onclick="window.print()" style="margin:16px 0;padding:6px 16px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`)
  win.document.close()
}

/**
 * Purpose-built letterhead layout for the Purchase Order print/download —
 * doesn't reuse printInventoryDocument()'s generic "Enterprise" meta-grid
 * shell, since a PO needs its own two-party (supplier + enterprise) header,
 * a delivery note, and signature blocks that don't fit that shared shape.
 */
export function printPurchaseOrderDocument(
  data: unknown,
  // Purchase order lines don't carry their received serial numbers
  // themselves (those live on the goods receipt) — pass in a
  // purchaseOrderLineId -> serials map (see get-purchase-order-receipts.ts)
  // once the PO is closed, so a fully-received PO's printout can show them.
  serialsByLineId?: Record<string, string[]>
): void {
  const doc = data as PrintDocumentEnvelope
  const po = doc.document as Record<string, unknown>
  const supplier = po.supplier as { name?: string; address?: string; taxId?: string } | undefined
  const lines = Array.isArray(po.lines) ? (po.lines as Record<string, unknown>[]) : []
  const enterprise = doc.enterprise

  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })
  const fmtDate = (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-PH') : '—')
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

  const rows = lines
    .map((l, i) => {
      const item = l.item as { name?: string } | undefined
      const qty = Number(l.quantity ?? 0)
      const unitPrice = Number(l.unitPrice ?? 0)
      const lineTotal = Number(l.lineTotal ?? qty * unitPrice)
      const name = l.isFreebie ? `${item?.name ?? '—'} (Freebie)` : (item?.name ?? '—')
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(name)}</td>
        <td>${esc(l.description) || '—'}</td>
        <td class="right">${qty}</td>
        <td class="right">${fmt(unitPrice)}</td>
        <td class="right">${fmt(lineTotal)}</td>
      </tr>`
    })
    .join('')

  // Page 2 — a per-unit list a receiver can check against the physical
  // delivery. One header row per item (numbered, bold), then one
  // unnumbered row per serial underneath it — not a flat list repeating
  // the item name on every row.
  const serialRows = lines
    .map((l) => {
      const item = l.item as { name?: string } | undefined
      return { itemName: item?.name ?? '—', serials: serialsByLineId?.[String(l.id)] ?? [] }
    })
    .filter((g) => g.serials.length > 0)
    .map((g, i) => {
      const header = `<tr>
        <td class="num">${i + 1}</td>
        <td class="item-name">${esc(g.itemName)}</td>
      </tr>`
      const serialLines = g.serials
        .map(
          (sn) => `<tr>
        <td class="num"></td>
        <td class="mono">${esc(sn)}</td>
      </tr>`
        )
        .join('')
      return header + serialLines
    })
    .join('')

  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) return

  win.document.write(`<!DOCTYPE html><html><head><title>${esc(doc.documentNumber)}</title><style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
    h1 { font-size: 26px; margin: 0; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .brand-logo { height: 64px; width: auto; object-fit: contain; }
    .info { display: flex; gap: 28px; margin-bottom: 20px; }
    .info > div { flex: 1; }
    .info .enterprise { border-left: 1px solid #ccc; padding-left: 28px; }
    .party-name { font-weight: 700; margin: 0 0 4px; }
    .party-address { margin: 0; color: #333; }
    .meta-label { font-weight: 700; margin: 0 0 2px; }
    .meta-value { margin: 0 0 12px; }
    .delivery-note { font-weight: 700; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 7px 10px; font-size: 12.5px; }
    th { background: #f5f5f5; text-align: left; font-weight: 700; }
    td.num, th.num { text-align: center; width: 32px; }
    td.right, th.right { text-align: right; }
    .total-wrap { display: flex; justify-content: flex-end; margin-top: 0; }
    .total-wrap table { width: auto; margin-top: 0; }
    .total-wrap td { font-weight: 700; }
    .total-wrap td.label { text-align: right; }
    .total-wrap td.value { text-align: right; min-width: 120px; }
    .signatures { margin-top: 56px; }
    .sig-block { margin-bottom: 40px; }
    .sig-label { font-weight: 700; margin: 0 0 32px; }
    .sig-line { border-bottom: 1px solid #333; width: 260px; }
    .sig-name { margin: 4px 0 0; font-size: 12px; color: #333; }
    .page-break { page-break-before: always; break-before: page; padding-top: 32px; }
    .mono { font-family: "Courier New", monospace; }
    .item-name { font-weight: 700; }
    .sn-table thead { display: table-header-group; }
    .sn-table tr { break-inside: avoid; }
    @media print { body { padding: 0; } .page-break { padding-top: 0; } button { display: none; } }
  </style></head><body>
    <div class="top">
      <h1>Purchase Order</h1>
      <img class="brand-logo" src="${window.location.origin}/nig-logo.png" alt="NIG logo" />
    </div>

    <div class="info">
      <div class="supplier">
        <p class="party-name">${esc(supplier?.name)}</p>
        <p class="party-address">${esc(supplier?.address) || '—'}</p>
      </div>
      <div class="meta">
        <p class="meta-label">Issue date</p>
        <p class="meta-value">${fmtDate(po.orderDate)}</p>
        <p class="meta-label">Reference</p>
        <p class="meta-value">${esc(po.code)}</p>
        <p class="meta-label">PAYEE'S TIN:</p>
        <p class="meta-value">${esc(supplier?.taxId) || '—'}</p>
      </div>
      <div class="enterprise">
        <p class="party-name">${esc(enterprise?.companyLegalName)}</p>
        <p class="party-address">${esc(enterprise?.address) || '—'}</p>
      </div>
    </div>

    ${
      po.deliveryInstructions
        ? `<p class="delivery-note">Please deliver to ${esc(po.deliveryInstructions)}.</p>`
        : ''
    }

    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Item</th>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="total-wrap">
      <table>
        <tr><td class="label">Total</td><td class="value">${fmt(Number(po.totalAmount ?? 0))}</td></tr>
      </table>
    </div>

    <div class="signatures">
      <div class="sig-block">
        <p class="sig-label">Prepared By:</p>
        <div class="sig-line"></div>
        ${po.preparedByName ? `<p class="sig-name">${esc(po.preparedByName)}</p>` : ''}
      </div>
      <div class="sig-block">
        <p class="sig-label">Approved by:</p>
        <div class="sig-line"></div>
        ${po.approvedByName ? `<p class="sig-name">${esc(po.approvedByName)}</p>` : ''}
      </div>
    </div>

    ${
      serialRows
        ? `<div class="page-break">
      <h1>Serial Numbers Received</h1>
      <p class="party-address" style="margin: 4px 0 16px">${esc(po.code)} — check off each unit against the physical delivery.</p>
      <table class="sn-table">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Item / Serial Number</th>
          </tr>
        </thead>
        <tbody>${serialRows}</tbody>
      </table>
    </div>`
        : ''
    }

    <button onclick="window.print()" style="margin:12px 0;padding:6px 16px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`)
  win.document.close()
}
