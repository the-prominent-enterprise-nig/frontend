import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  clickStable,
  deleteCustomers,
  fillPhoneStable,
  gotoReady,
  openCustomSelect,
  sweepE2ECustomers,
} from './utils'

// PR #199 review (Chloe, 2026-10-02) — the credit application.
//
//   3. "upon credit application, the birthdate doesnt show anything"
//   4. "There's 2 'relationship to applicant'"
//   5. "Calculation are currently wrong" — the rate card's monthly is worked
//      out from the card's OWN down payment, so where the card prices the
//      item for the chosen term that down payment is fixed; elsewhere the
//      minimum is development's 10%.
//   6. "changing the item in a credit application breaks the submit" — the
//      serial picked at the till rode along with a different item.
//
// The SHARP 2TC32GH3000X figures are the client's own price list row
// (backend prisma/data/APPLIANCE PRICELIST AUG_07_26.xlsx - Sheet1.csv), which
// the seed loads verbatim:
//   WIP   15,380 · DP 3,380 · 3 mo 4,845 / PPD 360 · 6 mo 2,650 / 200
//   CR-BR 13,490 · DP 2,970 · 6 mo 2,230 / 170
//   ZI    15,990 · DP 3,510 · 12 mo 1,340 / 300 (no 3/6/9-month row)
// The DOWELL STF3238 fan is on the WIP list with no down payment of its own.

const NAME_PREFIX = 'E2E PR199'
const SHARP = '2TC32GH3000X'
const ASTRON = 'LED3277'
const FAN = 'STF3238'
const DRAFT_KEY = 'credit_application_draft'

// ── Field helpers ──────────────────────────────────────────────────────────
// Most labels on this form are siblings of their control rather than
// associated with it, so a field is found through its label's container.

const fieldBox = (scope: Page | Locator, label: RegExp) =>
  scope.locator('label', { hasText: label }).locator('..')

const input = (scope: Page | Locator, label: RegExp) =>
  fieldBox(scope, label).locator('input').first()

const downPayment = (page: Page) => input(page, /^Down Payment\s*\*?$/)
const lcp = (page: Page) => input(page, /^LCP/)
const ppd = (page: Page) => input(page, /^PPD rebate/)
const firstDue = (page: Page) => input(page, /^First due date/)

/** A row of the live breakdown, e.g. "Total price₱17,915.00". */
const breakdown = (page: Page, label: string) =>
  page
    .locator('div.flex')
    .filter({ hasText: new RegExp(`^${label}`) })
    .last()

async function pickOption(trigger: Locator, page: Page, option: string) {
  await openCustomSelect(trigger)
  await page.getByRole('option', { name: option, exact: true }).click()
}

const priceUse = (page: Page) => fieldBox(page, /^Price Use/).getByRole('combobox')
const term = (page: Page) => fieldBox(page, /^Financing Term/).getByRole('combobox')

async function createApplicant(page: Page, extra: Record<string, unknown> = {}) {
  // Two applicants made in the same millisecond must still differ.
  const name = `${NAME_PREFIX} Applicant ${Date.now()}${Math.floor(Math.random() * 1000)}`
  const res = await page.request.post('/api/crm/customers', {
    data: {
      name,
      firstName: 'E2E',
      lastName: name.replace('E2E ', ''),
      customerType: 'individual',
      phone: `+63917${Date.now().toString().slice(-7)}`,
      ...extra,
    },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return { id: (body.data ?? body).id as string, name }
}

async function pickApplicant(page: Page, name: string) {
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

/** Picks (or replaces) the item in the first item row. Once an item is
 * picked, the search box's placeholder becomes that item's label, so the box
 * is found inside the row rather than by its default placeholder. */
async function pickItem(page: Page, query: string) {
  const row = page
    .getByText('Item / Model', { exact: false })
    .first()
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  await row.getByRole('button').first().click()
  const box = row.locator('input').first()
  const result = page.getByRole('button', { name: new RegExp(query) }).first()
  await expect(async () => {
    await box.fill(query)
    await expect(result).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await result.click()
}

async function openNewApplication(page: Page, applicantName: string) {
  await gotoReady(page, '/pos/credit-applications/new')
  await pickApplicant(page, applicantName)
}

/** Everything else the form requires before it will submit. */
async function fillTheRest(page: Page) {
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
async function submit(page: Page): Promise<string> {
  await expect(async () => {
    await page.getByRole('button', { name: 'Submit Application' }).click()
    await expect(page).toHaveURL(/\/pos\/credit-applications\/[a-f0-9-]{36}$/, { timeout: 8_000 })
  }).toPass({ timeout: 40_000 })
  return page.url().split('/').pop()!
}

async function getApplication(page: Page, id: string) {
  const res = await page.request.get(`/api/credit/applications/${id}`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return (body.data ?? body) as {
    downPayment: string | number | null
    monthlyInstallment: string | number | null
    totalPayable: string | number | null
    amountFinanced: string | number | null
    lcp: string | number | null
    ppdRebate: string | number | null
    items: { itemId: string; serialNumberId: string | null }[]
  }
}

async function itemId(page: Page, query: string): Promise<string> {
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

function localDatePlusOneMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

test.describe('PR #199 — credit application', () => {
  const customerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  // Applications cannot be deleted (terminal statuses only), so customers
  // that end up on one stay — the delete is best-effort, as elsewhere.
  test.afterAll(async ({ request }) => {
    await deleteCustomers(request, customerIds)
  })

  test("the customer's birthday reaches the Customer Profile (point 3)", async ({ page }) => {
    const withBirthday = await createApplicant(page, { birthday: '1990-09-21' })
    const without = await createApplicant(page)
    customerIds.push(withBirthday.id, without.id)

    await openNewApplication(page, withBirthday.name)
    const header = page.getByRole('button', { name: /Customer Profile/ })
    await expect(header).toBeVisible({ timeout: 15_000 })
    // The header lists every gap ("Missing civil status, gender, … — confirm
    // or add"); birthdate must not be one of them.
    await expect(header).toContainText('Missing', { timeout: 15_000 })
    await expect(header).not.toContainText('birthdate')
    await clickStable(header, page.locator('label', { hasText: /^Birthdate/ }))
    await expect(input(page, /^Birthdate/)).toHaveValue('1990-09-21')

    // Control: a customer genuinely without one is still flagged.
    await openNewApplication(page, without.name)
    await expect(page.getByRole('button', { name: /Customer Profile/ })).toContainText(
      /Missing .*birthdate/,
      { timeout: 15_000 }
    )
  })

  test('the co-maker row asks Role, then Relationship to applicant — once (point 4)', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    await expect(page.locator('label', { hasText: /^Role\s*\*$/ })).toBeVisible()
    await expect(page.locator('label', { hasText: /^Relationship to applicant/ })).toHaveCount(1)

    // Only a co-maker is asked how they are related — Father already says it.
    const role = page
      .locator('label', { hasText: /^Role\s*\*$/ })
      .locator('..')
      .getByRole('combobox')
    await pickOption(role, page, 'Father')
    await expect(page.locator('label', { hasText: /^Relationship to applicant/ })).toHaveCount(0)
    await pickOption(role, page, 'Co-maker')
    await expect(page.locator('label', { hasText: /^Relationship to applicant/ })).toHaveCount(1)

    // A co-maker with no relationship is refused, by name.
    const coMaker = page.locator('div.rounded-lg', { has: page.getByText(/^Role/) }).first()
    await fillPhoneStable(coMaker.locator('.phone-input-field'), '9171234570')
    await input(coMaker, /^First name/).fill('Ramon')
    await page.getByRole('button', { name: 'Submit Application' }).click()
    await expect(page.getByText('Relationship is required for a co-maker')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('the down payment follows the price list (point 5) and LCP/PPD follow the item and term (point 6)', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    // ── No price-list down payment: development's 10% minimum, editable.
    await pickItem(page, FAN)
    await expect(priceUse(page)).toContainText('WIP', { timeout: 15_000 })
    await pickOption(term(page), page, '3 months')

    const itemTotalText = await breakdown(page, 'Item total').innerText()
    const fanTotal = Number(itemTotalText.replace(/[^0-9.]/g, ''))
    expect(fanTotal).toBeGreaterThan(0)
    const tenPercent = (fanTotal * 0.1).toFixed(2)

    await expect(downPayment(page)).toHaveValue(tenPercent, { timeout: 15_000 })
    await expect(downPayment(page)).toBeEditable()
    await expect(lcp(page)).toHaveValue(String(fanTotal))
    await expect(ppd(page)).toHaveValue('')
    await expect(firstDue(page)).toHaveValue(localDatePlusOneMonth())

    await downPayment(page).fill((fanTotal * 0.1 - 5).toFixed(2))
    await expect(page.getByText(/Down payment must be at least .*10%/)).toBeVisible({
      timeout: 10_000,
    })
    await downPayment(page).fill((fanTotal * 0.2).toFixed(2))
    await expect(page.getByText(/Down payment must be at least/)).toHaveCount(0, {
      timeout: 10_000,
    })

    // ── Chloe's item, same row: the card fixes the down payment.
    await pickItem(page, SHARP)
    await expect(breakdown(page, 'Item total')).toContainText('₱15,380.00', { timeout: 15_000 })
    await expect(downPayment(page)).toHaveValue('3380.00', { timeout: 15_000 })
    await expect(downPayment(page)).not.toBeEditable()
    await expect(page.getByText('Set by the price list for this term')).toBeVisible()
    await expect(breakdown(page, 'Amount financed')).toContainText('₱12,000.00', {
      timeout: 15_000,
    })
    await expect(breakdown(page, 'Monthly installment')).toContainText('₱4,845.00')
    await expect(breakdown(page, 'PNV')).toContainText('₱14,535.00')
    // 3,380 + 4,845 × 3 — the spreadsheet. The branch showed 19,149.
    await expect(breakdown(page, 'Total price')).toContainText('₱17,915.00')
    // LCP left the fan's price behind; PPD is the card's 3-month figure.
    await expect(lcp(page)).toHaveValue('15380')
    await expect(ppd(page)).toHaveValue('360')

    // ── Term → 6: same down payment, the 6-month monthly and PPD.
    await pickOption(term(page), page, '6 months')
    await expect(breakdown(page, 'Total price')).toContainText('₱19,280.00', { timeout: 15_000 })
    await expect(downPayment(page)).toHaveValue('3380.00')
    await expect(ppd(page)).toHaveValue('200')

    // ── Price Use → CR-BR: its own down payment, still fixed.
    await pickOption(priceUse(page), page, 'CR-BR')
    await expect(downPayment(page)).toHaveValue('2970.00', { timeout: 15_000 })
    await expect(downPayment(page)).not.toBeEditable()
    await expect(breakdown(page, 'Total price')).toContainText('₱16,350.00', { timeout: 15_000 })
    await expect(lcp(page)).toHaveValue('13490')
    await expect(ppd(page)).toHaveValue('170')

    // ── ZI at 6 months: the card has no 6-month row, so the factor rate
    // applies — the card's down payment is pre-filled but only a starting
    // point, the minimum is 10%, and there is no PPD to quote.
    await pickOption(priceUse(page), page, 'ZI')
    await expect(downPayment(page)).toHaveValue('3510.00', { timeout: 15_000 })
    await expect(downPayment(page)).toBeEditable()
    await expect(downPayment(page)).toHaveAttribute('placeholder', 'Min. ₱1,599.00')
    await expect(ppd(page)).toHaveValue('', { timeout: 15_000 })

    // ── ZI at 12 months: on the card again.
    await pickOption(term(page), page, '12 months')
    await expect(downPayment(page)).not.toBeEditable({ timeout: 15_000 })
    await expect(breakdown(page, 'Total price')).toContainText('₱19,590.00', { timeout: 15_000 })
    await expect(ppd(page)).toHaveValue('300')

    // ── The paper wins: an LCP typed off the paper survives the Price Use
    // and term changing under it.
    await lcp(page).fill('15000')
    await pickOption(priceUse(page), page, 'WIP')
    await pickOption(term(page), page, '3 months')
    await expect(breakdown(page, 'Total price')).toContainText('₱17,915.00', { timeout: 15_000 })
    await expect(lcp(page)).toHaveValue('15000')
  })

  test('submits the price-list figures, and the server stores them (point 5)', async ({ page }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    await pickItem(page, SHARP)
    await pickOption(term(page), page, '3 months')
    await expect(downPayment(page)).toHaveValue('3380.00', { timeout: 15_000 })
    await expect(ppd(page)).toHaveValue('360', { timeout: 15_000 })
    await fillTheRest(page)

    const id = await submit(page)
    const app = await getApplication(page, id)
    expect(Number(app.downPayment)).toBe(3380)
    expect(Number(app.amountFinanced)).toBe(12000)
    expect(Number(app.monthlyInstallment)).toBe(4845)
    expect(Number(app.totalPayable)).toBe(14535)
    expect(Number(app.lcp)).toBe(15380)
    expect(Number(app.ppdRebate)).toBe(360)
  })

  test.describe('a serial remembered from the till (point 6)', () => {
    /** Seeds the draft checkout writes when "New application for this cart"
     * is clicked: the customer plus the cart's item, with the unit the
     * cashier had picked. */
    async function openWithCartDraft(page: Page) {
      const applicant = await createApplicant(page)
      customerIds.push(applicant.id)
      const sharpId = await itemId(page, SHARP)
      const serials = await page.request.get(
        `/api/inventory/serial-numbers?itemId=${sharpId}&status=in_stock&limit=1`
      )
      expect(serials.ok()).toBeTruthy()
      const serialBody = await serials.json()
      const serialId = ((serialBody.data ?? serialBody) as { id: string }[])[0]?.id
      expect(serialId, 'no in-stock SHARP serial to remember').toBeTruthy()

      const draft = {
        applicantCustomerId: applicant.id,
        items: [{ itemId: sharpId, itemLabel: SHARP, serialNumberId: serialId }],
      }
      await page.addInitScript(
        ([key, value]) => {
          if (!sessionStorage.getItem('pr199-draft-seeded')) {
            localStorage.setItem(key, value)
            sessionStorage.setItem('pr199-draft-seeded', '1')
          }
        },
        [DRAFT_KEY, JSON.stringify(draft)] as const
      )
      await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicant.id}`)
      await expect(page.getByRole('button', { name: new RegExp(SHARP) }).first()).toBeVisible({
        timeout: 15_000,
      })
      return { serialId }
    }

    test('is dropped when the item is changed, so the application submits', async ({ page }) => {
      await openWithCartDraft(page)
      const astronId = await itemId(page, ASTRON)

      await pickItem(page, ASTRON)
      await pickOption(term(page), page, '3 months')
      await expect(downPayment(page)).toHaveValue('2320.00', { timeout: 15_000 })
      await expect(lcp(page)).toHaveValue('10560')
      await expect(ppd(page)).toHaveValue('250')
      await fillTheRest(page)

      // Before the fix: "Serial … belongs to a different item and cannot be
      // recorded against this one."
      const id = await submit(page)
      const app = await getApplication(page, id)
      expect(app.items).toHaveLength(1)
      expect(app.items[0].itemId).toBe(astronId)
      expect(app.items[0].serialNumberId).toBeNull()
    })

    test('is kept when the item is not changed', async ({ page }) => {
      const { serialId } = await openWithCartDraft(page)

      await pickOption(term(page), page, '3 months')
      await expect(downPayment(page)).toHaveValue('3380.00', { timeout: 15_000 })
      await fillTheRest(page)

      const id = await submit(page)
      const app = await getApplication(page, id)
      expect(app.items[0].serialNumberId).toBe(serialId)
    })
  })
})
