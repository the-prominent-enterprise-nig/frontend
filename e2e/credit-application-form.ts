import { expect, type Locator, type Page } from '@playwright/test'
import { clickStable, fillPhoneStable, gotoReady, openCustomSelect } from './utils'

// Shared by the specs that drive the New Credit Application form
// (pr199-credit-application, credit-application-unit-picker).

export const DRAFT_KEY = 'credit_application_draft'

// ── Field helpers ──────────────────────────────────────────────────────────
// Most labels on this form are siblings of their control rather than
// associated with it, so a field is found through its label's container.

export const fieldBox = (scope: Page | Locator, label: RegExp): Locator =>
  scope.locator('label', { hasText: label }).locator('..')

export const input = (scope: Page | Locator, label: RegExp): Locator =>
  fieldBox(scope, label).locator('input').first()

export async function pickOption(trigger: Locator, page: Page, option: string): Promise<void> {
  await openCustomSelect(trigger)
  await page.getByRole('option', { name: option, exact: true }).click()
}

export const priceUse = (page: Page): Locator => fieldBox(page, /^Price Use/).getByRole('combobox')
export const term = (page: Page): Locator => fieldBox(page, /^Financing Term/).getByRole('combobox')

export async function pickApplicant(page: Page, name: string): Promise<void> {
  const box = page.getByPlaceholder('Search customer by name or phone…')
  // The closed picker is a button that swaps to the input on click; a click
  // that lands before hydration does nothing, so retry until the input shows.
  await clickStable(page.getByRole('button', { name: 'Search customer by name or phone…' }), box)
  const result = page.getByRole('button', { name: new RegExp(name) })
  await expect(async () => {
    await box.fill(name)
    await expect(result).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await result.click()
}

/** The item row at `index` — the box around its "Item / Model" picker. */
export const itemRow = (page: Page, index = 0): Locator =>
  page
    .getByText('Item / Model', { exact: false })
    .nth(index)
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')

/** Picks (or replaces) the item in an item row. Once an item is picked, the
 * search box's placeholder becomes that item's label, so the box is found
 * inside the row rather than by its default placeholder. */
export async function pickItem(page: Page, query: string, index = 0): Promise<void> {
  const row = itemRow(page, index)
  await row.getByRole('button').first().click()
  const box = row.locator('input').first()
  const result = page.getByRole('button', { name: new RegExp(query) }).first()
  await expect(async () => {
    await box.fill(query)
    await expect(result).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await result.click()
}

export async function openNewApplication(page: Page, applicantName: string): Promise<void> {
  await gotoReady(page, '/pos/credit-applications/new')
  await pickApplicant(page, applicantName)
}

/** Everything else the form requires before it will submit. */
export async function fillTheRest(page: Page): Promise<void> {
  // Related people — row 1 is the co-maker.
  const coMaker = page.locator('div.rounded-lg', { has: page.getByText(/^Role/) }).first()
  await fillPhoneStable(coMaker.locator('.phone-input-field'), '9171234560')
  await input(coMaker, /^First name/).fill('Ramon')
  await pickOption(
    fieldBox(coMaker, /^Relationship to applicant/).getByRole('combobox'),
    page,
    'Sibling'
  )

  // Character reference, row 1.
  const reference = page
    .locator('div.rounded-lg', { has: page.getByText('Mobile number', { exact: true }) })
    .first()
  await input(reference, /^Name$/).fill('Ana Reyes')
  await fillPhoneStable(reference.locator('.phone-input-field'), '9171234561')
  await pickOption(fieldBox(reference, /^Relationship$/).getByRole('combobox'), page, 'Neighbor')

  // Paper record.
  await pickOption(fieldBox(page, /^Down payment collection/).getByRole('combobox'), page, 'Branch')
  await input(page, /^POS draft/).fill(`QT-E2E-${Date.now()}`)
  await pickOption(fieldBox(page, /^Applicant is unit user/).getByRole('combobox'), page, 'Yes')
  await page.getByRole('checkbox', { name: /Paper form fully complete and signed/ }).check()
}

/** Submits and returns the new application's id from the detail URL. */
export async function submit(page: Page): Promise<string> {
  await expect(async () => {
    await page.getByRole('button', { name: 'Submit Application' }).click()
    await expect(page).toHaveURL(/\/pos\/credit-applications\/[a-f0-9-]{36}$/, { timeout: 8_000 })
  }).toPass({ timeout: 40_000 })
  return page.url().split('/').pop()!
}

export type StoredApplication = {
  applicationNumber: string
  downPayment: string | number | null
  monthlyInstallment: string | number | null
  totalPayable: string | number | null
  amountFinanced: string | number | null
  lcp: string | number | null
  ppdRebate: string | number | null
  items: {
    id: string
    itemId: string
    serialNumberId: string | null
    serialNumber?: { id: string; serialNumber: string } | null
  }[]
}

export async function getApplication(page: Page, id: string): Promise<StoredApplication> {
  const res = await page.request.get(`/api/credit/applications/${id}`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return (body.data ?? body) as StoredApplication
}

export async function itemId(page: Page, query: string): Promise<string> {
  const res = await page.request.get(
    `/api/pos/transactions/items/lookup?q=${encodeURIComponent(query)}`
  )
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const items = (body.data ?? body) as { id: string; name: string }[]
  const match = items.find((i) => i.name.includes(query))
  expect(match, `no item matching ${query}`).toBeTruthy()
  return match!.id
}

/** Seeds the draft checkout writes when "New credit application" is clicked,
 * read once by the next load of the new-application page. */
export async function seedDraft(page: Page, draft: unknown): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-draft-seeded')) {
        localStorage.setItem(key, value)
        sessionStorage.setItem('e2e-draft-seeded', '1')
      }
    },
    [DRAFT_KEY, JSON.stringify(draft)] as const
  )
}
