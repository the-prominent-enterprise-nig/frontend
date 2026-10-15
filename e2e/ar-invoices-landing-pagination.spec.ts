import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// The AR Invoices landing page lists customers with their totals. It used to
// download every invoice (~25 MB at 12.7k) and group them in the browser, so
// it was slow to open and slower to search. The server now groups and pages
// the customers (GET /ar-invoices?view=customers&limit&offset), and the page
// shows 25 at a time.
//
// The pages are mocked so this does not depend on how many customers the test
// database happens to hold. That the server's totals match a hand-grouping of
// the full list is covered by the backend unit spec and was checked against the
// 12.7k-invoice register.

const PER_PAGE = 25
const MOCK_CUSTOMERS = Array.from({ length: 60 }, (_, n) => ({
  customerId: `mock-customer-${n}`,
  customerName: `Mock Customer ${String(n).padStart(2, '0')}`,
  invoiceCount: (n % 3) + 1,
  total: 10_000 - n * 100,
  paid: 0,
  // Highest first, as the server returns them.
  outstanding: 10_000 - n * 100,
  overdueCount: n % 2,
}))

async function mockCustomerPages(page: Page) {
  const requests: URL[] = []
  await page.route(/\/api\/ar-invoices(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.searchParams.get('view') !== 'customers') return route.fallback()
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const limit = Number(url.searchParams.get('limit') ?? Number.MAX_SAFE_INTEGER)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const matching = MOCK_CUSTOMERS.filter((c) => c.customerName.toLowerCase().includes(search))
    await route.fulfill({
      json: { items: matching.slice(offset, offset + limit), total: matching.length },
    })
  })
  return requests
}

const rows = (page: Page) => page.locator('tbody tr.cursor-pointer')
const indicator = (page: Page, text: string) => page.getByText(text, { exact: true })
const pagerButton = (page: Page, name: 'Next' | 'Previous') =>
  page.getByRole('button', { name, exact: true })

// Open the landing with the customer pages mocked, and the dev-only React Query
// devtools widget hidden: it is a fixed overlay in the bottom-right corner, which is
// exactly where the page bar's Next button sits at the end of a full page, and it
// catches the click.
async function openLanding(page: Page) {
  const requests = await mockCustomerPages(page)
  await gotoReady(page, '/accounting/ar-invoices')
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
  await expect(rows(page)).toHaveCount(PER_PAGE, { timeout: 30_000 })
  return requests
}

const clickPager = (page: Page, name: 'Next' | 'Previous') => pagerButton(page, name).click()

test.describe('AR Invoices landing — customers are paged on the server', () => {
  test('opens on the first page of customers and never asks for the whole register', async ({
    page,
  }) => {
    const requests = await openLanding(page)

    await expect(rows(page).first()).toContainText('Mock Customer 00')
    await expect(page.getByText('60 customers', { exact: true })).toBeVisible()
    await expect(indicator(page, '1 / 3')).toBeVisible()

    // One page asked for — not every invoice.
    const first = requests.find((u) => u.searchParams.get('view') === 'customers')!
    expect(first.searchParams.get('limit')).toBe(String(PER_PAGE))
    expect(first.searchParams.get('offset')).toBe('0')
    expect(requests.filter((u) => u.searchParams.get('view') !== 'customers')).toEqual([])
  })

  test('Next and Previous move through the pages, and the buttons stop at the ends', async ({
    page,
  }) => {
    const requests = await openLanding(page)
    await expect(pagerButton(page, 'Previous')).toBeDisabled()

    await clickPager(page, 'Next')
    await expect(indicator(page, '2 / 3')).toBeVisible()
    await expect(rows(page).first()).toContainText('Mock Customer 25')
    await expect(rows(page)).toHaveCount(PER_PAGE)

    await clickPager(page, 'Next')
    await expect(indicator(page, '3 / 3')).toBeVisible()
    await expect(rows(page).first()).toContainText('Mock Customer 50')
    await expect(rows(page)).toHaveCount(10)
    await expect(pagerButton(page, 'Next')).toBeDisabled()

    await clickPager(page, 'Previous')
    await expect(indicator(page, '2 / 3')).toBeVisible()
    await expect(rows(page).first()).toContainText('Mock Customer 25')

    const offsets = requests
      .filter((u) => u.searchParams.get('view') === 'customers')
      .map((u) => u.searchParams.get('offset'))
    expect(offsets).toEqual(['0', '25', '50', '25'])
  })

  test('a page change made straight after the page opens is not undone', async ({ page }) => {
    // The search box commits its value 400ms after it settles — including once on
    // mount, where it used to send the list back to page 1 and undo this click.
    await openLanding(page)

    await clickPager(page, 'Next')
    await expect(indicator(page, '2 / 3')).toBeVisible()
    await page.waitForTimeout(1_000)

    await expect(indicator(page, '2 / 3')).toBeVisible()
    await expect(rows(page).first()).toContainText('Mock Customer 25')
  })

  test('searching goes back to page 1, and the page bar goes once one page is left', async ({
    page,
  }) => {
    const requests = await openLanding(page)
    await clickPager(page, 'Next')
    await expect(indicator(page, '2 / 3')).toBeVisible()

    await page.getByPlaceholder('Search…').fill('Customer 07')

    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Mock Customer 07')
    await expect(page.getByText(/customers$/)).toHaveCount(0)
    const searched = requests.filter((u) => u.searchParams.get('search') === 'Customer 07').at(-1)!
    expect(searched.searchParams.get('offset')).toBe('0')

    // Clearing it brings the full, paged list back on page 1.
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(rows(page)).toHaveCount(PER_PAGE)
    await expect(indicator(page, '1 / 3')).toBeVisible()
  })

  test('a customer row still opens that customer', async ({ page }) => {
    await openLanding(page)

    await rows(page).first().click()

    await expect(page).toHaveURL(/\/accounting\/ar-invoices\/customer\/mock-customer-0$/, {
      timeout: 15_000,
    })
  })
})
