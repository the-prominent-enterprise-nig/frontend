import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 10 — who requests stock from whom. The Transfers list's
// route column names the two sides (supplying → requesting). The
// Incoming/Outgoing tag only shows for a branch-assigned viewer, so it's a
// manual check (Business Owner, the default e2e session, has no branch).
// Read-only.

test.describe('Scenario 56 Part 10 — transfer direction', () => {
  test('route column reads Supplying → Requesting', async ({ page }) => {
    await gotoReady(page, '/inventory/transfers')
    await expect(page.getByRole('columnheader', { name: 'Supplying → Requesting' })).toBeVisible({
      timeout: 20_000,
    })
  })
})
