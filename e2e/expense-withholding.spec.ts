/**
 * Scenario 69 Part E — an expense can withhold.
 *
 * The client workbook's own example (Posting Examples row 5): rent of ₱56,000
 * with 12% VAT inside, withheld at EWT-RENT-5. The line shows what is withheld
 * (5% of the 50,000 net of VAT = ₱2,500), the footer shows what is left to pay,
 * and the payment follows the cash that leaves (₱53,500), not the whole amount.
 *
 * Also guards a bug found while building it: reopening a saved draft with an
 * Input VAT line used to show the amount with its VAT added back on (62,000
 * for a 56,000 entry), because the form still read the amount as stored net.
 *
 * Self-cleaning: the drafts it creates are deleted. The app only hides a
 * deleted expense (visibility=false), so one hidden DRAFT row stays behind per
 * draft, like every other spec that creates one. Nothing is ever recorded, so
 * no journal entry is posted. Changing a tax rate in the master cannot be
 * undone, so rates are only read here; the backend e2e
 * (scenario-69-expense-withholding.e2e-spec.ts) covers the posting.
 *
 * Needs the Part C, D and E migrations applied to the DB the stack runs against.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { fillStable, gotoReady, openCustomSelect } from './utils'

const createdIds: string[] = []

test.afterEach(async ({ request }) => {
  // DRAFTs can be deleted; runs whether or not the test got to its end.
  for (const id of createdIds.splice(0)) {
    await request.delete(`/api/expenses/${id}`).catch(() => {})
  }
})

/** Picks an option of one of the form's own dropdowns (a custom combobox). */
async function pickCustom(page: Page, combo: Locator, option: string | RegExp): Promise<void> {
  await expect(async () => {
    await openCustomSelect(combo)
    await page.getByRole('option', { name: option }).first().click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

/** Picks an account in the line's searchable Account picker. */
async function pickAccount(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await page.locator('[aria-label="Account"]').first().click()
    await page.keyboard.type(name)
    await page.locator('div.fixed button', { hasText: name }).first().click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

// The payee type's own dropdown, named by what it currently shows (its label
// goes blank once Other is picked, so it cannot be found by its label).
const payeeType = (page: Page) =>
  page.getByRole('combobox', { name: /^(— Select —|Customer|Supplier|Employee|Other)$/ }).first()
const paymentAmount = (page: Page) =>
  page
    .locator('label', { hasText: /^Amount$/ })
    .locator('input')
    .first()

test.describe('Expenses — withholding tax', () => {
  test('a rent expense shows what is withheld, what is left to pay, and the payment follows it', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 15_000,
    })
    await pickCustom(page, payeeType(page), 'Supplier')

    await pickAccount(page, 'Rent Expense')
    const amount = page.locator('input[aria-label="Amount"]').first()
    await fillStable(amount, '56000')
    await pickCustom(
      page,
      page.getByRole('combobox', { name: /Non-VAT|Input VAT|Exempt/ }).first(),
      'Input VAT'
    )

    const withholding = page.locator('[data-testid="line-withholding"]').first()
    // Nothing is withheld until a code is chosen.
    await expect(withholding).not.toContainText('withheld')
    await pickCustom(page, withholding.getByRole('combobox'), /EWT-RENT-5/)

    // 5% of the 50,000 inside 56,000 — the VAT is never part of the base.
    await expect(withholding).toContainText('EWT-RENT-5 · 5%')
    await expect(withholding).toContainText('−₱2,500.00 withheld')
    const form = page.locator('form')
    await expect(form).toContainText('Total: ₱56,000.00')
    await expect(form).toContainText('Less: withholding tax: −₱2,500.00')
    await expect(form).toContainText('Net payable: ₱53,500.00')
    // The one payment is the cash that leaves, not the whole amount.
    await expect(paymentAmount(page)).toHaveValue('53500.00')

    // The marker lets the saved draft be found again.
    const marker = `E2E-S69E-${Date.now()}`
    await fillStable(
      page
        .locator('label', { hasText: /^Description$/ })
        .locator('input')
        .first(),
      marker
    )
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/expenses') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save draft' }).click(),
    ])
    expect(saved.status()).toBe(201)
    const expense = await saved.json()
    createdIds.push(expense.id)

    expect(expense.totalAmount).toBe(56000)
    expect(expense.taxAmount).toBe(6000)
    expect(expense.withholdingAmount).toBe(2500)
    expect(expense.lines[0]).toMatchObject({
      withholdingTaxCode: 'EWT-RENT-5',
      withholdingAmount: 2500,
      withholdingAtc: null,
    })
    expect(expense.payments[0].amount).toBe(53500)

    // The detail screen says the same.
    await gotoReady(page, `/accounting/expenses/${expense.id}`)
    await expect(page.getByText('Net payable').first()).toBeVisible({ timeout: 15_000 })
    const detail = page.locator('main, body').first()
    await expect(detail).toContainText('EWT-RENT-5')
    await expect(detail).toContainText('₱53,500.00')
  })

  test('a saved draft reopens on the amount that was typed, with its code and its payment', async ({
    page,
    request,
  }) => {
    const account = await (await request.get('/api/accounts?limit=500')).json()
    const rent = (
      (account.items ?? account.data ?? account) as { id: string; number: string }[]
    ).find((a) => a.number === '6-03-010')
    test.skip(!rent, 'No Rent Expense account (6-03-010) in this chart')
    if (!rent) return

    const created = await request.post('/api/expenses', {
      data: {
        expenseDate: new Date().toISOString().slice(0, 10),
        payeeType: 'OTHER',
        payee: 'E2E S69E Landlord',
        lines: [
          {
            categoryAccountId: rent.id,
            amount: 56000,
            taxCode: 'INPUT_VAT',
            withholdingTaxCode: 'EWT-RENT-5',
          },
        ],
        payments: [{ paymentMethod: 'CASH', amount: 53500 }],
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const expense = await created.json()
    createdIds.push(expense.id)

    await gotoReady(page, `/accounting/expenses/${expense.id}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible({
      timeout: 15_000,
    })
    // 56,000 as it was typed — not 62,000, the amount with its VAT added again.
    await expect(page.locator('input[aria-label="Amount"]').first()).toHaveValue('56000')
    await expect(page.locator('[data-testid="line-withholding"]').first()).toContainText(
      'EWT-RENT-5 · 5%'
    )
    await expect(paymentAmount(page)).toHaveValue('53500')
    await expect(page.locator('form')).toContainText('Net payable: ₱53,500.00')
  })

  test('only a purchase can be withheld: a payroll entry and a customer expense offer no Withholding column', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 15_000,
    })
    const column = page.getByText('Withholding', { exact: true })

    // A free-text Other payee is a purchase...
    await pickCustom(page, payeeType(page), 'Other')
    await expect(column.first()).toBeVisible()

    // ...unless the entry is a payroll run: compensation, not an EWT matter.
    await pickCustom(page, page.getByRole('combobox', { name: /None|Payroll/ }).first(), 'Payroll')
    await expect(column).toHaveCount(0)
    await pickCustom(page, page.getByRole('combobox', { name: /None|Payroll/ }).first(), /None/)
    await expect(column.first()).toBeVisible()

    // A customer refund is not a purchase either.
    await pickCustom(page, payeeType(page), 'Customer')
    await expect(column).toHaveCount(0)
  })

  test('the printed voucher shows the withholding and the net that was paid out', async ({
    page,
    request,
  }) => {
    const account = await (await request.get('/api/accounts?limit=500')).json()
    const rent = (
      (account.items ?? account.data ?? account) as { id: string; number: string }[]
    ).find((a) => a.number === '6-03-010')
    test.skip(!rent, 'No Rent Expense account (6-03-010) in this chart')
    if (!rent) return

    const created = await request.post('/api/expenses', {
      data: {
        expenseDate: new Date().toISOString().slice(0, 10),
        payeeType: 'OTHER',
        payee: 'E2E S69E Landlord',
        lines: [
          {
            categoryAccountId: rent.id,
            amount: 56000,
            taxCode: 'INPUT_VAT',
            withholdingTaxCode: 'EWT-RENT-5',
          },
        ],
        payments: [{ paymentMethod: 'CASH', amount: 53500 }],
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const expense = await created.json()
    createdIds.push(expense.id)

    await gotoReady(page, `/accounting/expenses/${expense.id}`)
    const print = page.getByRole('button', { name: /Print voucher/ })
    await expect(print).toBeVisible({ timeout: 15_000 })
    const [popup] = await Promise.all([page.waitForEvent('popup'), print.click()])
    await popup.waitForLoadState('domcontentloaded')

    const text = (await popup.locator('body').innerText()).replace(/\s+/g, ' ')
    expect(text).toMatch(/Amount\s*₱56,000\.00/)
    expect(text).toMatch(/Less: withholding tax \(EWT-RENT-5\)\s*\(₱2,500\.00\)/)
    expect(text).toMatch(/Net amount paid\s*₱53,500\.00/)
  })
})
