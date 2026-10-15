import type { Account } from '@/src/libs/data/AccountingData'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'

/** A header row only groups its children — nothing posts to it. The client's
 * chart marks every header in its description; the older ones by a "-000"
 * number. Same test the Expense form's account picker applies. */
export function isHeaderAccount(a: Pick<Account, 'number' | 'description'>): boolean {
  return (a.number ?? '').endsWith('-000') || (a.description ?? '').startsWith('Header account')
}

/** The accounts a journal line can land on for a manual choice: no headers, and
 * no Equity — nothing a payment or an expense does belongs there. */
export function postableAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !isHeaderAccount(a) && (a.type ?? '').toUpperCase() !== 'EQUITY')
}

/** Accounts come back flat (with a parentId) ordered by number — turn that into
 * the depth-ordered list CategorySelect needs, so a parent stays directly above
 * its children instead of being resorted alphabetically. The label leads with
 * the Chart of Accounts number, so typing the code into the search box matches. */
export function accountsToOptions(accounts: Account[]): CategorySelectOption[] {
  const idsInList = new Set(accounts.map((a) => a.id))
  const childrenByParent = new Map<string, Account[]>()
  const roots: Account[] = []
  for (const a of accounts) {
    if (a.parentId && idsInList.has(a.parentId)) {
      const siblings = childrenByParent.get(a.parentId) ?? []
      siblings.push(a)
      childrenByParent.set(a.parentId, siblings)
    } else {
      roots.push(a)
    }
  }
  const options: CategorySelectOption[] = []
  const walk = (list: Account[], depth: number) => {
    for (const a of list) {
      options.push({ id: a.id, name: a.number ? `${a.number} — ${a.name}` : a.name, depth })
      const children = childrenByParent.get(a.id)
      if (children) walk(children, depth + 1)
    }
  }
  walk(roots, 0)
  return options
}
