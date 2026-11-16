/**
 * Docket #72 QA fail — a saved supplier expense reopens with its Item still on the line.
 *
 * A line stores only its Item's id (the API sends no name with it), so the form
 * used to open the Item box blank — "— None —" — while the line still held the
 * item. The form now looks the name up, the way it already looks up the SI.
 *
 * Self-cleaning: the draft it creates is deleted (the app only hides it, like
 * every other spec that creates one). Nothing is recorded, so no journal entry
 * is posted.
 */
import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

const createdIds: string[] = []

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) {
    await request.delete(`/api/expenses/${id}`).catch(() => {})
  }
})

test.describe('Expenses — a saved supplier expense keeps its Item on reopen', () => {
  test('the Item box names the saved item, on Major, with Qty and Unit price intact', async ({
    page,
    request,
  }) => {
    const suppliers = await (await request.get('/api/suppliers?limit=1')).json()
    const supplier = suppliers.data?.[0] as { id: string } | undefined
    test.skip(!supplier, 'No suppliers in this DB')
    if (!supplier) return

    const items = await (await request.get('/api/inventory/items?limit=20&lifecycle=active')).json()
    const item = (items.data ?? []).find((i: { name: string }) => i.name) as
      | { id: string; name: string; sku: string }
      | undefined
    test.skip(!item, 'No active items in this DB')
    if (!item) return

    const accounts = await (await request.get('/api/accounts?limit=500')).json()
    const rent = (
      (accounts.items ?? accounts.data ?? accounts) as { id: string; number: string }[]
    ).find((a) => a.number === '6-03-010')
    test.skip(!rent, 'No Rent Expense account (6-03-010) in this chart')
    if (!rent) return

    const created = await request.post('/api/expenses', {
      data: {
        expenseDate: new Date().toISOString().slice(0, 10),
        payeeType: 'SUPPLIER',
        supplierId: supplier.id,
        lines: [
          {
            categoryAccountId: rent.id,
            itemId: item.id,
            qty: 3,
            unitPrice: 100,
            amount: 300,
            taxCode: 'NON_VAT',
          },
        ],
        payments: [{ paymentMethod: 'CASH', amount: 300 }],
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const expense = await created.json()
    createdIds.push(expense.id)
    expect(expense.lines[0].itemId).toBe(item.id)

    await gotoReady(page, `/accounting/expenses/${expense.id}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible({
      timeout: 15_000,
    })

    // It opens on Major: the line carries an Item.
    await expect(
      page.locator('form').getByText('Supplier type', { exact: true }).locator('..')
    ).toContainText('Major')

    // The Item box names the item (name and SKU), not "— None —". Matched as a
    // plain substring: the box only ellipsizes it on screen.
    await expect(page.locator('form button', { hasText: item.name }).first()).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.locator('input[aria-label="Quantity"]').first()).toHaveValue('3')
    await expect(page.locator('input[aria-label="Unit price"]').first()).toHaveValue('100')
  })
})
