import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 29 ACC-04 — installment interest release batch. Covers:
//  - Business Owner sees the page, its pending-release panel, and the Run
//    Release control.
//  - Branch Manager (explicitly granted accounting:installmentInterest:release
//    this scenario, unlike most enterprise-wide accounting resources) can
//    reach the page too.
//  - Stock Controller (no grant at all) is redirected to /403.
//
// Exercising an actual non-empty pending release / Run Release click end to
// end requires an installment contract with an elapsed due date, which
// nothing in this app's UI or API can create (due dates are computed from
// the sale date, never editable) — that path is covered by the backend e2e
// suite (test/installment-interest-release.e2e-spec.ts), which backdates
// InstallmentScheduleLine.dueDate directly via Prisma.

const DEV_PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'
const STOCK_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'

test.describe('Accounting — Installment Interest Release (Scenario 29 ACC-04)', () => {
  test('Business Owner sees the release page with its pending panel and Run Release control', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/installment-interest-release')
    await expect(page.getByRole('heading', { name: 'Installment Interest Release' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Pending release', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /Run Release/ })).toBeVisible()
  })

  test('Branch Manager (explicitly granted) can also reach the page', async ({ page }) => {
    await page.context().clearCookies()
    await loginAs(page, MANAGER_EMAIL, DEV_PASSWORD)
    await gotoReady(page, '/accounting/installment-interest-release')
    await expect(page.getByRole('heading', { name: 'Installment Interest Release' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: /Run Release/ })).toBeVisible()
  })

  test('Stock Controller has no access — redirected away', async ({ page }) => {
    await page.context().clearCookies()
    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    await gotoReady(page, '/accounting/installment-interest-release')
    await expect(page).toHaveURL(/\/403/, { timeout: 15_000 })
  })
})
