import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'
import { AGING_TEMPLATE_HEADERS } from '../src/schema/crm/aging-load'

// Load AR Aging — the client's aging sheet (60 columns, one row per sale)
// uploaded from CRM > Installment Accounts instead of loaded by script. The
// check reads every row and saves nothing; the load runs in the background and
// the page follows its progress.

const stamp = Date.now()
const SI_PREFIX = `E2EAG${stamp}`
// Customers are matched by their letters (digits and punctuation are ignored),
// so the fixture people differ — and stay unique per run — in letters.
const LETTERS = String(stamp).replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)])
const NAMES = ['ALPHA', 'BRAVO', 'CHARLIE']

/** One 60-cell row; `cells` sets columns by their header text. */
function sheetRow(cells: Record<string, string>): string {
  const out = new Array<string>(60).fill('')
  for (const [header, value] of Object.entries(cells)) {
    const at = AGING_TEMPLATE_HEADERS.indexOf(header)
    if (at === -1) throw new Error(`no such column ${header}`)
    out[at] = value
  }
  return out.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')
}

const sale = (n: number, extra: Record<string, string> = {}) =>
  sheetRow({
    CAT: 'A',
    br: 'AJB',
    'SI No.': `${SI_PREFIX}-${n}`,
    'SI Date': '08-15-2025',
    'Customer Name': `E2E AGING ${LETTERS} ${NAMES[n - 1]}`,
    Term: '12',
    MI: '1000',
    'FMI Date': '09-15-2025',
    DP: '1000',
    PNV: '12000',
    OB: '8000',
    'NO ARS': '1',
    'MOS RUN': '5',
    "TOTAL PAY'T": '5000',
    LCP: '10000',
    ...extra,
  })

const sheet = (...rows: string[]) =>
  Buffer.from([AGING_TEMPLATE_HEADERS.join(','), ...rows].join('\n'))

/** Picks the file and waits for the check to come back. A pick made before the
 * page has hydrated is dropped, so it is repeated until the page answers. */
async function choose(page: Page, buffer: Buffer, expected: string | RegExp) {
  await expect(async () => {
    await page.setInputFiles('[data-testid="aging-load-input"]', {
      name: 'aging.csv',
      mimeType: 'text/csv',
      buffer,
    })
    await expect(page.getByText(expected)).toBeVisible({ timeout: 6_000 })
  }).toPass({ timeout: 30_000 })
}

test.afterEach(async ({ page }) => {
  // Best effort: take the fixture accounts and their customers back out.
  const found = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  if (!found.ok()) return
  const body = await found.json()
  const accounts: { id: string; customerId: string }[] = body.data ?? body.items ?? []
  for (const a of accounts) {
    await page.request.delete(`/api/crm/installment-accounts/${a.id}`)
    await page.request.delete(`/api/crm/customers/${a.customerId}`)
  }
})

test('a row with an error blocks the load, and nothing is saved', async ({ page }) => {
  await gotoReady(page, '/crm/installment-accounts/load-aging')
  await choose(page, sheet(sale(1), sale(2, { OB: 'not a number' })), '2 sales read')

  await expect(page.getByText('1 with errors')).toBeVisible()
  await expect(page.getByText(/OB "not a number" is not a number/)).toBeVisible()
  await expect(page.getByText(/nothing can be loaded yet/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Load \d+ account/ })).toBeDisabled()

  const found = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  const body = await found.json()
  expect((body.data ?? body.items ?? []).length).toBe(0)
})

test('loads a sheet, then loading it again updates the accounts instead of duplicating them', async ({
  page,
}) => {
  const file = sheet(sale(1), sale(2), sale(3))
  await gotoReady(page, '/crm/installment-accounts/load-aging')
  await choose(page, file, '3 sales read')

  await expect(page.getByText('3 to create')).toBeVisible()
  await expect(page.getByText('3 new to be created')).toBeVisible()
  // The first rows are shown so the column mapping can be checked.
  await expect(page.getByText(`${SI_PREFIX}-1`)).toBeVisible()

  await page.getByRole('button', { name: 'Load 3 accounts' }).click()
  await expect(page.getByTestId('aging-load-done')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Loaded 3 accounts')).toBeVisible()
  await expect(page.getByText(/3 created, 0 updated, 3 new customers/)).toBeVisible()

  const loaded = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  const accounts = (await loaded.json()).data ?? []
  expect(accounts).toHaveLength(3)

  // The same sheet again: every sale is already there.
  await page.getByRole('button', { name: 'Load another file' }).click()
  await choose(page, file, '0 to create')
  await expect(page.getByText('3 to update')).toBeVisible()
  await page.getByRole('button', { name: 'Load 3 accounts' }).click()
  await expect(page.getByText(/0 created, 3 updated, 0 new customers/)).toBeVisible({
    timeout: 60_000,
  })

  const again = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  expect((await again.json()).data).toHaveLength(3)
})

test('the aging report and the installment accounts list link to the loader', async ({ page }) => {
  await gotoReady(page, '/crm/installment-accounts')
  await expect(page.getByRole('link', { name: 'Load aging sheet' })).toHaveAttribute(
    'href',
    '/crm/installment-accounts/load-aging'
  )
  await gotoReady(page, '/crm/installment-accounts/aging-report')
  await expect(page.getByRole('link', { name: 'Load aging sheet' })).toBeVisible({
    timeout: 20_000,
  })
})
