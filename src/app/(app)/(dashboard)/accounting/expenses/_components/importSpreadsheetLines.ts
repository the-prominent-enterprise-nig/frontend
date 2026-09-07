import * as XLSX from 'xlsx'
import type { Account } from '@/src/libs/data/AccountingData'
import type { DivisionOption } from '@/src/libs/data/OrgStructureData'

/**
 * Turns a payroll disbursement sheet into expense lines.
 *
 * The client's own column mapping (2026-09-04):
 *   A — Chart of Accounts   → the line's Account
 *   B — Particulars / Memo  → the line's Division
 *   C — Debit               → Amount, positive (adds)
 *   D — Credit              → Amount, negative (deducts)
 *
 * Column B holds a department or branch name for the salary block
 * ("ACCOUNTING & FINANCE-NEGROS", "AJUY") and a person's name for the
 * advances and loans block ("TRAYCO, JOSHUA"). It is matched against the
 * Division list first; anything that doesn't match a branch or department
 * falls through to Description rather than being dropped, which is what
 * keeps the recipient of an advance visible on its line.
 */

export interface ImportedLine {
  categoryAccountId: string
  /** Set instead of categoryAccountId when column A names a Special
   * Account. Those are asset accounts (1-03-0xx) that never appear in the
   * Account picker, so matching them by name would always fail — they are
   * recognised by name here and resolved server-side from the mapping. */
  specialAccountType: string
  /** Column A verbatim, kept whether or not it matched an account — an
   * unmatched row still has to show the user what it was trying to be. */
  accountLabel: string
  division: string
  /** The line's recipient. On a Special Account row column B is a person's
   * name, which is what ties the advance or loan to their outstanding
   * balance — so it lands here rather than in Description. */
  payee: string
  description: string
  amount: string
}

export interface ImportResult {
  lines: ImportedLine[]
  /** Rows read, before any were skipped. */
  rowsRead: number
  /** Summary rows dropped by design (see SUMMARY_ROW_LABELS). */
  skippedSummaryRows: string[]
  /** Column A values with no matching account, deduplicated. Those lines
   * still import — with a blank Account for the user to fill in. */
  unmatchedAccounts: string[]
  /** Column B values that matched no branch or department, deduplicated.
   * Those went to Description instead. */
  unmatchedDivisions: string[]
}

/**
 * Rows that total the sheet rather than transact. Importing them would
 * double-count: TOTAL NET PAY is the cash side, which the expense's own
 * payment lines already represent, and GRAND TOTALS restates the whole file.
 * Dropping both leaves lines that net to exactly the cash paid out.
 */
const SUMMARY_ROW_LABELS = ['total net pay', 'grand totals', 'grand total', 'total']

/**
 * Column A spellings that name a Special Account rather than an expense
 * category. The client's sheet writes them as "Advances to Officer's and
 * Employees" and "Loans to Officer's and Employees" — 368 of its 657 rows —
 * where the chart of accounts calls them "Employee Cash Advance" and
 * "Employee Cash Loan". Matching on the account name alone would leave every
 * one of those rows unmatched.
 */
const SPECIAL_ACCOUNT_ALIASES: { match: string; type: string }[] = [
  { match: 'advances to officers and employees', type: 'EMPLOYEE_CASH_ADVANCE' },
  { match: 'advances to officer s and employees', type: 'EMPLOYEE_CASH_ADVANCE' },
  { match: 'employee cash advance', type: 'EMPLOYEE_CASH_ADVANCE' },
  { match: 'loans to officers and employees', type: 'EMPLOYEE_CASH_LOAN' },
  { match: 'loans to officer s and employees', type: 'EMPLOYEE_CASH_LOAN' },
  { match: 'employee cash loan', type: 'EMPLOYEE_CASH_LOAN' },
  { match: 'cash loan others', type: 'CASH_LOAN_OTHERS' },
  { match: 'cash loan – others', type: 'CASH_LOAN_OTHERS' },
]

function specialAccountFor(accountLabel: string): string {
  const key = norm(accountLabel)
  return SPECIAL_ACCOUNT_ALIASES.find((a) => a.match === key)?.type ?? ''
}

/** Comparison key for a name: case, spacing and punctuation all vary between
 * a chart of accounts and a hand-maintained spreadsheet. */
function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Column B names a department by department-and-region: the sheet says
 * "ACCOUNTING & FINANCE-NEGROS" where the Division list has "Accounting &
 * Finance" under a Negros branch. Both halves matter — "ACCOUNTING &
 * FINANCE-PANAY" is a different department in a different branch, and
 * matching on the prefix alone would silently file every Panay row under
 * Negros. So the suffix is matched against the branch, never dropped. */
function divisionCandidates(raw: string): string[] {
  const candidates = [norm(raw)]
  const dash = raw.lastIndexOf('-')
  if (dash > 0) {
    const name = norm(raw.slice(0, dash))
    const region = norm(raw.slice(dash + 1))
    if (name && region) candidates.push(`${name} ${region}`)
  }
  return candidates.filter(Boolean)
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,\s₱]/g, ''))
  return Number.isFinite(n) && n !== 0 ? n : null
}

export async function importSpreadsheetLines(
  file: File,
  accounts: Account[],
  divisions: DivisionOption[]
): Promise<ImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  // header:1 gives raw positional rows, so the mapping stays by column
  // position (A/B/C/D) rather than by whatever the header row happens to be
  // spelled — the client's own mapping is positional.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })

  const accountByName = new Map<string, string>()
  for (const a of accounts) {
    accountByName.set(norm(a.name), a.id)
    if (a.number) accountByName.set(norm(`${a.number} ${a.name}`), a.id)
  }
  const divisionByName = new Map<string, string>()
  for (const d of divisions) {
    // A branch matches on its own name. A department matches only on
    // "<department> <branch>" — never the department name alone, which
    // repeats across branches.
    if (d.kind === 'branch') {
      divisionByName.set(norm(d.name), d.value)
    } else if (d.branchName) {
      divisionByName.set(norm(`${d.name} ${d.branchName}`), d.value)
      divisionByName.set(norm(d.label), d.value)
    }
  }

  const lines: ImportedLine[] = []
  const skippedSummaryRows: string[] = []
  const unmatchedAccounts = new Set<string>()
  const unmatchedDivisions = new Set<string>()
  let rowsRead = 0

  for (const row of rows) {
    const accountLabel = String(row[0] ?? '').trim()
    const particulars = String(row[1] ?? '').trim()
    const debit = parseAmount(row[2])
    const credit = parseAmount(row[3])
    if (!accountLabel && debit === null && credit === null) continue
    rowsRead++

    if (SUMMARY_ROW_LABELS.includes(norm(accountLabel))) {
      skippedSummaryRows.push(accountLabel)
      continue
    }
    // The header row: text in the amount columns, nothing numeric.
    if (debit === null && credit === null) continue

    // Debit adds, credit deducts. A row carrying both is malformed; the
    // debit wins and the credit is folded in, so nothing is silently lost.
    const amount = (debit ?? 0) - (credit ?? 0)
    if (amount === 0) continue

    // A Special Account short-circuits the category lookup entirely.
    const specialAccountType = specialAccountFor(accountLabel)
    const accountId = specialAccountType ? '' : (accountByName.get(norm(accountLabel)) ?? '')
    if (accountLabel && !accountId && !specialAccountType) {
      unmatchedAccounts.add(accountLabel)
    }

    let division = ''
    let description = ''
    let payee = ''
    if (particulars) {
      for (const candidate of divisionCandidates(particulars)) {
        const match = divisionByName.get(candidate)
        if (match) {
          division = match
          break
        }
      }
      if (!division) {
        // On a Special Account row this is the recipient, not a memo.
        if (specialAccountType) payee = particulars
        else description = particulars
        unmatchedDivisions.add(particulars)
      }
    }

    lines.push({
      categoryAccountId: accountId,
      specialAccountType,
      accountLabel,
      division,
      payee,
      description,
      amount: String(amount),
    })
  }

  return {
    lines,
    rowsRead,
    skippedSummaryRows,
    unmatchedAccounts: [...unmatchedAccounts],
    unmatchedDivisions: [...unmatchedDivisions],
  }
}
