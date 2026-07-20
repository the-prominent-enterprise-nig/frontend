import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Part 6 of docs/pos-configuration-consolidation-plan.md (Step 8): grep sweep
// for hardcoded references to routes that moved or were removed during this
// consolidation, fixed wherever found outside the files already touched by
// earlier parts:
// - pos/page.tsx's dashboard quick-links "Terminals" card still pointed at
//   the pre-move /pos/terminals (dead route, would 404).
// - SideBar.tsx's "Management" item still had the pre-move /pos/terminals in
//   its activeWhen (dead entry — Terminals now lives under Settings).
// - branch-receipt-config.ts's two revalidatePath() calls still targeted the
//   pre-move /pos/receipt-branding instead of /pos/settings/receipt-branding.

test.describe('POS cross-link cleanup (Part 6)', () => {
  test('Dashboard quick-links "Terminals" card points to the moved settings page, not the dead pre-move route', async ({
    page,
  }) => {
    await gotoReady(page, '/pos')
    const card = page.getByRole('button', { name: /Terminals/ })
    await clickStable(card, page.getByRole('heading', { name: 'Terminals' }))
    await expect(page).toHaveURL(/\/pos\/settings\/terminals$/)

    // The old pre-move route is confirmed gone (404) elsewhere
    // (pos-settings-consolidation.spec.ts covers /pos/gl-mapping); this just
    // confirms the quick-link itself no longer points there.
    const response = await page.goto('/pos/terminals', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
  })
})
