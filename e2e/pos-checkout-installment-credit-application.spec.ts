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

/** Adds one WIP-priced item to the cart and switches its line to Installment
 * mode, matching pos-checkout-promissory-note.spec.ts's item choice. */
async function addInstallmentLine(page: Page): Promise<void> {
  const searchInput = page.getByPlaceholder('Search by name or serial')
  await expect(searchInput).toBeVisible({ timeout: 15_000 })
  await searchInput.fill('Universal Remote Control')
  const remoteCard = page
    .getByRole('button')
    .filter({ has: page.getByText('Universal Remote Control', { exact: true }) })
  await expect(remoteCard.first()).toBeVisible({ timeout: 10_000 })
  await remoteCard.first().click()
  await page.getByLabel('Price Use').selectOption({ label: 'WIP' })

  await clickStable(
    page.getByRole('button', { name: 'Installment', exact: true }),
    page.getByPlaceholder('Down payment')
  )
}

test.describe('POS Checkout — Installment requires an approved Credit Application', () => {
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
    // Scenario 60 Part 1 — this copy lost its "— open one in Credit
    // Applications first." tail when the panel gained a button that raises
    // the application inline, but this assertion kept the old sentence and
    // had been failing ever since. Asserted against the live copy now, plus
    // the button itself, whose label the client renamed in the same pass.
    await expect(
      page.getByText('Every installment sale requires an approved credit application.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Credit Application Form' })).toBeVisible()

    // The empty picker (still "") keeps submit disabled via
    // installmentMissingCreditApplication, even once a term is picked.
    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    // Scenario 60 — the term dropdown is the shared Select now, not a native
    // <select>: no placeholder <option>, so the old selectOption({index:1})
    // (index 0 being the placeholder) is simply the first real option.
    await openCustomSelect(termSelect)
    await page.getByRole('option').first().click()
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
      params: { search: 'Universal Remote Control', limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]

    const appRes = await page.request.post('/api/credit/applications', {
      data: {
        branchId,
        applicantCustomerId: customer.id,
        coMakerId: customer.coMakers[0].id,
        items: [{ itemId: items[0].id }],
      },
    })
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

    // Scenario 60 — the application picker is the shared Select now. Its
    // accessible name is whatever it currently shows, so while unselected
    // that's the placeholder; the application itself is an option in the
    // popup rather than an <option> child.
    const picker = page.getByRole('combobox', { name: 'Select an approved application…' })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    // Same stale sentence as above, and here it made the assertion vacuous:
    // a string that matches nothing always has count 0, so this proved
    // nothing. Against the live copy it actually tests what it claims —
    // that the "no approved application" panel is gone once one exists.
    await expect(
      page.getByText('Every installment sale requires an approved credit application.')
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New Credit Application Form' })).toHaveCount(0)

    // Selecting it clears the submit-blocking label.
    await openCustomSelect(picker)
    await page.getByRole('option').filter({ hasText: application.applicationNumber }).click()
    await expect(
      page.getByRole('button', { name: 'Select an approved credit application' })
    ).toHaveCount(0)
  })
})
