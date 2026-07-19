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
