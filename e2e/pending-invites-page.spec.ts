import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 28, Part 2 (docs/scenario-28-staff-invite-onboarding-plan.md):
// pending invites get their own dedicated page, split out of Users — Users
// only shows real (Active/Inactive) accounts now.
test.describe('Pending Invites — dedicated page', () => {
  test('a new invite appears on Pending Invites, not on Users, and the sidebar links to it', async ({
    page,
  }) => {
    await gotoReady(page, '/settings/users')

    const email = `e2e-pending-page-${Date.now()}@example.com`

    await clickStable(
      page.getByRole('button', { name: '+ Add User' }),
      page.getByRole('heading', { name: 'Personal Info' })
    )
    await page.getByPlaceholder('Juan').fill('E2E')
    await page.getByPlaceholder('Dela Cruz').fill('PageTest')
    await page.locator('input[type="date"]').fill('1995-01-01')
    await page.getByPlaceholder('user@example.com').fill(email)
    await page.getByPlaceholder('09XXXXXXXXX').fill('09171234567')
    await clickStable(
      page.getByRole('button', { name: 'Next', exact: true }),
      page.getByRole('heading', { name: 'Work & Access' })
    )
    await page.getByRole('paragraph').filter({ hasText: 'Cashier' }).click()
    await page.getByRole('button', { name: 'Send Invite' }).click()

    // Users page's default ("All") view must not show it — it moved.
    await page.waitForTimeout(1000)
    await expect(page.locator('tr', { hasText: email })).toHaveCount(0)

    // Sidebar nav links to the dedicated page.
    const sidebarLink = page.getByRole('link', { name: /Pending Invites/ })
    await expect(sidebarLink).toBeVisible()
    await sidebarLink.click()
    await expect(page).toHaveURL(/\/settings\/pending-invites$/)
    await expect(page.getByRole('heading', { name: 'Pending Invites' })).toBeVisible()

    const row = page.locator('tr', { hasText: email })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Pending', { exact: true })).toBeVisible()
    await expect(row.getByText('Cashier')).toBeVisible()

    // Cleanup via this page's own Revoke Invite action — the row disappears
    // entirely afterward, since this page's list is scoped to status=PENDING
    // and a revoked invite no longer matches that filter.
    await row.locator('button').last().click()
    await page.getByRole('button', { name: 'Revoke Invite' }).click()
    await expect(row).not.toBeVisible({ timeout: 10_000 })
  })
})
