import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// A serial-tracked item can now hold multiple units in one cart row instead
// of being capped at quantity 1 — each unit still needs its own distinct
// serial. Refrigerator is seeded with 200 in-stock serials at every branch
// (see prisma/seed.ts "Variant item serials"), so there's always enough
// stock to add several units in one run.
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

test.describe('POS Checkout — Multi-Serial Cart Line', () => {
  test('adding a serial-tracked item twice groups into one row with both serials, and the stepper adds/removes whole units', async ({
    page,
  }) => {
    await ensureManilaSession(page)

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill('Refrigerator')

    const refrigeratorCard = page
      .getByRole('button')
      .filter({ has: page.getByText('Refrigerator', { exact: true }) })
    await expect(refrigeratorCard.first()).toBeVisible({ timeout: 10_000 })

    // First unit.
    await refrigeratorCard.first().click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    const firstSerialRow = page.getByRole('button', { name: /WH-01-BULK/ }).first()
    const firstSerialLabel = (await firstSerialRow.textContent())?.trim() ?? ''
    await firstSerialRow.click()

    const cartRow = page.locator('tr', { hasText: 'Refrigerator' })
    await expect(cartRow.getByText(`SN: ${firstSerialLabel}`)).toBeVisible({ timeout: 10_000 })
    await expect(cartRow.getByText('× 2')).toHaveCount(0)

    // Second unit — clicking the same catalog card again used to no-op;
    // it now adds a sibling line and reopens the picker for it.
    await refrigeratorCard.first().click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    // Already-assigned serial from the sibling line must not be pickable again.
    await expect(page.getByRole('button', { name: firstSerialLabel, exact: true })).toHaveCount(0)
    const secondSerialRow = page.getByRole('button', { name: /WH-01-BULK/ }).first()
    const secondSerialLabel = (await secondSerialRow.textContent())?.trim() ?? ''
    expect(secondSerialLabel).not.toBe(firstSerialLabel)
    await secondSerialRow.click()

    await expect(cartRow.getByText('× 2')).toBeVisible({ timeout: 10_000 })
    // The grouped serial list renders each label with a trailing comma
    // except the last, so match by substring rather than exact text.
    await expect(cartRow.getByText(firstSerialLabel)).toBeVisible()
    await expect(cartRow.getByText(secondSerialLabel)).toBeVisible()

    // "+" on the grouped row adds a third unit directly, no need to go back
    // to the catalog card.
    await cartRow
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .nth(1)
      .click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    const thirdSerialRow = page.getByRole('button', { name: /WH-01-BULK/ }).first()
    await thirdSerialRow.click()
    await expect(cartRow.getByText('× 3')).toBeVisible({ timeout: 10_000 })

    // "-" removes one unit at a time (the most recently added), not the
    // whole group.
    await cartRow
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .first()
      .click()
    await expect(cartRow.getByText('× 2')).toBeVisible({ timeout: 10_000 })
    await expect(cartRow.getByText('× 3')).toHaveCount(0)

    // Cleanup — remove the whole line so repeated runs start clean.
    await cartRow.hover()
    await cartRow.locator('button').last().click()
    await expect(page.getByText('Click an item above to add it to the cart')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('closing the picker on a freshly-added, not-yet-serialed unit discards it instead of leaving it stranded', async ({
    page,
  }) => {
    await ensureManilaSession(page)

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill('Refrigerator')

    const refrigeratorCard = page
      .getByRole('button')
      .filter({ has: page.getByText('Refrigerator', { exact: true }) })
    await expect(refrigeratorCard.first()).toBeVisible({ timeout: 10_000 })

    // First unit — completed normally.
    await refrigeratorCard.first().click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    await page
      .getByRole('button', { name: /WH-01-BULK/ })
      .first()
      .click()

    const cartRow = page.locator('tr', { hasText: 'Refrigerator' })
    await expect(cartRow.getByText(/^SN: /)).toBeVisible({ timeout: 10_000 })
    await expect(cartRow.getByText(/× \d/)).toHaveCount(0)

    // Second unit — click "+" to add it, then Close WITHOUT picking a serial.
    await cartRow
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .nth(1)
      .click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Close' }).click()

    // The abandoned second unit must be gone entirely — back to a single,
    // fully-serialed line, not "× 2" with a "1 of 2 serials needed" warning.
    await expect(cartRow.getByText(/× \d/)).toHaveCount(0)
    await expect(cartRow.getByText(/serials? needed/)).toHaveCount(0)
    await expect(cartRow.getByText(/^SN: /)).toBeVisible()

    // Cleanup.
    await cartRow.hover()
    await cartRow.locator('button').last().click()
    await expect(page.getByText('Click an item above to add it to the cart')).toBeVisible({
      timeout: 10_000,
    })
  })
})
