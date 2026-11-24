import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { gotoReady, loginAs } from './utils'
import { staleOpenSessions } from '../src/app/(app)/(dashboard)/pos/_shared/stale-sessions'
import { formatManilaDateTime } from '../src/libs/format/manila-date'
import type { PosSession } from '../src/schema/pos'

// Checkout blocks while the signed-in cashier still has a session open from an
// earlier (Manila) day: that drawer is never counted, its cash can't be
// deposited, and the Daily Collection Report keeps it pending (2026-11-23).
// The block can't be dismissed; "Go to Sessions" is the only way out. It
// covers the Checkout page area only, so the tabs and sidebar still work.
//
// A session can't be opened "yesterday" through the API, and the earlier-day
// check runs in the browser, so these tests open a session today and move the
// browser's clock forward instead (page.clock).

const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const BRANCH = 'Bago'

type ApiSession = {
  id: string
  cashierId: string
  terminalId: string
  openedAt: string
  status: string
  terminal?: { name?: string; terminalCode?: string; branch?: { name?: string } }
}

// ─── Manila dates ─────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' of an instant in Manila (UTC+8, no DST). */
function manilaDate(instant: string | Date): string {
  return new Date(new Date(instant).getTime() + 8 * 3600_000).toISOString().slice(0, 10)
}
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
/** The instant of a Manila wall-clock time. */
function atManila(ymd: string, hms: string): Date {
  return new Date(`${ymd}T${hms}+08:00`)
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function myId(request: APIRequestContext): Promise<string> {
  return ((await (await request.get('/api/users/me')).json()) as { id: string }).id
}

async function openSessions(request: APIRequestContext): Promise<ApiSession[]> {
  const raw: unknown = await (await request.get('/api/pos/sessions?status=open')).json()
  return (Array.isArray(raw) ? raw : ((raw as { data?: unknown[] }).data ?? [])) as ApiSession[]
}

async function myOpenSessions(request: APIRequestContext): Promise<ApiSession[]> {
  const me = await myId(request)
  return (await openSessions(request)).filter((s) => s.cashierId === me)
}

/** Closes a session declaring exactly the expected cash, so no manager
 * override is needed. The first try learns the difference from the refusal
 * (same as pos-checkout-session-picker.spec.ts). */
async function closeAtExpected(request: APIRequestContext, sessionId: string): Promise<void> {
  const url = `/api/pos/sessions/${sessionId}/close`
  const first = await request.post(url, { data: { declaredClosingCash: 0 } })
  if (first.ok()) return
  const text = await first.text()
  if (/already closed|not open/i.test(text)) return
  const diff = Number(/by (-?[\d,]+(?:\.\d+)?)/.exec(text)?.[1]?.replace(/,/g, ''))
  expect(Number.isFinite(diff), text).toBeTruthy()
  const second = await request.post(url, { data: { declaredClosingCash: -diff } })
  expect(second.ok(), await second.text()).toBeTruthy()
}

async function branchId(request: APIRequestContext, name: string): Promise<string> {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  return branches.find((b) => b.name === name)!.id
}

async function terminalsOf(
  request: APIRequestContext,
  params: Record<string, string> = {}
): Promise<{ id: string; status: string }[]> {
  return (await (await request.get('/api/pos/terminals', { params })).json()) as {
    id: string
    status: string
  }[]
}

/** Opens a session on `terminalId` as whoever `request` is signed in as. */
async function openOn(request: APIRequestContext, terminalId: string): Promise<ApiSession> {
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const me = await myId(request)
  const opened = (await openSessions(request)).find(
    (s) => s.terminalId === terminalId && s.cashierId === me
  )
  expect(opened, 'the session just opened').toBeTruthy()
  return opened!
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

const block = (page: Page) => page.getByTestId('stale-session-block')

/** Checkout has rendered something of its own: the picker, the sale, or "No
 * Open Session". The block, if any, comes after this visit's session list. */
async function checkoutReady(page: Page): Promise<void> {
  await expect(
    page
      .getByTestId('checkout-session-picker')
      .or(page.getByText('New Sale'))
      .or(page.getByText('No Open Session'))
      .first()
  ).toBeVisible({ timeout: 45_000 })
}

/** The block stays away: given time for this visit's session list to arrive. */
async function expectNoBlock(page: Page): Promise<void> {
  await checkoutReady(page)
  await page.waitForTimeout(3_000)
  await expect(block(page)).toHaveCount(0)
}

// ─── The rule itself (no browser) ─────────────────────────────────────────────

test.describe('staleOpenSessions — which sessions count as left open', () => {
  const ME = 'cashier-me'
  const TODAY = '2026-11-23'
  const s = (over: Partial<PosSession>): PosSession =>
    ({
      id: over.id ?? 'x',
      terminalId: 't',
      cashierId: ME,
      status: 'open',
      openedAt: '2026-11-23T01:00:00Z',
      ...over,
    }) as PosSession

  test('nothing open: nothing stale', () => {
    expect(staleOpenSessions([], ME, TODAY)).toEqual([])
  })

  test('opened today is not stale; opened yesterday is', () => {
    const today = s({ id: 'today', openedAt: '2026-11-23T00:30:00Z' })
    const yesterday = s({ id: 'yesterday', openedAt: '2026-11-22T02:00:00Z' })
    expect(staleOpenSessions([today, yesterday], ME, TODAY).map((x) => x.id)).toEqual(['yesterday'])
  })

  test('the day turns at Manila midnight, not UTC midnight', () => {
    // 23:59:59 on 22 Nov in Manila (15:59:59Z) is an earlier day; 00:00 on
    // 23 Nov in Manila (16:00Z on the 22nd) is already today.
    const lastSecond = s({ id: 'last-second', openedAt: '2026-11-22T15:59:59Z' })
    const midnight = s({ id: 'midnight', openedAt: '2026-11-22T16:00:00Z' })
    expect(staleOpenSessions([lastSecond, midnight], ME, TODAY).map((x) => x.id)).toEqual([
      'last-second',
    ])
  })

  test('closed and handed-over sessions never count', () => {
    const closed = s({ id: 'closed', status: 'closed', openedAt: '2026-11-20T01:00:00Z' })
    const handed = s({ id: 'handed', status: 'handed_over', openedAt: '2026-11-20T01:00:00Z' })
    expect(staleOpenSessions([closed, handed], ME, TODAY)).toEqual([])
  })

  test("another cashier's old session does not count", () => {
    const theirs = s({ id: 'theirs', cashierId: 'someone-else', openedAt: '2026-11-20T01:00:00Z' })
    expect(staleOpenSessions([theirs], ME, TODAY)).toEqual([])
  })

  test('several are listed oldest first', () => {
    const a = s({ id: 'nov-20', openedAt: '2026-11-20T01:00:00Z' })
    const b = s({ id: 'nov-09', openedAt: '2026-11-09T01:00:00Z' })
    const c = s({ id: 'nov-12', openedAt: '2026-11-12T01:00:00Z' })
    expect(staleOpenSessions([a, b, c], ME, TODAY).map((x) => x.id)).toEqual([
      'nov-09',
      'nov-12',
      'nov-20',
    ])
  })
})

// ─── Checkout, as the Bago cashier ────────────────────────────────────────────

test.describe('POS Checkout — a session left open from an earlier day', () => {
  test.describe.configure({ mode: 'serial' })

  let cashierContext: BrowserContext
  let cashier: Page
  let cashierApi: APIRequestContext
  /** Opened today by the cashier on a Bago terminal; their only open session. */
  let session: ApiSession
  /** Sessions the owner opened here, closed again at the end. */
  const ownerOpened: string[] = []

  test.beforeAll(async ({ browser }) => {
    cashierContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    cashier = await cashierContext.newPage()
    await loginAs(cashier, CASHIER_EMAIL, DEV_PASSWORD)
    cashierApi = cashierContext.request

    // Start from exactly one session, opened today: close whatever the
    // cashier left open (it may be days old in the shared test database).
    for (const s of await myOpenSessions(cashierApi)) await closeAtExpected(cashierApi, s.id)
    const bago = await terminalsOf(cashierApi, { branchId: await branchId(cashierApi, BRANCH) })
    const busy = new Set((await openSessions(cashierApi)).map((s) => s.terminalId))
    const active = bago.filter((t) => t.status === 'active')
    let terminal = active.find((t) => !busy.has(t.id))
    if (!terminal) {
      // Every Bago terminal is held by someone else's session: free one.
      terminal = active[0] ?? bago[0]
      for (const s of (await openSessions(cashierApi)).filter((x) => x.terminalId === terminal!.id))
        await closeAtExpected(cashierApi, s.id)
    }
    session = await openOn(cashierApi, terminal.id)
    expect(await myOpenSessions(cashierApi)).toHaveLength(1)
  })

  test.afterAll(async ({ request }) => {
    for (const id of ownerOpened) await closeAtExpected(request, id)
    await cashierContext?.close()
  })

  test('a session opened today does not block Checkout', async () => {
    await cashier.clock.setFixedTime(atManila(manilaDate(session.openedAt), '23:59:59'))
    await gotoReady(cashier, '/pos/checkout')
    await expectNoBlock(cashier)
  })

  test('the next day starts at Manila midnight: 00:00:30 blocks, 23:59:59 the day before did not', async () => {
    await cashier.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 1), '00:00:30'))
    await gotoReady(cashier, '/pos/checkout')
    await expect(block(cashier)).toBeVisible({ timeout: 45_000 })
  })

  test('one session: names the terminal, branch and when it was opened', async () => {
    await cashier.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 1), '09:00:00'))
    await gotoReady(cashier, '/pos/checkout')
    const b = block(cashier)
    await expect(b).toBeVisible({ timeout: 45_000 })
    await expect(b.getByRole('heading')).toHaveText('Close your session from an earlier day')
    await expect(b).toContainText('Close it to continue selling.')
    if (session.terminal?.name) await expect(b).toContainText(session.terminal.name)
    await expect(b).toContainText(BRANCH)
    const opened = formatManilaDateTime(session.openedAt, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    await expect(b).toContainText(`Opened ${opened}`)
  })

  test('cannot be dismissed: Escape and clicking outside leave it up, and the page behind cannot be used', async () => {
    await cashier.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 1), '09:00:00'))
    await gotoReady(cashier, '/pos/checkout')
    const b = block(cashier)
    await expect(b).toBeVisible({ timeout: 45_000 })

    await cashier.keyboard.press('Escape')
    await expect(b).toBeVisible()
    // The dimmed backdrop, away from the card.
    await b.click({ position: { x: 12, y: 12 } })
    await expect(b).toBeVisible()
    await expect(b.getByRole('button', { name: /close|dismiss|later/i })).toHaveCount(0)

    // Whatever Checkout shows behind it can't take a click.
    const behind = cashier
      .getByTestId('checkout-session-picker')
      .getByRole('button')
      .or(cashier.getByPlaceholder('Search by name or serial'))
      .first()
    await expect(behind.click({ trial: true, timeout: 2_000 })).rejects.toThrow()
  })

  test('covers Checkout only: the POS tabs still work and other POS pages are not blocked', async () => {
    await cashier.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 1), '09:00:00'))
    await gotoReady(cashier, '/pos/checkout')
    await expect(block(cashier)).toBeVisible({ timeout: 45_000 })

    await cashier.getByRole('link', { name: 'Transactions' }).first().click()
    await expect(cashier).toHaveURL(/\/pos\/transactions/)
    await cashier.waitForTimeout(2_000)
    await expect(block(cashier)).toHaveCount(0)

    await cashier.getByRole('link', { name: 'Checkout' }).first().click()
    await expect(cashier).toHaveURL(/\/pos\/checkout/)
    await expect(block(cashier)).toBeVisible({ timeout: 45_000 })
  })

  test('"Go to Sessions" leads to the Sessions list, where the session can be closed', async () => {
    await cashier.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 1), '09:00:00'))
    await gotoReady(cashier, '/pos/checkout')
    const b = block(cashier)
    await expect(b).toBeVisible({ timeout: 45_000 })
    await b.getByRole('link', { name: 'Go to Sessions' }).click()
    await expect(cashier).toHaveURL(/\/pos\/sessions$/)
    await expect(block(cashier)).toHaveCount(0)
  })

  test('several sessions: the count only, no list', async ({ page, request }) => {
    // The owner, who can open sessions at more than one branch. Every session
    // they have open counts once the clock is two days on.
    const busy = new Set((await openSessions(request)).map((s) => s.terminalId))
    const free = (await terminalsOf(request)).filter(
      (t) => t.status === 'active' && !busy.has(t.id)
    )
    let mine = await myOpenSessions(request)
    for (const t of free) {
      if (mine.length >= 2) break
      ownerOpened.push((await openOn(request, t.id)).id)
      mine = await myOpenSessions(request)
    }
    test.skip(mine.length < 2, 'no free terminals for the owner to hold two sessions')

    const latest = mine
      .map((s) => manilaDate(s.openedAt))
      .sort()
      .at(-1)!
    await page.clock.setFixedTime(atManila(addDays(latest, 2), '09:00:00'))
    await gotoReady(page, '/pos/checkout')
    const b = block(page)
    await expect(b).toBeVisible({ timeout: 45_000 })
    await expect(b.getByRole('heading')).toHaveText(`You have ${mine.length} sessions still open`)
    await expect(b).toContainText(
      'They were opened on earlier days. Close them to continue selling.'
    )
    await expect(b.getByText(/^Opened /)).toHaveCount(0)
    await expect(b.getByRole('link', { name: 'Go to Sessions' })).toBeVisible()
  })

  test("another cashier's old session does not block you", async ({ page, request }) => {
    // The cashier's session is two days old on this clock. The owner sees a
    // block only for their own sessions, never one counting the cashier's.
    const ownerOwn = await myOpenSessions(request)
    await page.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 2), '09:00:00'))
    await gotoReady(page, '/pos/checkout')
    const ownerStale = ownerOwn.filter(
      (s) => manilaDate(s.openedAt) < addDays(manilaDate(session.openedAt), 2)
    )
    if (ownerStale.length === 0) {
      await expectNoBlock(page)
    } else {
      const b = block(page)
      await expect(b).toBeVisible({ timeout: 45_000 })
      if (ownerStale.length === 1) {
        await expect(b.getByRole('heading')).toHaveText('Close your session from an earlier day')
      } else {
        await expect(b.getByRole('heading')).toHaveText(
          `You have ${ownerStale.length} sessions still open`
        )
      }
    }
  })

  test('once the session is closed, coming back to Checkout shows no block, not even for a moment', async () => {
    await cashier.clock.setFixedTime(atManila(addDays(manilaDate(session.openedAt), 1), '09:00:00'))
    await gotoReady(cashier, '/pos/checkout')
    await expect(block(cashier)).toBeVisible({ timeout: 45_000 })

    // Closed elsewhere (another tab, or the Sessions page). Checkout's cached
    // list still has it.
    await closeAtExpected(cashierApi, session.id)

    await cashier.getByRole('link', { name: 'Transactions' }).first().click()
    await expect(cashier).toHaveURL(/\/pos\/transactions/)
    // Watch for the block attaching at any point on the way back.
    await cashier.evaluate(() => {
      const w = window as unknown as { __sawStaleBlock: boolean }
      w.__sawStaleBlock = false
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="stale-session-block"]')) w.__sawStaleBlock = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    await cashier.getByRole('link', { name: 'Checkout' }).first().click()
    await expect(cashier).toHaveURL(/\/pos\/checkout/)
    await expectNoBlock(cashier)
    expect(
      await cashier.evaluate(
        () => (window as unknown as { __sawStaleBlock: boolean }).__sawStaleBlock
      )
    ).toBe(false)
  })
})
