import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, fillStable, openCustomSelect } from './utils'

// Scenario 17, Part 6 — POS installment checkout now requires the customer's
// approved, unused CreditApplication. This spec sticks to UI-surface checks
// (the picker shows up, reflects "no approved application" vs. an actual
// approved one) — the enforcement itself (reject with no/wrong/consumed
// application) is covered by the backend e2e suite
// (test/pos-installment-financing.e2e-spec.ts, IF-07..IF-10), matching this
// codebase's existing split (see pos-checkout-reserve-mode.spec.ts).
//
// Per-line payment mode (2026-08-06 development merge) means "Installment"
// is now a per-cart-line toggle, not a whole-cart mode — an item must be in
// the cart before the picker can render. One credit application still
// covers the whole cart's installment lines (see PricingTotals-adjacent
// installmentCartLines in checkout/page.tsx), so this spec only ever adds
// a single installment line.
//
// No afterAll cleanup — same permanent-workflow-record tradeoff as the other
// credit e2e specs (CreditApplication rows are never hard-deleted).

/** A real, WIP-priced, serial-tracked item stocked at Bago in the dev data.
 * This used to be the demo "Universal Remote Control", which the seed deletes
 * again (cleanup-demo-business-data.ts), so the spec could never get past
 * adding it to the cart on a seeded database. */
const ITEM_QUERY = 'STF3238'

/** Adds one WIP-priced item to the cart and switches its line to Installment
 * mode. */
async function addInstallmentLine(page: Page): Promise<void> {
  const searchInput = page.getByPlaceholder('Search by name or serial')
  await expect(searchInput).toBeVisible({ timeout: 15_000 })
  const card = page.getByRole('button').filter({ hasText: ITEM_QUERY }).first()
  await expect(async () => {
    await searchInput.fill(ITEM_QUERY)
    await expect(card).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await card.click()

  // A serial-tracked item opens the serial picker straight away.
  const heading = page.getByRole('heading', { name: 'Select Serial Number' })
  if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page
      .getByText('In this branch', { exact: true })
      .locator('xpath=following-sibling::*[1]')
      .getByRole('button')
      .first()
      .click()
    await expect(heading).toHaveCount(0, { timeout: 10_000 })
  }
  await page.getByLabel('Price Use').first().selectOption({ label: 'WIP' })

  await clickStable(
    page.getByRole('button', { name: 'Installment', exact: true }),
    page.getByRole('button', { name: 'Inhouse Installment' })
  )
}

test.describe('POS Checkout — Installment requires an approved Credit Application', () => {
  // Logging in, building a cart and waiting on the customer's applications
  // regularly runs past the 60s default on a cold dev server.
  test.describe.configure({ timeout: 120_000 })

  test('a customer with no approved application shows the warning and an empty picker', async ({
    page,
  }) => {
    const applicantName = `E2E Checkout No-App ${Date.now()}`
    await page.request.post('/api/crm/customers', {
      data: { name: applicantName, customerType: 'individual', phone: '09170007777' },
    })

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)

    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    await expect(page.getByText('Approved Credit Application', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    // Scenario 64 Part 1 — this copy lost its "— open one in Credit
    // Applications first." tail when the panel gained a button that raises
    // the application inline, but this assertion kept the old sentence and
    // had been failing ever since. Asserted against the live copy now, plus
    // the button itself, whose label the client renamed in the same pass.
    // Shown once the customer's applications have loaded — the picker reads
    // "Loading…" until then, which can take a while on a cold dev server.
    await expect(
      page.getByText('Every installment sale requires an approved credit application.')
    ).toBeVisible({ timeout: 30_000 })
    // "New Credit Application Form" in Scenario 64 Part 1, then "New credit
    // application" — the panel's own button for raising one inline.
    await expect(page.getByRole('button', { name: 'New credit application' })).toBeVisible()

    // The empty picker (still "") keeps submit disabled via
    // installmentMissingCreditApplication, even once a term is picked.
    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    // Scenario 64 — the term dropdown is the shared Select now, not a native
    // <select>: no placeholder <option>, so the old selectOption({index:1})
    // (index 0 being the placeholder) is simply the first real option.
    await openCustomSelect(termSelect)
    // By name: the cart row's native Price Use <select> has role=option
    // children too, and the first of those cannot be clicked.
    await page
      .getByRole('option', { name: /months/ })
      .first()
      .click()
    await expect(
      page.getByRole('button', { name: 'Select an approved credit application' })
    ).toBeVisible()
  })

  test('a customer with an approved application shows it in the picker', async ({ page }) => {
    const applicantName = `E2E Checkout With-App ${Date.now()}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: {
        name: applicantName,
        customerType: 'individual',
        phone: '09170006666',
        coMakers: [
          { name: 'E2E Checkout Co-Maker', relationship: 'Sibling', contactNumber: '09171116666' },
        ],
      },
    })
    const customer = await customerRes.json()

    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
    const branchId = branches.find((b) => b.name === 'Bago')!.id

    const itemsRes = await page.request.get('/api/inventory/items', {
      params: { search: ITEM_QUERY, limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]

    // Scenario 64 item 21 — an application is priced from the Price Use's
    // price list and nothing else, so it has to name one.
    const priceUseRes = await page.request.get('/api/pos/catalog/price-use-types')
    type PriceUse = { id: string; name: string }
    const priceUseBody = (await priceUseRes.json()) as PriceUse[] | { data?: PriceUse[] }
    const priceUses = Array.isArray(priceUseBody) ? priceUseBody : (priceUseBody.data ?? [])
    const wip = priceUses.find((t) => t.name === 'WIP')!

    const appRes = await page.request.post('/api/credit/applications', {
      data: {
        branchId,
        applicantCustomerId: customer.id,
        coMakerId: customer.coMakers[0].id,
        items: [{ itemId: items[0].id }],
        priceUseTypeId: wip.id,
      },
    })
    expect(appRes.ok(), await appRes.text()).toBeTruthy()
    const application = await appRes.json()
    const creditApplicationItemId = application.items[0].id as string

    const uploadRes = await page.request.post('/api/files/upload', {
      multipart: {
        file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') },
      },
    })
    const file = await uploadRes.json()
    await page.request.post(`/api/credit/applications/${application.id}/documents`, {
      data: { fileId: file.id, documentType: 'applicant_id' },
    })
    await page.request.patch(`/api/credit/applications/${application.id}/submit`)
    await page.request.post(`/api/credit/applications/${application.id}/investigation/start`)
    await page.request.post(`/api/credit/applications/${application.id}/investigation`, {
      data: { affordabilityOutcome: 'recommend_approve', notes: 'Looks fine' },
    })
    // Scenario 29 POS-02 — decideItems() replaced the old whole-application approve().
    await page.request.patch(`/api/credit/applications/${application.id}/decide`, {
      data: { approveItemIds: [creditApplicationItemId], declineItemIds: [] },
    })

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)

    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    // One approved application that matches the cart is now picked for the
    // cashier (with its agreed term), so the picker shows it rather than its
    // "Select an approved application…" placeholder.
    const picker = page.getByRole('combobox', { name: new RegExp(application.applicationNumber) })
    await expect(picker).toBeVisible({ timeout: 30_000 })
    // The "no approved application" panel is gone once one exists. (Against
    // the old copy this matched nothing and proved nothing.)
    await expect(
      page.getByText('Every installment sale requires an approved credit application.')
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New credit application' })).toHaveCount(0)
    // Raising another one for the same cart stays possible.
    await expect(
      page.getByRole('button', { name: '+ New application for this cart' })
    ).toBeVisible()
    // And nothing is blocking submit on the application's account.
    await expect(
      page.getByRole('button', { name: 'Select an approved credit application' })
    ).toHaveCount(0)
  })
})
