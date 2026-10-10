/**
 * Scenario 69 Part G — input VAT variants.
 *
 * A supplier has a VAT status; an AP bill line is coded with an input VAT code
 * from the tax code master (VAT-IN-12 by default, VAT-IN-CAPEX for a capital
 * purchase, VAT-IN-NONVAT, VAT-IN-EXEMPT, VAT-IN-OOS), its tax is worked out
 * from the code, and a capital line is tagged to its project / asset and posts
 * to an asset account. An expense line can be a capital purchase too.
 *
 * Self-cleaning: the suppliers it creates are removed (soft), and so are the
 * draft bills and expenses. The app only hides a deleted draft, so one hidden
 * row stays behind per draft, like every other spec that creates one. No bill
 * is ever received and no expense recorded, so no journal entry is posted; the
 * backend e2e (scenario-69-input-vat.e2e-spec.ts) covers the posting.
 *
 * Needs the Part C to G migrations applied to the DB the stack runs against.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { fillStable, gotoReady, openCustomSelect } from './utils'

const supplierIds: string[] = []
const billIds: string[] = []
const expenseIds: string[] = []
let counter = 0

// A delete the app refuses (it answers, it does not throw) must not pass quietly:
// a test that leaves its data behind says so.
test.afterEach(async ({ request }) => {
  const refused: string[] = []
  const drop = async (path: string) => {
    const res = await request.delete(path)
    if (!res.ok()) refused.push(`${path} → ${res.status()}`)
  }
  for (const id of billIds.splice(0)) await drop(`/api/ap-bills/${id}`)
  for (const id of expenseIds.splice(0)) await drop(`/api/expenses/${id}`)
  for (const id of supplierIds.splice(0)) await drop(`/api/suppliers/${id}`)
  expect(refused, 'everything the test created should have been removed').toEqual([])
})

async function makeSupplier(
  page: Page,
  vatStatus: string
): Promise<{ id: string; name: string; code: string }> {
  counter += 1
  const stamp = `${Date.now()}${counter}`
  const res = await page.request.post('/api/suppliers', {
    data: {
      code: `E2E-G-${stamp}`.slice(0, 30),
      name: `E2E G ${vatStatus} ${stamp}`,
      vatStatus,
      defaultWithholdingTaxCode: 'EWT-NONE',
    },
  })
  expect(res.ok(), await res.text()).toBe(true)
  const supplier = await res.json()
  supplierIds.push(supplier.id)
  return supplier
}

/** Picks a supplier in the bill form's search combobox. A click made before the
 * form has hydrated is lost, so it is repeated until the search box is there. */
async function pickSupplier(page: Page, supplier: { name: string; code: string }) {
  const search = page.getByPlaceholder(/search supplier by name or code/i)
  await expect(async () => {
    await page.getByRole('button', { name: 'Supplier *' }).click()
    await expect(search).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await fillStable(search, supplier.code)
  await page.locator('div.fixed button', { hasText: supplier.name }).first().click()
}

/** A change made to a select before the form has hydrated is reset by
 * hydration, so choose it and check it together until both hold. */
async function selectStable(select: Locator, value: string): Promise<void> {
  await expect(async () => {
    await select.selectOption(value)
    await expect(select).toHaveValue(value)
  }).toPass({ timeout: 10_000 })
}

/** Picks an account in a searchable account picker. */
async function pickAccountIn(page: Page, picker: Locator, text: string): Promise<void> {
  await expect(async () => {
    await picker.click()
    await page.keyboard.type(text)
    await page.locator('div.fixed button', { hasText: text }).first().click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

test.describe('Supplier — VAT status', () => {
  test('a new supplier is VAT-registered, and the status says what its purchases start as', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/suppliers')
    await page.getByRole('button', { name: /new supplier/i }).click()
    await expect(page.getByRole('heading', { name: 'New supplier' })).toBeVisible({
      timeout: 10_000,
    })

    const status = page.getByTestId('supplier-vat-status')
    const select = status.getByRole('combobox')
    await expect(select).toContainText('VAT-registered')
    await expect(status).toContainText('Charges 12% VAT')
    await expect(status).toContainText('Purchases start as VATable')

    await openCustomSelect(select)
    const options = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim())
    expect(options).toEqual(['VAT-registered', 'Non-VAT', 'VAT-exempt', 'Government', 'PEZA'])

    // A non-VAT supplier charges none, so nothing is claimed from it.
    await page.getByRole('option', { name: 'Non-VAT' }).click()
    await expect(select).toContainText('Non-VAT')
    await expect(status).toContainText('Charges no VAT')
    await expect(status).toContainText('Purchases start as Non-VAT')

    // A government or PEZA supplier may or may not charge VAT: unclaimed until
    // a line says otherwise.
    await openCustomSelect(select)
    await page.getByRole('option', { name: 'Government' }).click()
    await expect(status).toContainText('May or may not charge VAT')
    await expect(status).toContainText('Purchases start as Non-VAT')

    // Opened and cancelled, never saved: a supplier cannot be hard-deleted.
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('an existing supplier shows its VAT status on its profile', async ({ page }) => {
    const supplier = await makeSupplier(page, 'PEZA')
    await gotoReady(page, `/inventory/suppliers?supplierId=${supplier.id}`)
    // The detail opens from the list: search for it and open it.
    await page
      .getByPlaceholder(/search/i)
      .first()
      .fill(supplier.code)
    await page.getByText(supplier.name).first().click()
    await expect(page.getByText('VAT status').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('body')).toContainText('PEZA')
  })
})

test.describe('AP bill — lines carry an input VAT code', () => {
  test('a line starts VATable, its tax follows the code, and a capital line needs its tag and account', async ({
    page,
  }) => {
    const supplier = await makeSupplier(page, 'VAT')
    await gotoReady(page, '/accounting/ap-bills/new')
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 15_000 })
    await pickSupplier(page, supplier)

    await fillStable(
      page.locator('label:has-text("SI / Invoice Number") input'),
      `E2E-G-${Date.now()}`
    )
    await page.getByRole('button', { name: 'Add line' }).click()

    const code = page.getByLabel('Line 1 input VAT code')
    // The supplier's status loads a moment after it is picked.
    await expect(code).toHaveValue('VAT-IN-12', { timeout: 10_000 })
    await fillStable(page.getByLabel('Line 1 description'), 'Delivery van')
    await fillStable(page.getByLabel('Line 1 quantity'), '1')
    await fillStable(page.getByLabel('Line 1 unit price'), '50000')

    // 12% of the net, worked out from the code: never typed.
    await expect(page.getByLabel('Line 1 input VAT', { exact: true })).toContainText('6,000.00')
    const headerTax = page.locator('label:has-text("Input Tax (VAT, from lines)") input')
    await expect(headerTax).toHaveValue('6000.00')
    await expect(headerTax).toHaveAttribute('readonly', '')

    // A non-VAT code claims nothing.
    await selectStable(code, 'VAT-IN-NONVAT')
    await expect(page.getByLabel('Line 1 input VAT', { exact: true })).toContainText('—')
    await expect(headerTax).toHaveValue('0.00')

    // A capital purchase: tagged to its project / asset, posted to an asset account.
    await selectStable(code, 'VAT-IN-CAPEX')
    await expect(page.getByLabel('Line 1 input VAT', { exact: true })).toContainText('6,000.00')
    const posting = page.getByTestId('line-1-posting')
    await expect(posting).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(
      page.locator('form').getByText(/needs the project or asset it is for/)
    ).toBeVisible()

    const tag = `FA-E2E-${Date.now()}`
    await fillStable(page.getByLabel('Line 1 project or asset'), tag)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(
      page.locator('form').getByText(/pick the account this capital purchase/)
    ).toBeVisible()

    // Only property / equipment accounts are on offer: not an expense account.
    const accountPicker = page.getByLabel('Line 1 account')
    await accountPicker.click()
    await page.keyboard.type('Rent')
    await expect(page.locator('div.fixed button', { hasText: 'Rent Expense' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await pickAccountIn(page, accountPicker, 'Office Equipment')

    // A capital code on a line the supplier's VAT status would have left VATable
    // is a change from the default (Scenario 69 Part I): the form asks why.
    const reason = page.getByTestId('bill-override-reason')
    await expect(page.getByTestId('bill-override-changes')).toContainText(
      'Input VAT code on line 1: VAT-IN-12 → VAT-IN-CAPEX'
    )
    await fillStable(reason, 'Delivery van, capitalised')

    const [created] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/ap-bills') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(created.status()).toBe(201)
    const bill = await created.json()
    billIds.push(bill.id)
    expect(bill).toMatchObject({ subtotal: 50000, taxAmount: 6000, totalAmount: 56000 })
    expect(bill.lines[0]).toMatchObject({
      taxCode: 'VAT-IN-CAPEX',
      taxAmount: 6000,
      projectAssetRef: tag,
      account: { number: '1-03-040' },
    })
    // ...and the change is kept with the bill, with why.
    expect(bill.taxOverride).toEqual([
      expect.objectContaining({
        field: 'INPUT_VAT_CODE',
        line: 1,
        from: 'VAT-IN-12',
        to: 'VAT-IN-CAPEX',
        reason: 'Delivery van, capitalised',
      }),
    ])

    // The bill's page shows the line with its code, tax, account and tag.
    await gotoReady(page, `/accounting/ap-bills/${bill.id}`)
    const lines = page.getByTestId('own-lines')
    await expect(lines).toBeVisible({ timeout: 15_000 })
    await expect(lines).toContainText('Capital goods')
    await expect(lines).toContainText('6,000.00')
    await expect(lines).toContainText('1-03-040')
    await expect(lines).toContainText(`Project / asset: ${tag}`)
  })

  test('a non-VAT supplier starts every line on Non-VAT and cannot be billed a claimable code', async ({
    page,
  }) => {
    const supplier = await makeSupplier(page, 'NON_VAT')
    await gotoReady(page, '/accounting/ap-bills/new')
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 15_000 })
    await pickSupplier(page, supplier)

    await page.getByRole('button', { name: 'Add line' }).click()
    const code = page.getByLabel('Line 1 input VAT code')
    await expect(code).toHaveValue('VAT-IN-NONVAT', { timeout: 10_000 })

    // The claimable codes are there but cannot be picked.
    await expect(code.locator('option[value="VAT-IN-12"]')).toBeDisabled()
    await expect(code.locator('option[value="VAT-IN-CAPEX"]')).toBeDisabled()
    await expect(code.locator('option[value="VAT-IN-EXEMPT"]')).toBeEnabled()
    await expect(page.getByText(/is non-vat: no input VAT is claimed on its lines/i)).toBeVisible()
  })

  test('a government supplier starts unclaimed but may be switched to VATable when its invoice shows VAT', async ({
    page,
  }) => {
    const supplier = await makeSupplier(page, 'GOVERNMENT')
    await gotoReady(page, '/accounting/ap-bills/new')
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 15_000 })
    await pickSupplier(page, supplier)

    await page.getByRole('button', { name: 'Add line' }).click()
    const code = page.getByLabel('Line 1 input VAT code')
    await expect(code).toHaveValue('VAT-IN-NONVAT', { timeout: 10_000 })
    await expect(code.locator('option[value="VAT-IN-12"]')).toBeEnabled()
    await fillStable(page.getByLabel('Line 1 quantity'), '1')
    await fillStable(page.getByLabel('Line 1 unit price'), '1000')
    await selectStable(code, 'VAT-IN-12')
    await expect(page.getByLabel('Line 1 input VAT', { exact: true })).toContainText('120.00')
  })
})

test.describe('Expenses — a capital purchase', () => {
  const payeeType = (page: Page) =>
    page.getByRole('combobox', { name: /^(— Select —|Customer|Supplier|Employee|Other)$/ }).first()

  test('asks for the project / asset and offers only property and equipment accounts', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(async () => {
      await openCustomSelect(payeeType(page))
      await page.getByRole('option', { name: 'Supplier' }).first().click({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })

    // The line's tax choices include the capital one.
    const tax = page.getByRole('combobox', { name: /Non-VAT|Input VAT|Exempt|Capital/ }).first()
    await expect(async () => {
      await openCustomSelect(tax)
      await page
        .getByRole('option', { name: 'Capital goods (Input VAT)' })
        .click({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })

    const tag = page.getByTestId('line-project-asset')
    await expect(tag).toBeVisible()

    // Only property / equipment accounts: Rent Expense is not among them.
    const account = page.locator('[aria-label="Account"]').first()
    await account.click()
    await page.keyboard.type('Rent Expense')
    await expect(page.locator('div.fixed button', { hasText: 'Rent Expense' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await pickAccountIn(page, account, 'Office Equipment')

    await fillStable(page.locator('input[aria-label="Amount"]').first(), '112000')

    // The tag is required.
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(
      page.getByText('A capital purchase needs the project or asset it is for.')
    ).toBeVisible()

    const ref = `FA-E2E-${Date.now()}`
    await fillStable(page.getByLabel('Project or asset'), ref)
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/expenses') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save draft' }).click(),
    ])
    expect(saved.status()).toBe(201)
    const expense = await saved.json()
    expenseIds.push(expense.id)

    // The VAT inside 112,000 is claimed like any Input VAT, and the tag is kept.
    expect(expense.taxAmount).toBe(12000)
    expect(expense.lines[0]).toMatchObject({
      taxCode: 'VAT-IN-CAPEX',
      projectAssetRef: ref,
      taxAmount: 12000,
    })

    // Reopened, the line still says what it is for.
    await gotoReady(page, `/accounting/expenses/${expense.id}/edit`)
    await expect(page.getByLabel('Project or asset')).toHaveValue(ref, { timeout: 15_000 })
    // ...and so does the detail.
    await gotoReady(page, `/accounting/expenses/${expense.id}`)
    await expect(page.locator('body')).toContainText(`Project / asset: ${ref}`, { timeout: 15_000 })
  })
})
