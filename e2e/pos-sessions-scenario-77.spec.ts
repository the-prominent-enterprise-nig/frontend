import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 77 Part 1 — installment collections (MI) on session close (client
// notes, 2026-10-16): "When closing a session, display the payment methods
// used (e.g., GCash) … Provide a separate box for MI."
// Case IDs (S77-1-F…) match docs/scenario-77-pos-bank-names-session-collections-plan.md.
//
// The filled-in box (cash + GCash rows, the total, the cash split) is pinned by
// the backend spec scenario-77-session-collections and checked by hand in M1:
// putting a real installment payment on a session here would post a real
// collection to a dev-DB customer, and the reconciliation is fetched by a
// server action, so the browser cannot stub it. These cases cover what the
// screen does with a real ₱0 session: the box is there, says it is empty, and
// adds no cash lines that are not there.
//
// One dedicated terminal, found or created by code, so reruns reuse it. Every
// session it opens is closed again at the expected amount in afterAll.

const TERMINAL_CODE = 'E2E-S77-PW-01'
const TERMINAL_NAME = 'E2E S77 Terminal'
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
  await expect(screen.getByText(/The drawer should hold ₱/)).toBeVisible({ timeout: 15_000 })
  return screen
}

test.describe('Scenario 77 Part 1 — installment collections on session close', () => {
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

  test('S77-1-F01 — the close screen has an MI box, empty on a shift with no installments', async ({
    page,
  }) => {
    await openSession(page.request, 0)
    const screen = await openCloseScreen(page)

    const box = screen.getByTestId('close-installment-collections')
    await expect(box).toBeVisible()
    await expect(box).toContainText('Installment collections (MI)')
    await expect(box.getByTestId('installment-collections-empty')).toHaveText(
      'No installment payments taken this shift.'
    )
  })

  test('S77-1-F02 (edge) — with nothing collected, the cash build-up adds no installment or delivery-fee line', async ({
    page,
  }) => {
    await openSession(page.request, 250)
    const screen = await openCloseScreen(page)

    await expect(screen.getByText('Opening float')).toBeVisible()
    // The build-up lists only lines the shift had; the MI box's own heading
    // is the one place "Installment collections" may appear.
    await expect(screen.getByText('Installment collections', { exact: true })).toHaveCount(0)
    await expect(screen.getByText('Delivery fees', { exact: true })).toHaveCount(0)
    await expect(screen.getByText('Counter collections')).toHaveCount(0)
  })

  test('S77-1-F03 — an open session’s detail shows the MI pane', async ({ page }) => {
    await openSession(page.request, 0)
    await gotoReady(page, '/pos/sessions')
    const row = ourRow(page)
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.getByRole('button', { name: 'Show session detail' }).click()

    await expect(page.getByText('Installment collections (MI)')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('installment-collections-empty')).toBeVisible()
  })

  test('S77-1-F04 — a closed session’s detail still shows the MI pane', async ({ page }) => {
    await openSession(page.request, 0)
    await closeOurSessions(page.request)

    await gotoReady(page, '/pos/sessions')
    const row = ourRow(page)
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row).toContainText('Closed')
    await row.getByRole('button', { name: 'Show session detail' }).click()

    await expect(page.getByText('Installment collections (MI)')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('installment-collections-empty')).toBeVisible()
  })
})
