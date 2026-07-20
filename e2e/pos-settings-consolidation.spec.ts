import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// POS configuration consolidation (docs/pos-configuration-consolidation-plan.md).
// Part 1: /pos/settings becomes one real, tabbed shell instead of an 11-card
// list, with the 7 sub-pages it links to moved under it.
// Part 2: the old standalone GL Mapping page is deleted; Payment Methods'
// GL Account field explains the fallback instead.
// Part 3: Sidebar + PosNav collapse — Terminals moves out of Management;
// PosNav's Configuration group (and its tab bar) is removed entirely, since
// /pos/settings/* already has its own left-rail tabs and a lone,
// unswitchable PosNav tab added nothing.
// The Loyalty split and the Cashier PIN unification are later parts with
// their own specs.
test.describe('POS Settings — consolidated shell (Part 1)', () => {
  test('redirects /pos/settings to general and every moved tab loads its content', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/settings')
    await expect(page).toHaveURL(/\/pos\/settings\/general$/)
    await expect(page.getByRole('heading', { name: 'POS Settings' })).toBeVisible()

    const rail = page.getByRole('navigation', { name: 'POS settings tabs' })
    await expect(rail.getByRole('link', { name: 'General' })).toHaveClass(/bg-purple-50/)

    const tabs: Array<{ label: string; path: string; heading: string }> = [
      {
        label: 'Payment Methods',
        path: '/pos/settings/payment-methods',
        heading: 'Payment Methods',
      },
      { label: 'Terminals', path: '/pos/settings/terminals', heading: 'Terminals' },
      {
        label: 'Receipt Branding',
        path: '/pos/settings/receipt-branding',
        heading: 'Receipt Branding',
      },
      {
        label: 'Financing Terms',
        path: '/pos/settings/financing-terms',
        heading: 'Financing Terms',
      },
      {
        label: 'Queue Categories',
        path: '/pos/settings/queue-categories',
        heading: 'Queue Categories',
      },
      {
        label: 'Customer Display',
        path: '/pos/settings/customer-display',
        heading: 'Customer Display',
      },
    ]

    for (const tab of tabs) {
      const link = rail.getByRole('link', { name: tab.label, exact: true })
      await clickStable(link, page.getByRole('heading', { name: tab.heading }).first())
      await expect(page).toHaveURL(new RegExp(`${tab.path.replace(/\//g, '\\/')}$`))
      await expect(link).toHaveClass(/bg-purple-50/)
    }
  })

  test('PosNav has no Configuration group and Terminals moves out of Management (Part 3)', async ({
    page,
  }) => {
    const posNav = page.getByRole('navigation', { name: 'POS section tabs' })

    // /pos/settings/* has its own left-rail tabs (PosSettingsTabs) and the
    // Sidebar already highlights "Configuration" as active — a PosNav tab
    // bar with a single, unswitchable item had no purpose, so these routes
    // intentionally match no PosNav group at all (same as any other
    // standalone page): no bar renders, not even an empty one.
    for (const path of [
      '/pos/settings/general',
      '/pos/settings/queue-categories',
      '/pos/settings/financing-terms',
      '/pos/settings/terminals',
    ]) {
      await gotoReady(page, path)
      await expect(posNav).toHaveCount(0)
    }

    // Management now only has Sessions + Cash Drawer — Terminals is gone.
    await gotoReady(page, '/pos/sessions')
    await expect(posNav.getByRole('link', { name: 'Sessions' })).toBeVisible()
    await expect(posNav.getByRole('link', { name: 'Cash Drawer' })).toBeVisible()
    await expect(posNav.getByRole('link', { name: 'Terminals' })).toHaveCount(0)

    // /pos/pin is also a standalone page — PosNav renders nothing there
    // either, reachable only via the Sidebar's own separate "POS PIN"
    // item.
    await gotoReady(page, '/pos/pin')
    await expect(posNav).toHaveCount(0)
  })

  test('GL Mapping is gone — no page, no nav entry, and Payment Methods explains the fallback', async ({
    page,
  }) => {
    const response = await page.goto('/pos/gl-mapping', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)

    await gotoReady(page, '/pos/settings/payment-methods')
    await expect(page.getByRole('link', { name: 'GL Mapping' })).toHaveCount(0)

    // Open the edit panel for the first payment method row and confirm the
    // fallback note + link Part 2 added is actually there, not just present
    // in source.
    await page.getByRole('table').getByRole('button', { name: 'Edit' }).first().click()
    await expect(page.getByRole('heading', { name: 'Edit Payment Method' })).toBeVisible()
    const fallbackLink = page.getByRole('link', { name: 'Accounting → Account Mapping' })
    await expect(fallbackLink).toBeVisible()
    await expect(fallbackLink).toHaveAttribute('href', '/accounting/account-mapping')
  })
})
