import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillAllStable, loginAs } from './utils'

// Price Maker — the installment price preview that used to be a modal on CRM's
// Installment Accounts page ("Price checker"). It is a POS page now, a tab of
// Pricing & Promotion, and it calls the same InstallmentAccountService.priceCheck.
//
// Read-only: it only previews, so nothing is created.

/** Types the four terms and waits for `sentinel` to show. Fill and check go
 * together, so a fill that lands before hydration (and is reset by it) is done
 * again rather than left to time out. */
async function quote(
  page: Page,
  terms: { price: string; down: string; months: string; factor: string },
  sentinel: string
) {
  await expect(async () => {
    await fillAllStable([
      { locator: page.getByLabel('Listed cash price (₱)'), value: terms.price },
      { locator: page.getByLabel('Down payment (₱)'), value: terms.down },
      { locator: page.getByLabel('Term (months, 1-12)'), value: terms.months },
      { locator: page.getByLabel('MI factor'), value: terms.factor },
    ])
    await expect(page.getByText(sentinel, { exact: true })).toBeVisible({ timeout: 2_500 })
  }).toPass({ timeout: 25_000 })
}

test('Price Maker works out the financing terms on its own page', async ({ page }) => {
  await gotoReady(page, '/pos/price-maker')
  await expect(page.getByRole('heading', { name: 'Price Maker' })).toBeVisible()
  // A page, not a pop-up.
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await quote(page, { price: '50000', down: '10000', months: '12', factor: '0.0954' }, '₱40,000.00')

  // AF = 40000, MI = round2(40000*0.0954) = 3816, PNV = 3816*12 = 45792,
  // Total price = 45792+10000 = 55792, ID = 55792-50000 = 5792
  await expect(page.getByText('₱3,816.00')).toBeVisible()
  await expect(page.getByText('₱45,792.00')).toBeVisible()
  await expect(page.getByText('₱55,792.00')).toBeVisible()
  await expect(page.getByText('₱5,792.00')).toBeVisible()
})

test('a term over 12 months is refused on the page', async ({ page }) => {
  await gotoReady(page, '/pos/price-maker')
  // Fill and check together, so a fill that lands before hydration (and is reset
  // by it) is simply done again.
  await expect(async () => {
    await fillAllStable([{ locator: page.getByLabel('Term (months, 1-12)'), value: '13' }])
    await expect(page.getByText('Term cannot exceed 12 months')).toBeVisible({ timeout: 1_500 })
  }).toPass({ timeout: 15_000 })
})

test('Price Maker is a tab of Pricing & Promotion', async ({ page }) => {
  await gotoReady(page, '/pos/price-maker')
  const tabs = page.getByRole('navigation', { name: 'POS section tabs' })
  await expect(tabs.getByRole('link', { name: 'Price Maker' })).toHaveClass(/border-purple-600/)
  await expect(tabs.getByRole('link', { name: 'Promotions' })).toBeVisible()
})

test.describe('Price Maker — Cashier', () => {
  // The real role boundary, so it opts out of the shared Business Owner state.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a cashier can use it (pos:transactions:read), without CRM access', async ({ page }) => {
    await loginAs(
      page,
      process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com',
      process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
    )
    await gotoReady(page, '/pos/price-maker')
    await expect(page.getByRole('heading', { name: 'Price Maker' })).toBeVisible()
    await quote(page, { price: '1000', down: '100', months: '6', factor: '0.05' }, '₱900.00')
    // AF = 900, MI = 45, PNV = 270, Total = 370
    await expect(page.getByText('₱45.00', { exact: true })).toBeVisible()
  })
})
