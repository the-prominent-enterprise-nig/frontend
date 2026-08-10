import { test, expect, type Page } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
  pickFromCustomSelect,
} from './utils'

// Scenario 15, Part 5 — a curated per-SKU down payment (from the admin's
// "Down Payment" field on a Price List item) auto-fills at checkout instead
// of the generic 10%-floor fallback, once a financing term is picked. Uses
// the CREDIT CARD price use type (Scenario 15 Part 1) since it's guaranteed
// to have no other active price list anywhere in this suite, avoiding any
// date-overlap collision with the seeded WIP/CR-BR lists or other specs'
// fixtures under ZI/PROMO/SSC.

const NAME_PREFIX = 'E2E Price List Installment Terms — '
const ITEM_NAME = 'Universal Remote Control'
const CURATED_DOWN_PAYMENT = '25.00'

test.describe('Inventory — Price List curated down payment at checkout', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
  })

  async function ensureOpenSession(page: Page, branchName: string) {
    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
    const branchId = branches.find((b) => b.name === branchName)!.id

    const terminalsRes = await page.request.get('/api/pos/terminals', { params: { branchId } })
    const terminals = (await terminalsRes.json()) as { id: string; status: string }[]
    const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]

    const sessionsRes = await page.request.get('/api/pos/sessions', {
      params: { terminalId: terminal.id, status: 'open' },
    })
    const openSessions = (await sessionsRes.json()) as { id: string }[]
    for (const s of openSessions) {
      await page.request.post(`/api/pos/sessions/${s.id}/close`, {
        data: { declaredClosingCash: 0 },
      })
    }
    await page.request.post('/api/pos/sessions/open', {
      data: { terminalId: terminal.id, openingCash: 1000 },
    })
  }

  test('admin sets a Down Payment on a price list item, and it auto-fills at checkout instead of the 10% floor', async ({
    page,
    request,
  }) => {
    const name = `${NAME_PREFIX}${Date.now()}`

    // ─── Admin: create + price the list under CREDIT CARD ──────────────────
    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), name)
    await pickFromCustomSelect(page, 'Select price use type…', 'CREDIT CARD')
    await page.getByRole('button', { name: 'Create Price List' }).click()
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const row = page.getByRole('row').filter({ hasText: name })
    await clickStable(
      row.getByRole('button', { name: 'Manage Items' }),
      page.getByRole('heading', { name: 'Manage Items' })
    )
    await clickStable(
      page.getByRole('button', { name: 'Add Item' }),
      page.getByPlaceholder('Search item by name or SKU…')
    )
    await page.getByPlaceholder('Search item by name or SKU…').fill(ITEM_NAME)
    await page
      .getByRole('button', { name: new RegExp(ITEM_NAME) })
      .first()
      .click()
    // Price, Floor Price, Down Payment, Min Qty — in that order (see
    // PriceListItemsModal.tsx). Only Price and Down Payment matter here.
    await fillStable(page.getByPlaceholder('0.00').first(), '168.00')
    await fillStable(page.getByPlaceholder('0.00').nth(2), CURATED_DOWN_PAYMENT)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const itemRow = page.locator('tbody tr').filter({ hasText: ITEM_NAME })
    await expect(itemRow).toContainText(CURATED_DOWN_PAYMENT.replace('.00', ''), {
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Manage Items' })).not.toBeVisible()

    // Approve — a price list only applies at checkout once active.
    await clickStable(
      row.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Approve Price List' })).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(row).toContainText('Active')

    // ─── Cashier side: checkout picks up the curated down payment ──────────
    await ensureOpenSession(page, 'Bago')
    await gotoReady(page, '/pos/checkout')

    const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
    if (await sessionSelect.isVisible().catch(() => false)) {
      const sessionOptionValue = await sessionSelect
        .locator('option', { hasText: 'Bago' })
        .getAttribute('value')
      await sessionSelect.selectOption(sessionOptionValue!)
    }

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill(ITEM_NAME)
    const remoteCard = page
      .getByRole('button')
      .filter({ has: page.getByText(ITEM_NAME, { exact: true }) })
    await expect(remoteCard.first()).toBeVisible({ timeout: 10_000 })
    await remoteCard.first().click()
    await page.getByLabel('Price Use').selectOption({ label: 'CREDIT CARD' })

    await clickStable(
      page.getByRole('button', { name: 'Installment', exact: true }),
      page.getByPlaceholder('Down payment')
    )

    const termSelect = page.locator('select').filter({ hasText: 'Select a term' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await termSelect.selectOption({ index: 1 })

    await expect(page.getByPlaceholder('Down payment')).toHaveValue(CURATED_DOWN_PAYMENT, {
      timeout: 10_000,
    })

    const id = await findPriceListIdByName(request, name)
    await request.delete(`/api/inventory/price-lists/${id}`)
  })
})
