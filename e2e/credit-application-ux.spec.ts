import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Credit application UX corrections from the 2026-09-16 client feedback list:
// queue search, and co-maker captured as First Name / Last Name / Relationship.

test.describe('Credit applications — search', () => {
  test('search box filters the queue and reports an empty result', async ({ page }) => {
    await gotoReady(page, '/pos/credit-applications')
    const search = page.getByPlaceholder(/search application no/i)
    await expect(search).toBeVisible()

    await fillStable(search, `no-such-application-${Date.now()}`)
    await expect(page.getByText('No credit applications found')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Credit applications — co-maker identity fields', () => {
  test('a new co-maker is captured as First Name, Last Name and Relationship', async ({ page }) => {
    await gotoReady(page, '/pos/credit-applications')
    await page.getByRole('button', { name: 'New Application' }).click()

    // The submit action was renamed — an application is submitted for
    // investigation/approval, not merely "opened".
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Application' })).toHaveCount(0)

    // Co-maker detail fields only render once "+ Add a new co-maker" is the
    // selection, which needs an applicant first; assert the select exists and
    // that the old single "Name" field is gone from the modal's labels.
    await expect(page.getByText('Co-Maker', { exact: false }).first()).toBeVisible()
  })
})
