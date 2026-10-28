import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// POS Checkout — Selling Agent (Scenario 57, Part 1).
//
// The field was removed in 1b82138 and is restored here. What the backend
// spec cannot see is whether the picker actually renders and populates:
// the reason it was dropped rather than fixed is that it fetched from
// /crm/agents, which a cashier cannot read, so it rendered permanently
// empty. Those access rules are asserted in
// backend/test/pos-agents.e2e-spec.ts; this spec covers the UI surface
// and that the list is non-empty, which is the symptom that would return
// if the action were ever repointed at the CRM route again.
//
// Runs as Business Owner (the only storage state available) — so an empty
// list here means the route or the wiring is broken outright, not a
// permission problem.
test.describe('POS Checkout — Selling Agent', () => {
  // Scenario 78 Part 3 — required, defaulting to OFFICE (the client's ask),
  // where Scenario 57 had it optional.
  test('requires a Selling Agent and starts on OFFICE', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')

    await expect(page.getByText('Selling Agent *', { exact: false })).toBeVisible()
    await expect(page.getByText('— OFFICE for a walk-in', { exact: false })).toBeVisible()
    await expect(page.getByText('— optional', { exact: false })).toHaveCount(0)

    // /pos/agents always lists OFFICE, so it is preselected once the list
    // loads — a walk-in is credited to the house, never to no one.
    const picker = page.getByPlaceholder('Select the selling agent')
    await expect(picker).toHaveValue('OFFICE', { timeout: 15_000 })
  })

  test('offers OFFICE first, and never a resigned agent', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const picker = page.getByPlaceholder('Select the selling agent')
    await expect(picker).toHaveValue('OFFICE', { timeout: 15_000 })

    await picker.click()
    const options = page.getByTestId('searchable-select-option')
    await expect(options.first()).toHaveText(/OFFICE/)
    // Status is forced server-side, so a resigned agent can't be attached.
    await expect(options.filter({ hasText: 'Ernesto Paguio' })).toHaveCount(0)
  })

  test('cannot be cleared to nothing', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const picker = page.getByPlaceholder('Select the selling agent')
    await expect(picker).toHaveValue('OFFICE', { timeout: 15_000 })
    // No clear button on the agent picker — the pick can change, but not to
    // "no agent". Scoped to the Selling Agent block; other pickers may clear.
    const block = page
      .locator('div', { has: page.getByText('Selling Agent *') })
      .filter({ has: picker })
      .last()
    await expect(block.getByRole('button', { name: 'Clear selection' })).toHaveCount(0)
  })
})
