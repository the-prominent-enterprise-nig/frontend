/**
 * Scenario 69 Part C — the Tax Codes screens.
 *
 * Read-only: it opens the seeded master (the 21 codes from the client's NIG ERP
 * Tax Setup workbook) and asserts what the list, the per-code history and the
 * new-version form show. It creates nothing — there is no delete for a tax code
 * (history is the point), so a spec that created one could not clean up after
 * itself. Creating a code, adding a version, editing and switching a code off
 * are exercised against the API by backend/test/scenario-69-tax-codes.e2e-spec.ts.
 *
 * Needs the Part C migration applied to the DB the stack runs against.
 */
import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.describe('Tax Codes — the master from the NIG ERP Tax Setup workbook', () => {
  test('lists the seeded codes with their rates and posting accounts, and says they are provisional', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/tax-codes')

    await expect(page.getByRole('heading', { name: 'Tax Codes' })).toBeVisible()
    // The rates are the workbook's, not yet confirmed by NIG's accountant.
    await expect(
      page.getByText(/rates below are the client.s workbook values and are provisional/i)
    ).toBeVisible()

    const outputVat = page.getByRole('row', { name: /VAT-OUT-12/ })
    await expect(outputVat).toContainText('12%')
    await expect(outputVat).toContainText('Output VAT Payable')

    // The posting account is the label of the key, not the key itself.
    const rent = page.getByRole('row', { name: /EWT-RENT-5/ })
    await expect(rent).toContainText('5%')
    await expect(rent).toContainText('Withholding Tax Payable — Rent')
  })

  test('keeps the two government codes out until inactive codes are shown', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-codes')

    await expect(page.getByRole('row', { name: /VAT-OUT-12/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /VAT-OUT-GOV-12/ })).toHaveCount(0)
    await expect(page.getByRole('row', { name: /CWT-AR-GOV-VAT-5/ })).toHaveCount(0)

    await page.getByLabel('Show inactive codes').check()
    await expect(page.getByRole('row', { name: /VAT-OUT-GOV-12/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /CWT-AR-GOV-VAT-5/ })).toBeVisible()
  })

  test('filters by type', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-codes')
    await expect(page.getByRole('row', { name: /VAT-OUT-12/ })).toBeVisible()

    await page.getByLabel('Type').selectOption('CWT_RECEIVABLE')

    await expect(page.getByRole('row', { name: /CWT-AR-GOODS-1/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /VAT-OUT-12/ })).toHaveCount(0)
    await expect(page.getByRole('row', { name: /EWT-RENT-5/ })).toHaveCount(0)
  })

  test('opens a code to its version history, and offers a new version of it', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-codes')
    await page.getByRole('row', { name: /EWT-RENT-5/ }).click()

    await expect(page).toHaveURL(/\/accounting\/tax-codes\/EWT-RENT-5$/)
    await expect(page.getByRole('heading', { name: 'EWT-RENT-5' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Versions' })).toBeVisible()
    // The migration seeds one open-ended version from 2000-01-01.
    const current = page.locator('tbody tr').first()
    await expect(current).toContainText('2000-01-01')
    await expect(current).toContainText('5%')
    await expect(current).toContainText('In force')

    await page.getByRole('link', { name: 'Add a new version' }).click()
    await expect(page.getByRole('heading', { name: 'New version of EWT-RENT-5' })).toBeVisible()
    // A rate change keeps the code and its type; only what changes is typed.
    await expect(page.getByPlaceholder('e.g. EWT-RENT-5')).toBeDisabled()
    await expect(page.getByPlaceholder('e.g. EWT-RENT-5')).toHaveValue('EWT-RENT-5')
    await expect(page.locator('input[type="number"]')).toHaveValue('5')
    // ...and it has to start after the version it replaces.
    await expect(page.getByText(/latest version starts 2000-01-01/i)).toBeVisible()
    await expect(page.locator('label:has-text("Effective from") input')).toHaveAttribute(
      'min',
      '2000-01-02'
    )
  })

  test('offers a new code only the posting accounts that suit its type', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-codes/new')
    await expect(page.getByRole('heading', { name: 'New Tax Code' })).toBeVisible()

    const postsTo = page.locator('label:has-text("Posts to") select')
    const type = page.locator('label:has-text("Type *") select')
    const options = async () =>
      (await postsTo.locator('option').allInnerTexts()).map((t) => t.trim())

    // A change made before the form has hydrated is reset by hydration, so
    // choose the type and check the options together until both hold.
    await expect(async () => {
      await type.selectOption('INPUT_VAT')
      expect(await options()).toEqual(['No tax posted', 'Input VAT'])
    }).toPass({ timeout: 10_000 })

    await expect(async () => {
      await type.selectOption('EWT_PAYABLE')
      expect(await options()).toEqual([
        'No tax posted',
        'Withholding Tax Payable',
        'Withholding Tax Payable — Rent',
        'Withholding Tax Payable — Professional Fees',
      ])
    }).toPass({ timeout: 10_000 })
  })
})
