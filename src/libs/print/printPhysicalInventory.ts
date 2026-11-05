import type { CountLineSnapshot, CountSummary } from '@/src/schema/inventory/stock-counts'

/**
 * Scenario 87 Part 4 — the Monthly Physical Inventory printout, laid out like
 * the client's sample: page 1 is the note, certification and sign-off; the
 * Stock Count Sheet follows, then the units found but not listed. "NIG
 * Marketing Corporation" is the letterhead, as on the other NIG printouts in
 * printInventoryDocument.ts.
 */

const COMPANY = 'NIG Marketing Corporation'
const BLANK_SHEET_ROWS = 3
const BLANK_FOUND_LINES = 3

const esc = (v: unknown): string =>
  String(v ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  )

/** "October 9, 2026", on the Philippine calendar. */
function longDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function branchName(count: CountSummary): string {
  return count.warehouse?.branch?.name ?? count.warehouse?.name ?? ''
}

type SheetLine = {
  serial: string
  brand: string
  model: string
  name: string
  inStore: boolean
  /** Non-serial lines only: "counted of expected". */
  qty?: string
  remarks: string
  unaccounted: boolean
}

function toSheetLine(l: CountLineSnapshot): SheetLine {
  const counted = l.countedQty ?? 0
  const isUnit = Boolean(l.serialNumberId)
  const remarks = (l.remarks ?? '').trim()
  return {
    serial: l.serialNumber?.serialNumber ?? l.item.sku,
    brand: l.item.brand?.name ?? '',
    model: l.item.modelNumber ?? '',
    name: l.item.name,
    inStore: isUnit ? counted === 1 : counted >= Number(l.systemQty),
    qty: isUnit ? undefined : `${counted} of ${Number(l.systemQty)}`,
    remarks,
    // Not found, and nothing said about where it is (decision 5).
    unaccounted: isUnit && counted === 0 && !remarks && !l.remarkTag,
  }
}

/** Shelf order: brand, then model, then serial. */
function byShelf(a: SheetLine, b: SheetLine): number {
  return (
    a.brand.localeCompare(b.brand) ||
    a.model.localeCompare(b.model) ||
    a.serial.localeCompare(b.serial)
  )
}

function splitLines(lines: CountLineSnapshot[]): { listed: SheetLine[]; found: SheetLine[] } {
  // A find is a line the start-time snapshot didn't have (systemQty 0).
  const listed = lines.filter((l) => Number(l.systemQty) > 0).map(toSheetLine)
  const found = lines
    .filter((l) => Number(l.systemQty) === 0 && (l.countedQty ?? 0) > 0)
    .map(toSheetLine)
  return { listed: listed.sort(byShelf), found: found.sort(byShelf) }
}

function headerBlock(title: string, count: CountSummary): string {
  return `
    <div class="company">${esc(COMPANY.toUpperCase())}</div>
    <h1>${esc(title)}</h1>
    <table class="meta">
      <tr><th>AS OF:</th><td>${esc(longDate(count.startedAt ?? count.scheduledDate))}</td></tr>
      <tr><th>BRANCH:</th><td>${esc(branchName(count))}</td></tr>
    </table>`
}

function coverPage(count: CountSummary): string {
  return `
  <section class="page">
    ${headerBlock('MONTHLY PHYSICAL INVENTORY', count)}
    <p class="label">Note:</p>
    <ul class="note">
      <li>Serial numbers <b>checked “In Store?”</b> in the ERP Count Sheet were found in both the system and the actual count.</li>
      <li>Serial numbers <b>left unchecked</b> were in the system’s stock balance when the count started but were not found in the actual count. These are <b>RECONCILING ITEMS</b>.</li>
      <li>Every reconciling item must be accounted for individually by serial number, with its exact location and a supporting reference document number entered in Remarks. A blank, vague or unsupported remark does not count as reconciled.</li>
      <li>A reconciling item that is not located and supported when this report is submitted is treated as unaccounted for and remains a variance in this report.</li>
      <li>Items found in the actual count that were not already listed are recorded through Add Found Item.</li>
    </ul>
    <p class="certify">We hereby certify that the above Physical Inventory was done accurately and in our presence. We further certify that the report submitted is true and correct to the best of our knowledge. We further understand that any false information given with regard to the Physical Inventory may result in Serious Disciplinary Action or possible grounds for Termination.</p>
    <div class="signoff">
      <div><p class="label">PREPARED BY:</p><div class="line"></div><p class="role">Stock Custodian</p></div>
      <div><p class="label">APPROVED BY:</p><div class="line"></div><p class="role">BSM/OIC</p></div>
    </div>
    <p class="label witness">WITNESS:</p>
    <div class="witnesses">
      ${'<div><div class="line"></div><p class="role">Signature over printed name</p></div>'.repeat(4)}
    </div>
  </section>`
}

function sheetRow(no: number | string, l: SheetLine | null): string {
  if (!l) {
    return `<tr class="blank"><td class="no">${no}</td><td></td><td></td><td></td><td class="box">☐</td><td></td></tr>`
  }
  const remark = l.unaccounted
    ? '<span class="unaccounted">UNACCOUNTED — no location or reference</span>'
    : esc(l.remarks)
  const inStore = l.qty ? esc(l.qty) : l.inStore ? '☑' : '☐'
  return `<tr${l.unaccounted ? ' class="flag"' : ''}>
    <td class="no">${no}</td>
    <td class="serial">${esc(l.serial)}</td>
    <td>${esc(l.brand)}</td>
    <td>${esc(l.model)}<div class="sub">${esc(l.name)}</div></td>
    <td class="box">${inStore}</td>
    <td>${remark}</td>
  </tr>`
}

function summary(listed: SheetLine[], found: SheetLine[]): string {
  const inStore = listed.filter((l) => l.inStore).length
  const reconciling = listed.length - inStore
  const unaccounted = listed.filter((l) => l.unaccounted).length
  return `<p class="summary">Expected: <b>${listed.length}</b> · In store: <b>${inStore}</b> ·
    Reconciling items: <b>${reconciling}</b>${unaccounted ? ` (unaccounted: <b>${unaccounted}</b>)` : ''} ·
    Found, not listed: <b>${found.length}</b></p>`
}

function foundSection(found: SheetLine[]): string {
  const filled = found
    .map(
      (l) =>
        `<div class="found">${esc(l.serial)} / ${esc(l.brand)} / ${esc(l.model)} — ${esc(l.name)}${l.remarks ? ` / ${esc(l.remarks)}` : ''}</div>`
    )
    .join('')
  const blank = '<div class="found ruled"></div>'.repeat(BLANK_FOUND_LINES)
  return `<div class="found-block">
    <p class="label">Items found but not listed <span class="hint">(record through Add Found Item): serial no. / brand / model / location</span></p>
    ${filled}${blank}
  </div>`
}

function sheetPages(count: CountSummary, lines: CountLineSnapshot[]): string {
  const { listed, found } = splitLines(lines)
  const rows = listed.map((l, i) => sheetRow(i + 1, l))
  for (let i = 1; i <= BLANK_SHEET_ROWS; i++) rows.push(sheetRow(listed.length + i, null))
  return `
  <section class="page break">
    ${headerBlock('STOCK COUNT SHEET', count)}
    <p class="intro">Expected items come from the system’s stock balance at the moment the count started. Tick <b>In Store?</b> for each serial number actually found. For unticked items, enter the exact location and reference document number in Remarks.</p>
    ${summary(listed, found)}
    <table class="sheet">
      <thead><tr><th class="no">No.</th><th>Serial Number</th><th>Brand</th><th>Model</th><th class="box">In Store?</th><th>Remarks (location / ref. no.)</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    ${foundSection(found)}
  </section>`
}

const STYLES = `
  /* No page margin: the browser prints its own date / title / URL header and
     footer inside the page margin, so with none there's nowhere for them to
     go. The margins are drawn by .page instead — cloned onto every page a
     long sheet breaks across — and the footer is a fixed element, which
     repeats on each printed page. */
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; padding: 24px; }
  .page { padding: 16mm 14mm 20mm; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  .page-footer { display: none; }
  .toolbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
  .toolbar button { background: #3D2563; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; }
  .company { text-align: right; font-weight: 700; font-size: 13px; letter-spacing: .02em; }
  h1 { font-size: 17px; margin: 18px 0 10px; }
  .meta th { text-align: left; font-weight: 400; padding: 3px 14px 3px 0; }
  .meta td { border-bottom: 1px solid #111; min-width: 230px; padding: 3px 4px; }
  .label { font-weight: 700; margin: 18px 0 6px; }
  .note { margin: 0; padding-left: 20px; line-height: 1.5; }
  .note li { margin-bottom: 4px; }
  .certify { text-indent: 36px; line-height: 1.6; margin: 18px 0; text-align: justify; }
  .signoff, .witnesses { display: grid; grid-template-columns: 1fr 1fr; column-gap: 60px; row-gap: 28px; }
  .signoff { margin-top: 40px; }
  .witness { margin-top: 36px; }
  .line { border-bottom: 1px solid #111; height: 34px; }
  .role { text-align: center; font-size: 11px; margin: 4px 0 0; }
  .break { break-before: page; }
  .intro { margin: 6px 0 8px; line-height: 1.5; }
  .summary { margin: 0 0 8px; font-size: 11px; }
  table.sheet { width: 100%; border-collapse: collapse; }
  .sheet th, .sheet td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
  .sheet thead th { background: #eee; font-size: 11px; text-align: left; }
  .sheet tr { break-inside: avoid; }
  .sheet .no { width: 34px; text-align: center; }
  .sheet .box { width: 72px; text-align: center; font-size: 15px; }
  .sheet th.box { font-size: 11px; white-space: nowrap; }
  .sheet .serial { font-weight: 700; white-space: nowrap; }
  .sheet .sub { font-size: 9.5px; color: #555; }
  .sheet tr.blank td { height: 26px; }
  .sheet tr.flag td { background: #fff4f4; }
  .unaccounted { color: #b00020; font-weight: 700; }
  .found-block { margin-top: 18px; }
  .hint { font-weight: 400; color: #444; }
  .found { padding: 6px 2px; border-bottom: 1px solid #111; min-height: 24px; }
  @media print {
    body { padding: 0; }
    .toolbar { display: none; }
    .page-footer { display: block; position: fixed; left: 14mm; right: 14mm; bottom: 8mm; font-size: 9px; color: #666; }
  }
`

export function buildPhysicalInventoryHtml(
  count: CountSummary,
  lines: CountLineSnapshot[]
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monthly Physical Inventory — ${esc(branchName(count))}</title><style>${STYLES}</style></head>
  <body>
    <div class="toolbar"><button onclick="window.print()">Print</button></div>
    ${coverPage(count)}
    ${sheetPages(count, lines)}
    <div class="page-footer">${esc(COMPANY)} – Monthly Physical Inventory</div>
  </body></html>`
}

/**
 * Opens the printout. The window is opened before the lines are fetched —
 * a window opened after an await counts as a popup and gets blocked.
 */
export async function printPhysicalInventory(
  count: CountSummary,
  loadLines: () => Promise<CountLineSnapshot[] | null>
): Promise<boolean> {
  const win = window.open('', '_blank', 'width=950,height=800')
  if (!win) return false
  win.document.write('<p style="font-family:Arial;padding:24px">Preparing the printout…</p>')
  const lines = await loadLines()
  if (!lines) {
    win.close()
    return false
  }
  win.document.open()
  win.document.write(buildPhysicalInventoryHtml(count, lines))
  win.document.close()
  return true
}
