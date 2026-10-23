'use client'

import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { useSessions } from '../../../pos/_hooks/usePos'
import { writeCheckoutHandoff } from '@/src/libs/pos/checkout-handoff'
import type { DrDetail } from '@/src/schema/inventory/delivery-receipts'
import { BTN_PRIMARY } from './drFormUi'

/**
 * Scenario 72 Part 6 — rings up an approved "sales invoice to follow" DR at
 * POS. Same handoff as a credit application's "Continue to sale": no lines
 * travel, checkout builds the cart from the DR and its held units. Any open
 * till enables it; a session is only named when it is this user's own.
 */
export function DrProceedToPos({
  dr,
  userId,
}: {
  dr: DrDetail
  userId: string
}): React.JSX.Element {
  const router = useRouter()
  const { data } = useSessions({ status: 'open' })
  const openSessions = data?.data ?? []
  const mine = openSessions.filter((s) => s.cashierId === userId)
  const hasOpenSession = openSessions.length > 0

  function proceed(): void {
    writeCheckoutHandoff({
      customerId: dr.customerId ?? undefined,
      deliveryReceiptId: dr.id,
      sessionId: mine.length === 1 ? mine[0].id : undefined,
    })
    router.push('/pos/checkout')
  }

  return (
    <button type="button" onClick={proceed} disabled={!hasOpenSession} className={BTN_PRIMARY}>
      <ShoppingCart className="h-4 w-4" />
      {hasOpenSession ? 'Proceed to POS' : 'No open POS session'}
    </button>
  )
}
