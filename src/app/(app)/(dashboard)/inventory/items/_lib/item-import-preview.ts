import * as XLSX from 'xlsx'

export type ItemImportPreview = {
  headers: string[]
  /** Which headers the import reads, index-aligned with `headers`. */
  recognized: boolean[]
  sampleRows: string[][]
  totalRows: number
  /** Distinct models — how many items the file describes. */
  uniqueModels: number
  /** PRICE USE + PRICE present, so the rows can also be priced. */
  hasPrices: boolean
  /** Rows with a SERIAL — units that will be recorded at their BRANCH. */
  unitRows: number
  /** Why the file can't be imported, if it can't. */
  problem: string | null
}

const PREVIEW_ROWS = 5

/** Catalog columns (backend ItemsService.BULK_IMPORT_HEADER_ALIASES), the
 * price columns and the unit columns. Matched case-insensitively. */
const RECOGNIZED_HEADERS = new Set([
  'brand',
  'model',
  'modelnumber',
  'name',
  'sku',
  'type',
  'group',
  'subgroup',
  'category',
  'subcategory',
  'description',
  'baseunitcode',
  'price use',
  'price',
  'down payment',
  '3mos mi',
  '3mos ppd',
  '6mos mi',
  '6mos ppd',
  '9mos mi',
  '9mos ppd',
  '12mos mi',
  '12mos ppd',
  'credit',
  'cm',
  'serial',
  'serial number',
  'serialnumber',
  'branch',
  'date in',
  'datein',
  'rr',
  'rr #',
  'rr#',
  'cost',
  'unit cost',
])

const SERIAL_HEADERS = new Set(['serial', 'serial number', 'serialnumber', 'serial no', 'sn'])

const key = (header: string): string => header.trim().toLowerCase().replace(/\s+/g, ' ')

function readRows(text: string): string[][] {
  const workbook = XLSX.read(text, { type: 'string', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false })
  return rows.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean))
}

function countModels(keys: string[], body: string[][]): number {
  const col = keys.findIndex((k) => k === 'model' || k === 'modelnumber')
  if (col < 0) return 0
  return new Set(body.map((r) => r[col]?.toUpperCase()).filter(Boolean)).size
}

function countUnits(keys: string[], body: string[][]): number {
  const col = keys.findIndex((k) => SERIAL_HEADERS.has(k))
  return col < 0 ? 0 : body.filter((r) => r[col]).length
}

function problemFor(keys: string[], rows: number): string | null {
  if (!keys.includes('model') && !keys.includes('name')) {
    return 'No MODEL column found — use the item upload template and check the header row.'
  }
  if (rows === 0) return 'The file has a header row but no data.'
  return null
}

/** Reads the chosen file in the browser so the modal can show what it will
 * import before anything is sent. */
export async function readItemImportPreview(file: File): Promise<ItemImportPreview> {
  const [headers = [], ...body] = readRows(await file.text())
  const keys = headers.map(key)
  return {
    headers,
    recognized: keys.map((k) => RECOGNIZED_HEADERS.has(k)),
    sampleRows: body.slice(0, PREVIEW_ROWS),
    totalRows: body.length,
    uniqueModels: countModels(keys, body),
    hasPrices: keys.includes('price use') && keys.includes('price'),
    unitRows: countUnits(keys, body),
    problem: problemFor(keys, body.length),
  }
}
