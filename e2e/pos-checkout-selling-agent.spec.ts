import { test, expect, type Page } from '@playwright/test'
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

// The closed picker is a button carrying the chosen agent's name; the search
// input only exists while it is open. Scoped to the Selling Agent block —
// other pickers on the page are SearchCombobox too.
const agentBlock = (page: Page) =>
  page.locator('div', { has: page.getByText('Selling Agent *') }).last()

test.describe('POS Checkout — Selling Agent', () => {
  let createdAgentId: string | undefined

  test.afterEach(async ({ page }) => {
    if (createdAgentId) {
      await page.request.delete(`/api/crm/agents/${createdAgentId}`)
      createdAgentId = undefined
    }
  })

  // Scenario 78 Part 3 — required, defaulting to OFFICE (the client's ask),
  // where Scenario 57 had it optional.
  test('requires a Selling Agent and starts on OFFICE', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')

    await expect(page.getByText('Selling Agent *', { exact: false })).toBeVisible()
    await expect(page.getByText('— OFFICE for a walk-in', { exact: false })).toBeVisible()
    await expect(page.getByText('— optional', { exact: false })).toHaveCount(0)

    // /pos/agents always lists OFFICE, so it is preselected once the list
    // loads — a walk-in is credited to the house, never to no one.
    await expect(agentBlock(page).getByRole('button', { name: 'OFFICE', exact: true })).toBeVisible(
      { timeout: 15_000 }
    )
  })

  test('offers OFFICE first, and never a resigned agent', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const block = agentBlock(page)
    await block.getByRole('button', { name: 'OFFICE', exact: true }).click({ timeout: 15_000 })

    const options = page.getByTestId('search-combobox-option')
    // The search is a server action, queued behind the ones the page fires on
    // load — slower than the default expect timeout on a cold dev stack.
    await expect(options.first()).toHaveText(/OFFICE/, { timeout: 15_000 })
    // Status is forced server-side, so a resigned agent can't be attached.
    await expect(options.filter({ hasText: 'Ernesto Paguio' })).toHaveCount(0)
  })

  // The list is capped at 100 agents by name, so the picker has to search
  // server-side: an agent past the first 100 (the "ZZ" probe sorts last) used
  // to be unreachable, however it was typed.
  test('finds an agent by typing its name, not just from the first 100', async ({ page }) => {
    const name = `ZZ E2E Agent ${Date.now()}`
    const res = await page.request.post('/api/crm/agents', { data: { name } })
    createdAgentId = (await res.json()).id

    await gotoReady(page, '/pos/checkout')
    const block = agentBlock(page)
    await block.getByRole('button', { name: 'OFFICE', exact: true }).click({ timeout: 15_000 })
    await page.getByPlaceholder('OFFICE').fill(name)

    await page.getByTestId('search-combobox-option').filter({ hasText: name }).click()
    await expect(block.getByRole('button', { name, exact: true })).toBeVisible()
  })

  test('cannot be cleared to nothing', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const block = agentBlock(page)
    await expect(block.getByRole('button', { name: 'OFFICE', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    // No clear button on the agent picker — the pick can change, but not to
    // "no agent". The closed picker itself is the block's only button.
    await expect(block.getByRole('button')).toHaveCount(1)
  })
})
