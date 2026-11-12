import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { deleteCustomers, gotoReady } from './utils'

/**
 * A deposit slip matching an Unidentified Bank Credit, from POS → Undeposited
 * Funds: tick a closed session → Record deposit → Bank account "Unidentified
 * Bank Credits — 2-01-042" → pick the credit Bank Reconciliation recorded →
 * its amount and reference fill the slip → record → the session is banked and
 * the credit is no longer unmatched.
 *
 * Seeds its own closed cash session and a credit of the same odd-centavo
 * amount, so both are unambiguous. The posting itself (Dr 2-01-042 / Cr the
 * Deposit from account, no second bank debit), the full-amount rule and
 * corrections are covered by
 * backend/test/pos-deposits-unidentified-credit.e2e-spec.ts.
 */

const PREFIX = 'E2E-UBC-SLIP'

async function unwrap<T>(res: APIResponse): Promise<T[]> {
  const body = await res.json()
  return Array.isArray(body) ? body : (body.data ?? body.items ?? [])
}

async function ok<T>(res: APIResponse, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`)
  return res.json()
}

interface Seeded {
  sessionId: string
  customerId: string
  amount: number
  creditId: string
  bankRef: string
  cashFundName: string
}

/** Opens a session on the first active terminal that has none open — a DB
 * that was not freshly seeded can have someone's session left open on one. */
async function openSessionOnFreeTerminal(request: APIRequestContext): Promise<{ id: string }> {
  const terminals = await unwrap<{ id: string; status: string; branchId: string | null }>(
    await request.get('/api/pos/terminals?limit=200')
  )
  let lastError = 'no active terminal'
  for (const t of terminals.filter((t) => t.status === 'active' && t.branchId)) {
    const res = await request.post('/api/pos/sessions/open', {
      data: { terminalId: t.id, openingCash: 0 },
    })
    if (res.ok()) return res.json()
    lastError = await res.text()
  }
  throw new Error(`open session: ${lastError}`)
}

/** Opens a session on a free terminal, sells `price` for cash, closes it. */
async function seedClosedCashSession(
  request: APIRequestContext,
  price: number
): Promise<{ sessionId: string; customerId: string; amount: number }> {
  const session = await openSessionOnFreeTerminal(request)
  const items = await unwrap<{ id: string; name: string; isSerialTracked: boolean }>(
    await request.get('/api/inventory/items?limit=200')
  )
  const item = items.find((i) => !i.isSerialTracked)
  if (!item) throw new Error('No non-serial-tracked item')
  const customer = await ok<{ id: string }>(
    await request.post('/api/crm/customers', {
      data: {
        name: `${PREFIX} ${Date.now()}`,
        sourceChannel: 'pos_walkin',
        phone: `09${Date.now().toString().slice(-9)}`,
      },
    }),
    'create customer'
  )
  const sale = await ok<{ id: string; totalAmount: string | number }>(
    await request.post('/api/pos/transactions', {
      data: {
        sessionId: session.id,
        customerId: customer.id,
        salesInvoiceNumber: `SI-${PREFIX}-${Date.now()}`,
        subtotal: price,
        totalAmount: price,
        currency: 'PHP',
        lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: price }],
      },
    }),
    'cash sale'
  )
  const total = Number(sale.totalAmount)
  await ok(
    await request.post(`/api/pos/transactions/${sale.id}/payments`, {
      data: { paymentMethod: 'cash', amount: total },
    }),
    'pay sale'
  )
  await ok(
    await request.post(`/api/pos/sessions/${session.id}/close`, {
      data: { declaredClosingCash: total },
    }),
    'close session'
  )
  return { sessionId: session.id, customerId: customer.id, amount: total }
}

/** An Unidentified Bank Credit of `amount`, as Bank Reconciliation records
 * one, at a bank other than the branch's Cash on Hand fund — which the slip
 * then empties. */
async function seedCredit(
  request: APIRequestContext,
  amount: number
): Promise<Pick<Seeded, 'creditId' | 'bankRef' | 'cashFundName'>> {
  const accounts = await unwrap<{
    id: string
    name: string
    accountType: string
    isActive: boolean
  }>(await request.get('/api/bank-accounts'))
  const bank = accounts.find((a) => a.isActive && a.accountType !== 'Cash')
  const cashFund = accounts.find((a) => a.isActive && a.accountType === 'Cash')
  if (!bank || !cashFund) throw new Error('Seed needs a bank and a Cash on Hand fund')
  const bankRef = `${PREFIX}-${Date.now()}`
  const credit = await ok<{ id: string }>(
    await request.post('/api/bank-accounts/unidentified-bank-credits', {
      data: {
        bankAccountId: bank.id,
        amount,
        creditDate: '2026-10-05',
        bankRef,
        voucherControlNo: `${PREFIX}-JV-${Date.now()}`,
      },
    }),
    'record unidentified credit'
  )
  return { creditId: credit.id, bankRef, cashFundName: cashFund.name }
}

/** ₱1,234.57 — the page's money format. */
function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

test.describe('Undeposited Funds — a slip matching an Unidentified Bank Credit', () => {
  let seeded: Seeded

  test.beforeAll(async ({ request }) => {
    // Odd centavos so the seeded row and credit are the only ones this amount.
    const price = Math.round((700 + Math.random() * 200) * 100) / 100 + 0.01
    const session = await seedClosedCashSession(request, Math.round(price * 100) / 100)
    seeded = { ...session, ...(await seedCredit(request, session.amount)) }
  })

  test.afterAll(async ({ request }) => {
    if (seeded?.customerId) await deleteCustomers(request, [seeded.customerId]).catch(() => {})
  })

  test('pick 2-01-042 → pick the credit → amount and reference fill → record → banked and matched', async ({
    page,
    request,
  }) => {
    await gotoReady(page, '/pos/undeposited-funds')
    const row = page
      .locator('tbody tr', { hasText: peso(seeded.amount) })
      .filter({ has: page.getByLabel('Select session') })
    await expect(row).toHaveCount(1, { timeout: 20_000 })
    await row.getByLabel('Select session').check()
    // The selection bar's button (beside its Clear), not a branch row's
    // "deposit the receipts" one, which opens with no sessions.
    await page
      .getByRole('button', { name: 'Clear', exact: true })
      .locator('..')
      .getByRole('button', { name: /Record deposit/ })
      .click()
    await expect(page.getByRole('heading', { name: 'Record deposit' })).toBeVisible()

    // Bank account: searchable like any bank, no heading of its own.
    const bank = page.getByPlaceholder('Bank account…')
    await bank.click()
    await bank.fill('unide')
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: 'Unidentified Bank Credits — 2-01-042' })
      .click()

    // Then which credit — listed with its reference.
    await page.getByPlaceholder('Which unidentified credit…').click()
    await page.getByTestId('searchable-select-option').filter({ hasText: seeded.bankRef }).click()

    const amount = page.getByLabel('slip 1 amount')
    const reference = page.getByLabel('slip 1 reference')
    await expect(amount).toHaveValue(String(seeded.amount))
    await expect(reference).toHaveValue(seeded.bankRef)
    await expect(reference).toHaveAttribute('readonly', '')

    const deposit = page.getByLabel('slip 1 deposit from')
    await deposit.click()
    await deposit.fill(seeded.cashFundName)
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: seeded.cashFundName })
      .first()
      .click()

    // The amount is typed like any slip's, but a credit is matched whole.
    const submit = page.locator('button[type="submit"]', { hasText: 'Record deposit' })
    await amount.fill(String(Math.round((seeded.amount - 1) * 100) / 100))
    await expect(submit).toBeDisabled()
    await amount.fill(String(seeded.amount))
    await expect(submit).toBeEnabled()

    await submit.click()
    await expect(page.getByText('Deposit recorded', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(row).toHaveCount(0)

    // Bank Reconciliation no longer lists it as waiting to be identified.
    const unmatched = await unwrap<{ id: string }>(
      await request.get('/api/bank-accounts/unidentified-bank-credits?status=unmatched')
    )
    expect(unmatched.some((c) => c.id === seeded.creditId)).toBe(false)
  })
})
