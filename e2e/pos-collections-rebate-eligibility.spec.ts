import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 57 Part 3 — a contract marked "not eligible for rebate" shows no
// rebate where it could otherwise be applied or read on the CRM side: the
// installment account detail's PPD row and its Record payment modal (Rebate
// field locked at 0). The backend's rebate_not_eligible guard on both payment
// paths is covered by collections-payment-rebate.e2e-spec.ts.
//
// POS Collections' own "not eligible" rendering isn't driven here: it needs
// a real POS installment schedule, and the isolated test DB has no priced,
// stocked, non-serial item to sell (every priced item is serial-tracked with
// no serial stock) — so it's covered by manual testing instead.
//
// Cleanup: the hand-entered account is deleted and the customer soft-deleted.

let createdCustomerId: string | undefined
let createdAccountId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdAccountId) {
    await page.request.delete(`/api/crm/installment-accounts/${createdAccountId}`)
    createdAccountId = undefined
  }
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

async function createCustomer(
  page: Page,
  name: string,
  phone: string
): Promise<{
  id: string
  coMakerId: string
}> {
  const res = await page.request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone,
      creditLimit: 200000,
      coMakers: [{ name: `${name} Co-Maker`, relationship: 'Spouse', contactNumber: phone }],
    },
  })
  const customer = await res.json()
  createdCustomerId = customer.id
  return { id: customer.id, coMakerId: customer.coMakers[0].id }
}

test('CRM account detail and Record payment lock the rebate for a not-eligible account', async ({
  page,
}) => {
  const name = `E2E Rebate Inelig CRM ${Date.now()}`
  const customer = await createCustomer(page, name, '09170005702')

  const accountRes = await page.request.post('/api/crm/installment-accounts', {
    data: {
      accountNumber: `S57-${String(Date.now()).slice(-8)}`,
      customerId: customer.id,
      listedCashPrice: 20000,
      downPayment: 2000,
      termMonths: 12,
      miFactor: 0.0954,
      rebateEligible: false,
    },
  })
  expect(accountRes.ok(), await accountRes.text()).toBeTruthy()
  const account = await accountRes.json()
  createdAccountId = account.id
  expect(account.rebateEligible).toBe(false)

  await gotoReady(page, `/crm/installment-accounts/${account.id}`)
  const ppdRow = page.getByText('PPD', { exact: true }).locator('..')
  await expect(ppdRow).toContainText('Not eligible')

  await page.getByRole('button', { name: 'Record payment' }).first().click()
  const rebateInput = page.locator('#payment-rebateAmount')
  await expect(rebateInput).toBeDisabled()
  await expect(rebateInput).toHaveValue('0')
  await expect(page.getByText('Not eligible for rebate — set at checkout.')).toBeVisible()
})
