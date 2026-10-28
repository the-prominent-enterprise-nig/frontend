import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// POS sidebar, regrouped to the client's "Proposed Point of Sales Tab revision".
// One sidebar row per group, each with a tab strip in the POS top bar:
//
//   Sales Counter        Overview | Checkout | Reservations | Transactions | Parked Sales
//   Product Catalog      Product Catalog | Price Lists (not a Sales Counter tab, and Price
//                        Lists not under Operations & Admin, on purpose)
//   Credit & Collections Collections | Credit Applications | Customers — the customer's
//                        account, in the client's order (Customers kept in POS on purpose)
//   Pricing & Promotion  Promotions → second row: Promo Codes | Gift Cards | Loyalty
//   Cash & Receipts      Management → second row: Sessions | Cash Drawer,
//                        New Receipts | Collected Funds History
//   Approvals & Reviews  Override Review | Unit Release Approvals | Refund Approvals |
//                        Void Requests | Cancellations
//   Reports              Sales Reports | Daily Collection
//   Operations & Admin   Service Jobs | POS PIN | Settings
//
// The tab definitions and each page's permission live in pos/_shared/pos-hubs.ts.
//
// Read-only: navigation and visibility only, nothing is created.

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
const INVESTIGATOR_EMAIL = process.env.E2E_INVESTIGATOR_EMAIL ?? 'technova.b1.investigator@test.com'

const sidebar = (page: Page) => page.locator('aside')
const strip = (page: Page) => page.getByRole('navigation', { name: 'POS section tabs' })
const subStrip = (page: Page) => page.getByRole('navigation', { name: 'POS sub tabs' })

// A link's accessible name is its label, plus the pending count when it carries
// one (Approvals & Reviews, Override Review) — so match the label followed by an
// optional number.
const linkName = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\d+)?$`)
const row = (page: Page, label: string) =>
  sidebar(page).getByRole('link', { name: linkName(label) })

async function expectTabs(page: Page, present: string[], absent: string[] = []) {
  for (const label of present) {
    await expect(strip(page).getByRole('link', { name: linkName(label) })).toBeVisible()
  }
  for (const label of absent) {
    await expect(strip(page).getByRole('link', { name: linkName(label) })).toHaveCount(0)
  }
}

/** The strip's tabs in the order they are drawn, pending counts dropped. */
async function tabOrder(page: Page): Promise<string[]> {
  const texts = await strip(page).getByRole('link').allInnerTexts()
  return texts.map((t) => t.replace(/\s*\d+$/, '').trim())
}

// Next dev compiles a route on its first hit, which can outlast the default 5s.
const NAVIGATED = { timeout: 20_000 }

// Clicks a link and waits for the route to change, clicking again if a click
// lands mid-transition and is swallowed (the race clickStable exists for, with
// a URL as the thing to wait on).
async function clickUntilUrl(
  link: () => ReturnType<Page['getByRole']>,
  page: Page,
  url: string | RegExp
) {
  await expect(async () => {
    await link().click()
    await expect(page).toHaveURL(url, { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
}

const clickTab = (page: Page, label: string, url: string | RegExp) =>
  clickUntilUrl(() => strip(page).getByRole('link', { name: linkName(label) }), page, url)

const clickSubTab = (page: Page, label: string, url: string | RegExp) =>
  clickUntilUrl(() => subStrip(page).getByRole('link', { name: linkName(label) }), page, url)

const clickRow = (page: Page, label: string, url: string | RegExp) =>
  clickUntilUrl(() => row(page, label), page, url)

test.describe('POS sidebar — Business Owner', () => {
  test('eight rows, named as the doc names them; the old rows are gone', async ({ page }) => {
    await gotoReady(page, '/pos/customers')

    for (const label of [
      'Sales Counter',
      'Product Catalog',
      'Credit & Collections',
      'Pricing & Promotion',
      'Cash & Receipts',
      'Approvals & Reviews',
      'Reports',
      'Operations & Admin',
    ]) {
      await expect(row(page, label)).toHaveCount(1)
    }

    for (const label of [
      'Operations',
      'Price Lists',
      'Customers',
      'Cash & Collections',
      'Collections',
      'Cash & Shift',
      'Approvals',
      'Promotions',
      'Credit Applications',
      'Sales Reports',
      'Service Jobs',
      'POS PIN',
      'Management',
      'Branch Pricing',
      'New Receipts',
    ]) {
      await expect(row(page, label)).toHaveCount(0)
    }
  })

  test('Sales Counter is lit on the sale-flow tabs only, and has no Product Catalog', async ({
    page,
  }) => {
    const lit = /bg-prominent-orange-200\/20/

    await gotoReady(page, '/pos/checkout')
    await expect(row(page, 'Sales Counter')).toHaveAttribute('href', '/pos')
    await expect(row(page, 'Sales Counter')).toHaveClass(lit)
    expect(await tabOrder(page)).toEqual([
      'Overview',
      'Checkout',
      'Reservations',
      'Transactions',
      'Parked Sales',
    ])

    // The "Point of Sale" module row above is lit on every POS page; this is not.
    await gotoReady(page, '/pos/catalog')
    await expect(row(page, 'Sales Counter')).not.toHaveClass(lit)
    await expect(row(page, 'Product Catalog')).toHaveClass(lit)
  })

  test('Product Catalog and Price Lists share one strip', async ({ page }) => {
    await gotoReady(page, '/pos/catalog')
    expect(await tabOrder(page)).toEqual(['Product Catalog', 'Price Lists'])
    // Stock is per branch, so the catalog keeps the shared switcher …
    await expect(page.getByTestId('pos-branch-switcher')).toBeVisible()

    // … and Price Lists, scoped by their own branch filter, do not.
    await clickTab(page, 'Price Lists', '/pos/catalog/price-lists')
    await expect(page.getByTestId('pos-branch-switcher')).toHaveCount(0)
  })

  test('Pricing & Promotion: Promotions (with its three pages) and Price Maker', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/customers')
    await clickRow(page, 'Pricing & Promotion', '/pos/promo-codes')

    expect(await tabOrder(page)).toEqual(['Promotions', 'Price Maker'])
    await expect(subStrip(page).getByRole('link')).toHaveText([
      'Promo Codes',
      'Gift Cards',
      'Loyalty',
    ])
    await clickSubTab(page, 'Gift Cards', '/pos/gift-cards')
    await expect(page.getByTestId('pos-branch-switcher')).toBeVisible()

    // Price Maker is a page of its own, with no second row.
    await clickTab(page, 'Price Maker', '/pos/price-maker')
    await expect(subStrip(page)).toHaveCount(0)
  })

  test('Credit & Collections: Collections, Credit Applications and Customers, in that order', async ({
    page,
  }) => {
    const lit = /bg-prominent-orange-200\/20/

    await gotoReady(page, '/pos/catalog')
    await clickRow(page, 'Credit & Collections', '/pos/collections')
    expect(await tabOrder(page)).toEqual(['Collections', 'Credit Applications', 'Customers'])
    await expect(row(page, 'Credit & Collections')).toHaveClass(lit)

    await clickTab(page, 'Credit Applications', '/pos/credit-applications')
    await clickTab(page, 'Customers', '/pos/customers')
    await expect(row(page, 'Credit & Collections')).toHaveClass(lit)

    // A customer's own page has no strip, but the row stays lit.
    await gotoReady(page, '/pos/customers/new')
    await expect(strip(page)).toHaveCount(0)
    await expect(row(page, 'Credit & Collections')).toHaveClass(lit)

    // New Receipts lives under /pos/collections too, but belongs to the cash group:
    // only that row is lit there.
    await gotoReady(page, '/pos/collections/acknowledgement')
    await expect(row(page, 'Cash & Receipts')).toHaveClass(lit)
    await expect(row(page, 'Credit & Collections')).not.toHaveClass(lit)
  })

  test('Cash & Receipts: Management fronts Sessions and Cash Drawer, with New Receipts and Collected Funds History', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/catalog')
    await clickRow(page, 'Cash & Receipts', '/pos/sessions')

    expect(await tabOrder(page)).toEqual(['Management', 'New Receipts', 'Collected Funds History'])
    await expect(subStrip(page).getByRole('link')).toHaveText(['Sessions', 'Cash Drawer'])
    await expect(page.getByTestId('pos-branch-switcher')).toBeVisible()

    // Management stays lit across both of its pages.
    await clickSubTab(page, 'Cash Drawer', '/pos/cash-drawer')
    await expect(strip(page).getByRole('link', { name: 'Management' })).toHaveClass(
      /border-purple-600/
    )

    // A page with no second row drops it.
    await clickTab(page, 'Collected Funds History', '/pos/undeposited-funds')
    await expect(subStrip(page)).toHaveCount(0)
    await expect(page.getByTestId('pos-branch-switcher')).toHaveCount(0)
  })

  test('Approvals & Reviews: the doc order, opening on Override Review', async ({ page }) => {
    await gotoReady(page, '/pos/customers')
    await clickRow(page, 'Approvals & Reviews', '/pos/override-review')

    expect(await tabOrder(page)).toEqual([
      'Override Review',
      'Unit Release Approvals',
      'Refund Approvals',
      'Void Requests',
      'Cancellations',
    ])
    await clickTab(page, 'Unit Release Approvals', '/pos/release-approvals')
    await clickTab(page, 'Refund Approvals', '/pos/return-refund-approvals')
  })

  test('Reports opens on Sales Reports and also has Daily Collection', async ({ page }) => {
    await gotoReady(page, '/pos/customers')
    await clickRow(page, 'Reports', '/pos/reports')
    expect(await tabOrder(page)).toEqual(['Sales Reports', 'Daily Collection'])

    await clickTab(page, 'Daily Collection', '/pos/daily-collection')
  })

  test('Price Lists keeps the strip, and the Product Catalog row, on its list and upload pages', async ({
    page,
  }) => {
    const lit = /bg-prominent-orange-200\/20/

    await gotoReady(page, '/pos/catalog/price-lists')
    await expect(page.getByRole('heading', { name: 'Price Lists' })).toBeVisible({
      timeout: 10_000,
    })
    await expectTabs(page, ['Product Catalog', 'Price Lists'])
    await expect(row(page, 'Product Catalog')).toHaveClass(lit)

    await gotoReady(page, '/pos/catalog/price-lists/upload')
    await expectTabs(page, ['Product Catalog', 'Price Lists'])
    await expect(row(page, 'Product Catalog')).toHaveClass(lit)
    await expect(page.getByTestId('pos-branch-switcher')).toHaveCount(0)
  })

  test('Operations & Admin holds Service Jobs, POS PIN and Settings', async ({ page }) => {
    await gotoReady(page, '/pos/customers')
    await clickRow(page, 'Operations & Admin', '/pos/service-jobs')
    expect(await tabOrder(page)).toEqual(['Service Jobs', 'POS PIN', 'Settings'])

    await clickTab(page, 'POS PIN', '/pos/pin')
    // Settings keeps its own left rail; the strip sits above it.
    await clickTab(page, 'Settings', /\/pos\/settings\/general$/)
    await expectTabs(page, ['Settings'])
  })

  test('Branch Pricing is gone', async ({ page }) => {
    const response = await page.goto('/pos/branch-pricing', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
  })
})

test.describe('POS sidebar — Cashier', () => {
  // The real role boundary, so it opts out of the shared Business Owner state.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Approvals & Reviews shows only the queues a cashier may open', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/approvals')
    // Cashier holds pos:transactions:read but not the override permission, so the
    // first tab they can open is not the first in the doc's order.
    await expect(page).toHaveURL('/pos/release-approvals', NAVIGATED)
    await expectTabs(
      page,
      ['Unit Release Approvals', 'Void Requests'],
      ['Override Review', 'Refund Approvals', 'Cancellations']
    )
  })

  test('has Sales Counter and Product Catalog, and never Sales Reports', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/checkout')
    for (const label of [
      'Sales Counter',
      'Product Catalog',
      'Credit & Collections',
      'Cash & Receipts',
    ]) {
      await expect(row(page, label)).toHaveCount(1)
    }

    // Sales Reports is Branch-Manager tier (pos:reports:read). Whatever else the
    // cashier's Reports group holds (Daily Collection, when the role has it), the
    // Sales Reports tab is never among it.
    await gotoReady(page, '/pos/daily-collection')
    await expectTabs(page, [], ['Sales Reports'])
  })

  test('Credit & Collections and Cash & Receipts open without a 403', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)

    await gotoReady(page, '/pos/credit-collections')
    await expect(page).toHaveURL(/\/pos\/(customers|credit-applications|collections)$/, NAVIGATED)
    await expect(page.getByText('Access Forbidden')).toHaveCount(0)

    await gotoReady(page, '/pos/cash-receipts')
    await expect(page).toHaveURL(
      /\/pos\/(sessions|cash-drawer|collections\/acknowledgement|undeposited-funds)$/,
      NAVIGATED
    )
    await expect(page.getByText('Access Forbidden')).toHaveCount(0)
  })

  test('Operations & Admin has POS PIN but no Settings for a cashier', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/admin')
    await expect(page).toHaveURL(/\/pos\/(service-jobs|pin)$/, NAVIGATED)
    // Settings is Business Owner / Branch Manager only.
    await expectTabs(page, ['POS PIN'], ['Settings'])
  })
})

test.describe('POS sidebar — Credit Investigator', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('reaches Credit Applications through Credit & Collections, and nothing they cannot open', async ({
    page,
  }) => {
    await loginAs(page, INVESTIGATOR_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/credit-collections')
    await expect(page).toHaveURL('/pos/credit-applications', NAVIGATED)

    await expect(row(page, 'Credit & Collections')).toHaveCount(1)
    for (const label of [
      'Sales Counter',
      'Product Catalog',
      'Approvals & Reviews',
      'Reports',
      'Pricing & Promotion',
      'Cash & Receipts',
    ]) {
      await expect(row(page, label)).toHaveCount(0)
    }
    // Only one tab of the group is theirs, so there is no strip to switch with.
    await expect(strip(page)).toHaveCount(0)
  })
})
