import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 (Accounting section), dead-code cleanup — the "Total Expenses"
// KPI had a `|| Number(pnl?.totalExpenses ...)` fallback for a field
// profitAndLoss() never actually returns (always dead, always resolved to
// 0), and the Bank Account Balances card's visibility gate read a parallel
// `bankBreakdown` array that was computed but never rendered — the actual
// grid used `bankAccountsList` instead, so the two could in principle
// disagree. Both simplified to use only real, actually-rendered values.

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '₱0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(0)}K`
  return `${sign}₱${Math.round(abs).toLocaleString('en-PH')}`
}

test.describe('Accounting Dashboard — Dead Code Cleanup', () => {
  test('Total Expenses KPI equals COGS + Operating Expenses from the real P&L endpoint', async ({
    page,
  }) => {
    const today = new Date().toISOString().slice(0, 10)
    const yearStart = `${new Date().getFullYear()}-01-01`
    const res = await page.request.get('/api/reports/profit-and-loss', {
      params: { startDate: yearStart, endDate: today },
    })
    expect(res.ok()).toBeTruthy()
    const pnl = await res.json()
    const expectedTotal = Number(pnl.totalCogs ?? 0) + Number(pnl.totalOpEx ?? 0)

    await gotoReady(page, '/accounting')
    const card = page.getByRole('link', { name: /Total Expenses/i })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card).toContainText(fmtMoney(expectedTotal))
  })

  test('Bank Account Balances card visibility matches whether real bank accounts exist', async ({
    page,
  }) => {
    const res = await page.request.get('/api/bank-accounts')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const accounts = Array.isArray(body) ? body : (body?.data ?? [])

    await gotoReady(page, '/accounting')
    const heading = page.getByRole('heading', { name: 'Bank Account Balances', exact: true })

    if (accounts.length > 0) {
      await expect(heading).toBeVisible({ timeout: 15_000 })
    } else {
      await expect(heading).toHaveCount(0)
    }
  })
})
