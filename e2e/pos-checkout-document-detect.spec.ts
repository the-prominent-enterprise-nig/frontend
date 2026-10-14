import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// The checkout's document number is typed off a paper booklet, under a Sales
// Invoice / Delivery Receipt toggle. A number that carries its own prefix is
// the document it says: "DR-1014-B" typed with Sales Invoice selected used to be
// saved as an invoice that happened to be numbered DR, and read "Sales Invoice
// No." on every screen. Now the toggle follows the number.

const BRANCH = 'Bago'

async function ensureOpenSession(request: APIRequestContext): Promise<void> {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  if (open.length) return
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

const numberInput = (page: Page) => page.getByTestId('document-number-input')
const radio = (page: Page, type: 'sales_invoice' | 'delivery_receipt') =>
  page.getByTestId(`document-type-${type}`)

/** An owner sees every branch's open sessions: with several open the checkout asks
 * which one to ring on, with exactly one it simply picks it. Handles both. */
async function pickSessionIfAsked(page: Page): Promise<void> {
  const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
  const autoSelected = page.getByText(/^Counter \d+$/).first()
  await expect(sessionSelect.or(autoSelected)).toBeVisible({ timeout: 20_000 })
  if (await sessionSelect.isVisible()) {
    const value = await sessionSelect
      .locator('option', { hasText: BRANCH })
      .first()
      .getAttribute('value')
    await sessionSelect.selectOption(value!)
  }
}

/** Typed until the toggle has caught up: a value typed before hydration shows in
 * the box without reaching the page's state, so it is emptied and typed again. */
async function typeNumber(page: Page, value: string): Promise<void> {
  const input = numberInput(page)
  await pickSessionIfAsked(page)
  await expect(async () => {
    await input.fill('')
    await fillStable(input, value)
    await expect(input).toHaveValue(value)
  }).toPass({ timeout: 15_000 })
}

test.describe('POS Checkout — the document type follows the number', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL!,
      storageState: 'e2e/.auth/business-owner.json',
    })
    await ensureOpenSession(request)
    await request.dispose()
  })

  test('DD-F01: a number starting DR, typed under Sales Invoice, switches to Delivery Receipt and relabels', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'true', {
      timeout: 20_000,
    })

    await typeNumber(page, 'DR-1014-B')

    await expect(radio(page, 'delivery_receipt')).toHaveAttribute('aria-checked', 'true')
    await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('document-switch-note')).toContainText('Delivery Receipt')
    // The field keeps what was typed, now under its own name.
    await expect(numberInput(page)).toHaveValue('DR-1014-B')
    await expect(page.getByLabel('Delivery Receipt No.')).toBeVisible()
  })

  test('DD-F02: a number starting SI, typed under Delivery Receipt, switches to Sales Invoice', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await expect(radio(page, 'sales_invoice')).toBeVisible({ timeout: 20_000 })
    // A click before hydration changes nothing, so it is repeated until it takes
    // (picking the document already selected does nothing, so repeating is safe).
    await expect(async () => {
      await radio(page, 'delivery_receipt').click()
      await expect(radio(page, 'delivery_receipt')).toHaveAttribute('aria-checked', 'true', {
        timeout: 1_000,
      })
    }).toPass({ timeout: 15_000 })

    await typeNumber(page, 'SI-2201')

    await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('document-switch-note')).toContainText('Sales Invoice')
  })

  test('DD-F03: a word that only starts with those letters, and a plain number, leave the choice alone', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'true', {
      timeout: 20_000,
    })

    await typeNumber(page, 'DRAKE-1')
    await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('document-switch-note')).toHaveCount(0)

    await typeNumber(page, '000123')
    await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'true')
  })

  test('DD-F04: choosing the other document by hand still works and clears the number', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await typeNumber(page, 'DR-77')
    await expect(radio(page, 'delivery_receipt')).toHaveAttribute('aria-checked', 'true')

    await expect(async () => {
      await radio(page, 'sales_invoice').click()
      await expect(radio(page, 'sales_invoice')).toHaveAttribute('aria-checked', 'true', {
        timeout: 1_000,
      })
    }).toPass({ timeout: 15_000 })
    await expect(numberInput(page)).toHaveValue('')
    await expect(page.getByTestId('document-switch-note')).toHaveCount(0)
  })
})
