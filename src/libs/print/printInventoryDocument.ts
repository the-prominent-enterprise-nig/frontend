import type { InstallmentLedger } from '@/src/schema/crm/types'

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
 * Builds the Receiving Report document as a standalone HTML string — same
 * typographic system as printPurchaseOrderDocument() below (title left /
 * logo right, stacked label-over-value meta columns, light #ccc-bordered
 * table) so the two lettered documents read as one family, rather than the
 * earlier version's pre-printed-pad look (underlined fill-in blanks, heavy
 * ruled borders). Kept separate from printReceivingReportDocument() so a
 * preview (e.g. an iframe) can render the exact same markup without opening
 * a popup window.
 */
export function buildReceivingReportHtml(data: unknown): string {
  const doc = data as PrintDocumentEnvelope
  const rr = doc.document as Record<string, unknown>
  const supplier = rr.supplier as { name?: string } | undefined
  const warehouse = rr.warehouse as { name?: string; branch?: { name?: string } | null } | undefined
  const enterprise = doc.enterprise
  const lines = Array.isArray(rr.lines) ? (rr.lines as Record<string, unknown>[]) : []

  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-PH') : '—')
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

  return `<!DOCTYPE html><html><head><title>${esc(doc.documentNumber)}</title><style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
    h1 { font-size: 26px; margin: 0; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .brand-logo { height: 160px; width: auto; object-fit: contain; }
    .info { display: flex; gap: 28px; margin-bottom: 20px; }
    .info > div { flex: 1; }
    .info .enterprise { border-left: 1px solid #ccc; padding-left: 28px; }
    .party-name { font-weight: 700; margin: 0 0 4px; }
    .party-address { margin: 0; color: #333; }
    .meta-label { font-weight: 700; margin: 0 0 2px; }
    .meta-value { margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 7px 10px; font-size: 12.5px; }
    thead th { background: #f5f5f5; text-align: center; font-weight: 700; }
    td.right, th.right { text-align: right; }
    td.mono { font-family: "Courier New", monospace; }
    .total-wrap { display: flex; justify-content: flex-end; margin-top: 12px; }
    .total-wrap table { width: auto; }
    .total-wrap td { font-weight: 700; }
    .total-wrap td.label { text-align: right; }
    .total-wrap td.value { text-align: right; min-width: 120px; }
    .signatures { margin-top: 40px; display: flex; gap: 56px; }
    .sig-block { flex: 1; }
    .sig-label { font-weight: 700; margin: 0 0 32px; }
    .sig-line { border-bottom: 1px solid #333; }
    .sig-name { margin: 4px 0 0; font-size: 12px; color: #333; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
    <div class="top">
      <h1>Receiving Report</h1>
      <img class="brand-logo" src="${window.location.origin}/nig-logo.png" alt="NIG logo" />
    </div>

    <div class="info">
      <div class="party">
        <p class="party-name">${esc(supplier?.name) || '—'}</p>
        <p class="party-address">Driver/Helper: —</p>
      </div>
      <div class="meta">
        <p class="meta-label">No.</p>
        <p class="meta-value">${esc(doc.documentNumber)}</p>
        <p class="meta-label">Date</p>
        <p class="meta-value">${fmtDate(rr.receivedAt)}</p>
        <p class="meta-label">Ref</p>
        <p class="meta-value">${esc(ref) || '—'}</p>
        <p class="meta-label">Dated</p>
        <p class="meta-value">—</p>
      </div>
      <div class="enterprise">
        <p class="party-name">${esc(enterprise?.companyLegalName)}</p>
        <p class="party-address">${esc(enterprise?.address) || '—'}</p>
        <p class="party-address">Branch: ${esc(warehouse?.branch?.name ?? warehouse?.name) || '—'}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width:14%">Part No. / Serial No.</th>
          <th colspan="3">Description</th>
          <th rowspan="2" style="width:8%">Qty</th>
          <th rowspan="2" style="width:12%">Unit price</th>
          <th rowspan="2" style="width:14%">Amount</th>
        </tr>
        <tr>
          <th>Brand</th>
          <th>Model</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="total-wrap">
      <table>
        <tr>
          <td class="label">Total</td>
          <td class="value">${totalQty} unit${totalQty === 1 ? '' : 's'}${hasAnyCost ? ` — ${fmt(totalAmount)}` : ''}</td>
        </tr>
      </table>
    </div>

    <div class="signatures">
      <div class="sig-block">
        <p class="sig-label">Received by:</p>
        <div class="sig-line"></div>
        ${rr.receivedByName ? `<p class="sig-name">${esc(rr.receivedByName)}</p>` : ''}
      </div>
    </div>

    <button onclick="window.print()" style="margin:16px 0;padding:6px 16px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`
}

export function printReceivingReportDocument(data: unknown): void {
  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) return
  win.document.write(buildReceivingReportHtml(data))
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
    .brand-logo { height: 160px; width: auto; object-fit: contain; }
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

/**
 * Bespoke print layout for the Customer Ledger (developer-requested,
 * 2026-08-27, format-matched 2026-08-27 against a photo of the client's
 * actual paper "Customer Ledger" form) — doesn't reuse
 * printInventoryDocument()'s generic Enterprise shell since there's no
 * server-side document envelope for this view (the ledger is already fully
 * loaded client-side via installmentAccountsApi.getLedger()).
 *
 * Reproduces the paper form's own grid-of-boxed-cells layout (value on top,
 * small caps label underneath, thin borders around every cell) rather than
 * the label-above-value meta style the rest of this file's documents use —
 * this one specific document is meant to visually match that paper form.
 * "NIG Marketing Corporation" is hardcoded as the letterhead since this
 * layout only exists to match that one client's form; not reusable as a
 * generic multi-tenant letterhead.
 *
 * Field groups, in the paper form's own row order — 1-6 are the bordered
 * grid (table.form-grid), always exactly 4 columns wide per row (row 1's
 * Sales Invoice No./SI Date share one cell precisely so it doesn't become
 * a 5th column and throw off every other row's alignment); 7-9 are plain
 * italic "Label : value" lines below the grid instead of more boxed cells
 * — mixing those into the bordered table was what made the grid
 * misalign in the first place, and doesn't match the paper form anyway:
 *   1. Lastname / Firstname / Middle / (Sales Invoice No. + SI Date)
 *   2. Brand / Type / Model / Serial
 *   3. Agent / Unit Manager / Collector / FMI
 *   4. LCP / Down / Amt. Financed / Inst. Diff.
 *   5. Scheme (the paper form's "WIP") / MI / Term / Branch
 *   6. PN / IC / Total Price
 *   7. Total Payments / Total Penalty / Penalty Balance (column 1)
 *   8. Total Rebates / Total Billing / Required DP (column 2)
 *   9. DP Balance / Tot. Amt. Due / Tot. Amt. Out (column 3)
 * Lastname/Firstname/Middle (developer-requested 2026-08-27) come from the
 * customer's own real stored name-part columns now, falling back to the
 * single merged `name` in the Lastname cell only for the rare customer
 * created before those columns existed and never re-saved since. The one
 * thing the paper form has that this still can't reproduce is "Unit
 * Manager" — no such role exists anywhere in this system, left blank.
 */
export function buildCustomerLedgerHtml(ledger: InstallmentLedger): string {
  const { account, rows } = ledger

  const fmt = (n: number | string) =>
    Number(n).toLocaleString('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    })
  const fmtDate = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleDateString('en-PH') : '—'
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

  const unitItem = account.unitItems[0]

  const cell = (label: string, value: string, colspan = 1) =>
    `<td colspan="${colspan}"><p class="cell-value">${esc(value)}</p><p class="cell-label">${esc(label)}</p></td>`

  // The paper form's Total Payments/Penalty/Rebates/Billing/etc. block is
  // plain italic "Label : value" text below the bordered grid, not more
  // boxed cells — mixing it into table.form-grid was what made that row's
  // column count (and so its alignment against every other row) inconsistent.
  const totalLine = (label: string, value: string) =>
    `<p class="totals-line"><span class="totals-label">${esc(label)}</span> : <span class="totals-value">${esc(value)}</span></p>`

  const ledgerRows = rows
    .map(
      (r) => `<tr>
        <td>${fmtDate(r.date)}</td>
        <td class="mono">${esc(r.ref)}</td>
        <td class="right">${r.inst > 0 ? r.inst : '—'}</td>
        <td>${esc(r.description)}</td>
        <td class="right">${r.debit > 0 ? fmt(r.debit) : '—'}</td>
        <td class="right">${r.credit > 0 ? fmt(r.credit) : '—'}</td>
        <td class="right">${fmt(r.due)}</td>
        <td class="right"><strong>${fmt(r.outstanding)}</strong></td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html><html><head><title>Customer Ledger — ${esc(account.accountNumber)}</title><style>
    body { font-family: Arial, sans-serif; padding: 18px; color: #111; font-size: 11px; }
    .letterhead { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .letterhead h1 { font-size: 16px; margin: 0; text-decoration: underline; }
    .letterhead .doc-label { font-size: 12px; font-weight: 700; }
    table.form-grid { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
    table.form-grid td { border: 1px solid #333; padding: 2px 6px; vertical-align: top; line-height: 1.2; }
    .cell-value { margin: 0; font-weight: 700; font-size: 11px; }
    .cell-label { margin: 0; color: #555; font-size: 9px; }
    .split-cell { display: flex; gap: 8px; }
    .split-cell-divider { border-left: 1px solid #ccc; padding-left: 8px; }
    .totals { display: flex; width: 100%; margin: 4px 0 8px; }
    .totals-col { flex: 1; }
    .totals-line { margin: 1px 0; font-style: italic; font-size: 10.5px; }
    .totals-label { display: inline-block; min-width: 92px; }
    .totals-value { font-style: normal; font-weight: 700; }
    h2 { font-size: 11px; font-weight: 700; margin: 8px 0 3px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
    table.ledger { width: 100%; border-collapse: collapse; margin-top: 2px; }
    table.ledger th, table.ledger td { border: 1px solid #ccc; padding: 3px 6px; font-size: 10.5px; line-height: 1.2; }
    table.ledger th { background: #f5f5f5; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 9px; }
    td.right, th.right { text-align: right; }
    td.mono { font-family: "Courier New", monospace; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
    <div class="letterhead">
      <h1>NIG Marketing Corporation</h1>
      <span class="doc-label">Customer Ledger</span>
    </div>

    <table class="form-grid">
      <tr>
        ${cell('Lastname', account.customer.lastName ?? account.customer.name)}
        ${cell('Firstname', account.customer.firstName ?? '—')}
        ${cell('Middle', account.customer.middleName ?? '—')}
        <td>
          <div class="split-cell">
            <div>
              <p class="cell-value">${esc(ledger.saleReference ?? '—')}</p>
              <p class="cell-label">Sales Invoice No.</p>
            </div>
            <div class="split-cell-divider">
              <p class="cell-value">${esc(fmtDate(ledger.saleDate))}</p>
              <p class="cell-label">SI Date</p>
            </div>
          </div>
        </td>
      </tr>
      ${
        unitItem
          ? `<tr>
        ${cell('Brand', unitItem.brand ?? '—')}
        ${cell('Type', unitItem.itemType ?? '—')}
        ${cell('Model', unitItem.modelNumber ?? '—')}
        ${cell('Serial', unitItem.serialNumber ?? '—')}
      </tr>`
          : ''
      }
      <tr>
        ${cell('Agent', account.sellingAgent?.name ?? '—')}
        ${cell('Unit Manager', '—')}
        ${cell(
          'Collector',
          account.collector
            ? `${account.collector.stubNumber} — ${account.collector.name}`
            : 'Unassigned'
        )}
        ${cell('FMI', fmtDate(ledger.firstInstallmentDate))}
      </tr>
      <tr>
        ${cell('LCP', fmt(account.listedCashPrice))}
        ${cell('Down', fmt(account.downPayment))}
        ${cell('Amt. Financed', fmt(account.amountFinanced))}
        ${cell('Inst. Diff.', fmt(account.interestDifferential))}
      </tr>
      <tr>
        ${cell('Scheme', account.priceUseType?.name ?? '—')}
        ${cell('MI', fmt(account.monthlyInstallment))}
        ${cell('Term', `${account.termMonths} months`)}
        ${cell('Branch', account.branch?.name ?? '—')}
      </tr>
      <tr>
        ${cell('PN', fmt(account.pnv))}
        ${cell('IC', fmt(account.insuranceCharge ?? 0))}
        ${cell('Total Price', fmt(account.totalPrice), 2)}
      </tr>
    </table>

    <div class="totals">
      <div class="totals-col">
        ${totalLine('Total Payments', fmt(account.totalPayments))}
        ${totalLine('Total Penalty', '—')}
        ${totalLine('Penalty Balance', fmt(account.penalty))}
      </div>
      <div class="totals-col">
        ${totalLine('Total Rebates', fmt(account.totalRebates))}
        ${totalLine('Total Billing', fmt(account.totalBilling))}
        ${totalLine('Required DP', fmt(account.downPayment))}
      </div>
      <div class="totals-col">
        ${totalLine('DP Balance', fmt(account.dpBalance))}
        ${totalLine('Tot. Amt. Due', fmt(account.totalDue))}
        ${totalLine('Tot. Amt. Out', fmt(account.currentBalance))}
      </div>
    </div>

    <h2>Ledger</h2>
    <table class="ledger">
      <thead>
        <tr>
          <th>Date</th><th>Ref</th><th class="right">Inst.</th><th>Description</th>
          <th class="right">Debit</th><th class="right">Credit</th><th class="right">Due</th><th class="right">Outstanding</th>
        </tr>
      </thead>
      <tbody>${ledgerRows || '<tr><td colspan="8" style="text-align:center;color:#999">No ledger activity yet.</td></tr>'}</tbody>
    </table>

    <button onclick="window.print()" style="margin:16px 0;padding:6px 16px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`
}

export function printCustomerLedgerDocument(ledger: InstallmentLedger): void {
  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) return
  win.document.write(buildCustomerLedgerHtml(ledger))
  win.document.close()
}
