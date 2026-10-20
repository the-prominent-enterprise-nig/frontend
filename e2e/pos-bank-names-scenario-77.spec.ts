import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'
import { fillStable, gotoReady } from './utils'

// Scenario 77 Part 2 — full bank names (client notes, 2026-10-16): "Replace
// 'MTCB' with Metrobank's full name and display the full names of other banks
// as well." The stored option names stay short (MBTC, BDO-Q, …); every place
// that shows one shows the bank's full legal name instead.
// Case IDs (S77-2-F…) match docs/scenario-77-pos-bank-names-session-collections-plan.md.
//
// The checkout cases need one item in the cart, so they pick any in-stock,
// non-serial item from the live Bago catalog rather than a fixed name (a fixed
// name is what left pos-checkout-payment-method-options failing on the dev DB),
// and skip if there is none. Nothing is sold or saved: the cart lives in each test's
// own browser context and goes with it.
// One dedicated terminal, as in Part 1; its session is closed in afterAll.

const TERMINAL_CODE = 'E2E-S77-PW-01'
const TERMINAL_NAME = 'E2E S77 Terminal'
const BRANCH = 'Bago'

const METROBANK = 'Metropolitan Bank and Trust Company'

let terminalId = ''
let branchId = ''

async function ownerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
}

function rowsOf<T>(body: unknown): T[] {
  return (Array.isArray(body) ? body : ((body as { data?: unknown[] }).data ?? [])) as T[]
}

async function ensureTerminal(request: APIRequestContext): Promise<void> {
  const branches = rowsOf<{ id: string; name: string }>(
    await (await request.get('/api/branches?limit=200')).json()
  )
  const branch = branches.find((b) => b.name === BRANCH)
  if (!branch) throw new Error(`branch "${BRANCH}" not found`)
  branchId = branch.id

  const terminals = rowsOf<{ id: string; terminalCode: string }>(
    await (await request.get('/api/pos/terminals?limit=500')).json()
  )
  const existing = terminals.find((t) => t.terminalCode === TERMINAL_CODE)
  if (existing) {
    await request.patch(`/api/pos/terminals/${existing.id}`, { data: { status: 'active' } })
    terminalId = existing.id
    return
  }
  const res = await request.post('/api/pos/terminals', {
    data: { terminalCode: TERMINAL_CODE, name: TERMINAL_NAME, branchId },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  terminalId = (await res.json()).id
}

async function closeOurSessions(request: APIRequestContext) {
  const open = rowsOf<{ id: string }>(
    await (await request.get(`/api/pos/sessions?terminalId=${terminalId}&status=open`)).json()
  )
  for (const s of open) {
    const rec = await (await request.get(`/api/pos/sessions/${s.id}/reconciliation`)).json()
    const expected = Number((rec.data ?? rec).expectedClosingCash ?? 0)
    await request.post(`/api/pos/sessions/${s.id}/close`, {
      data: { declaredClosingCash: expected },
    })
  }
}

/** Checkout with our session selected and one in-stock item in the cart. */
async function checkoutWithAnItem(page: Page) {
  const open = rowsOf<{ id: string }>(
    await (await page.request.get(`/api/pos/sessions?terminalId=${terminalId}&status=open`)).json()
  )
  if (open.length === 0) {
    const res = await page.request.post('/api/pos/sessions/open', {
      data: { terminalId, openingCash: 0 },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
  }

  type CatalogItem = { name?: string; sku?: string; isSerialTracked?: boolean; stockQty?: number }
  const items = rowsOf<CatalogItem>(
    await (await page.request.get(`/api/pos/catalog?branchId=${branchId}`)).json()
  )
  const item = items.find((i) => !i.isSerialTracked && (i.stockQty ?? 0) > 0 && i.sku)
  test.skip(!item, 'no in-stock, non-serial item at Bago on this DB')

  await gotoReady(page, '/pos/checkout')
  // Several open sessions render a picker; with only ours, checkout picks it
  // and shows a chip. Wait for whichever renders — isVisible() alone doesn't
  // wait, and the sessions load after the page does.
  const picker = page.locator('select').filter({ hasText: 'Select session…' })
  const chip = page.locator('span.rounded-full', { hasText: TERMINAL_NAME })
  await expect(picker.or(chip).first()).toBeVisible({ timeout: 30_000 })
  if (await picker.isVisible()) {
    const label = await picker.locator('option', { hasText: TERMINAL_CODE }).first().textContent()
    await picker.selectOption({ label: label!.trim() })
  }

  await fillStable(page.getByPlaceholder('Search by name or serial'), item!.sku!)
  await page.getByRole('button').filter({ hasText: item!.sku! }).first().click()
  // A cash line brings up the Cash toggle (Cash on Hand … Debit/Credit Card),
  // whatever the line's price.
  await expect(page.getByTestId('cash-sub-mode-toggle')).toBeVisible({ timeout: 15_000 })
}

async function pickCashSubMode(page: Page, name: string) {
  await page.getByTestId('cash-sub-mode-toggle').getByRole('button', { name, exact: true }).click()
}

async function pickerOptions(page: Page, name: string): Promise<string[]> {
  const box = page.getByRole('combobox', { name, exact: true })
  await expect(box).toBeVisible({ timeout: 10_000 })
  await box.click()
  const texts = await page.getByRole('listbox').getByRole('option').allTextContents()
  return texts.map((t) => t.trim())
}

test.describe('Scenario 77 Part 2 — full bank names', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await ownerRequest(playwright, baseURL!)
    await ensureTerminal(request)
    await closeOurSessions(request)
    await request.dispose()
  })

  test.afterAll(async ({ playwright, baseURL }) => {
    const request = await ownerRequest(playwright, baseURL!)
    await closeOurSessions(request)
    await request.dispose()
  })

  test('S77-2-F01 — POS settings keep the short name and say what the POS shows', async ({
    page,
  }) => {
    await gotoReady(page, '/settings/payment-methods')
    const card = page.getByTestId('payment-method-options-card')
    await expect(card.getByText('MBTC', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText(`shown as ${METROBANK}`)).toBeVisible()
    await expect(card.getByText('shown as BDO Unibank', { exact: true })).toBeVisible()

    const qr = page.getByTestId('payment-method-options-qr')
    await expect(qr.getByText('shown as Security Bank Corporation')).toBeVisible()
    // A brand is not a bank abbreviation: no "shown as" beside Maya.
    const mayaRow = qr.locator('[data-testid^="payment-method-option-row-"]', {
      has: page.getByText('Maya', { exact: true }),
    })
    await expect(mayaRow.getByTestId('payment-method-option-full-name')).toHaveCount(0)
  })

  test('S77-2-F02 — the Card Acquirer picker lists full names, and "MBTC" still finds Metrobank', async ({
    page,
  }) => {
    await checkoutWithAnItem(page)
    await pickCashSubMode(page, 'Debit/Credit Card')

    const options = await pickerOptions(page, 'Card Acquirer')
    expect(options).toEqual(
      expect.arrayContaining(['BDO Unibank', 'Bank of the Philippine Islands', METROBANK, 'Maya'])
    )
    expect(options).not.toContain('MBTC')

    await page.getByRole('combobox', { name: 'Card Acquirer' }).fill('MBTC')
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText([METROBANK])
    await page.getByRole('option', { name: METROBANK }).click()
    await expect(page.getByRole('combobox', { name: 'Card Acquirer' })).toHaveValue(METROBANK)
  })

  test('S77-2-F03 — Cash → Bank Transfer lists the deposit banks by full name and branch', async ({
    page,
  }) => {
    await checkoutWithAnItem(page)
    await page
      .getByTestId('cash-sub-mode-toggle')
      .getByRole('button', { name: 'Bank Transfer', exact: true })
      .click()

    const options = await pickerOptions(page, 'Bank')
    expect(options).toEqual(
      expect.arrayContaining([
        'BDO Unibank — Iloilo Quezon',
        'BDO Unibank — Goldenfield',
        'Bank of the Philippine Islands — Araneta',
        'Bank of the Philippine Islands — Iloilo Central Market',
        METROBANK,
        'Land Bank of the Philippines — Passi',
        'Land Bank of the Philippines — Sipalay',
        'Land Bank of the Philippines — Sagay',
      ])
    )

    // (edge) the short code still filters to its bank
    await page.getByRole('combobox', { name: 'Bank', exact: true }).fill('lb-psb')
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
      'Land Bank of the Philippines — Passi',
    ])
  })

  test('S77-2-F04 (edge) — Cash → QR shows Security Bank by name and leaves Maya as it is', async ({
    page,
  }) => {
    await checkoutWithAnItem(page)
    await page
      .getByTestId('cash-sub-mode-toggle')
      .getByRole('button', { name: 'QR', exact: true })
      .click()

    const options = await pickerOptions(page, 'Gateway')
    expect(options).toEqual(expect.arrayContaining(['Maya', 'Security Bank Corporation']))
    expect(options).not.toContain('Sbank')
  })
})
