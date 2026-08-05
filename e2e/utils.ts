import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

/**
 * Next dev-mode compiles routes on demand, and this app appears to keep a
 * persistent connection open (HMR websocket and/or live-polling queries) —
 * both the browser 'load' event and Playwright's 'networkidle' wait hang
 * indefinitely here. 'domcontentloaded' is the only reliable wait condition.
 */
export async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
}

/**
 * 'use client' forms (react-hook-form, Controller, etc.) attach their
 * handlers asynchronously during hydration. Filling a field right after
 * navigation can race hydration — the DOM value gets set, then wiped when
 * hydration settles and React's own (empty) state takes over. Rather than
 * guessing how long hydration takes, this retries fill+verify until the
 * value actually sticks.
 */
export async function fillStable(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill(value)
    await expect(locator).toHaveValue(value)
  }).toPass({ timeout: 10_000 })
}

/**
 * fillStable only proves a field's value at the instant it's checked — on a
 * multi-field form, an earlier field can still get silently reset by a LATER
 * hydration reconciliation that happens after its own check passed but before
 * the form is submitted (the whole tree hydrates together, not field-by-
 * field, so the wipe can land after we've already moved on). Filling every
 * field and then verifying all of them together in the same retry attempt
 * means any drift on any field re-fills the whole set, so submission only
 * ever proceeds once every field is simultaneously correct.
 */
export async function fillAllStable(fields: { locator: Locator; value: string }[]): Promise<void> {
  await expect(async () => {
    for (const { locator, value } of fields) {
      await locator.fill(value)
    }
    for (const { locator, value } of fields) {
      await expect(locator).toHaveValue(value)
    }
  }).toPass({ timeout: 10_000 })
}

/**
 * Same hydration race as fillStable, but for buttons whose onClick opens
 * something (a modal, a navigation) rather than setting a form value: the DOM
 * node is clickable before React has attached its handler, so an early click
 * can silently no-op. Retries the click until `expected` actually shows up.
 */
export async function clickStable(
  locator: Locator,
  expected: Locator,
  opts: { timeout?: number } = {}
): Promise<void> {
  await expect(async () => {
    await locator.click()
    await expect(expected).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: opts.timeout ?? 10_000 })
}

/**
 * react-phone-number-input reformats whatever's typed into a spaced display
 * string (e.g. "9171234567" becomes "+63 917 123 4567"), so fillStable's
 * exact-value check can never pass against it. Verifies by digits only —
 * and by non-emptiness surviving the same hydration-wipe race fillStable's
 * own docstring describes, not exact formatting, since no test in this
 * suite asserts a specific phone value back out of this component.
 */
export async function fillPhoneStable(locator: Locator, digits: string): Promise<void> {
  await expect(async () => {
    await locator.fill(digits)
    const value = await locator.inputValue()
    expect(value.replace(/\D/g, '')).toContain(digits.replace(/\D/g, ''))
  }).toPass({ timeout: 10_000 })
}

/**
 * Logs in as an arbitrary seeded user (prisma/seed.ts) rather than the shared
 * Business Owner session every other spec inherits from playwright.config.ts's
 * storageState — use this for specs that need to exercise a specific role's
 * permissions. Callers must opt out of the default storageState first via
 * `test.use({ storageState: { cookies: [], origins: [] } })`, otherwise the
 * page is already authenticated as Business Owner before this ever runs.
 * Same dev-only DEV_API_KEY bypass documented in auth.setup.ts.
 */
/**
 * Tops up an item's on-hand stock at a branch via a direct stock-adjustment
 * API call — the same POST /inventory/adjustments the Inventory > Stock
 * Counts "Create Adjustment" UI uses, just skipping the UI itself. Use this
 * when a spec's success depends on a specific item genuinely being in stock
 * at a specific branch (e.g. Aircool's Start Install, which issues materials
 * out of stock for real) rather than on this shared, long-lived dev
 * database's ambient — and steadily depleted by other specs' own fixtures —
 * stock level for whatever item/branch combination the test happens to pick.
 * expectedQty is always sent as 0 — the backend only applies the
 * actualQty-expectedQty delta, so this always adds `quantity` on top of
 * whatever is currently on hand, regardless of what that is.
 */
export async function ensureItemStock(
  page: Page,
  opts: { branchName: string; itemQuery: string; quantity: number }
): Promise<void> {
  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branch = branches.find((b) => b.name === opts.branchName)
  if (!branch) throw new Error(`ensureItemStock: branch "${opts.branchName}" not found`)

  const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
  const warehouses = ((await warehousesRes.json()).data ?? []) as {
    id: string
    branchId: string | null
  }[]
  const warehouse = warehouses.find((w) => w.branchId === branch.id)
  if (!warehouse)
    throw new Error(`ensureItemStock: no warehouse found for branch "${opts.branchName}"`)

  const itemsRes = await page.request.get(
    `/api/inventory/items?search=${encodeURIComponent(opts.itemQuery)}&limit=5`
  )
  const items = ((await itemsRes.json()).data ?? []) as { id: string; name: string }[]
  const item = items.find((i) => i.name.includes(opts.itemQuery))
  if (!item) throw new Error(`ensureItemStock: item matching "${opts.itemQuery}" not found`)

  const adjustRes = await page.request.post('/api/inventory/adjustments', {
    data: {
      warehouseId: warehouse.id,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'found',
      notes: 'E2E fixture stock top-up',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: opts.quantity }],
    },
  })
  if (!adjustRes.ok()) {
    throw new Error(
      `ensureItemStock: adjustment failed (${adjustRes.status()}): ${await adjustRes.text()}`
    )
  }

  // Scenario 19 Part 2: an adjustment no longer posts to stock on creation —
  // it sits 'submitted' until it clears confirm -> investigate -> approve.
  // This helper needs the stock to actually land, so it drives the chain
  // itself using the same session (Business Owner storageState bypasses
  // every step's permission check, same as a real approver would need to
  // pass through, just without the wait).
  const { id: adjustmentId } = await adjustRes.json()
  for (const step of ['confirm', 'investigate', 'approve']) {
    const stepRes = await page.request.patch(`/api/inventory/adjustments/${adjustmentId}/${step}`)
    if (!stepRes.ok()) {
      throw new Error(
        `ensureItemStock: ${step} failed (${stepRes.status()}): ${await stepRes.text()}`
      )
    }
  }
}

/**
 * Deletes CRM customers by id, ignoring individual failures — one already-
 * deleted or unreachable id shouldn't stop the rest of a cleanup batch from
 * running. Use in `test.afterEach` for whatever a test created, so cleanup
 * runs regardless of where in the test body an assertion failed (the
 * previous pattern — cleanup as the literal last lines of the test body —
 * only ran on a clean pass, which is how the shared dev DB accumulated
 * hundreds of orphaned test customers; see fix/e2e-test-pollution).
 */
export async function deleteCustomers(request: APIRequestContext, ids: string[]): Promise<void> {
  for (const id of ids) {
    await request.delete(`/api/crm/customers/${id}`).catch(() => {})
  }
}

/**
 * Deletes any CRM customer whose name starts with `namePrefix` — a self-heal
 * sweep run in `test.beforeAll` so a prior run that never reached its own
 * cleanup (a hard crash, or an interruption Playwright's own retry/afterEach
 * couldn't cover) doesn't leave orphans that compound across every run after
 * it. `DELETE /crm/customers/:id` is a soft delete already excluded from
 * `findAll` by default, so sweeping on every run is safe/idempotent.
 */
export async function sweepE2ECustomers(
  request: APIRequestContext,
  namePrefix: string
): Promise<void> {
  const res = await request.get(
    `/api/crm/customers?search=${encodeURIComponent(namePrefix)}&limit=100`
  )
  if (!res.ok()) return
  const body = await res.json()
  const matches = ((body.data ?? []) as { id: string; name: string }[]).filter((c) =>
    c.name?.startsWith(namePrefix)
  )
  await deleteCustomers(
    request,
    matches.map((c) => c.id)
  )
}

/**
 * Finds the id of a just-created Service Draft by its exact title. Draft
 * creation goes through a Next.js Server Action ('use server'), which never
 * shows up as a client-visible network request — so unlike CRM customer
 * creation (a plain client-side POST `page.waitForResponse` can intercept),
 * the id has to be looked up after the fact instead.
 */
export async function findServiceDraftIdByTitle(
  request: APIRequestContext,
  title: string
): Promise<string> {
  const res = await request.get('/api/pos/service-drafts?limit=20')
  const body = await res.json()
  const match = ((body.data ?? []) as { id: string; title: string }[]).find(
    (d) => d.title === title
  )
  if (!match) throw new Error(`findServiceDraftIdByTitle: no draft found with title "${title}"`)
  return match.id
}

const TERMINAL_SERVICE_DRAFT_STATUSES = ['completed', 'cancelled']

/**
 * Best-effort: cancels a POS Service Draft if it's still in a cancellable
 * state (draft/sourcing/installing). Deliberately does NOT try to unwind a
 * draft a test successfully drove to 'completed' — that's a real record
 * with real stock-deduction side effects, same as any genuinely completed
 * job, not something to clean up after. Ignores the 400 the backend
 * returns for an already-completed/cancelled draft.
 */
export async function cancelServiceDraft(request: APIRequestContext, id: string): Promise<void> {
  await request.post(`/api/pos/service-drafts/${id}/cancel`).catch(() => {})
}

/**
 * Self-heal sweep: cancels any leftover, still-cancellable Service Draft
 * whose title starts with `titlePrefix` — same rationale as
 * sweepE2ECustomers, for a prior run of these specs that got interrupted
 * before reaching its own cleanup. No `search` filter exists on this
 * endpoint's DTO, so this fetches a page of drafts and filters client-side.
 */
export async function sweepE2EServiceDrafts(
  request: APIRequestContext,
  titlePrefix: string
): Promise<void> {
  const res = await request.get('/api/pos/service-drafts?limit=100')
  if (!res.ok()) return
  const body = await res.json()
  const matches = ((body.data ?? []) as { id: string; title: string; status: string }[]).filter(
    (d) => d.title?.startsWith(titlePrefix) && !TERMINAL_SERVICE_DRAFT_STATUSES.includes(d.status)
  )
  for (const d of matches) {
    await cancelServiceDraft(request, d.id)
  }
}

/**
 * Finds the id of a just-created Stock Transfer by its exact reason text.
 * Creation goes through a Next.js Server Action ('use server') — see
 * findServiceDraftIdByTitle's docstring for why that rules out intercepting
 * the creation request itself.
 */
export async function findStockTransferIdByReason(
  request: APIRequestContext,
  reason: string
): Promise<string> {
  const res = await request.get('/api/inventory/transfers?limit=20')
  const body = await res.json()
  const match = ((body.data ?? []) as { id: string; reason: string | null }[]).find(
    (t) => t.reason === reason
  )
  if (!match)
    throw new Error(`findStockTransferIdByReason: no transfer found with reason "${reason}"`)
  return match.id
}

const CANCELLABLE_TRANSFER_STATUSES = ['requested', 'pending_hq_approval', 'draft']

/**
 * Best-effort: cancels a Stock Transfer request if it's still in a
 * cancellable state (requested/pending_hq_approval/draft). A transfer a
 * test drove all the way to accepted/in_transit/received, or to rejected,
 * is either a real completed movement (received moves real destination
 * stock) or already terminal — neither is something to unwind here, and the
 * backend has no action that would anyway. Ignores the 400 the backend
 * returns for a non-cancellable transfer.
 */
export async function cancelStockTransfer(request: APIRequestContext, id: string): Promise<void> {
  await request.patch(`/api/inventory/transfers/${id}/cancel`).catch(() => {})
}

/**
 * Self-heal sweep: cancels any leftover, still-cancellable Stock Transfer
 * whose reason starts with `reasonPrefix` — same rationale as
 * sweepE2ECustomers. No `search`/reason filter exists on this endpoint's
 * DTO, so this fetches a page of transfers and filters client-side.
 */
export async function sweepE2EStockTransfers(
  request: APIRequestContext,
  reasonPrefix: string
): Promise<void> {
  const res = await request.get('/api/inventory/transfers?limit=100')
  if (!res.ok()) return
  const body = await res.json()
  const matches = (
    (body.data ?? []) as { id: string; reason: string | null; status: string }[]
  ).filter(
    (t) => t.reason?.startsWith(reasonPrefix) && CANCELLABLE_TRANSFER_STATUSES.includes(t.status)
  )
  for (const t of matches) {
    await cancelStockTransfer(request, t.id)
  }
}

/**
 * Finds the id of a just-created/updated Price List by its exact name.
 * Creation/update go through a Next.js Server Action ('use server') — see
 * findServiceDraftIdByTitle's docstring for why that rules out intercepting
 * the request itself.
 */
export async function findPriceListIdByName(
  request: APIRequestContext,
  name: string
): Promise<string> {
  const res = await request.get(`/api/inventory/price-lists?search=${encodeURIComponent(name)}`)
  const body = await res.json()
  const list = (Array.isArray(body) ? body : []) as { id: string; name: string }[]
  const match = list.find((p) => p.name === name)
  if (!match) throw new Error(`findPriceListIdByName: no price list found with name "${name}"`)
  return match.id
}

/**
 * Self-heal sweep: deactivates any leftover Price List whose name starts
 * with `namePrefix` — same rationale as sweepE2ECustomers, for a prior run
 * of these specs that got interrupted before reaching its own cleanup.
 * There's no hard-delete endpoint for price lists (DELETE only deactivates),
 * so this is the closest to a real cleanup this entity supports.
 */
export async function sweepE2EPriceLists(
  request: APIRequestContext,
  namePrefix: string
): Promise<void> {
  const res = await request.get(
    `/api/inventory/price-lists?search=${encodeURIComponent(namePrefix)}`
  )
  if (!res.ok()) return
  const body = await res.json()
  const list = (Array.isArray(body) ? body : []) as { id: string; name: string }[]
  const matches = list.filter((p) => p.name?.startsWith(namePrefix))
  for (const p of matches) {
    await request.delete(`/api/inventory/price-lists/${p.id}`).catch(() => {})
  }
}

/**
 * Self-heal sweep: hard-deletes any leftover PriceUseType whose name starts
 * with `namePrefix` — same rationale as sweepE2EPriceLists. Unlike price
 * lists, DELETE here is a real delete (no soft-deactivate), so this is a
 * genuine cleanup, not just a status change.
 */
export async function sweepE2EPriceUseTypes(
  request: APIRequestContext,
  namePrefix: string
): Promise<void> {
  const res = await request.get('/api/inventory/price-use-types')
  if (!res.ok()) return
  const body = await res.json()
  const list = (Array.isArray(body) ? body : []) as { id: string; name: string }[]
  const matches = list.filter((t) => t.name?.startsWith(namePrefix))
  for (const t of matches) {
    await request.delete(`/api/inventory/price-use-types/${t.id}`).catch(() => {})
  }
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await gotoReady(page, '/login')
  // Re-fills on every retry, not just once up front: a hydration reconciliation
  // can silently wipe fields *after* fillAllStable's own verification passes
  // but *before* the click lands (same race fillAllStable's own docstring
  // describes) — retrying fill+click together is the only way to close it.
  //
  // The success check must not false-positive on /login?email=...&password=...
  // — if the login form's React submit handler hasn't (re)attached yet when
  // the click fires (e.g. right after a mid-test clearCookies() invalidates
  // the SPA's auth context), the browser falls back to native HTML form
  // submission (default GET), landing back on /login with the credentials
  // leaked into the query string. A plain `not.toHaveURL('/login')` treats
  // that as a successful navigation away from the login page (the string
  // isn't an exact match), when the login API was never actually called —
  // every action after this silently runs unauthenticated. Matching against
  // a regex that also catches the query-string-suffixed form closes that.
  await expect(async () => {
    await fillAllStable([
      { locator: page.locator('#email'), value: email },
      { locator: page.locator('#password'), value: password },
    ])
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}
