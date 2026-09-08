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
 * Division list first. What happens to the rest is decided by the account
 * the row resolved to, not by how the value is spelled: on an account that
 * keeps a subsidiary ledger it is the name that balance is carried against;
 * on any other account it is a memo, and goes to Description. Either way it
 * is kept rather than dropped, so the recipient stays visible on the line.
 */

export interface ImportedLine {
  categoryAccountId: string
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
  /** Which named balance the line belongs to. Only set when the resolved
   * account keeps a subsidiary ledger (`isSpecialAccountControl`) — that is
   * what ties an advance or loan to the person's outstanding balance. On
   * any other account there is no such ledger, so column B is a memo and
   * goes to Description instead. */
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
  /** Rows counted but not imported for any other reason — the sheet's own
   * header row, and any row whose debit and credit cancel to nothing.
   * Reported so that rowsRead minus what was skipped actually equals the
   * number of lines, rather than a row quietly disappearing. */
  skippedEmptyRows: number
  /** Column A values with no matching account, deduplicated. Those lines
   * still import — with a blank Account for the user to fill in. */
  unmatchedAccounts: string[]
  /** Column B values that matched no branch or department **and** sit on an
   * account with no per-name ledger, deduplicated — the ones that might be a
   * division we are missing. Names on advance/loan rows are excluded: they
   * are Special Account names, not failed division matches. */
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
/** Region words the sheet appends to a division. The client's Division list
 * is region-free, so the suffix is stripped before matching. */
const REGION_SUFFIXES = ['panay', 'negros']

/**
 * Sheet spellings the mapping cannot derive, read off the client's own entry
 * by comparing its Description column against the Division each line was
 * filed under. Their mapping is curated, not mechanical: marketing files
 * under "NIG MARKETEAM", and both receivable and collection collapse into one
 * "AR & COLLECTIONDEPARTMENT".
 *
 * Incomplete by construction — this is only what their screenshot shows.
 * "SALES AND MARKETING DEPARTMENT NEGROS" is deliberately absent: it could be
 * either NIG MARKETEAM or SALES DEPARTMENT and guessing would misfile a whole
 * region's payroll. Anything unmapped is reported for a person to place.
 *
 * Keys and values are both `norm`-ed spellings.
 */
const DIVISION_ALIASES: Record<string, string> = {
  'marketing department': 'nig marketeam',
  'sales and branch support department': 'sales department',
  'sales and branch support': 'sales department',
  'account receivable department': 'ar collectiondepartment',
  'accounts receivable department': 'ar collectiondepartment',
  'credit collection': 'ar collectiondepartment',
  'credit collection department': 'ar collectiondepartment',
  'accounting and finance department': 'accounting finance department',
  edp: 'edp department',
  hr: 'hr department',
  inventory: 'inventory department',
  aircool: 'aircool department',
  logistics: 'logistics department',
  it: 'it department',
}

function divisionCandidates(raw: string): string[] {
  const out: string[] = []
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v)
  }
  const base = norm(raw)
  push(base)
  // "ACCOUNTING & FINANCE-NEGROS" — name and region either side of a dash.
  const dash = raw.lastIndexOf('-')
  if (dash > 0) {
    const name = norm(raw.slice(0, dash))
    const region = norm(raw.slice(dash + 1))
    if (name && region) {
      push(`${name} ${region}`)
      push(name)
    }
  }
  // "HR DEPARTMENT PANAY" — the same thing separated by a space, which is
  // how the client's own payroll entry writes it.
  for (const region of REGION_SUFFIXES) {
    if (base.endsWith(` ${region}`)) push(base.slice(0, -(region.length + 1)))
  }
  // Their curated spellings, applied to everything derived so far.
  for (const candidate of [...out]) {
    const alias = DIVISION_ALIASES[candidate]
    if (alias) push(alias)
  }
  return out
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

  // Accounts that keep one balance per named person or project. Whether a
  // line is a Special Account is a property of the account it posts to —
  // not of how column A happens to be spelled.
  const controlAccountIds = new Set(
    accounts.filter((a) => a.isSpecialAccountControl).map((a) => a.id)
  )
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
    } else if (!d.branchName) {
      // Company-wide, which is how the client's own Division list is
      // organised: the name stands alone and the region lives in the memo.
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
  let skippedEmptyRows = 0

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
    if (debit === null && credit === null) {
      skippedEmptyRows++
      continue
    }

    // Debit adds, credit deducts. A row carrying both is malformed; the
    // debit wins and the credit is folded in, so nothing is silently lost.
    const amount = (debit ?? 0) - (credit ?? 0)
    if (amount === 0) {
      skippedEmptyRows++
      continue
    }

    const aliased = ACCOUNT_NAME_ALIASES[norm(accountLabel)]
    const accountId =
      accountByName.get(norm(accountLabel)) ??
      (aliased ? (accountByName.get(norm(aliased)) ?? '') : '')
    if (accountLabel && !accountId) {
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
      // Division and Description are not either/or. The client's own entry
      // carries both — "HR DEPARTMENT PANAY" in Description, "HR DEPARTMENT"
      // in Division — and Description is the column their printed voucher
      // actually shows, so dropping it on a successful Division match would
      // print a blank column.
      //
      // The exception is an account that keeps a subsidiary ledger: there
      // column B is the name the balance is carried against, and the memo is
      // a sentence the user writes ("To take up payment for Cash advances
      // from Payroll 08/30/26"), not the name repeated.
      if (controlAccountIds.has(accountId)) {
        payee = particulars
      } else {
        description = particulars
      }
      // Only worth reporting when the value could plausibly have been an org
      // unit. A person's name on an advance or loan row was never going to
      // match a division — it is a Special Account name and is exactly where
      // it belongs — so counting those buried the handful that actually need
      // a look under hundreds that do not.
      if (!division && !controlAccountIds.has(accountId)) {
        unmatchedDivisions.add(particulars)
      }
    }

    // Match on the recipient's name, in either spelling. Keyed off column B
    // itself rather than `payee`: a receivable line names a person but keeps
    // no per-name ledger, so its name sits in Description — and it is
    // exactly the line that has instalments to settle.
    let matched: { id: string; name: string } | null = null
    if (particulars && !division && looksLikeAPersonName(particulars)) {
      for (const key of nameKeys(particulars)) {
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
    skippedEmptyRows,
    skippedSummaryRows,
    unmatchedAccounts: [...unmatchedAccounts],
    unmatchedDivisions: [...unmatchedDivisions],
    matchedCustomers: lines.filter((l) => l.collectFromId).length,
  }
}
