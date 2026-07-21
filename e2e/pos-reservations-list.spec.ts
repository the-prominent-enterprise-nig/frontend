import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 03, Part 7 — the reservations list surfaced under /pos/reservations
// for the first time. This spec sticks to UI-surface checks (page loads,
// status filter, nav entry) — the actual fulfil/request-cancel/approve-cancel
// business logic these buttons call into is already covered by the backend
// e2e suite (test/sku-reservation-fulfilment.e2e-spec.ts,
// test/sku-reservation-cancel-refund.e2e-spec.ts), same split
// pos-checkout-reserve-mode.spec.ts uses for the create side.
test.describe('POS Reservations List', () => {
  test('loads the reservations page and the status filter narrows the list', async ({ page }) => {
    await gotoReady(page, '/pos/reservations')

    await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()
    // Not asserting emptiness — this runs against whatever real reservations
    // already exist (e.g. from manual testing); the table header is a stable
    // signal the list rendered instead.
    await expect(page.getByRole('columnheader', { name: 'Item' })).toBeVisible()

    const filter = page.getByRole('combobox', { name: 'Filter by status' })
    await expect(filter).toBeVisible()
    // A status vanishingly unlikely to have any rows in a dev DB — proves
    // the filter actually narrows the query rather than always showing all.
    await filter.selectOption('cancel_requested')
    await expect(page.getByText('No reservations')).toBeVisible()
  })

  test('Reservations tab is reachable from the POS nav', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const reservationsLink = page.getByRole('link', { name: 'Reservations' })
    await clickStable(reservationsLink, page.getByRole('heading', { name: 'Reservations' }))
    await expect(page).toHaveURL(/\/pos\/reservations$/)
  })
})
