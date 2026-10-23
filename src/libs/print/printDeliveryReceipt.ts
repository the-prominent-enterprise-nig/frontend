import type { PrintDocumentEnvelope } from './printInventoryDocument'
import {
  DR_PURPOSE_CONFIG,
  DR_PURPOSE_GROUPS,
} from '@/src/libs/inventory/delivery-receipt-purposes'
import type { DrDetail, DrPurpose } from '@/src/schema/inventory/delivery-receipts'
import type { IdmDetail } from '@/src/schema/accounting/inventory-debit-memos'

// Scenario 72 Part 5 — the client's two paper forms: the Delivery Receipt
// ("Delivery Receipt with Debit Memo Form Suggestion") and the Debit Memo.
// Same window-and-logo approach as printInventoryDocument.ts, kept in its own
// file because that one is already 3,000+ lines.

/** What each purpose charges, for the DR's grey system note. */
const CHARGED_TO: Partial<Record<DrPurpose, string>> = {
  office_use: 'Office equipment, furniture and fixtures',
  raffle_prize: 'Employee benefits and wellness',
  giveaway: 'Advertising and promotion',
  donation: 'Donations and charitable contributions',
  redeemed_unit: 'Marketing and sales support',
}

function systemNote(purpose: DrPurpose): string {
  const charged = CHARGED_TO[purpose]
  if (charged) {
    return `Posting its debit memo moves the stock out of the issuing branch and charges ${charged}. Not valid as a sales invoice.`
  }
  if (purpose === 'return_to_supplier') {
    return 'Posting its supplier debit memo moves the stock out of the issuing branch; accounting applies the memo to a supplier invoice. Not valid as a sales invoice.'
  }
  if (purpose === 'sales_invoice_to_follow') {
    return 'The units are held for this customer until the sale is rung up at POS, which issues the sales invoice. Not valid as a sales invoice.'
  }
  return 'The units stay on the books while away. Not valid as a sales invoice.'
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  )

const fmtDate = (v: unknown): string =>
  v
    ? new Date(v as string).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''

/** The envelope is the API's raw JSON, where Prisma Decimals arrive as
 * strings ("1500"), so every amount is coerced before it is formatted. */
const num = (v: unknown): number => Number(v ?? 0) || 0

const fmtAmount = (v: unknown): string =>
  num(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Shared look: Poppins-like sans, the blue rule, underlined fields. */
const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Poppins, Arial, sans-serif; color: #17171c; padding: 36px 44px; font-size: 12.5px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  h1 { font-size: 30px; font-weight: 700; margin: 6px 0 0; }
  .brand { text-align: right; font-size: 11.5px; color: #3d3d4a; line-height: 1.5; }
  .brand img { height: 78px; width: auto; display: block; margin-left: auto; }
  .rule { border: 0; border-top: 2px solid #1f4e9c; margin: 16px 0 18px; }
  .row { display: flex; gap: 28px; }
  .field { flex: 1; display: flex; gap: 8px; align-items: baseline; border-bottom: 1px solid #c9c9d3; padding: 9px 0 5px; min-width: 0; }
  .field .k { font-weight: 700; white-space: nowrap; }
  .field .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .half { max-width: calc(50% - 14px); }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #c9c9d3; padding: 8px 10px; text-align: left; }
  th { background: #eef0f6; font-weight: 700; }
  td.r, th.r { text-align: right; }
  td.mono { font-family: Menlo, Consolas, monospace; }
  tr.blank td { height: 34px; }
  .sigs { display: flex; gap: 28px; margin-top: 48px; }
  .sig { flex: 1; text-align: center; border-top: 1px solid #17171c; padding-top: 6px; }
  .sig b { display: block; font-size: 13px; }
  .sig span { font-size: 11px; color: #5b5b6b; }
  /* One sheet per printed page (the Delivery Receipt, then its debit memo),
     each carrying its own watermark — the collection report's one-form-per-
     page layout. */
  .sheet { position: relative; }
  .sheet + .sheet { break-before: page; page-break-before: always; margin-top: 40px; }
  /* A long Delivery Receipt runs onto more pages; these never split across a
     page break (the debit memo still always starts on a page of its own). */
  tr, .sigs, .purpose-box, .note, .totals { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  @media print { .sheet + .sheet { margin-top: 0; } }
  .watermark { position: absolute; top: 38%; left: 0; right: 0; text-align: center; font-size: 96px; font-weight: 800; color: rgba(180, 35, 24, .09); transform: rotate(-24deg); pointer-events: none; }
  .print-btn { margin: 20px 0 0; padding: 7px 18px; background: #5b21b6; color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
  /* A zero page margin is what makes the browser drop its own header and
     footer (date, title, about:blank, page count); the body's padding
     becomes the printed margin instead. */
  @page { size: A4; margin: 0; }
  /* The margin lives on each sheet, not the body: body padding only reaches
     the top of page 1, so the debit memo's page started flush with the paper
     edge. box-decoration-break repeats it on every page a long sheet spills
     onto. */
  @media print {
    body { padding: 0; }
    .sheet { padding: 14mm 16mm; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .print-btn { display: none; }
  }
`

function letterhead(title: string, doc: PrintDocumentEnvelope): string {
  const e = doc.enterprise
  return `<div class="top">
    <h1>${esc(title)}</h1>
    <div class="brand">
      <img src="${window.location.origin}/nig-logo.png" alt="NIG Marketing" />
      ${e?.address ? `<div>${esc(e.address)}</div>` : ''}
      ${e?.taxId ? `<div>TIN ${esc(e.taxId)}</div>` : ''}
    </div>
  </div>
  <hr class="rule" />`
}

const field = (label: string, value: unknown, extra = ''): string =>
  `<div class="field ${extra}"><span class="k">${esc(label)}:</span><span class="v">${esc(value)}</span></div>`

const signatures = (labels: string[]): string =>
  `<div class="sigs">${labels
    .map((l) => `<div class="sig"><b>${esc(l)}</b><span>Name / signature / date</span></div>`)
    .join('')}</div>`

function page(title: string, sheets: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body>
    ${sheets}
    <button class="print-btn" onclick="window.print()">Print</button>
  </body></html>`
}

function openWindow(html: string): void {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ─── Delivery receipt ─────────────────────────────────────────────────────────

function purposeBox(dr: DrDetail): string {
  const all = DR_PURPOSE_GROUPS.flatMap((g) => g.purposes)
  const boxes = all
    .map((p) => {
      const on = p === dr.purpose
      const label = DR_PURPOSE_CONFIG[p].label
      const detail = on && dr.purposeDetail ? ` (${esc(dr.purposeDetail)})` : ''
      return `<span style="white-space:nowrap;${on ? 'font-weight:700' : ''}">${on ? '&#9746;' : '&#9744;'} ${esc(label)}${detail}</span>`
    })
    .join('')
  return `<div class="purpose-box" style="border:1px solid #c9c9d3;border-radius:6px;padding:10px 14px;margin-top:16px;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline">
    <b>Purpose:</b>${boxes}</div>`
}

function itemsTable(dr: DrDetail): string {
  const withQty = dr.lines.some((l) => !l.item.isSerialTracked)
  const rows = dr.lines
    .map((l) => {
      const cost = l.unitCost ?? l.estimatedUnitCost ?? 0
      return `<tr>
        <td>${esc(l.item.name)}${l.item.modelNumber ? `<br/><span style="color:#5b5b6b;font-size:11px">${esc(l.item.modelNumber)}</span>` : ''}</td>
        <td>${esc(l.item.brand?.name ?? '')}</td>
        <td class="mono">${esc(l.serialNumber?.serialNumber ?? '')}</td>
        ${withQty ? `<td class="r">${num(l.quantity)}</td>` : ''}
        <td class="r">${fmtAmount(cost)}</td>
      </tr>`
    })
    .join('')
  const blanks = Math.max(0, 4 - dr.lines.length)
  const blankRow = `<tr class="blank"><td></td><td></td><td></td>${withQty ? '<td></td>' : ''}<td></td></tr>`
  return `<table>
    <thead><tr><th style="width:30%">Model</th><th>Brand</th><th>Serial no.</th>${withQty ? '<th class="r">Qty</th>' : ''}<th class="r">Unit cost</th></tr></thead>
    <tbody>${rows}${blankRow.repeat(blanks)}</tbody>
  </table>`
}

function deliveryReceiptSheet(data: PrintDocumentEnvelope): string {
  const dr = data.document as unknown as DrDetail
  const config = DR_PURPOSE_CONFIG[dr.purpose]
  const unofficial = dr.status === 'draft' || dr.status === 'pending_approval'
  const voided = dr.status === 'voided' || dr.status === 'rejected'
  return `<section class="sheet">
    ${unofficial ? '<div class="watermark">DRAFT</div>' : voided ? `<div class="watermark">${dr.status === 'voided' ? 'VOID' : 'REJECTED'}</div>` : ''}
    ${letterhead('Delivery receipt', data)}
    ${config.withDebitMemo ? field('Debit memo no.', (dr.debitMemo ?? dr.supplierDebitMemo)?.memoNumber ?? '') : ''}
    <div class="row">${field('DR no.', dr.drNumber)}${field('Date', fmtDate(dr.issueDate))}</div>
    <div class="row">${field('Issued from', dr.branch?.name ?? dr.warehouse.name)}${field('Department', dr.department?.name ?? '')}</div>
    ${field('Delivered to', dr.deliveredTo ?? '')}
    ${field('Customer ID', dr.customerCode ?? '')}
    ${field('Address', dr.address ?? '')}
    <div class="row">${field('Contact', dr.contactNo ?? '', 'half')}</div>
    ${dr.referenceNo ? `<div class="row">${field('Reference no.', dr.referenceNo)}${field('Reference date', fmtDate(dr.referenceDate))}</div>` : ''}
    ${purposeBox(dr)}
    ${itemsTable(dr)}
    <p style="margin:18px 0 4px"><b>Remarks:</b></p>
    ${dr.remarks ? `<p style="margin:0 0 6px">${esc(dr.remarks)}</p>` : ''}
    <p style="margin:0">Received the above merchandise in good order and condition.</p>
    ${signatures(['Prepared by', 'Approved by', 'Delivered by', 'Received by'])}
    <div class="note" style="margin-top:28px;background:#f1f1f4;border-radius:6px;padding:10px 14px;font-size:11.5px">
      <b>System note:</b> ${esc(systemNote(dr.purpose))}
    </div>
  </section>`
}

/** The Delivery Receipt, followed on its own page by its debit memo when it
 * has one — one print job, like the collection report's forms. */
export function buildDeliveryReceiptHtml(
  data: PrintDocumentEnvelope,
  memo?: PrintDocumentEnvelope | null
): string {
  return page(data.documentNumber, deliveryReceiptSheet(data) + (memo ? debitMemoSheet(memo) : ''))
}

export function printDeliveryReceipt(
  data: PrintDocumentEnvelope,
  memo?: PrintDocumentEnvelope | null
): void {
  openWindow(buildDeliveryReceiptHtml(data, memo))
}

// ─── Debit memo ───────────────────────────────────────────────────────────────

function memoLines(memo: IdmDetail): string {
  const rows = memo.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.account.number)} — ${esc(l.account.name)}</td>
        <td>${esc(l.description ?? '')}</td>
        <td class="r">${num(l.debit) ? fmtAmount(l.debit) : ''}</td>
        <td class="r">${num(l.credit) ? fmtAmount(l.credit) : ''}</td>
      </tr>`
    )
    .join('')
  const blanks = Math.max(0, 4 - memo.lines.length)
  return `<table>
    <thead><tr><th style="width:30%">Account</th><th>Description</th><th class="r" style="width:16%">Debit amount</th><th class="r" style="width:16%">Credit amount</th></tr></thead>
    <tbody>${rows}${'<tr class="blank"><td></td><td></td><td></td><td></td></tr>'.repeat(blanks)}</tbody>
  </table>
  <table class="totals" style="width:320px;margin-left:auto;margin-top:16px">
    <tr><th>Total debit</th><td class="r"><b>${fmtAmount(memo.totalDebit)}</b></td></tr>
    <tr><th>Total credit</th><td class="r"><b>${fmtAmount(memo.totalCredit)}</b></td></tr>
  </table>`
}

/** A supplier debit memo printed in the same form carries two more facts. */
type PrintableMemo = IdmDetail & {
  supplier?: { name: string } | null
  appliedTo?: string | null
}

function debitMemoSheet(data: PrintDocumentEnvelope): string {
  const memo = data.document as unknown as PrintableMemo
  const purpose = memo.purpose ? DR_PURPOSE_CONFIG[memo.purpose].label : ''
  const mark = memo.status === 'DRAFT' ? 'DRAFT' : memo.status === 'VOID' ? 'VOID' : ''
  return `<section class="sheet">
    ${mark ? `<div class="watermark">${mark}</div>` : ''}
    ${letterhead('Debit memo', data)}
    <div class="row">${field('Debit memo no.', memo.memoNumber)}${field('Date', fmtDate(memo.memoDate))}</div>
    ${field('Purpose', purpose)}
    ${memo.supplier ? `<div class="row">${field('Supplier', memo.supplier.name)}${field('Applied to', memo.appliedTo ?? 'Not yet applied — accounting picks the invoice')}</div>` : ''}
    <div class="row">${field('Branch', memo.branch?.name ?? '')}${field('Department', memo.department?.name ?? '')}</div>
    <div class="row">${field('Reference', memo.referenceNo ?? memo.deliveryReceipt?.drNumber ?? '')}${field('Reference date', fmtDate(memo.referenceDate))}</div>
    ${field('Reason / details', memo.reason ?? '')}
    ${memoLines(memo)}
    ${signatures(['Prepared by', 'Noted by', 'Approved by'])}
  </section>`
}

export function buildDebitMemoHtml(data: PrintDocumentEnvelope): string {
  return page(data.documentNumber, debitMemoSheet(data))
}

export function printDebitMemo(data: PrintDocumentEnvelope): void {
  openWindow(buildDebitMemoHtml(data))
}
