import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { deleteCustomers, gotoReady, pickComboboxOption, pickSearchableOption } from './utils'

/**
 * A card slip names the provider it banks.
 *
 * BDO and BPI card money both post to the one POS_CARD clearing account, so a
 * slip that only says "1-01-043" cannot say whose money it is — the deposit
 * cleared the OLDEST ticked session's card money, and the Daily Collection
 * for the day the BDO sale was made read it as undeposited (Mabini, Nov 2026).
 * Now Record deposit asks which provider a slip banks when two or more share
 * the account it empties, and the deposit clears that provider's takings.
 *
 * Seeds two closed sessions of its own — the older one's card sale on BPI, the
 * newer one's on BDO, at odd centavo amounts so each row is unambiguous — and
 * deposits the newer one's amount with the older one ticked as well. The
 * backend rules (allocation, validation, correction) are covered by
 * backend/test/pos-deposits.e2e-spec.ts.
 */

const PREFIX = 'E2E-DEP-PROV'

async function unwrap<T>(res: APIResponse): Promise<T[]> {
  const body = await res.json()
  return Array.isArray(body) ? body : (body.data ?? body.items ?? [])
}

async function ok<T>(res: APIResponse, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`)
  return res.json()
}

/** ₱1,234.57 — the page's money format. */
function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** `amount` is what the session's row prints (cash plus card); `card` is the
 * provider's part of it. */
type Seeded = { sessionId: string; customerId: string; amount: number; card: number }

/** A session needs cash to bank to be offered to a deposit at all, so every
 * seeded session also takes this much over the counter. */
const CASH_PART = 100

/** Opens a session on a Bago terminal, takes ₱100 in cash, sells `price` by
 * card through `provider`, and closes it — so the session holds that
 * provider's card money. */
async function seedClosedCardSession(
  request: APIRequestContext,
  price: number,
  provider: 'BDO' | 'BPI'
): Promise<Seeded> {
  const branches = await unwrap<{ id: string; name: string }>(
    await request.get('/api/branches?limit=200')
  )
  const branch = branches.find((b) => b.name === 'Bago') ?? branches[0]
  const terminals = await unwrap<{ id: string; branchId: string | null }>(
    await request.get('/api/pos/terminals?limit=200')
  )
  const terminal = terminals.find((t) => t.branchId === branch.id)
  if (!terminal) throw new Error(`No terminal for ${branch.name}`)

  const open = await unwrap<{ id: string; terminalId: string }>(
    await request.get('/api/pos/sessions?status=open&limit=50')
  )
  for (const s of open.filter((s) => s.terminalId === terminal.id)) {
    await request.post(`/api/pos/sessions/${s.id}/close`, { data: { declaredClosingCash: 0 } })
  }
  const session = await ok<{ id: string }>(
    await request.post('/api/pos/sessions/open', {
      data: { terminalId: terminal.id, openingCash: 0 },
    }),
    'open session'
  )

  const configs = await unwrap<{ key: string; options: { id: string; name: string }[] }>(
    await request.get('/api/pos/payment-method-configs')
  )
  const option = configs.find((c) => c.key === 'card')?.options.find((o) => o.name === provider)
  if (!option) throw new Error(`No card option named ${provider}`)

  const items = await unwrap<{ id: string; name: string; isSerialTracked: boolean }>(
    await request.get('/api/inventory/items?limit=200')
  )
  const item = items.find((i) => !i.isSerialTracked)
  if (!item) throw new Error('No non-serial-tracked item')
  const customer = await ok<{ id: string }>(
    await request.post('/api/crm/customers', {
      data: {
        name: `${PREFIX} ${provider} ${Date.now()}`,
        sourceChannel: 'pos_walkin',
        phone: `09${Date.now().toString().slice(-9)}`,
      },
    }),
    'create customer'
  )
  const sell = async (
    amount: number,
    payment: Record<string, unknown>,
    what: string
  ): Promise<number> => {
    const sale = await ok<{ id: string; totalAmount: string | number }>(
      await request.post('/api/pos/transactions', {
        data: {
          sessionId: session.id,
          customerId: customer.id,
          salesInvoiceNumber: `SI-${PREFIX}-${provider}-${what}-${Date.now()}`,
          subtotal: amount,
          totalAmount: amount,
          currency: 'PHP',
          lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: amount }],
        },
      }),
      `${what} sale`
    )
    const total = Number(sale.totalAmount)
    await ok(
      await request.post(`/api/pos/transactions/${sale.id}/payments`, {
        data: { ...payment, amount: total },
      }),
      `pay ${what} sale`
    )
    return total
  }
  const cash = await sell(CASH_PART, { paymentMethod: 'cash' }, 'cash')
  const card = await sell(
    price,
    { paymentMethod: 'card', paymentMethodOptionId: option.id },
    'card'
  )
  // The drawer holds only the cash: the card money is with the processor.
  await ok(
    await request.post(`/api/pos/sessions/${session.id}/close`, {
      data: { declaredClosingCash: cash },
    }),
    'close session'
  )
  return { sessionId: session.id, customerId: customer.id, amount: cash + card, card }
}

/** Odd centavos so the seeded row is the only one with this amount. */
function oddAmount(base: number): number {
  return Math.round((base + Math.floor(Math.random() * 300) + 0.37) * 100) / 100
}

/** The provider each slip of the deposit recorded under `reference` names. */
async function namedProviders(
  request: APIRequestContext,
  reference: string
): Promise<(string | null)[]> {
  const deposits = await unwrap<{ id: string; reference: string | null }>(
    await request.get(`/api/pos-deposits?search=${reference}&pageSize=10`)
  )
  const deposit = deposits.find((d) => d.reference?.includes(reference))
  expect(deposit, 'the deposit is listed').toBeTruthy()
  const detail = await ok<{ lines: { clearsTender: string | null }[] }>(
    await request.get(`/api/pos-deposits/${deposit!.id}`),
    'deposit detail'
  )
  return detail.lines.map((l) => l.clearsTender)
}

test.describe('Record deposit — a card slip names the provider it banks', () => {
  let older: Seeded // BPI card money, closed first
  let newer: Seeded // BDO card money, closed second

  test.beforeAll(async ({ request }) => {
    older = await seedClosedCardSession(request, oddAmount(30_000), 'BPI')
    newer = await seedClosedCardSession(request, oddAmount(500), 'BDO')
  })

  test.afterAll(async ({ request }) => {
    await deleteCustomers(
      request,
      [older?.customerId, newer?.customerId].filter((id): id is string => !!id)
    ).catch(() => {})
  })

  test('two providers share the account: the slip must say which, and only that provider is banked', async ({
    page,
    request,
  }) => {
    const reference = `${PREFIX}-${Date.now()}`
    await gotoReady(page, '/pos/undeposited-funds')
    await expect(page.getByRole('heading', { name: 'Collected Funds History' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: /^Undeposited \(/ }).click()

    // Session rows only: a branch's header row (it has the collapse button)
    // can show a total that equals one session's amount.
    const rowOf = (s: Seeded) =>
      page
        .locator('tbody tr', { hasText: peso(s.amount) })
        .filter({ hasNot: page.getByRole('button') })
    await expect(rowOf(older)).toHaveCount(1, { timeout: 15_000 })
    await expect(rowOf(newer)).toHaveCount(1)
    await rowOf(older).getByLabel('Select session').check()
    await rowOf(newer).getByLabel('Select session').check()

    await page.getByRole('button', { name: 'Record deposit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Record deposit' })).toBeVisible()

    // One slip: the BDO money, taken from the Credit Card / POS clearing account.
    await pickComboboxOption(page, 'Bank account…')
    await page.getByLabel('slip 1 amount').fill(String(newer.card))
    await page.getByLabel('slip 1 reference').fill(reference)

    // Nothing asked while no account is chosen.
    await expect(page.getByTestId('slip-provider')).toHaveCount(0)
    await pickSearchableOption(
      page,
      'slip 1 deposit from',
      '1-01-043 — Credit Card / POS Clearing Account'
    )

    // BDO and BPI both post to 1-01-043, so the slip has to say which.
    const picker = page.getByTestId('slip-provider')
    await expect(picker).toBeVisible()
    // The dialog's own button: the selection bar's is still behind it.
    const submit = page.locator('form').getByRole('button', { name: 'Record deposit', exact: true })
    await expect(submit).toBeDisabled()
    await expect(page.getByText(/say whose money it banks/i)).toBeVisible()

    // The choices are the providers of the ticked sessions, with what each
    // still has to bank, and an explicit "not specified".
    await page.getByLabel('slip 1 provider', { exact: true }).click()
    const options = page.getByTestId('searchable-select-option')
    await expect(options).toHaveCount(3)
    await expect(options.nth(0)).toContainText(`BDO — ${peso(newer.card)} to bank`)
    await expect(options.nth(1)).toContainText(`BPI — ${peso(older.card)} to bank`)
    await expect(options.nth(2)).toContainText('Not specified')
    await options.nth(0).click()

    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(page.getByText('Deposit recorded', { exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // The BDO session is banked; the older BPI session is untouched.
    await expect(rowOf(newer)).toHaveCount(0, { timeout: 15_000 })
    await expect(rowOf(older)).toHaveCount(1)
    await expect(rowOf(older)).toContainText('For deposit')

    // The slip kept the provider it named.
    expect(await namedProviders(request, reference)).toEqual(['card::BDO'])
  })

  test('one provider on the account: nothing to ask — the slip names it itself', async ({
    page,
    request,
  }) => {
    const solo = await seedClosedCardSession(request, oddAmount(700), 'BDO')
    try {
      const reference = `${PREFIX}-SOLO-${Date.now()}`
      await gotoReady(page, '/pos/undeposited-funds')
      await expect(page.getByRole('heading', { name: 'Collected Funds History' })).toBeVisible({
        timeout: 15_000,
      })
      await page.getByRole('button', { name: /^Undeposited \(/ }).click()
      const row = page
        .locator('tbody tr', { hasText: peso(solo.amount) })
        .filter({ hasNot: page.getByRole('button') })
      await expect(row).toHaveCount(1, { timeout: 15_000 })
      await row.getByLabel('Select session').check()

      await page.getByRole('button', { name: 'Record deposit', exact: true }).click()
      await pickComboboxOption(page, 'Bank account…')
      await page.getByLabel('slip 1 amount').fill(String(solo.card))
      await page.getByLabel('slip 1 reference').fill(reference)
      await pickSearchableOption(
        page,
        'slip 1 deposit from',
        '1-01-043 — Credit Card / POS Clearing Account'
      )

      // Only BDO's money is in the ticked session: no question, just a note.
      await expect(page.getByTestId('slip-provider')).toHaveCount(0)
      await expect(page.getByTestId('slip-provider-note')).toContainText(
        `BDO — ${peso(solo.card)} to bank`
      )
      const submit = page
        .locator('form')
        .getByRole('button', { name: 'Record deposit', exact: true })
      await expect(submit).toBeEnabled()
      await submit.click()
      await expect(page.getByText('Deposit recorded', { exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(row).toHaveCount(0, { timeout: 15_000 })
      expect(await namedProviders(request, reference)).toEqual(['card::BDO'])
    } finally {
      await deleteCustomers(request, [solo.customerId]).catch(() => {})
    }
  })
})
