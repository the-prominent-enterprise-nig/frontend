import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 01 (POS installment sale) gap closure, Part 3: the Agent
// Commission ledger fired correctly on every completed sale all along
// (AgentCommission, backend GET /crm/agents/:id/commissions) but had zero
// frontend consumer beyond the raw JSON endpoint. This adds a "View
// Commissions" row action on the Sales Agents table opening a read-only
// ledger dialog — no new backend endpoint needed.

test.describe('CRM Sales Agents — commission ledger (Part 3)', () => {
  test('View Commissions opens a read-only ledger dialog for the selected agent', async ({
    page,
  }) => {
    await gotoReady(page, '/crm/agents')
    await expect(page.getByRole('heading', { name: 'Sales Agents' })).toBeVisible()

    // The table renders a single-cell "Loading..."/"No sales agents yet"
    // placeholder row before real data arrives (one <td>, not six) — wait
    // for an actual data row instead of reading whichever row is there first.
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow.locator('td')).toHaveCount(6, { timeout: 10000 })
    const agentName = await firstRow.locator('td').first().innerText()

    await firstRow.getByTitle('View commissions').click()

    const dialogHeading = page.getByRole('heading', { name: `Commissions — ${agentName}` })
    await expect(dialogHeading).toBeVisible()

    // Either state is valid depending on data — just confirm it resolved
    // past the loading placeholder, not stuck forever.
    await expect(page.getByText('Loading...')).toHaveCount(0, { timeout: 10000 })
  })
})
