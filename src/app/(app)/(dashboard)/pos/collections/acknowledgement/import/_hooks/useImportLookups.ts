'use client'

import { useEffect, useState } from 'react'
import {
  BankAccounts,
  ClearingSettlements,
  type BankAccountOption,
} from '@/src/libs/data/AccountingV2Data'
import { getAccountOptions, type Account } from '@/src/libs/data/AccountingData'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { useBranches } from '@/src/app/(app)/(dashboard)/pos/_hooks/usePos'

export type ImportLookups = {
  /** Branch names — the file matches a branch by its exact name. */
  branchNames: string[]
  branchesLoading: boolean
  /** Bank / cash accounts — matched by exact name too. */
  bankAccounts: Pick<BankAccountOption, 'name' | 'bankName'>[]
  /** Financing partner names (Tonik, Salmon…) — matched by exact name too. */
  financingPartnerNames: string[]
  /** The chart, depth-ordered, with the account NUMBER as the option id —
   * that is what the file carries in the two account columns. Accounts with no
   * number can't be named in a file and are left out. */
  accountOptions: CategorySelectOption[]
}

// Same walk the receipt form uses (flat list + parentId → depth-ordered),
// except the id is the account number, since the CSV names accounts by number.
function accountsToNumberOptions(accounts: Account[]): CategorySelectOption[] {
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
      if (a.number) options.push({ id: a.number, name: `${a.number} — ${a.name}`, depth })
      const children = childrenByParent.get(a.id)
      if (children) walk(children, depth + 1)
    }
  }
  walk(roots, 0)
  return options
}

/** What the row edit panels' pickers choose from. Loaded once, when the import
 * page opens, so the panels have their lists by the time a file is reviewed. */
export function useImportLookups(): ImportLookups {
  const { data: branchesData, isLoading: branchesLoading } = useBranches()
  const branchNames = ((branchesData?.data ?? []) as Array<{ name: string }>).map((b) => b.name)
  const [bankAccounts, setBankAccounts] = useState<ImportLookups['bankAccounts']>([])
  const [financingPartnerNames, setFinancingPartnerNames] = useState<string[]>([])
  const [accountOptions, setAccountOptions] = useState<CategorySelectOption[]>([])

  useEffect(() => {
    BankAccounts.options().then((res) => setBankAccounts(res.data ?? []))
    ClearingSettlements.activeTpfProviders().then((res) =>
      setFinancingPartnerNames((res.data ?? []).map((p) => p.name))
    )
    getAccountOptions().then((res) => {
      const list = ((res.data as any)?.items ?? res.data ?? []) as Account[]
      setAccountOptions(accountsToNumberOptions(list))
    })
  }, [])

  return { branchNames, branchesLoading, bankAccounts, financingPartnerNames, accountOptions }
}
