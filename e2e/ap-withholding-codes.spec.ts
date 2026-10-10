/**
 * Scenario 69 Part D — suppliers, AP bills and receiving withhold at a tax code.
 *
 * Reads the seeded EWT codes of the tax code master (EWT-GOODS-1 1%, EWT-SERV-2
 * 2%, EWT-RENT-5 5%…) and asserts that:
 *  - the supplier form defaults a new supplier to EWT-GOODS-1 and offers the
 *    other EWT codes with their rates. It is opened and cancelled, never saved:
 *    there is no way to delete a supplier;
 *  - the New Bill form offers the same codes and says what the chosen one
 *    withholds, and a rent bill made through it is withheld at 5% with the code
 *    stored and named on the bill document;
 *  - the manual receiving report's goods / services choices carry the master's
 *    rates, not a figure typed into the screen.
 *
 * Self-cleaning: the bill it creates is deleted. The app only hides a deleted
 * bill (visibility=false), so one hidden DRAFT row stays behind per run, like
 * every other AP spec. It creates nothing else.
 * Changing a rate in the master cannot be undone (history is the point), so the
 * rates are only read here; the backend e2e
 * (scenario-69-ap-withholding-codes.e2e-spec.ts) covers a rate that changes.
 *
 * Needs the Part C and Part D migrations applied to the DB the stack runs against.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { fillStable, gotoReady, openCustomSelect } from './utils'

const createdBillIds: string[] = []

test.afterEach(async ({ request }) => {
  // DRAFT bills can be deleted; runs whether or not the test got to its end.
  for (const id of createdBillIds.splice(0)) {
    await request.delete(`/api/ap-bills/${id}`).catch(() => {})
  }
})

/** A change made to a select before the form has hydrated is reset by
 * hydration, so choose it and check it together until both hold. */
async function selectStable(select: Locator, value: string): Promise<void> {
  await expect(async () => {
    await select.selectOption(value)
    await expect(select).toHaveValue(value)
  }).toPass({ timeout: 10_000 })
}

async function optionTexts(select: Locator): Promise<string[]> {
  return (await select.locator('option').allInnerTexts()).map((t) => t.trim())
}

test.describe('Withholding tax codes — suppliers, AP bills and receiving', () => {
  test('the supplier form defaults to the 1% goods code and offers the other EWT codes with their rates', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/suppliers')
    await page.getByRole('button', { name: /new supplier/i }).click()
    await expect(page.getByRole('heading', { name: 'New supplier' })).toBeVisible({
      timeout: 10_000,
    })

    // The form's own dropdown (a custom combobox, named by what it shows).
    const withholding = page.getByRole('combobox', { name: /^EWT-/ })
    await expect(withholding).toContainText('EWT-GOODS-1 — Local Supplier of Goods (1%)')

    await openCustomSelect(withholding)
    // The list comes from the tax code master and may still be arriving.
    await expect(page.getByRole('option', { name: /EWT-RENT-5/ })).toBeVisible({ timeout: 10_000 })
    const options = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim())
    expect(options).toContain('EWT-NONE — No Withholding')
    expect(options).toContain('EWT-GOODS-1 — Local Supplier of Goods (1%)')
    expect(options).toContain('EWT-SERV-2 — Local Supplier of Services (2%)')
    expect(options).toContain('EWT-RENT-5 — Real Property Rent (5%)')
    // Nothing of another tax type is on offer.
    expect(options.some((o) => o.startsWith('VAT-') || o.startsWith('CWT-'))).toBe(false)

    await page.getByRole('option', { name: /EWT-RENT-5/ }).click()
    await expect(withholding).toContainText('EWT-RENT-5 — Real Property Rent (5%)')

    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('a new bill offers the EWT codes and says what the chosen one withholds', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/ap-bills/new')
    const code = page.getByLabel('Withholding tax code')
    await expect(code.locator('option', { hasText: 'EWT-RENT-5' })).toHaveCount(1, {
      timeout: 10_000,
    })

    // Nothing chosen: the supplier's own code applies.
    await expect(code).toHaveValue('')
    expect((await optionTexts(code))[0]).toBe("Supplier's default")
    await expect(page.getByText("Withheld at the supplier's own code.")).toBeVisible()

    await selectStable(code, 'EWT-RENT-5')
    await expect(page.getByText('Held back at 5% of the subtotal.')).toBeVisible()

    await selectStable(code, 'EWT-SERV-2')
    await expect(page.getByText('Held back at 2% of the subtotal.')).toBeVisible()
  })

  test('a rent bill is withheld at 5% and its document names the code', async ({
    page,
    request,
  }) => {
    // Any existing supplier will do; the bill names its own code, so the
    // supplier's default does not matter.
    const suppliers = await (await request.get('/api/suppliers?limit=1')).json()
    const supplier = suppliers.data?.[0] as
      | {
          id: string
          name: string
          code: string
          defaultWithholding: 'none' | 'pct_1'
          defaultWithholdingTaxCode: string
        }
      | undefined
    test.skip(!supplier, 'No suppliers to bill — nothing to withhold from')
    if (!supplier) return
    // The code the supplier is withheld at unless the bill says otherwise.
    const ownCode =
      supplier.defaultWithholding === 'none' ? 'EWT-NONE' : supplier.defaultWithholdingTaxCode

    await gotoReady(page, '/accounting/ap-bills/new')
    const code = page.getByLabel('Withholding tax code')
    await expect(code.locator('option', { hasText: 'EWT-RENT-5' })).toHaveCount(1, {
      timeout: 10_000,
    })

    // Pick the supplier in the search combobox.
    // (The field's own <label> is what names the button.)
    await page.getByRole('button', { name: 'Supplier *' }).click()
    await page
      .getByPlaceholder(/search supplier by name or code/i)
      .fill(supplier.code ?? supplier.name)
    await page.locator('div.fixed button', { hasText: supplier.name }).first().click()

    const marker = `E2E-D-${Date.now()}`
    await fillStable(page.locator('label:has-text("SI / Invoice Number") input'), marker)
    await fillStable(page.locator('label:has-text("Subtotal *") input'), '50000')
    await selectStable(code, 'EWT-RENT-5')

    // Withholding at another code than the supplier's own is a change from the
    // default (Scenario 69 Part I): the form asks why. A supplier already on the
    // rent code is not changed from anything.
    const reason = page.getByTestId('bill-override-reason')
    if (ownCode === 'EWT-RENT-5') {
      await expect(reason).toHaveCount(0)
    } else {
      await expect(reason).toBeVisible({ timeout: 10_000 })
      await fillStable(reason, 'E2E: rent is paid to a goods supplier')
    }

    const [created] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/ap-bills') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(created.status()).toBe(201)
    const bill = await created.json()
    createdBillIds.push(bill.id)

    // 5% of 50,000, at the rent code, with the ATC left empty until NIG's
    // accountant supplies the list (never invented).
    expect(bill.withholdingTaxCode).toBe('EWT-RENT-5')
    expect(Number(bill.withholdingAmount)).toBe(2500)
    expect(bill.withholdingAtc).toBeNull()

    await gotoReady(page, `/accounting/ap-bills/${bill.id}`)
    await expect(page.getByText('Withholding tax (EWT-RENT-5)')).toBeVisible({ timeout: 10_000 })
    await expectMoneyRow(page, 'Withholding tax (EWT-RENT-5)', '2,500.00')
  })

  test("the manual receiving report's withholding choices carry the master's rates", async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/receiving-reports/manual-rr/new')
    const withholding = page.getByLabel('Default withholding')
    await expect(withholding).toBeVisible({ timeout: 10_000 })

    // Goods and services are the EWT-GOODS-1 / EWT-SERV-2 rates the master
    // holds, which are what the server posts at.
    await expect(withholding.locator('option', { hasText: 'Goods (1%)' })).toHaveCount(1)
    await expect(withholding.locator('option', { hasText: 'Services (2%)' })).toHaveCount(1)
  })
})

/** The row of the document's totals table that starts with `label` shows `amount`. */
async function expectMoneyRow(page: Page, label: string, amount: string): Promise<void> {
  const row = page.locator('tr', { hasText: label }).first()
  await expect(row).toContainText(amount)
}
