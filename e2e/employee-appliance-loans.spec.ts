import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 40 Part 4 — Employee Appliance Loan. A standalone model (not an
// InstallmentAccount extension), same financing-terms math, full page from
// the start per the same page-not-modal convention as Parts 1-3.
test.describe('Accounting — Employee Appliance Loans (Scenario 40 Part 4)', () => {
  test('creates a loan with correctly computed terms, records a partial payment, and updates the balance', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/employee-appliance-loans')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    await page.getByRole('link', { name: 'New Loan' }).click()
    await page.waitForURL('**/accounting/employee-appliance-loans/new')
    await expect(page.getByRole('heading', { name: 'New Employee Appliance Loan' })).toBeVisible({
      timeout: 10_000,
    })

    const employeeInput = page.getByPlaceholder('Search employee by name or code…')
    await employeeInput.click()
    await employeeInput.fill('TEC')
    const employeeDropdown = page.locator('div.absolute.z-50')
    await expect(employeeDropdown).toBeVisible({ timeout: 10_000 })
    await employeeDropdown.locator('button').first().click()

    await page.getByPlaceholder('e.g. Samsung 55" Smart TV').fill('E2E Test Fridge')
    await page.getByLabel('Listed Cash Price *').fill('25000')
    await page.getByLabel('Down Payment').fill('5000')
    await page.getByLabel('Term (months) *').fill('12')
    await page.getByLabel('MI Factor *').fill('0.0954')

    // Live preview computes before submit: AF=20000, MI=1908, PNV=22896.
    await expect(page.getByText('Amount Financed (AF)').locator('..')).toContainText('20,000')
    await expect(page.getByText('Monthly Installment (MI)').locator('..')).toContainText('1,908')
    await expect(page.getByText('PNV (MI × Term)').locator('..')).toContainText('22,896')

    await page.getByRole('button', { name: 'Create Loan' }).click()
    await page.waitForURL(/\/accounting\/employee-appliance-loans\/[0-9a-f-]+$/, {
      timeout: 10_000,
    })

    // Detail page shows the same server-computed terms.
    await expect(page.getByText('Amount Financed').locator('..')).toContainText('20,000')
    await expect(page.getByText('Outstanding Balance').locator('..')).toContainText('22,896')
    await expect(page.getByText('ACTIVE')).toBeVisible()

    // Record a partial payment.
    await page.getByLabel('Amount *').fill('1908')
    await page.getByRole('button', { name: 'Record Payment' }).click()
    await expect(page.getByText('Outstanding Balance').locator('..')).toContainText('20,988', {
      timeout: 10_000,
    })
    await expect(
      page.getByRole('heading', { name: 'Payment History' }).locator('..')
    ).toContainText('1,908')
  })
})
