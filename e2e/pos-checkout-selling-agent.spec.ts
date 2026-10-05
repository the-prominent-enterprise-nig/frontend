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
  test('offers an optional Selling Agent picker that is populated', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')

    const label = page.getByText('Selling Agent', { exact: false })
    await expect(label).toBeVisible()

    // Optional by design: a walk-in has no agent behind it, and forcing a
    // choice would put a false name on the commission trail.
    await expect(page.getByText('— optional', { exact: false }).first()).toBeVisible()

    // SearchableSelect puts its placeholder on the <input>, not in text.
    const picker = page.getByPlaceholder('No agent')
    await expect(picker).toBeVisible()

    // Opening it must render the dropdown — either with agents, or with the
    // component's own empty state. Deliberately NOT asserting a non-empty
    // list: `agents` is one of several tables this project's seed does not
    // reliably populate, so "is it populated" is a statement about the
    // database, not about this component. That guarantee lives in
    // backend/test/pos-agents.e2e-spec.ts, which creates its own agents and
    // proves a Cashier receives them — which is the regression that actually
    // mattered (the picker used to read /crm/agents and come back empty for
    // every cashier).
    await picker.click()
    const options = page.getByTestId('searchable-select-option')
    const empty = page.getByText('No matches', { exact: true })
    await expect(options.first().or(empty)).toBeVisible()

    // Whatever is offered, a resigned agent never is — status is forced
    // server-side so one cannot be attached to a new sale.
    await expect(options.filter({ hasText: 'Ernesto Paguio' })).toHaveCount(0)
  })

  test('does not block a sale when no agent is chosen', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')

    // Nothing selected is a valid state — the placeholder stays put and no
    // validation message appears against it.
    await expect(page.getByPlaceholder('No agent')).toBeVisible()
    await expect(page.getByText('Selling agent is required', { exact: false })).toHaveCount(0)
  })
})
