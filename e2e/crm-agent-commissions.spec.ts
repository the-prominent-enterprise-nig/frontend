import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 78 — the Sales Agents row opens the agent's own page: their
// invoices with commission / Released / SMI Released, and Edit and Remove in
// the header (inline edit, in-app confirm, unsaved-changes guard). Replaces
// the Scenario-01 "View commissions" dialog this file used to cover.
//
// Self-contained: creates its own agent through the API, so it never depends
// on what the roster holds, and removes it at the end (Remove is the last
// test; afterAll sweeps it if a run died earlier). The invoice rows
// themselves need a POS sale credited to the agent, which a spec can't make
// cheaply — the data side is proven in backend/src/crm/agent/agent.service.spec.ts.

const NAME = `E2E S78 Agent ${Date.now()}`
let agentId = ''

async function openList(page: Page) {
  await gotoReady(page, '/crm/agents')
  await expect(page.getByRole('heading', { name: 'Sales Agents' })).toBeVisible()
}

async function searchForAgent(page: Page, name: string) {
  const row = page.locator('tbody tr', { hasText: name })
  // The search box can be wiped by hydration on a cold compile — re-type until
  // the row shows.
  await expect(async () => {
    await page.getByPlaceholder('Search agents...').fill(name)
    await expect(row).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  return row
}

test.describe.configure({ mode: 'serial' })

test.describe('CRM Sales Agents — the agent page (Scenario 78)', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/crm/agents', {
      data: { name: NAME, commissionRate: 0.05, branchId: null },
    })
    expect(res.ok()).toBeTruthy()
    agentId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    if (agentId) await request.delete(`/api/crm/agents/${agentId}`).catch(() => {})
  })

  test('the list has no row actions — clicking a row opens the agent page', async ({ page }) => {
    await openList(page)
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0)
    await expect(page.getByTitle('View commissions')).toHaveCount(0)

    const row = await searchForAgent(page, NAME)
    // Any cell, not just the name.
    await row.locator('td').nth(4).click()
    await expect(page).toHaveURL(new RegExp(`/crm/agents/${agentId}$`))

    await expect(page.getByRole('heading', { name: NAME })).toBeVisible()
    await expect(page.getByText('All branches · 5.00% rate · Active')).toBeVisible()
    for (const tile of ['Invoices', 'Commission', 'Released', 'SMI Released']) {
      await expect(page.getByText(tile, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('No invoices sold yet.')).toBeVisible()
  })

  test('Edit is inline: Cancel discards, Save keeps the rate when it was left alone', async ({
    page,
  }) => {
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Agent' })).toBeVisible()
    // The invoices stay on the page under the form.
    await expect(page.getByText('No invoices sold yet.')).toBeVisible()

    const phone = page.locator('form').getByRole('textbox').nth(1)
    await phone.fill('09170000078')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('09170000078')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.locator('form').getByRole('textbox').nth(1).fill('09170000078')
    // Rate untouched: the API sends it as a Decimal string and the update DTO is
    // @IsNumber() — this Save is what would 400 if the form passed it back as-is.
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Agent updated')).toBeVisible()
    await expect(page.getByText('09170000078')).toBeVisible()
    await expect(page.getByText('All branches · 5.00% rate · Active')).toBeVisible()
  })

  test('leaving with unsaved edits asks first; an unchanged form just leaves', async ({ page }) => {
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    const name = page.locator('form').getByRole('textbox').first()
    await name.fill(`${NAME} X`)

    await page.getByRole('link', { name: 'Back to sales agents' }).click()
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(new RegExp(`/crm/agents/${agentId}$`))
    await expect(name).toHaveValue(`${NAME} X`)

    // Changed back to the saved value — nothing to lose, so no question.
    await name.fill(NAME)
    await page.getByRole('link', { name: 'Back to sales agents' }).click()
    await expect(page).toHaveURL(/\/crm\/agents$/)
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toHaveCount(0)

    // And Discard and leave really leaves, without saving.
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.locator('form').getByRole('textbox').first().fill(`${NAME} Y`)
    await page.getByRole('link', { name: 'Back to sales agents' }).click()
    await page.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(page).toHaveURL(/\/crm\/agents$/)
    await searchForAgent(page, NAME)
    await expect(page.locator('tbody tr', { hasText: `${NAME} Y` })).toHaveCount(0)
  })

  test('the list pages 20 at a time', async ({ page }) => {
    await openList(page)
    const footer = page.getByText(/^Showing \d+–\d+ of \d+ agents?$/)
    await expect(footer).toBeVisible({ timeout: 15_000 })
    const total = Number((await footer.innerText()).match(/of (\d+)/)![1])
    await expect(page.locator('tbody tr')).toHaveCount(Math.min(total, 20))
    const next = page.getByRole('button', { name: 'Next', exact: true })
    if (total <= 20) {
      await expect(next).toBeDisabled()
      return
    }
    await next.click()
    await expect(footer).toHaveText(
      new RegExp(`^Showing 21–${Math.min(total, 40)} of ${total} agents$`)
    )
    // A search goes back to page 1.
    await page.getByPlaceholder('Search agents...').fill(NAME)
    await expect(footer).toHaveText('Showing 1–1 of 1 agent')
  })

  test('Remove asks in-app, then returns to the list without the agent', async ({ page }) => {
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByRole('heading', { name: 'Remove agent' })).toBeVisible()
    await expect(page.getByText('Their past invoices and commissions are kept.')).toBeVisible()
    await page.getByRole('button', { name: 'Remove', exact: true }).last().click()
    await expect(page).toHaveURL(/\/crm\/agents$/)
    await page.getByPlaceholder('Search agents...').fill(NAME)
    await expect(page.getByText('No sales agents yet')).toBeVisible({ timeout: 10_000 })
    agentId = ''
  })
})
