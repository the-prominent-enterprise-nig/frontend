import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, sweepE2EPriceUseTypes } from './utils'

const NAME_PREFIX = 'E2E Checkout Active Type — '

// TPE x NIG meeting notes (07/31/26): checkout must defer pricing to the
// selected Price Use (WIP/CR-BR/SSC/PROMO/ZI) instead of a flat item price,
// and fall back to a PIN-gated Price Override when no price-list entry
// covers the item under that category. This spec covers the live wiring —
// picking a Price Use resolves a real seeded price, switching to a category
// with no coverage flips the line to the override entry point, and that
// entry point opens the right dialog. Full sale submission (customer,
// payment, PIN-approved override) is covered by the backend e2e suite
// (test/pos-price-use.e2e-spec.ts) — this spec sticks to the frontend
// resolution + UI wiring that suite can't see.
async function ensureManilaSession(page: import('@playwright/test').Page) {
  await gotoReady(page, '/pos/checkout')

  const noSessionLink = page.getByRole('link', { name: 'Open a Session' })
  if (await noSessionLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await gotoReady(page, '/pos/sessions')
    await clickStable(
      page.getByRole('button', { name: 'Open Session' }),
      page.getByRole('heading', { name: 'Open Session' })
    )
    const notYou = page.getByText('Not you?')
    if (await notYou.isVisible().catch(() => false)) await notYou.click()
    await page.getByPlaceholder('Type to search…').fill('Tyrell Buckridge')
    await page.getByText('Tyrell Buckridge', { exact: true }).first().click()
    await page.getByPlaceholder('4–6 digit PIN').fill('1234')
    await page.getByRole('button', { name: 'Verify PIN' }).click()
    await expect(page.getByText('Tyrell Buckridge', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    const terminalSelect = page.locator('select')
    const manilaOption = terminalSelect.locator('option', { hasText: 'TN-B1-01' })
    const manilaLabel = (await manilaOption.textContent())?.trim() ?? ''
    await expect(async () => {
      await terminalSelect.selectOption({ label: manilaLabel })
      await expect(terminalSelect).toHaveValue(/.+/)
    }).toPass({ timeout: 10_000 })
    await page.getByRole('spinbutton').fill('1000')
    await expect(async () => {
      await page.getByRole('button', { name: 'Open Session' }).click()
      await expect(page.getByRole('heading', { name: 'Open Session' })).toHaveCount(0, {
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })
    await gotoReady(page, '/pos/checkout')
  }

  const sessionSelect = page.getByRole('combobox').first()
  if (await sessionSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const options = await sessionSelect.locator('option').all()
    for (const option of options) {
      const text = (await option.textContent()) ?? ''
      if (text.includes('TN-B1-01')) {
        const value = await option.getAttribute('value')
        if (value) await sessionSelect.selectOption(value)
        break
      }
    }
  }
}

test.describe('POS Checkout — Price Use', () => {
  test('picking a Price Use resolves a real price, and switching to an uncovered category falls back to Override', async ({
    page,
  }) => {
    await ensureManilaSession(page)

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill('Universal Remote Control')

    const remoteCard = page
      .getByRole('button')
      .filter({ has: page.getByText('Universal Remote Control', { exact: true }) })
    await expect(remoteCard.first()).toBeVisible({ timeout: 10_000 })
    await remoteCard.first().click()

    const cartRow = page.locator('tr', { hasText: 'Universal Remote Control' })
    await expect(cartRow).toBeVisible({ timeout: 10_000 })

    // No Price Use picked yet — the line must show a pending state, never a
    // bare price (which would misread as a real ₱0 item).
    await expect(cartRow.getByText('— Select Price Use')).toBeVisible()

    // WIP is seeded with a real price-list entry covering this item (see
    // prisma/seed.ts "Price lists" — retail items land in the WIP list at
    // their own sellingPrice) — picking it must resolve a real amount.
    const priceUseSelect = page.getByLabel('Price Use')
    await priceUseSelect.selectOption({ label: 'WIP' })
    await expect(cartRow.getByText(/₱[\d,]+\.\d{2}/)).toBeVisible({ timeout: 10_000 })
    await expect(cartRow.getByText('— Select Price Use')).toHaveCount(0)
    await expect(cartRow.getByText('No price — Override')).toHaveCount(0)

    // SSC has no price list at all in the seed — switching to it must
    // re-resolve to a gap, not silently keep the WIP price.
    await priceUseSelect.selectOption({ label: 'SSC' })
    const overrideBadge = cartRow.getByText('No price — Override')
    await expect(overrideBadge).toBeVisible({ timeout: 10_000 })
    await expect(cartRow.getByText(/₱[\d,]+\.\d{2}/)).toHaveCount(0)

    // The override entry point opens the PIN-gated dialog with the right item.
    // Identification is PIN-only — no Manager User ID to look up or paste,
    // same McDonald's-style pattern the discount override already uses; the
    // backend resolves the manager from the PIN alone.
    await overrideBadge.click()
    const overrideHeading = page.getByRole('heading', { name: 'Price Override' })
    await expect(overrideHeading).toBeVisible()
    // The dialog's item-name caption is the same text as the catalog card and
    // cart row already on screen — it renders last in the DOM, after both.
    await expect(page.getByText('Universal Remote Control', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('New Unit Price (₱)')).toBeVisible()
    await expect(page.getByText('Manager User ID')).toHaveCount(0)
    await expect(page.getByText('Manager PIN')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)
    // Cancelling must not fabricate a price — the line stays a gap.
    await expect(overrideBadge).toBeVisible()

    // Cleanup — remove the line so repeated runs start clean.
    await cartRow.hover()
    await cartRow.locator('button').last().click()
    await expect(page.getByText('Click an item above to add it to the cart')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('a price use type toggled inactive disappears from the Price Use dropdown, and reappears when reactivated (Scenario 37)', async ({
    page,
    request,
  }) => {
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
    const name = `${NAME_PREFIX}${Date.now()}`
    const created = await request.post('/api/inventory/price-use-types', { data: { name } })
    expect(created.ok()).toBeTruthy()
    const typeId = (await created.json()).id as string

    await ensureManilaSession(page)
    const priceUseSelect = page.getByLabel('Price Use')
    await expect(priceUseSelect.locator('option', { hasText: name })).toHaveCount(1, {
      timeout: 10_000,
    })

    const toggledOff = await request.patch(`/api/inventory/price-use-types/${typeId}`, {
      data: { isActive: false },
    })
    expect(toggledOff.ok()).toBeTruthy()

    await gotoReady(page, '/pos/checkout')
    await expect(priceUseSelect.locator('option', { hasText: name })).toHaveCount(0, {
      timeout: 10_000,
    })

    const toggledOn = await request.patch(`/api/inventory/price-use-types/${typeId}`, {
      data: { isActive: true },
    })
    expect(toggledOn.ok()).toBeTruthy()

    await gotoReady(page, '/pos/checkout')
    await expect(priceUseSelect.locator('option', { hasText: name })).toHaveCount(1, {
      timeout: 10_000,
    })

    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })
})
