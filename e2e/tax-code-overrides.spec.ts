/**
 * Scenario 69 Part I — a tax code kept away from its default needs a reason.
 *
 * An AP bill is withheld at its supplier's own code. Withholding at another is
 * allowed, but the bill says why: the form lists the change and will not save
 * without a reason, and the bill keeps the change with who made it and when, on
 * its own page. A change already on a bill stands as it was made — editing
 * something else does not ask again — and putting the default back drops it.
 *
 * The line-level input VAT codes, the AR invoice's class and the register's VAT
 * treatment are covered where they are built (input-vat-variants.spec.ts and
 * output-vat-classification.spec.ts). Who may change a code at all — and the
 * refusal when someone may not — is the server's, covered by
 * backend/test/scenario-69-tax-controls.e2e-spec.ts and, as a user without the
 * permission, in the Part I walkthrough.
 *
 * Self-cleaning: the supplier it creates is removed (soft), and so are the draft
 * bills. The app only hides a deleted draft, so one hidden row stays behind per
 * bill, like every other AP spec. No bill is ever received, so nothing is posted.
 *
 * Needs the Part I migration applied to the DB the stack runs against.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

const supplierIds: string[] = []
const billIds: string[] = []
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
  for (const id of supplierIds.splice(0)) await drop(`/api/suppliers/${id}`)
  expect(refused, 'everything the test created should have been removed').toEqual([])
})

/** A supplier withheld at the 1% goods code, so any other code is a change. */
async function makeSupplier(page: Page): Promise<{ id: string; name: string; code: string }> {
  counter += 1
  const stamp = `${Date.now()}${counter}`
  const res = await page.request.post('/api/suppliers', {
    data: {
      code: `E2E-I-${stamp}`.slice(0, 30),
      name: `E2E I ${stamp}`,
      vatStatus: 'VAT',
      defaultWithholdingTaxCode: 'EWT-GOODS-1',
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

/** A bill the API saves for the supplier, withheld at the rent code with its reason. */
async function makeRentBill(
  page: Page,
  supplier: { id: string },
  reason: string
): Promise<{ id: string; taxOverride: { at: string; reason: string }[] }> {
  const res = await page.request.post('/api/ap-bills', {
    data: {
      supplierId: supplier.id,
      billNumber: `E2E-I-${Date.now()}`,
      billDate: '2026-10-10',
      dueDate: '2026-11-10',
      subtotal: 10000,
      withholdingTaxCode: 'EWT-RENT-5',
      taxOverrideReason: reason,
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  const bill = await res.json()
  billIds.push(bill.id)
  return bill
}

test.describe('AP bill — withholding at a code other than the supplier’s own', () => {
  test('is a change that asks why, is kept with the bill, and shows on its page', async ({
    page,
  }) => {
    const supplier = await makeSupplier(page)
    await gotoReady(page, '/accounting/ap-bills/new')
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 15_000 })
    await pickSupplier(page, supplier)

    await fillStable(
      page.locator('label:has-text("SI / Invoice Number") input'),
      `E2E-I-${Date.now()}`
    )
    await fillStable(page.locator('label:has-text("Subtotal *") input'), '50000')

    const code = page.getByLabel('Withholding tax code')
    await expect(code.locator('option', { hasText: 'EWT-RENT-5' })).toHaveCount(1, {
      timeout: 10_000,
    })
    const box = page.getByTestId('bill-override')

    // The rent code is not the supplier's own: the form says what is being changed.
    await selectStable(code, 'EWT-RENT-5')
    await expect(page.getByTestId('bill-override-changes')).toContainText(
      'Withholding tax code: EWT-GOODS-1 → EWT-RENT-5',
      { timeout: 10_000 }
    )
    await expect(page.getByTestId('bill-override-reason')).toBeVisible()

    // The supplier's own code, named outright, is not a change from anything.
    await selectStable(code, 'EWT-GOODS-1')
    await expect(box).toHaveCount(0)

    // Back on the rent code, the bill will not save without the reason.
    await selectStable(code, 'EWT-RENT-5')
    await expect(box).toBeVisible()
    let posted = false
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/ap-bills')) posted = true
    })
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(
      page.locator('form').getByText('Say why this tax code was changed from its default')
    ).toBeVisible()
    expect(posted).toBe(false)

    await fillStable(page.getByTestId('bill-override-reason'), 'Landlord is on our goods list')
    const [created] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/ap-bills') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(created.status()).toBe(201)
    const bill = await created.json()
    billIds.push(bill.id)
    expect(bill.withholdingTaxCode).toBe('EWT-RENT-5')
    expect(bill.taxOverride).toEqual([
      expect.objectContaining({
        field: 'WITHHOLDING_CODE',
        from: 'EWT-GOODS-1',
        to: 'EWT-RENT-5',
        reason: 'Landlord is on our goods list',
        byUserId: expect.any(String),
      }),
    ])

    // The bill's own page says what was changed, why, and by whom.
    await gotoReady(page, `/accounting/ap-bills/${bill.id}`)
    const summary = page.getByTestId('bill-override-summary')
    await expect(summary).toBeVisible({ timeout: 15_000 })
    await expect(summary).toContainText('Withholding tax code: EWT-GOODS-1 → EWT-RENT-5')
    await expect(summary).toContainText('Landlord is on our goods list')
    await expect(summary).not.toContainText('Someone')
  })

  test('a change on record stands when something else is edited, and the default drops it', async ({
    page,
  }) => {
    const supplier = await makeSupplier(page)
    const bill = await makeRentBill(page, supplier, 'Landlord is on our goods list')
    expect(bill.taxOverride).toHaveLength(1)
    const recordedAt = bill.taxOverride[0].at

    // Edit the description: the change already on the bill is not asked about again.
    await gotoReady(page, `/accounting/ap-bills/${bill.id}/edit`)
    const earlier = page.getByTestId('bill-override')
    await expect(earlier).toBeVisible({ timeout: 20_000 })
    await expect(earlier).toContainText('Landlord is on our goods list')
    await expect(page.getByTestId('bill-override-reason')).toHaveCount(0)

    await fillStable(page.locator('label:has-text("Description") input'), 'E2E: edited')
    const [kept] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/ap-bills/${bill.id}`) && r.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(kept.status()).toBe(200)
    const afterEdit = await kept.json()
    expect(afterEdit.taxOverride).toHaveLength(1)
    // the same entry, as it was made: not made again by this save
    expect(afterEdit.taxOverride[0]).toMatchObject({
      reason: 'Landlord is on our goods list',
      at: recordedAt,
    })

    // Putting the supplier's own code back leaves nothing to explain.
    await gotoReady(page, `/accounting/ap-bills/${bill.id}/edit`)
    const code = page.getByLabel('Withholding tax code')
    await expect(code).toHaveValue('EWT-RENT-5', { timeout: 20_000 })
    await selectStable(code, 'EWT-GOODS-1')
    await expect(page.getByTestId('bill-override')).toHaveCount(0)
    const [dropped] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/ap-bills/${bill.id}`) && r.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(dropped.status()).toBe(200)
    const afterDefault = await dropped.json()
    expect(afterDefault.withholdingTaxCode).toBe('EWT-GOODS-1')
    expect(afterDefault.taxOverride ?? []).toEqual([])
  })
})
