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
  /** Customer this line collects from, when the recipient's name matched
   * exactly one customer. Left blank on no match or an ambiguous one —
   * a wrong match settles the wrong person's instalments, so it is offered
   * for confirmation rather than assumed. */
  collectFromId: string
  collectFromLabel: string
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
  /** Recipients matched to a customer, so the import can say how many
   * deductions will actually settle an instalment. */
  matchedCustomers: number
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
  { match: 'employee cash advance', type: 'EMPLOYEE_CASH_ADVANCE' },
  { match: 'employee cash loan', type: 'EMPLOYEE_CASH_LOAN' },
  { match: 'cash loan others', type: 'CASH_LOAN_OTHERS' },
  { match: 'cash loan – others', type: 'CASH_LOAN_OTHERS' },
]

/**
 * Spellings the sheet uses for accounts that do exist, just under a
 * slightly different name. Only two are needed now that the client's own
 * chart is loaded — "Advances to Officer's and Employees" and "Loans to
 * Officers and Employees" match their real accounts directly, so the
 * aliases that used to redirect them onto this project's invented
 * Employee Cash Advance / Loan accounts are gone.
 */
const ACCOUNT_NAME_ALIASES: Record<string, string> = {
  'pag big premium payable': 'Pag-Ibig Premium Payable',
  'withholding tax compensation': 'Withholding Tax Payable Wages',
}

/**
 * Does this column B value name a person rather than a memo?
 *
 * The sheet writes recipients surname-first — "TRAYCO, JOSHUA",
 * "DE LA TORRE, ELY ROSE APPLE D." — and one row uses a full stop where
 * the rest use a comma ("REMOLA. GERALDINE"). Org units never contain
 * either separator, and they are matched against the Division list first
 * regardless, so this only ever sees what that failed to place.
 *
 * It matters because the recipient has to land in the line's Name, not its
 * Description: outstanding advance and loan balances are matched on the
 * name stored there, so a recovery filed under Description never draws
 * anyone's balance down.
 */
function looksLikeAPersonName(value: string): boolean {
  const parts = value
    .split(/[,.]/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length >= 2 && parts.every((p) => /^[A-Za-zÑñ' -]+$/.test(p))
}

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

/**
 * Last resort when nothing matches exactly: the sheet and the branch list
 * spell the same place differently — "BAGO CITY" for the branch "Bago",
 * "GT MALL" for "GT", "JORDAN" for "Guimaras - Jordan".
 *
 * Only accepted when exactly one branch is a candidate. "GUIMARAS" is the
 * reason: it prefixes both "Guimaras - Buenavista" and "Guimaras - Jordan",
 * and picking either would file a whole branch's payroll under the wrong
 * one. Ambiguity is left unmatched for a person to resolve.
 */
function looseBranchMatch(raw: string, divisions: DivisionOption[]): string | null {
  const value = norm(raw)
  if (!value) return null
  const words = (s: string) => s.split(' ').filter(Boolean)
  const startsWithWords = (haystack: string, needle: string) => {
    const h = words(haystack)
    const n = words(needle)
    return n.length <= h.length && n.every((w, i) => h[i] === w)
  }
  const hits = divisions.filter((d) => {
    if (d.kind !== 'branch') return false
    const name = norm(d.name)
    // "BAGO CITY" starts with branch "Bago"; "JORDAN" is the tail of
    // "Guimaras - Jordan".
    return (
      startsWithWords(value, name) ||
      startsWithWords(name, value) ||
      words(name).slice(1).join(' ') === value
    )
  })
  return hits.length === 1 ? hits[0].value : null
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,\s₱]/g, ''))
  return Number.isFinite(n) && n !== 0 ? n : null
}

export async function importSpreadsheetLines(
  file: File,
  accounts: Account[],
  divisions: DivisionOption[],
  /** Customers to match recipient names against. Optional: without them
   * every line simply imports with no customer, which is what happened
   * before this existed. */
  customers: { id: string; name: string }[] = []
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
    } else {
      // A payroll sheet writes "ACCOUNTING & FINANCE-NEGROS" — department
      // and *region*, not department and branch. Region is the half that
      // matters: the departments live under the region's warehouse branch
      // (NWHSE/PWHSE), whose name the sheet never uses. Both spellings are
      // indexed so either resolves.
      if (d.branchRegion) {
        divisionByName.set(norm(`${d.name} ${d.branchRegion}`), d.value)
      }
      if (d.branchName) {
        divisionByName.set(norm(`${d.name} ${d.branchName}`), d.value)
        divisionByName.set(norm(d.label), d.value)
      }
    }
  }

  // Recipient names are written "SURNAME, FIRSTNAME" while customers are
  // usually stored "Firstname Surname", so both orders are indexed. A name
  // held by more than one customer is dropped from the index rather than
  // resolved arbitrarily — settling the wrong person's instalments is worse
  // than settling nobody's.
  const customerByName = new Map<string, { id: string; name: string } | null>()
  const remember = (key: string, c: { id: string; name: string }) => {
    if (!key) return
    customerByName.set(key, customerByName.has(key) ? null : c)
  }
  /** Every spelling one name might be written in: as given, surname-first
   * flipped, and both with middle initials dropped — the sheet writes
   * "ADVENCULA, JUVY B." where a customer record says "Juvy Advencula",
   * and a single stray initial should not defeat the match. */
  const nameKeys = (name: string): string[] => {
    const dropInitials = (v: string) =>
      norm(v)
        .split(' ')
        .filter((w) => w.length > 1)
        .join(' ')
    const keys = [norm(name), dropInitials(name)]
    const parts = name
      .split(/[,.]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 2) {
      const flipped = `${parts.slice(1).join(' ')} ${parts[0]}`
      keys.push(norm(flipped), dropInitials(flipped))
    }
    return [...new Set(keys.filter(Boolean))]
  }
  for (const c of customers) for (const k of nameKeys(c.name)) remember(k, c)

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
    const aliased = ACCOUNT_NAME_ALIASES[norm(accountLabel)]
    const accountId = specialAccountType
      ? ''
      : (accountByName.get(norm(accountLabel)) ??
        (aliased ? (accountByName.get(norm(aliased)) ?? '') : ''))
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
      // Exact match first, always. Only if that finds nothing does the
      // looser spelling comparison get a turn.
      if (!division) division = looseBranchMatch(particulars, divisions) ?? ''
      if (!division) {
        // A Special Account row is always a recipient; so is anything that
        // reads as a person's name, whichever account it posts to — the
        // sheet's advance, loan and receivable rows all name people, and
        // they resolve to real accounts now rather than Special Accounts.
        if (specialAccountType || looksLikeAPersonName(particulars)) {
          payee = particulars
        } else {
          description = particulars
        }
        unmatchedDivisions.add(particulars)
      }
    }

    // Match on the recipient's name, in either spelling.
    let matched: { id: string; name: string } | null = null
    if (payee) {
      for (const key of nameKeys(payee)) {
        const hit = customerByName.get(key)
        if (hit) {
          matched = hit
          break
        }
      }
    }

    lines.push({
      collectFromId: matched?.id ?? '',
      collectFromLabel: matched?.name ?? '',
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
    matchedCustomers: lines.filter((l) => l.collectFromId).length,
  }
}
