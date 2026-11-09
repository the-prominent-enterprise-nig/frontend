import { test, expect } from '@playwright/test'
import { deleteCustomers, gotoReady, sweepE2ECustomers } from './utils'

// Scenario 80 Part 3 — Oct 29 UAT rules not already covered by the updated
// checkout / collections specs:
//   - POS-04 a customer saves without a phone number
//   - DC-02  Collections no longer has a date override (it used to cap at today)
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

  test('DC-02: Collections has no date override — the screen always reads real today', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/collections')
    await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible()
    await expect(page.getByTestId('collections-override-date')).toHaveCount(0)
    await expect(page.getByText('Override current date')).toHaveCount(0)
  })
})
