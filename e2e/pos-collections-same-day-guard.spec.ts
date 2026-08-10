import { test, expect, type APIResponse } from '@playwright/test'
import { deleteCustomers, fillStable, gotoReady, sweepE2ECustomers } from './utils'

const NAME_PREFIX = 'E2E CollectionsGuard '

// Backend list endpoints aren't consistent about pagination envelopes — some
// return { data: [...] }, others a raw array. Handle both rather than
// guessing per-endpoint.
async function unwrap<T>(res: APIResponse): Promise<T[]> {
  const body = await res.json()
  return Array.isArray(body) ? body : (body.data ?? [])
}

// POS Collections — same-calendar-day duplicate payment guard. Covers the UX
// added on top of the backend guard (ar-invoices.service.ts's recordPayment):
// a due already paid today shows a non-clickable "Collected today" badge
// instead of "Collect", while a *different* due for the same customer stays
// collectable the same day (the guard is per-due, not per-customer).
test.describe('POS Collections — same-day duplicate payment guard', () => {
  let customerId: string
  let sessionId: string | undefined

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)

    const branches = await unwrap<{ id: string; name: string }>(
      await request.get('/api/branches?limit=200')
    )
    const branch = branches.find((b) => b.name === 'Bago') ?? branches[0]

    const terminals = await unwrap<{ id: string; branchId: string | null }>(
      await request.get('/api/pos/terminals?limit=200')
    )
    const terminal = terminals.find((t) => t.branchId === branch.id)
    if (!terminal) throw new Error(`No terminal found for branch ${branch.name}`)

    // Close any session already open on this terminal so opening a fresh one
    // doesn't 409 against a prior interrupted run.
    const openSessions = await unwrap<{ id: string; terminalId: string }>(
      await request.get('/api/pos/sessions?status=open&limit=50')
    )
    for (const s of openSessions.filter((s) => s.terminalId === terminal.id)) {
      await request
        .post(`/api/pos/sessions/${s.id}/close`, {
          data: { declaredClosingCash: 0 },
        })
        .catch(() => {})
    }

    const sessionRes = await request.post('/api/pos/sessions/open', {
      data: { terminalId: terminal.id, openingCash: 1000 },
    })
    if (!sessionRes.ok()) throw new Error(`Failed to open session: ${await sessionRes.text()}`)
    sessionId = (await sessionRes.json()).id

    const terms = await unwrap<{ id: string; termMonths: number }>(
      await request.get('/api/pos/financing-terms?limit=50')
    )
    const shortestTerm = [...terms].sort((a, b) => a.termMonths - b.termMonths)[0]
    if (!shortestTerm) throw new Error('No financing terms seeded')

    const items = await unwrap<{
      id: string
      name: string
      sellingPrice: number | null
      isSerialTracked: boolean
    }>(await request.get('/api/inventory/items?limit=200'))
    const item = items.find((i) => Number(i.sellingPrice) > 0 && !i.isSerialTracked)
    if (!item) throw new Error('No sellable, non-serial-tracked item found')

    const customerRes = await request.post('/api/crm/customers', {
      data: {
        name: `${NAME_PREFIX}${Date.now()}`,
        sourceChannel: 'pos_walkin',
        phone: `09${Date.now().toString().slice(-9)}`,
      },
    })
    const customer = await customerRes.json()
    customerId = customer.id

    const saleRes = await request.post('/api/pos/transactions', {
      data: {
        sessionId,
        customerId,
        invoiceType: 'installment',
        financingTermId: shortestTerm.id,
        // Scenario 01 Gap 4 — installment sales require a down payment of
        // at least 10% of the line's sale amount.
        downPayment: Math.round(Number(item.sellingPrice) * 0.1 * 100) / 100,
        subtotal: item.sellingPrice,
        totalAmount: item.sellingPrice,
        currency: 'PHP',
        lines: [
          { itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice },
        ],
      },
    })
    if (!saleRes.ok()) throw new Error(`Failed to submit installment sale: ${await saleRes.text()}`)
    // Default storageState is Business Owner, who holds pos:transaction:override
    // and self-approves — the sale posts directly with no pending release-form
    // detour, so there's no separate approval step to drive here.
  })

  test.afterAll(async ({ request }) => {
    if (customerId) await deleteCustomers(request, [customerId])
    if (sessionId) {
      await request
        .post(`/api/pos/sessions/${sessionId}/close`, { data: { declaredClosingCash: 0 } })
        .catch(() => {})
    }
  })

  test('collecting a due shows "Collected today" and blocks re-collecting it, but a different due stays collectable', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/collections')

    const searchInput = page.getByPlaceholder('Filter by name or phone…')
    await fillStable(searchInput, NAME_PREFIX)
    const customerRow = page.locator('ul > li > button').filter({ hasText: NAME_PREFIX })
    await expect(customerRow).toBeVisible({ timeout: 10_000 })
    await customerRow.click()

    const due1 = page.locator('li').filter({ hasText: 'Payment 1 of' })
    const due2 = page.locator('li').filter({ hasText: 'Payment 2 of' })
    await expect(due1).toBeVisible({ timeout: 10_000 })

    // Collect a *partial* amount on due #1 — paying it in full would move it
    // to PAID, which shows a different, permanent "Paid" indicator (see the
    // fully-paid test below) rather than "Collected today". A partial
    // payment is what actually isolates the same-day guard's own badge.
    await due1.getByRole('button', { name: 'Collect' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
    await fillStable(page.locator('input[type="number"]').first(), '1')
    await page.getByRole('button', { name: 'Collect payment' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
      timeout: 10_000,
    })

    // Due #1 now shows the non-clickable "Collected today" indicator, not
    // a "Collect" button — this is the proactive warning, not a submit-time
    // error.
    await expect(due1.getByText('Collected today')).toBeVisible({ timeout: 10_000 })
    await expect(due1.getByRole('button', { name: 'Collect' })).not.toBeVisible()

    // A *different* due for the same customer, same day, is unaffected —
    // the guard is per-due, not per-customer.
    await due2.getByRole('button', { name: 'Collect' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
    await expect(
      page.getByText('A payment was already collected for this due today')
    ).not.toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  // Uses due #3, untouched by the test above, so the two tests don't share
  // mutated state despite sharing the same beforeAll-created fixture.
  test('backdating a payment is flagged, and re-picking that same backdated date on the same due is blocked', async ({
    page,
  }) => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    await gotoReady(page, '/pos/collections')
    const searchInput = page.getByPlaceholder('Filter by name or phone…')
    await fillStable(searchInput, NAME_PREFIX)
    const customerRow = page.locator('ul > li > button').filter({ hasText: NAME_PREFIX })
    await expect(customerRow).toBeVisible({ timeout: 10_000 })
    await customerRow.click()

    const due3 = page.locator('li').filter({ hasText: 'Payment 3 of' })
    await expect(due3).toBeVisible({ timeout: 10_000 })

    // Collect a *partial* amount, backdated to yesterday — flagged, not
    // blocked. Partial (not the full prefilled outstanding) so the due stays
    // collectable afterward instead of moving to PAID, which would remove
    // the "Collect" button entirely (see the fully-paid test below) and make
    // the reopen step further down unreachable.
    await due3.getByRole('button', { name: 'Collect' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
    await fillStable(page.locator('input[type="date"]'), yesterday)
    await fillStable(page.locator('input[type="number"]').first(), '1')
    await expect(page.getByText('not today — make sure that').first()).toBeVisible()
    await page.getByRole('button', { name: 'Collect payment' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
      timeout: 10_000,
    })

    // Wait for the post-collect refetch to actually land before reopening —
    // otherwise the modal's `line` prop is still the pre-payment snapshot,
    // and the date-aware guard below would see no payment yet (a real race
    // this test hit before this wait was added). PARTIAL, not "Collected
    // today" or "Paid" — it wasn't collected today, and it isn't fully paid.
    await expect(due3.getByText('Partially Paid')).toBeVisible({ timeout: 10_000 })
    await expect(due3.getByText('Collected today')).not.toBeVisible()
    await expect(due3.getByRole('button', { name: 'Collect' })).toBeVisible()

    // Reopening and picking that exact same backdated date again is blocked
    // — the guard is date-aware, not hardcoded to literal "today".
    await due3.getByRole('button', { name: 'Collect' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
    await fillStable(page.locator('input[type="date"]'), yesterday)
    await expect(page.getByText('A payment was already collected for this due on')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Collect payment' })).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  // Uses due #2 — test 1 opened its modal to check the per-due-scope
  // assertion but cancelled without submitting, so it's still untouched.
  test('paying a due in full removes "Collect" entirely, replacing it with a permanent "Paid" indicator', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/collections')
    const searchInput = page.getByPlaceholder('Filter by name or phone…')
    await fillStable(searchInput, NAME_PREFIX)
    const customerRow = page.locator('ul > li > button').filter({ hasText: NAME_PREFIX })
    await expect(customerRow).toBeVisible({ timeout: 10_000 })
    await customerRow.click()

    const due2 = page.locator('li').filter({ hasText: 'Payment 2 of' })
    await expect(due2).toBeVisible({ timeout: 10_000 })

    // Collect due #2 in full — the default prefilled amount already equals
    // the full outstanding balance, so submitting as-is pays it off.
    await due2.getByRole('button', { name: 'Collect' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
    await page.getByRole('button', { name: 'Collect payment' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
      timeout: 10_000,
    })

    // The permanent "Paid" indicator (distinct from the status badge, which
    // also reads "Paid" — matched by its tooltip to avoid ambiguity) takes
    // over from "Collect" entirely — not "Collected today" (that badge is
    // only for a still-open due), and no way left to reach the modal again
    // through this screen at all.
    await expect(due2.getByTitle('This due is already fully paid')).toBeVisible({
      timeout: 10_000,
    })
    await expect(due2.getByText('Collected today')).not.toBeVisible()
    await expect(due2.getByRole('button', { name: 'Collect' })).not.toBeVisible()
  })
})
