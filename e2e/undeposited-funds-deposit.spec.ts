import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { deleteCustomers, gotoReady, loginAs, pickComboboxOption } from './utils'

/**
 * Scenario 61 Part 5 — a POS deposit from the Undeposited Funds page, end to
 * end: tick a closed session → Record deposit (a draft, with the slip) → it
 * waits under Awaiting clearing → accounting opens it and clears it, which
 * posts Dr Bank / Cr Undeposited Funds → the session reads Deposited.
 *
 * Seeds its own closed session (a cash sale at an odd centavo amount, so its
 * row is unambiguous). Clearing posts a journal entry, so the deposit stays
 * behind on the e2e DB — the same as any cleared deposit a person makes.
 *
 * Rules (attachment required, branch scoping, CAS, the JE itself) are covered
 * by backend/test/pos-deposits.e2e-spec.ts.
 */

const PREFIX = 'E2E-S61-DEP'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

async function unwrap<T>(res: APIResponse): Promise<T[]> {
  const body = await res.json()
  return Array.isArray(body) ? body : (body.data ?? body.items ?? [])
}

async function ok<T>(res: APIResponse, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`)
  return res.json()
}

/** Opens a session on a Bago terminal, sells `price` for cash, closes it.
 * Returns the session's undeposited amount as the page prints it. */
async function seedClosedCashSession(
  request: APIRequestContext,
  price: number
): Promise<{ sessionId: string; customerId: string; amount: number }> {
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

/** ₱1,234.57 — the page's money format. */
function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

test.describe('Undeposited Funds — record and clear a POS deposit (Scenario 61 Part 5)', () => {
  let seeded: { sessionId: string; customerId: string; amount: number }

  test.beforeAll(async ({ request }) => {
    // Odd centavos so the seeded row is the only one with this amount.
    const price =
      600 + Math.floor(Math.random() * 300) + Math.floor(Math.random() * 99) / 100 + 0.01
    seeded = await seedClosedCashSession(request, Math.round(price * 100) / 100)
  })

  test.afterAll(async ({ request }) => {
    // A run that stopped before Clear & post leaves its draft holding the
    // session; cancel it so the session goes back to To deposit.
    const drafts = await unwrap<{ id: string; reference: string | null }>(
      await request.get(`/api/pos-deposits?status=draft&search=${PREFIX}&pageSize=50`)
    )
    for (const d of drafts.filter((d) => d.reference?.startsWith(PREFIX))) {
      await request.post(`/api/pos-deposits/${d.id}/cancel`).catch(() => {})
    }
    if (seeded?.customerId) await deleteCustomers(request, [seeded.customerId]).catch(() => {})
  })

  test('tick → record a draft with its slip → awaiting → clear & post → deposited', async ({
    page,
  }) => {
    const reference = `${PREFIX}-${Date.now()}`
    await gotoReady(page, '/accounting/cash-in-transit')
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 15_000,
    })

    // To deposit is the opening view; the seeded session is in it.
    // Session rows only: a branch's header row (it has the collapse button)
    // shows the branch total, which equals this amount when it is alone.
    const row = page
      .locator('tbody tr', { hasText: peso(seeded.amount) })
      .filter({ hasNot: page.getByRole('button') })
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    await expect(row).toContainText('To deposit')
    await row.getByLabel('Select session').check()

    await page.getByRole('button', { name: /Record Deposit/ }).click()
    const dialog = page.locator('div.fixed', {
      has: page.getByRole('heading', { name: 'Record deposit' }),
    })
    await expect(dialog.getByText(peso(seeded.amount)).first()).toBeVisible()
    await pickComboboxOption(page, 'Search bank account…')
    await dialog.getByPlaceholder('Deposit slip / reference number').fill(reference)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'deposit-slip.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
        'base64'
      ),
    })
    await expect(dialog.getByText('deposit-slip.png')).toBeVisible()
    await dialog.getByRole('button', { name: 'Record deposit' }).click()
    await expect(page.getByText('Deposit recorded', { exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // Out of To deposit, into Awaiting clearing.
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: /^Awaiting clearing \(/ }).click()
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    await expect(row).toContainText('Awaiting')

    // Accounting opens it: the slip is there, so Clear & post is live.
    await row.click()
    await expect(page.getByText(`Ref ${reference}`, { exact: false })).toBeVisible()
    await expect(page.getByText('Awaiting clearing', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('deposit-slip.png')).toBeVisible()
    const clear = page.getByRole('button', { name: /Clear & post/ })
    await expect(clear).toBeEnabled()
    await clear.click()
    await page.getByRole('button', { name: 'Clear & post' }).last().click()
    await expect(page.getByText('Deposit cleared and posted')).toBeVisible({ timeout: 15_000 })

    // Gone from Awaiting; reads Deposited.
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: 'Deposited', exact: true }).click()
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    await expect(row).toContainText('Deposited')
  })
})

test.describe('Undeposited Funds — the branch reads, accounting deposits', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Branch Manager sees the balances but gets no Record Deposit and no tick boxes', async ({
    page,
  }) => {
    await loginAs(page, MANAGER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/undeposited-funds')
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Awaiting clearing', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Record Deposit/ })).toHaveCount(0)
    await expect(page.getByLabel('Select session')).toHaveCount(0)
  })
})
