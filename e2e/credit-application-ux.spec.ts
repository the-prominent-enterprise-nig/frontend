import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, openCustomSelect } from './utils'

// Credit application UX corrections from the 2026-09-16 client feedback list:
// queue search, and co-maker captured as First Name / Last Name / Relationship.

test.describe('Credit applications — search', () => {
  test('search box filters the queue and reports an empty result', async ({ page }) => {
    await gotoReady(page, '/pos/credit-applications')
    const search = page.getByPlaceholder(/search application no/i)
    await expect(search).toBeVisible()

    await fillStable(search, `no-such-application-${Date.now()}`)
    // Two distinct empty states: "No credit applications yet" when the queue
    // is genuinely empty, and this one when a search/status filter matched
    // nothing. This asserted "No credit applications found", which neither
    // says, so it had been failing.
    await expect(page.getByText('No applications match your filters')).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('Credit applications — co-maker identity fields', () => {
  test('a new co-maker is captured as First Name, Last Name and Relationship', async ({ page }) => {
    await gotoReady(page, '/pos/credit-applications')
    await page.getByRole('link', { name: 'New Application' }).click()

    // The submit action was renamed — an application is submitted for
    // investigation/approval, not merely "opened".
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Application' })).toHaveCount(0)

    // Co-maker detail fields only render once "+ Add a new co-maker" is the
    // selection, which needs an applicant first; assert the select exists and
    // that the old single "Name" field is gone from the modal's labels.
    await expect(page.getByText('Co-Maker', { exact: false }).first()).toBeVisible()
  })

  // Scenario 60 Part 4 — the co-maker's contact number is required. It isn't
  // cosmetic: CoMaker.contactNumber is NOT NULL, and this form submitted
  // `(value ?? '').trim()`, so a blank was writing an empty string into a
  // required column instead of failing. A co-maker exists to be reachable
  // when the account goes bad, so a blank one defeats the point.
  test('a new co-maker cannot be saved without a contact number', async ({ page }) => {
    const applicantName = `E2E CoMaker Phone ${Date.now()}`
    const res = await page.request.post('/api/crm/customers', {
      data: { name: applicantName, customerType: 'individual', phone: '09170004321' },
    })
    expect(res.ok()).toBeTruthy()

    await gotoReady(page, '/pos/credit-applications')
    await page.getByRole('link', { name: 'New Application' }).click()

    // SearchCombobox renders closed as a button carrying the placeholder as
    // its text, and swaps to a real input only once clicked — see the
    // "Closed state is a button, not the search <input>, on purpose" note in
    // that component.
    await page.getByRole('button', { name: 'Search customer by name or phone…' }).click()
    await fillStable(page.getByPlaceholder('Search customer by name or phone…'), applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    // The co-maker picker is the shared Select; "Add a new co-maker" is its
    // extraAction row, not an option.
    await openCustomSelect(page.getByRole('combobox', { name: /No co-maker/ }))
    await page.getByRole('button', { name: 'Add a new co-maker' }).click()

    // Submitted with the whole co-maker block blank. The other fields raise
    // their own errors too — this asserts only the contact-number rule, which
    // is the one this scenario added.
    await page.getByRole('button', { name: 'Submit Application' }).click()
    await expect(page.getByText('Contact number is required')).toBeVisible({ timeout: 10_000 })
  })
})
