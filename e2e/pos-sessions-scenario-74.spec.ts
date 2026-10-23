import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 74 Part 1 — POS sessions (client notes, 2026-10-16):
//  - "Unable to close session when cash is 0.00": the close screen had no way
//    to declare an empty drawer, so Close stayed disabled.
//  - "Clarify the Point of Sale date": the list showed times only, had no date
//    filter, and checkout said nothing when the till was opened on an earlier
//    day.
// Case IDs (S74-1-F…) match docs/scenario-74-oct16-client-notes-quick-wins-plan.md.
// S74-1-F02 (a shift that crossed midnight) needs a back-dated session row and
// is covered by the manual script (M1) — closedAt is stamped by the server.
//
// Uses one dedicated terminal, found or created by code, so reruns reuse it
// rather than adding a terminal per run to the dev DB. Every session it opens
// is closed again at the expected amount in afterAll.

const TERMINAL_CODE = 'E2E-S74-PW-01'
const TERMINAL_NAME = 'E2E S74 Terminal'
const BRANCH = 'Bago'

let terminalId = ''

async function ownerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
}

async function ensureTerminal(request: APIRequestContext): Promise<string> {
  const list = await request.get('/api/pos/terminals?limit=500')
  const body = await list.json()
  const rows = (Array.isArray(body) ? body : (body.data ?? [])) as {
    id: string
    terminalCode: string
  }[]
  const existing = rows.find((t) => t.terminalCode === TERMINAL_CODE)
  if (existing) {
    await request.patch(`/api/pos/terminals/${existing.id}`, { data: { status: 'active' } })
    return existing.id
  }

  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branch = branches.find((b) => b.name === BRANCH)
  if (!branch) throw new Error(`branch "${BRANCH}" not found`)
  const res = await request.post('/api/pos/terminals', {
    data: { terminalCode: TERMINAL_CODE, name: TERMINAL_NAME, branchId: branch.id },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id
}

async function openSessions(request: APIRequestContext) {
  const res = await request.get(`/api/pos/sessions?terminalId=${terminalId}&status=open`)
  const body = await res.json()
  return (Array.isArray(body) ? body : (body.data ?? [])) as { id: string }[]
}

/** Close whatever is open on our terminal at exactly its expected cash. */
async function closeOurSessions(request: APIRequestContext) {
  for (const s of await openSessions(request)) {
    const rec = await (await request.get(`/api/pos/sessions/${s.id}/reconciliation`)).json()
    const expected = Number((rec.data ?? rec).expectedClosingCash ?? 0)
    await request.post(`/api/pos/sessions/${s.id}/close`, {
      data: { declaredClosingCash: expected },
    })
  }
}

async function openSession(request: APIRequestContext, openingCash: number): Promise<string> {
  await closeOurSessions(request)
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId, openingCash },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id
}

function ourRow(page: Page) {
  // Desktop row (lg:grid); the mobile card carries the same text but is hidden.
  return page.locator('div.lg\\:grid').filter({ hasText: TERMINAL_NAME }).first()
}

async function openCloseScreen(page: Page) {
  await gotoReady(page, '/pos/sessions')
  const row = ourRow(page)
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.getByRole('button', { name: 'Close session' }).click()
  const screen = page.getByTestId('close-session-screen')
  await expect(screen).toBeVisible()
  // The expected figure loads with the screen; wait for it so the verdict is real.
  await expect(screen.getByText(/The drawer should hold ₱/)).toBeVisible({ timeout: 15_000 })
  return screen
}

test.describe('Scenario 74 Part 1 — POS sessions', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await ownerRequest(playwright, baseURL!)
    terminalId = await ensureTerminal(request)
    await closeOurSessions(request)
    await request.dispose()
  })

  test.afterAll(async ({ playwright, baseURL }) => {
    const request = await ownerRequest(playwright, baseURL!)
    await closeOurSessions(request)
    await request.dispose()
  })

  test('S74-1-F01 — a session row shows its date before the terminal and open time', async ({
    page,
  }) => {
    await openSession(page.request, 0)
    await gotoReady(page, '/pos/sessions')
    const row = ourRow(page)
    await expect(row).toBeVisible({ timeout: 20_000 })
    // "Mon, Oct 19 · E2E S74 Terminal · opened 8:02 AM"
    await expect(row).toContainText(
      new RegExp(`\\w{3}, \\w{3} \\d{1,2} · ${TERMINAL_NAME} · opened \\d{1,2}:\\d{2}`)
    )
  })

  test('S74-1-F03 — the date filter narrows the list and Clear brings everything back', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/sessions')
    await expect(ourRow(page)).toBeVisible({ timeout: 20_000 })

    const today = await page.evaluate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    })
    await page.getByLabel('Sessions from date').fill(today)
    await page.getByLabel('Sessions to date').fill(today)
    await expect(ourRow(page)).toBeVisible()

    await page.getByLabel('Sessions from date').fill('2020-01-01')
    await page.getByLabel('Sessions to date').fill('2020-01-01')
    await expect(page.getByText('No sessions found.')).toBeVisible()

    await page.getByRole('button', { name: 'Clear dates' }).click()
    await expect(ourRow(page)).toBeVisible()
    await expect(page.getByLabel('Sessions from date')).toHaveValue('')
  })

  test('S74-1-F04 — an empty drawer closes a ₱0 session', async ({ page }) => {
    await openSession(page.request, 0)
    const screen = await openCloseScreen(page)

    const close = screen.getByRole('button', { name: 'Close session', exact: true })
    await expect(close).toBeDisabled()

    await screen.getByRole('button', { name: 'Drawer is empty — ₱0.00' }).click()
    await expect(screen.getByText('Drawer declared empty')).toBeVisible()
    await expect(screen.getByText('Drawer balances')).toBeVisible()
    await expect(close).toBeEnabled()

    await close.click()
    await expect(page).toHaveURL(/\/pos\/daily-collection/, { timeout: 20_000 })
    expect(await openSessions(page.request)).toHaveLength(0)
  })

  test('S74-1-F05 (edge) — typing 0 in Coins counts as counted', async ({ page }) => {
    await openSession(page.request, 0)
    const screen = await openCloseScreen(page)
    const close = screen.getByRole('button', { name: 'Close session', exact: true })
    await expect(close).toBeDisabled()

    await screen.getByLabel('Loose coin total').fill('0')
    await expect(close).toBeEnabled()
    await expect(screen.getByText('Drawer balances')).toBeVisible()
  })

  test('S74-1-F06 (edge) — an empty drawer against ₱500 expected is a shortage needing a reason', async ({
    page,
  }) => {
    await openSession(page.request, 500)
    const screen = await openCloseScreen(page)

    await screen.getByRole('button', { name: 'Drawer is empty — ₱0.00' }).click()
    await expect(screen.getByText('Short by ₱500.00')).toBeVisible()
    // No reason picked yet, so the variance close stays blocked.
    await expect(screen.getByRole('button', { name: 'Close with variance' })).toBeDisabled()
  })

  test('S74-1-F07 (edge) — typing a count after "Drawer is empty" clears the empty flag', async ({
    page,
  }) => {
    await openSession(page.request, 0)
    const screen = await openCloseScreen(page)

    await screen.getByRole('button', { name: 'Drawer is empty — ₱0.00' }).click()
    await expect(screen.getByText('Drawer declared empty')).toBeVisible()

    await screen.getByLabel('100 peso count').fill('1')
    await expect(screen.getByText('Drawer declared empty')).toHaveCount(0)
    await expect(screen.getByText('1 note')).toBeVisible()
    await expect(screen.getByText('Over by ₱100.00')).toBeVisible()
  })

  test('S74-1-F08 — checkout flags a session opened on an earlier day, not one opened today', async ({
    page,
  }) => {
    await openSession(page.request, 0)

    // Either the picker (several sessions open) or the auto-selected chip.
    // Not getByText: that also matches the picker's hidden <option>s.
    function sessionControl() {
      return page
        .locator('select')
        .filter({ hasText: 'Select session…' })
        .or(page.locator('span.rounded-full', { hasText: TERMINAL_NAME }))
        .first()
    }

    async function pickOurSession() {
      const picker = page.locator('select').filter({ hasText: 'Select session…' })
      // Only rendered when more than one session is open; with just ours,
      // checkout auto-selects it.
      if (await picker.isVisible().catch(() => false)) {
        const label = await picker
          .locator('option', { hasText: TERMINAL_CODE })
          .first()
          .textContent()
        await picker.selectOption({ label: label!.trim() })
      }
    }

    await gotoReady(page, '/pos/checkout')
    await expect(sessionControl()).toBeVisible({ timeout: 30_000 })
    await pickOurSession()
    await expect(page.getByTestId('session-opened-earlier')).toHaveCount(0)

    // The browser's "today" moves to tomorrow; the session's openedAt stays.
    // setFixedTime fakes Date only, so the app's own timers keep running.
    await page.clock.setFixedTime(new Date(Date.now() + 26 * 60 * 60 * 1000))
    await gotoReady(page, '/pos/checkout')
    await expect(sessionControl()).toBeVisible({ timeout: 30_000 })
    await pickOurSession()
    await expect(page.getByTestId('session-opened-earlier')).toBeVisible()
    await expect(page.getByTestId('session-opened-earlier')).toContainText('This session opened on')
  })
})
