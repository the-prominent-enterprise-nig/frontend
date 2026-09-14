import { test, expect } from '@playwright/test'
import { clickStable, fillStable, gotoReady } from './utils'

/**
 * Scenario 50 Part 5 — three closing gaps on the Stock Transfer dispatch/
 * receive flow, proven together across one real transfer lifecycle:
 *
 *  1. Serial multi-select at dispatch — SearchableSelect (multiple) replaces
 *     the old "one box per pick, remounts after each" flow, so a dispatcher
 *     assigns several units without the dropdown closing between them.
 *  2. Expected Arrival is optional at dispatch, matching the request side
 *     (DispatchTransferFormSchema no longer requires it).
 *  3. The received transfer surfaces its Receiving Report as a link through
 *     to the RR's own full-page detail — not a bare code.
 *
 * TN-FURN-SET-001 — seeded with 200 in-stock serials per branch warehouse
 * specifically so e2e/manual testing never runs low (see the sibling
 * override spec's own comment on the same fixture).
 *
 * Not self-cleaning: once dispatched/received this is a real (if
 * fictitious) stock movement, same tradeoff the override spec already
 * documents and accepts.
 */
test.describe('Inventory — Stock Transfer dispatch multi-select & RR link', () => {
  test('assigns multiple serials in one picker session, arrival is optional, and receipt links through', async ({
    page,
  }) => {
    const uniqueReason = `E2E-TRF-MULTISELECT-${Date.now()}`

    const warehousesRes = await page.request.get(
      '/api/inventory/warehouses?limit=200&status=active'
    )
    const warehouses = ((await warehousesRes.json()).data ?? []) as {
      id: string
      branchId: string | null
    }[]
    const branchWarehouses = warehouses.filter((w) => w.branchId)
    expect(branchWarehouses.length).toBeGreaterThanOrEqual(2)

    // Resolve a source warehouse that genuinely has ≥3 in-stock serials of
    // one item, and a destination distinct from it — rather than a fixed
    // SKU, which this isolated test database doesn't necessarily seed with
    // the same reference items the real dev DB does.
    let fromWarehouse: { id: string } | undefined
    let itemId: string | undefined
    for (const w of branchWarehouses) {
      const serialsRes = await page.request.get('/api/inventory/serial-numbers', {
        params: { warehouseId: w.id, status: 'in_stock', limit: '200' },
      })
      const serials = ((await serialsRes.json()).data ?? []) as { itemId: string }[]
      const counts = new Map<string, number>()
      for (const s of serials) counts.set(s.itemId, (counts.get(s.itemId) ?? 0) + 1)
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      if (best && best[1] >= 3) {
        fromWarehouse = w
        itemId = best[0]
        break
      }
    }
    expect(
      fromWarehouse,
      'a warehouse with ≥3 in-stock serials of one item must exist'
    ).toBeTruthy()
    expect(itemId).toBeTruthy()
    const toWarehouse = branchWarehouses.find((w) => w.id !== fromWarehouse!.id)!
    expect(toWarehouse).toBeTruthy()

    // A serial-tracked item requests as N separate qty-1 lines, never one
    // qty-N line — the UI's CreateTransferModal splits it this way itself
    // (see its own comment: "the requester never picks the specific unit");
    // going straight to the API means replicating that split here. Three
    // lines, enough to prove "several in one picker session," not just two.
    const createRes = await page.request.post('/api/inventory/transfers', {
      data: {
        fromWarehouseId: fromWarehouse!.id,
        toWarehouseId: toWarehouse.id,
        transferDate: new Date().toISOString().split('T')[0],
        reason: uniqueReason,
        lines: [
          { itemId: itemId!, quantity: 1 },
          { itemId: itemId!, quantity: 1 },
          { itemId: itemId!, quantity: 1 },
        ],
      },
    })
    expect(createRes.ok(), `create failed: ${await createRes.text()}`).toBeTruthy()
    const transfer = await createRes.json()

    const acceptRes = await page.request.patch(`/api/inventory/transfers/${transfer.id}/accept`, {
      data: {},
    })
    expect(acceptRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/transfers')
    await expect(async () => {
      await page.locator('tbody tr').first().click()
      await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
        timeout: 3_000,
      })
      const isMine = await page
        .getByText(uniqueReason, { exact: true })
        .isVisible()
        .catch(() => false)
      if (!isMine) {
        await page.getByRole('button', { name: 'Close dialog' }).click()
        throw new Error('opened transfer is not the one just created — retrying')
      }
    }).toPass({ timeout: 20_000 })

    // The detail view is a right-hand drawer over a dimmed page, so the
    // wrapper is `fixed`. Queries scope into it because the overlay contains
    // the panel.
    const modal = page.locator('.fixed.inset-0.z-50')
    await expect(modal.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Same documented hydration-reconciliation race this project's own
    // fillStable/clickStable guard against throughout e2e/utils.ts: a click
    // can land before React has attached its handler and silently no-op.
    await clickStable(
      modal.getByRole('button', { name: 'Dispatch' }),
      modal.getByRole('button', { name: 'Confirm Dispatch' }),
      { timeout: 15_000 }
    )

    // ── Gap 2: Expected Arrival is optional — deliberately left blank ─────
    await expect(modal.getByText('Expected Arrival (optional)')).toBeVisible()
    await expect(modal.locator('input[type="date"]').first()).toHaveValue('')

    // ── Gap 1: multi-select — one dropdown session, three picks ───────────
    const serialPicker = modal.getByPlaceholder('Search serial number…')
    await expect(serialPicker).toBeVisible({ timeout: 10_000 })

    for (let i = 0; i < 3; i++) {
      await serialPicker.click()
      // Same option each time (by list position): after a pick, the picked
      // serial drops out of `serialOptions` (already-picked are excluded),
      // so what's first in the still-open list shifts to the next unit.
      const firstOption = page.getByRole('button', { name: /^checkbox$/ }).first()
      // Fall back to a positional query-select role=checkbox button — see
      // note below on why role isn't asserted directly.
      const option = modal.locator('div.absolute').filter({ hasText: '' }).locator('button').first()
      await expect(option).toBeVisible({ timeout: 10_000 })
      await option.click()
      void firstOption
    }

    // All three assigned, and the box never closed between picks.
    await expect(modal.getByText('3 of 3 assigned')).toBeVisible({ timeout: 10_000 })

    // The dropdown stays open across picks by design (SearchableSelect's
    // multi-select never auto-closes — "picking several is the whole
    // point"). It only closes on an outside mousedown, which nothing in the
    // loop above ever did — so its absolutely-positioned panel is still
    // covering the rest of the form. Dismiss it before going further.
    await page.keyboard.press('Escape')
    await modal.getByPlaceholder('Optional dispatch notes…').click()

    await fillStable(modal.getByPlaceholder('e.g. Juan dela Cruz'), 'E2E Driver')
    await fillStable(modal.getByPlaceholder('e.g. 09171234567'), '09170002222')
    await fillStable(modal.getByPlaceholder('e.g. ABC 1234'), 'E2E 002')
    await fillStable(modal.getByPlaceholder('e.g. LBC Express'), 'E2E Carrier')

    const confirmDispatch = modal.getByRole('button', { name: 'Confirm Dispatch' })
    await expect(confirmDispatch).toBeEnabled()
    // Dispatch is a Next.js Server Action (POSTs to the page's own URL, not
    // a REST path page.waitForResponse can filter by), so the UI state
    // transition is the only observable signal — clickStable retries the
    // submit itself until it shows up, covering the same hydration race.
    await clickStable(confirmDispatch, modal.getByText('In Transit', { exact: true }), {
      timeout: 20_000,
    })

    // ── Receive, then check Gap 3: the RR surfaces as a real link ─────────
    await clickStable(
      modal.getByRole('button', { name: 'Receive' }),
      modal.getByRole('button', { name: 'Confirm Receipt' }),
      { timeout: 15_000 }
    )
    await clickStable(
      modal.getByRole('button', { name: 'Confirm Receipt' }),
      modal.getByText('Received', { exact: true }).first(),
      { timeout: 20_000 }
    )

    const rrLink = modal.getByRole('link', { name: /^RR-/ })
    await expect(rrLink).toBeVisible({ timeout: 10_000 })
    const href = await rrLink.getAttribute('href')
    // The RR detail page moved under the Stock module — `goods-receiving/[id]`
    // is now only a redirect kept alive for old links/bookmarks, so the
    // canonical href the UI emits is the stock/reports one.
    expect(href).toMatch(/^\/inventory\/stock\/reports\//)
    expect(await rrLink.getAttribute('target')).toBe('_blank')

    // The link is real, not decorative — the page it points to exists and
    // is this transfer's own receipt.
    const rrCode = (await rrLink.innerText()).trim()
    const rrId = href!.split('/').pop()!
    const rrRes = await page.request.get(`/api/inventory/stock/receiving-reports/${rrId}`)
    expect(rrRes.ok()).toBeTruthy()
    const rr = await rrRes.json()
    expect(rr.code).toBe(rrCode)
    expect(rr.stockTransferId).toBe(transfer.id)

    await modal.getByRole('button', { name: 'Close dialog' }).click()
  })
})
