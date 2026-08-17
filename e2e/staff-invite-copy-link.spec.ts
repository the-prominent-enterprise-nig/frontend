import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 28, Part 1 (docs/scenario-28-staff-invite-onboarding-plan.md):
// a pending invite's link can be copied directly, without depending on the
// invite email actually arriving. Invites are still created from Users, but
// the Copy Link interaction itself happens on the dedicated Pending Invites
// page (Part 2 moved pending rows off Users entirely). The expired-invite /
// disabled-button case has no UI-only path to trigger (nothing here can
// backdate an invite's expiry) — that's covered instead by the backend
// suite's dedicated `expired: true` test (backend/test/user-invite-flow.e2e-spec.ts).
test.describe('Staff invite — Copy Link', () => {
  test('a pending invite row can have its link copied to the clipboard', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await gotoReady(page, '/settings/users')

    const email = `e2e-invite-${Date.now()}@example.com`

    await clickStable(
      page.getByRole('button', { name: '+ Add User' }),
      page.getByRole('heading', { name: 'Personal Info' })
    )
    await page.getByPlaceholder('Juan').fill('E2E')
    await page.getByPlaceholder('Dela Cruz').fill('Tester')
    await page.locator('input[type="date"]').fill('1995-01-01')
    await page.getByPlaceholder('user@example.com').fill(email)
    await page.getByPlaceholder('09XXXXXXXXX').fill('09171234567')
    await clickStable(
      page.getByRole('button', { name: 'Next', exact: true }),
      page.getByRole('heading', { name: 'Work & Access' })
    )

    await page.getByRole('paragraph').filter({ hasText: 'Cashier' }).click()
    // Not clickStable here — the actual request makes a real outbound call
    // to Resend, which can take longer than clickStable's 1s-per-attempt
    // retry window and would otherwise double-submit. A single click plus a
    // generously-timed separate wait is correct for a real network round trip.
    await page.getByRole('button', { name: 'Send Invite' }).click()

    // Either "Invite sent" or "email failed" toast is acceptable here — this
    // test covers Copy Link, not whether Resend's sending domain is verified
    // in this environment (Scenario 28 Closing Gap 4, external/not code). Wait
    // for whichever toast fires before navigating away, so the create
    // request has genuinely finished (Users no longer shows this row at all
    // now, so there's no on-page signal left to wait on instead).
    await expect(page.getByText(/Invite sent|invite email failed/i)).toBeVisible({
      timeout: 15_000,
    })
    await gotoReady(page, '/settings/pending-invites')
    const row = page.locator('tr', { hasText: email })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText('Pending', { exact: true })).toBeVisible()

    await row.getByTitle('Copy invite link').click()
    await expect(page.getByText('Link copied')).toBeVisible()

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('/onboard?token=')

    // Cleanup — revoke rather than delete, matching this app's soft-delete
    // convention for user records (no hard-delete endpoint exists). The row
    // disappears entirely afterward since this page is scoped to
    // status=PENDING and a revoked invite no longer matches that filter.
    await row.locator('button').last().click()
    await page.getByRole('button', { name: 'Revoke Invite' }).click()
    await expect(row).not.toBeVisible({ timeout: 10_000 })
  })
})
