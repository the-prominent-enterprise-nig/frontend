'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BankAccounts,
  UnidentifiedBankCredits,
  type BankAccount,
  type UnidentifiedBankCredit,
} from '@/src/libs/data/AccountingV2Data'
import {
  AdjustingForm,
  BANK_RECON_HREF,
  ReclassifyForm,
  UnidentifiedCreditForm,
} from './BankReconForms'

// Client wrappers behind the Bank Reconciliation form routes: load what the
// form needs, and send Cancel/Done back to the list.

function useBankAccounts(): BankAccount[] {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  useEffect(() => {
    BankAccounts.list().then((r) => setAccounts(r.data ?? []))
  }, [])
  return accounts
}

function useBack(): () => void {
  const router = useRouter()
  return () => router.push(BANK_RECON_HREF)
}

export function AdjustingEntryPage() {
  const back = useBack()
  return <AdjustingForm accounts={useBankAccounts()} onClose={back} onSaved={back} />
}

export function UnidentifiedCreditPage() {
  const back = useBack()
  return <UnidentifiedCreditForm accounts={useBankAccounts()} onClose={back} onSaved={back} />
}

export function ReclassifyPage({ id }: { id: string }) {
  const back = useBack()
  const [credit, setCredit] = useState<UnidentifiedBankCredit | null | undefined>(undefined)
  useEffect(() => {
    UnidentifiedBankCredits.list().then((r) =>
      setCredit((r.data ?? []).find((c) => c.id === id) ?? null)
    )
  }, [id])
  if (credit === undefined) return <div className="p-10 text-sm text-gray-400">Loading...</div>
  if (!credit) return <div className="p-10 text-sm text-gray-500">Credit not found.</div>
  return <ReclassifyForm credit={credit} onClose={back} onSaved={back} />
}
