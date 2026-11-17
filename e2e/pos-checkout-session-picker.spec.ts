import { test, expect, type APIRequestContext } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Checkout asks which cashier session a sale is for before the cart opens
// (2026-11-16). Testers kept ringing up whole sales with no session picked:
// with two or more open, nothing was selected, the only sign was a small
// dropdown in the top bar, and Confirm stayed greyed out without saying why.
// Nothing is picked for the seller now, not even the only open session.
// Picking another cashier's session asks once, because the sale goes into
// their drawer.

const BRANCH = 'Bago'
// Where the owner keeps a session of their own, for the dropdown switch.
const OTHER_BRANCH = 'Binalbagan'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const DEV_PASSWORD = 'dev-prominent-enterprise-2026'

type OpenSession = {
  id: string
  cashierId: string
  cashier?: { name?: string | null }
  terminalId: string
  terminal?: { terminalCode?: string; branch?: { name?: string } }
}

async function openSessions(request: APIRequestContext): Promise<OpenSession[]> {
  const raw: unknown = await (await request.get('/api/pos/sessions?status=open')).json()
  return (Array.isArray(raw) ? raw : ((raw as { data?: unknown[] }).data ?? [])) as OpenSession[]
}

/** Makes sure Bago has an open session, so checkout has one to offer. */
async function ensureBagoSession(request: APIRequestContext): Promise<void> {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  if (open.length) return
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

/** Closes a session declaring exactly the expected cash, so no manager
 * override is needed. The first try learns the difference from the refusal. */
async function closeAtExpected(request: APIRequestContext, sessionId: string): Promise<void> {
  const url = `/api/pos/sessions/${sessionId}/close`
  const first = await request.post(url, { data: { declaredClosingCash: 0 } })
  if (first.ok()) return
  const text = await first.text()
  const diff = Number(/by (-?[\d,]+(?:\.\d+)?)/.exec(text)?.[1]?.replace(/,/g, ''))
  expect(Number.isFinite(diff), text).toBeTruthy()
  const second = await request.post(url, { data: { declaredClosingCash: -diff } })
  expect(second.ok(), await second.text()).toBeTruthy()
}

/** A Bago session open under the Bago cashier, `request` being signed in as
 * them. Reuses one if they already have it; otherwise closes whatever is open
 * on a Bago terminal and opens one as the cashier. */
async function ensureCashierBagoSession(request: APIRequestContext): Promise<OpenSession> {
  const me = (await (await request.get('/api/users/me')).json()) as { id: string }
  const mine = (await openSessions(request)).find(
    (s) => s.cashierId === me.id && s.terminal?.branch?.name === BRANCH
  )
  if (mine) return mine

  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const active = terminals.filter((t) => t.status === 'active')
  const busy = new Set(
    (await openSessions(request)).map((s) => s.terminalId).filter(Boolean) as string[]
  )
  // A free Bago terminal if there is one, so no one else's session is closed.
  let terminal = active.find((t) => !busy.has(t.id))
  if (!terminal) {
    terminal = active[0] ?? terminals[0]
    const open = (await (
      await request.get('/api/pos/sessions', {
        params: { terminalId: terminal.id, status: 'open' },
      })
    ).json()) as { id: string }[]
    for (const s of open) await closeAtExpected(request, s.id)
  }
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const opened = (await openSessions(request)).find(
    (s) => s.cashierId === me.id && s.terminal?.branch?.name === BRANCH
  )
  expect(opened, 'the cashier session just opened').toBeTruthy()
  return opened!
}

test.describe('POS checkout — pick the session first', () => {
  test.beforeAll(async ({ request }) => {
    await ensureBagoSession(request)
  })

  test('nothing is picked for the seller; the cart opens only once a session is picked', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')

    const picker = page.getByTestId('checkout-session-picker')
    await expect(picker).toBeVisible({ timeout: 30_000 })
    await expect(picker.getByText('Which session is this sale for?')).toBeVisible()
    // No cart behind it to fill in before the session is known.
    await expect(page.getByPlaceholder('Search by name or serial')).toHaveCount(0)
    await expect(page.getByTestId('checkout-active-session')).toHaveCount(0)

    const active = page.getByTestId('checkout-active-session')
    await expect(async () => {
      if (await picker.isVisible()) {
        const confirm = picker.getByRole('button', { name: 'Use this session' })
        if (await confirm.isVisible()) await confirm.click({ timeout: 3_000 })
        else
          await picker
            .getByTestId('checkout-session-option')
            .filter({ hasText: BRANCH })
            .first()
            .click({ timeout: 3_000 })
      }
      await expect(active).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    // The pick stays in view as the top bar's dropdown, already chosen, and
    // the cart is open.
    await expect(active).toContainText(BRANCH)
    await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible({ timeout: 15_000 })
  })

  test("another cashier's session asks first, says whose drawer it is, and Back returns to the list", async ({
    page,
    browser,
  }) => {
    // The Bago cashier's own session, opened as them in a separate browser,
    // so the owner below is picking someone else's.
    const cashierContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const cashierPage = await cashierContext.newPage()
    await loginAs(cashierPage, CASHIER_EMAIL, DEV_PASSWORD)
    const target = await ensureCashierBagoSession(cashierPage.request)
    await cashierContext.close()
    const code = target.terminal?.terminalCode ?? target.terminalId
    const name = target.cashier?.name || 'another cashier'

    await gotoReady(page, '/pos/checkout')
    const picker = page.getByTestId('checkout-session-picker')
    await expect(picker).toBeVisible({ timeout: 30_000 })
    const option = picker.getByTestId('checkout-session-option').filter({ hasText: code })
    const heading = picker.getByText(`This is ${name}'s session`)

    await expect(async () => {
      await option.first().click({ timeout: 3_000 })
      await expect(heading).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await expect(picker.getByText(`This sale goes into ${name}'s drawer.`)).toBeVisible()

    await picker.getByRole('button', { name: 'Back' }).click()
    await expect(picker.getByText('Which session is this sale for?')).toBeVisible()

    await option.first().click()
    await picker.getByRole('button', { name: 'Use this session' }).click()
    const active = page.getByTestId('checkout-active-session')
    await expect(active).toHaveAttribute('data-session-id', target.id)
    await expect(active).toContainText(name)
  })

  test("switching to another cashier's session from the dropdown asks first; Back keeps the session in use", async ({
    page,
    request,
    browser,
  }) => {
    // The cashier's Bago session, and one of the owner's own elsewhere, so
    // the owner starts on their own and switches to the cashier's.
    const cashierContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const cashierPage = await cashierContext.newPage()
    await loginAs(cashierPage, CASHIER_EMAIL, DEV_PASSWORD)
    const cashierSession = await ensureCashierBagoSession(cashierPage.request)
    await cashierContext.close()
    const own = await ensureOwnSessionAt(request, OTHER_BRANCH)
    test.skip(!own, `no free ${OTHER_BRANCH} terminal for the owner's own session`)
    const name = cashierSession.cashier?.name || 'another cashier'
    const cashierCode = cashierSession.terminal?.terminalCode ?? cashierSession.terminalId

    await gotoReady(page, '/pos/checkout')
    const picker = page.getByTestId('checkout-session-picker')
    const active = page.getByTestId('checkout-active-session')
    await expect(picker).toBeVisible({ timeout: 30_000 })
    // Both sessions are offered only under All Branches.
    test.skip(
      !(await picker
        .getByTestId('checkout-session-option')
        .filter({ hasText: OTHER_BRANCH })
        .count()),
      `the branch switcher is not on All Branches, so ${OTHER_BRANCH} is not offered`
    )
    await expect(async () => {
      await picker
        .getByTestId('checkout-session-option')
        .filter({ hasText: OTHER_BRANCH })
        .first()
        .click({ timeout: 3_000 })
      await expect(active).toHaveAttribute('data-session-id', own!.id, { timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    const check = page.getByTestId('checkout-session-confirm')
    await active.click()
    await page
      .getByTestId('checkout-session-switch-option')
      .filter({ hasText: cashierCode })
      .click()
    await expect(check.getByText(`This is ${name}'s session`)).toBeVisible()
    await check.getByRole('button', { name: 'Back' }).click()
    await expect(check).toHaveCount(0)
    await expect(active).toHaveAttribute('data-session-id', own!.id)

    await active.click()
    await page
      .getByTestId('checkout-session-switch-option')
      .filter({ hasText: cashierCode })
      .click()
    await check.getByRole('button', { name: 'Use this session' }).click()
    await expect(active).toHaveAttribute('data-session-id', cashierSession.id)
    await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible()
  })
})

// Checkout keeps the session this login picked (or opened in POS → Sessions)
// until it closes (checkout-session-memory.ts), so it is not picked again on
// every visit.
test.describe('POS checkout — the picked session is kept until it closes', () => {
  const KEPT_KEY = 'pos_checkout_session'

  test('stays picked on later visits, and the picker comes back once it closes', async ({
    page,
    request,
  }) => {
    const own = await ensureOwnSessionAt(request, OTHER_BRANCH)
    test.skip(!own, `no free ${OTHER_BRANCH} terminal for the owner's own session`)
    const picker = page.getByTestId('checkout-session-picker')
    const active = page.getByTestId('checkout-active-session')

    await gotoReady(page, '/pos/checkout')
    await expect(picker).toBeVisible({ timeout: 30_000 })
    test.skip(
      !(await picker
        .getByTestId('checkout-session-option')
        .filter({ hasText: OTHER_BRANCH })
        .count()),
      `the branch switcher is not on All Branches, so ${OTHER_BRANCH} is not offered`
    )
    await expect(async () => {
      await picker
        .getByTestId('checkout-session-option')
        .filter({ hasText: OTHER_BRANCH })
        .first()
        .click({ timeout: 3_000 })
      await expect(active).toHaveAttribute('data-session-id', own!.id, { timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    // Away and back, then a reload: still on it, never asked.
    await gotoReady(page, '/pos/transactions')
    await gotoReady(page, '/pos/checkout')
    await expect(active).toHaveAttribute('data-session-id', own!.id, { timeout: 30_000 })
    await expect(picker).toHaveCount(0)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(active).toHaveAttribute('data-session-id', own!.id, { timeout: 30_000 })

    // Closed: nothing to keep, so Checkout asks again.
    await closeAtExpected(request, own!.id)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(active).toHaveCount(0, { timeout: 30_000 })
  })

  test('a session just opened in POS → Sessions is the one Checkout starts on', async ({
    page,
    request,
  }) => {
    const own = await ensureOwnSessionAt(request, OTHER_BRANCH)
    test.skip(!own, `no free ${OTHER_BRANCH} terminal for the owner's own session`)
    const me = (await (await request.get('/api/users/me')).json()) as { id: string }
    // Kept as the Sessions page keeps it on opening.
    await gotoReady(page, '/pos/sessions')
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [KEPT_KEY, JSON.stringify({ userId: me.id, sessionId: own!.id })]
    )

    await gotoReady(page, '/pos/checkout')
    await expect(page.getByTestId('checkout-active-session')).toHaveAttribute(
      'data-session-id',
      own!.id,
      { timeout: 30_000 }
    )
    await expect(page.getByTestId('checkout-session-picker')).toHaveCount(0)
  })

  test("another login's kept session is not used", async ({ page, browser }) => {
    const cashierContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const cashierPage = await cashierContext.newPage()
    await loginAs(cashierPage, CASHIER_EMAIL, DEV_PASSWORD)
    const cashierSession = await ensureCashierBagoSession(cashierPage.request)
    await cashierContext.close()
    // Left behind on this browser by the cashier's login.
    await gotoReady(page, '/pos/sessions')
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [KEPT_KEY, JSON.stringify({ userId: cashierSession.cashierId, sessionId: cashierSession.id })]
    )

    await gotoReady(page, '/pos/checkout')
    await expect(page.getByTestId('checkout-session-picker')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('checkout-active-session')).toHaveCount(0)
  })
})

/** An open session of the owner's own at `branchName` (`request` being the
 * owner): reused if there is one, else opened on a free terminal there. Null
 * when every terminal there is held by someone else. */
async function ensureOwnSessionAt(
  request: APIRequestContext,
  branchName: string
): Promise<OpenSession | null> {
  const me = (await (await request.get('/api/users/me')).json()) as { id: string }
  const sessions = await openSessions(request)
  const mine = sessions.find(
    (s) => s.cashierId === me.id && s.terminal?.branch?.name === branchName
  )
  if (mine) return mine
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === branchName)?.id
  if (!branchId) return null
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const busy = new Set(sessions.map((s) => s.terminalId))
  const free = terminals.find((t) => t.status === 'active' && !busy.has(t.id))
  if (!free) return null
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: free.id, openingCash: 0 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (
    (await openSessions(request)).find(
      (s) => s.cashierId === me.id && s.terminal?.branch?.name === branchName
    ) ?? null
  )
}
