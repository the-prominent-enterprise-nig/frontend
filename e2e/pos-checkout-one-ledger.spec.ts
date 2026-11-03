import { test, expect, type Page } from '@playwright/test'
import {
  gotoReady,
  fillStable,
  openCustomSelect,
  deleteCustomers,
  sweepE2ECustomers,
} from './utils'
import { addInstallmentLine, addItemToCart, ensureBagoSession } from './credit-application-checkout'

// Client notes 2026-10-28: an installment sale is ONE plan — several items are
// one sale, so one ledger and one collection; the only difference to a one-item
// sale is the higher price. The server side is covered by
// backend/test/pos-one-ledger-multi-item.e2e-spec.ts; this drives the checkout
// page for a real two-item sale and reads back what the cashier and the ledger
// get.
//
// Needs a till session at Bago and these items stocked there: DOWELL STF3238
// (added by addInstallmentLine) and AULA F606HWL. The sale waives the credit
// application (a typed reason and note), as pos-checkout-credit-waiver does.

const PREFIX = 'E2E OneLedger'
const SECOND_ITEM = 'F606HWL'
const createdCustomerIds: string[] = []

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

test.describe('POS checkout — one ledger for several items', () => {
  test.describe.configure({ timeout: 180_000 })

  test.beforeEach(async ({ page }) => {
    await ensureBagoSession(page)
    await sweepE2ECustomers(page.request, PREFIX)
  })

  test.afterAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: 'e2e/.auth/business-owner.json',
    })
    await deleteCustomers(context.request, createdCustomerIds)
    await context.close()
  })

  test('OL-UI-01: two items post as ONE plan — one card on the success screen, one installment account', async ({
    page,
  }) => {
    const stamp = Date.now()
    const name = `${PREFIX} ${stamp}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: {
        name,
        customerType: 'individual',
        phone: `0917${stamp.toString().slice(-7)}`,
      },
    })
    expect(customerRes.ok(), await customerRes.text()).toBeTruthy()
    const customer = await customerRes.json()
    createdCustomerIds.push(customer.id)

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)
    await addItemToCart(page, SECOND_ITEM, 1)
    await selectCustomer(page, name)
    await expect(page.getByTestId('installment-plan')).toHaveCount(1, { timeout: 15_000 })

    // One term for the whole plan; the credit application is waived.
    await page.getByTestId('credit-waiver-checkbox').check()
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    await page.getByRole('listbox').getByRole('option').first().click()

    const section = page.getByTestId('price-override-exception')
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(
      section.getByLabel('Note for the price override or typed terms'),
      'One ledger check'
    )

    const salesInvoiceNumber = `SI-OLUI-${stamp}`
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')
    await fillStable(page.getByPlaceholder('CR Number'), `CR-OLUI-${stamp}`)

    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 45_000,
    })

    // One card for the plan, listing both items — not a monthly per item.
    const outcome = page.getByTestId('installment-outcome')
    await expect(outcome).toHaveCount(1)
    await expect(outcome).toContainText('2 items')
    await expect(outcome).toContainText('STF3238')
    await expect(outcome).toContainText(SECOND_ITEM)
    await expect(outcome.getByText('Monthly Installment')).toHaveCount(1)

    // And one ledger behind it.
    const accountsRes = await page.request.get('/api/crm/installment-accounts', {
      params: { customerId: customer.id },
    })
    expect(accountsRes.ok(), await accountsRes.text()).toBeTruthy()
    const accounts = ((await accountsRes.json()).data ?? []) as { id: string }[]
    expect(accounts).toHaveLength(1)

    // The ledger lists BOTH items it carries, not just the first.
    await gotoReady(page, `/crm/customers/${customer.id}/installments/${accounts[0].id}`)
    await expect(page.getByTestId('ledger-item')).toHaveCount(2, { timeout: 30_000 })
  })
})
