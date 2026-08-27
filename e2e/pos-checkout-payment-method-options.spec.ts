import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 37 — Item Payment Mode (Cash / Installment / Credit-Debit Card,
// one dropdown, Cash default) is the single real source for the POS
// Terminal (card) / Bank (bank_transfer) / Gateway (qr) sub-choices, each
// carrying a named-option dropdown sourced from PosPaymentMethodConfig.
// options. The tender "Payment" section no longer repeats these — it just
// defaults its method to match Item Payment Mode and shows a pointer note.
// The row's own method dropdown stays visible (no "Use a different method"
// toggle) so a split tender or an Item-Payment-Mode-uncovered method (Gift
// Card/Store Credit/Loyalty Points) is a direct selection.
// Option CRUD itself is covered by settings-payment-methods.spec.ts.
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

async function addAnyItemToCart(page: import('@playwright/test').Page) {
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
  const priceUseSelect = page.getByLabel('Price Use')
  await priceUseSelect.selectOption({ label: 'WIP' })
  await expect(cartRow.getByText(/₱[\d,]+\.\d{2}/)).toBeVisible({ timeout: 10_000 })
  return cartRow
}

async function cleanup(
  page: import('@playwright/test').Page,
  cartRow: import('@playwright/test').Locator
) {
  await cartRow.hover()
  await cartRow.locator('button').last().click()
  await expect(page.getByText('Click an item above to add it to the cart')).toBeVisible({
    timeout: 10_000,
  })
}

test.describe('POS Checkout — Payment Method Options', () => {
  test('Item Payment Mode defaults to Cash, showing a Cash-sub-mode toggle (Cash on Hand / Bank Transfer / QR)', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)

    await expect(page.getByLabel('Item Payment Mode')).toHaveValue('cash')
    const cashSubModeToggle = page.getByTestId('cash-sub-mode-toggle')
    await expect(cashSubModeToggle).toBeVisible({ timeout: 10_000 })
    await expect(cashSubModeToggle.getByRole('button', { name: 'Cash on Hand' })).toBeVisible()
    await expect(cashSubModeToggle.getByRole('button', { name: 'Bank Transfer' })).toBeVisible()
    await expect(cashSubModeToggle.getByRole('button', { name: 'QR', exact: true })).toBeVisible()

    await cleanup(page, cartRow)
  })

  test('Bank Transfer sub-mode under Cash shows a Bank dropdown with the 4 seeded banks', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)

    const cashSubModeToggle = page.getByTestId('cash-sub-mode-toggle')
    await expect(cashSubModeToggle).toBeVisible({ timeout: 10_000 })
    await cashSubModeToggle.getByRole('button', { name: 'Bank Transfer', exact: true }).click()

    const bankSelect = page.getByLabel('Bank')
    await expect(bankSelect).toBeVisible({ timeout: 10_000 })
    const optionTexts = await bankSelect.locator('option').allTextContents()
    expect(optionTexts).toEqual(expect.arrayContaining(['BDO', 'BPI', 'Metrobank', 'Maya']))

    await cleanup(page, cartRow)
  })

  test('QR sub-mode under Cash shows a Gateway dropdown with the 5 seeded gateways, and the tender section no longer duplicates it', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)

    const cashSubModeToggle = page.getByTestId('cash-sub-mode-toggle')
    await expect(cashSubModeToggle).toBeVisible({ timeout: 10_000 })
    await cashSubModeToggle.getByRole('button', { name: 'QR', exact: true }).click()

    const gatewaySelect = page.getByLabel('Gateway')
    await expect(gatewaySelect).toBeVisible({ timeout: 10_000 })
    const optionTexts = await gatewaySelect.locator('option').allTextContents()
    expect(optionTexts).toEqual(
      expect.arrayContaining([
        'Palawan',
        'GCash Soundpay',
        'ECPay',
        'Maya QR',
        'Security Bank (SCB) QR',
      ])
    )

    // Tender section: switch its row to QR via the row's own (always-visible)
    // method dropdown, confirm no duplicate gateway picker there — reference
    // number still lives there.
    await page.getByLabel('Payment method', { exact: true }).first().selectOption({ label: 'QR' })
    await page.getByPlaceholder('0.00').first().fill('100')
    await expect(page.getByPlaceholder(/QR reference/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Gateway set via Item Payment Mode above.')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByLabel('Gateway')).toHaveCount(1) // still just the one, above

    await cleanup(page, cartRow)
  })

  test('marking Credit/Debit Card in Item Payment Mode shows a POS Terminal dropdown, and the tender section no longer duplicates it', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)

    await page.getByLabel('Item Payment Mode').selectOption({ label: 'Debit/Credit Card' })

    const terminalSelect = page.getByLabel('POS Terminal')
    await expect(terminalSelect).toBeVisible({ timeout: 10_000 })
    const optionTexts = await terminalSelect.locator('option').allTextContents()
    expect(optionTexts).toEqual(expect.arrayContaining(['BDO', 'BPI', 'Metrobank', 'Maya']))

    await page.getByLabel('Payment method', { exact: true }).first().selectOption({ label: 'Card' })
    await page.getByPlaceholder('0.00').first().fill('100')
    await expect(
      page.getByText('Terminal/Straight-Installment/Term set via Item Payment Mode above.')
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('POS Terminal')).toHaveCount(1) // still just the one, above

    await cleanup(page, cartRow)
  })

  test('an existing payment row stays live-synced with Item Payment Mode, not just defaulted once', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)
    const methodSelect = page.getByLabel('Payment method', { exact: true }).first()

    // The row auto-created before Item Payment Mode is touched starts on
    // the plain Cash default.
    await expect(async () => {
      expect(await methodSelect.locator('option:checked').innerText()).toBe('Cash')
    }).toPass({ timeout: 10_000 })

    // Switching Item Payment Mode afterward must update that *same* row in
    // place — not leave it stale until it's removed and re-added.
    await page.getByLabel('Item Payment Mode').selectOption({ label: 'Debit/Credit Card' })
    await expect(async () => {
      expect(await methodSelect.locator('option:checked').innerText()).toBe('Card')
    }).toPass({ timeout: 10_000 })

    // Also cover switching between two Cash sub-modes (the exact scenario
    // reported live: QR → Bank Transfer left the tender row stuck on QR).
    await page.getByLabel('Item Payment Mode').selectOption({ label: 'Cash' })
    const cashSubModeToggle = page.getByTestId('cash-sub-mode-toggle')
    await cashSubModeToggle.getByRole('button', { name: 'QR', exact: true }).click()
    await expect(async () => {
      expect(await methodSelect.locator('option:checked').innerText()).toBe('QR')
    }).toPass({ timeout: 10_000 })
    await cashSubModeToggle.getByRole('button', { name: 'Bank Transfer', exact: true }).click()
    await expect(async () => {
      expect(await methodSelect.locator('option:checked').innerText()).toBe('Bank Transfer')
    }).toPass({ timeout: 10_000 })

    await cleanup(page, cartRow)
  })

  test('the tender row shows its method dropdown right away, defaulted to Item Payment Mode, with no extra click needed', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)
    const methodSelect = page.getByLabel('Payment method', { exact: true }).first()

    await expect(methodSelect).toBeVisible({ timeout: 10_000 })
    await expect(async () => {
      expect(await methodSelect.locator('option:checked').innerText()).toBe('Cash')
    }).toPass({ timeout: 10_000 })

    // Picking straight off the dropdown works without any prior toggle.
    await methodSelect.selectOption({ label: 'Card' })
    await expect(async () => {
      expect(await methodSelect.locator('option:checked').innerText()).toBe('Card')
    }).toPass({ timeout: 10_000 })

    await cleanup(page, cartRow)
  })

  test('Card payment defaults to Straight; picking Installment reveals a Term dropdown with the 6 seeded terms', async ({
    page,
  }) => {
    await ensureManilaSession(page)
    const cartRow = await addAnyItemToCart(page)

    await page.getByLabel('Item Payment Mode').selectOption({ label: 'Debit/Credit Card' })
    await expect(page.getByLabel('POS Terminal')).toBeVisible({ timeout: 10_000 })

    // No Term dropdown yet — Straight is the default, no term needed.
    await expect(page.getByLabel('Term', { exact: true })).toHaveCount(0)

    // Scoped to this toggle specifically — the Item Payment Mode dropdown
    // above it has its own, unrelated "Installment" option with the same text.
    const cardTxnModeToggle = page.getByTestId('card-txn-mode-toggle')
    await cardTxnModeToggle.getByRole('button', { name: 'Installment', exact: true }).click()
    const termSelect = page.getByLabel('Term', { exact: true })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    const optionTexts = await termSelect.locator('option').allTextContents()
    expect(optionTexts).toEqual(
      expect.arrayContaining([
        '3 months',
        '6 months',
        '9 months',
        '12 months',
        '18 months',
        '24 months',
      ])
    )

    // Switching back to Straight hides the Term field again.
    await cardTxnModeToggle.getByRole('button', { name: 'Straight', exact: true }).click()
    await expect(page.getByLabel('Term', { exact: true })).toHaveCount(0)

    await cleanup(page, cartRow)
  })
})
