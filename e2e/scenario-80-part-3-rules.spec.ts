import { test, expect } from '@playwright/test'
import { deleteCustomers, gotoReady, sweepE2ECustomers } from './utils'

// Scenario 80 Part 3 — Oct 29 UAT rules not already covered by the updated
// checkout / collections specs:
//   - POS-04 a customer saves without a phone number
//   - DC-02  the Collections date override can't go into the future
// POS-11 (in-house down payment > 0) is in pos-checkout-combined-down-payment
// and pos-checkout-installment-down-payment-floor; POS-14 / CC-01 (CR number
// optional) in pos-checkout-mixed-payment and pos-collections-multiple-payments.

const PREFIX = 'E2E S80 No Phone'
const createdIds: string[] = []

test.describe('Scenario 80 Part 3 — rules', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, PREFIX)
  })
  test.afterAll(async ({ request }) => {
    await deleteCustomers(request, createdIds)
  })

  test('POS-04: the customer form marks Phone optional, and a customer saves without one', async ({
    page,
  }) => {
    await gotoReady(page, '/crm/customers/new')
    await expect(page.getByText('Phone', { exact: true })).toBeVisible()
    await expect(page.getByText('Phone *', { exact: true })).toHaveCount(0)

    const res = await page.request.post('/api/crm/customers', {
      data: { name: `${PREFIX} ${Date.now()}`, sourceChannel: 'sales' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const customer = await res.json()
    createdIds.push(customer.id)
    expect(customer.phone ?? null).toBeNull()
  })

  test('DC-02: the Collections date override stops at today', async ({ page }) => {
    await gotoReady(page, '/pos/collections')
    const override = page.getByTestId('collections-override-date')
    const today = new Date().toISOString().slice(0, 10)
    await expect(override).toHaveAttribute('max', today)

    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    await override.fill(nextWeek)
    await expect(override).toHaveValue(today)
    await expect(page.getByRole('button', { name: 'Reset to today' })).toHaveCount(0)

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await override.fill(yesterday)
    await expect(override).toHaveValue(yesterday)
    await expect(page.getByRole('button', { name: 'Reset to today' })).toBeVisible()
  })
})
