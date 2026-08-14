import { test, expect } from '@playwright/test'
import {
  clickStable,
  ensureWarehouseStock,
  findWarehouseRequestIdByNotes,
  gotoReady,
  sweepE2EWarehouseRequests,
} from './utils'

// Scenario 27, Part 4b/4c/5b/5c — the /inventory/warehouse-requests page: one
// collapsed create flow (no more separate "New Request"/"New Delivery"
// buttons — Part 5b removed the direction toggle, the server now derives
// pull vs. push from who's creating it and which branch it's for), list,
// a real per-line receive checklist (Part 5c — "Receive" opens it, defaults
// every line to arrived, uncheck anything missing before "Confirm Receipt"),
// cancel (4b), and warehouse-side accept/reject/dispatch (4c).
//
// Runs entirely as Business Owner (unrestricted, branchId null), matching
// this project's convention for these specs — see
// stock-transfer-accept-reject.spec.ts's own header comment. One real
// consequence of Part 5b's server-side derivation: a branchless caller can
// never self-approve (isPush requires a real actorBranchId whose region
// matches the warehouse), so every request Business Owner creates here
// starts at 'requested' — there's no UI path left to reach the self-
// approved 'ready' starting state from this login alone. That specific
// derivation (a same-region Stock Controller creating for a DIFFERENT
// branch than their own) is already covered by the backend's own e2e suite
// (inventory-warehouse-requests.e2e-spec.ts); this spec is UI coverage, not
// a re-test of that logic.
//
// Multi-serial-select "Add Item" coverage (Part 5b's actual new UI, for a
// serial-tracked item) is NOT included here — it needs a dedicated
// registered-serial fixture the way the backend spec builds one, which is a
// bigger lift than this pass covers. The item used below
// ("Universal Remote Control") is not serial-tracked, so it exercises the
// simpler manual-quantity "Add Item" path instead. Flagged as a real
// coverage gap, not silently skipped.

const NOTES_PREFIX = 'E2E-WHREQ-'

function detailModal(page: import('@playwright/test').Page) {
  return page.locator('.fixed.inset-0.z-50')
}

async function createWarehouseMovement(page: import('@playwright/test').Page, uniqueNotes: string) {
  await gotoReady(page, '/inventory/warehouse-requests')
  await clickStable(
    page.getByRole('button', { name: 'New Request' }),
    page.getByRole('heading', { name: 'Move Stock' })
  )

  const modalForm = page.locator('form')
  // Business Owner has no branch — both pickers are always visible now
  // (Part 5b collapsed the old conditional branch picker), Branch first,
  // then Warehouse. Bago/Negros Warehouse pairing matches
  // ensureWarehouseStock's own fixture setup below.
  await modalForm.locator('select').nth(0).selectOption({ label: 'Bago' })
  await modalForm.locator('select').nth(1).selectOption({ label: 'Negros Warehouse' })

  await modalForm.getByPlaceholder('e.g. Running low ahead of the weekend rush').fill(uniqueNotes)

  // The item picker is already open by default (no "Add Item" click needed)
  // once a warehouse is selected — it shows a "pick a warehouse first"
  // placeholder until then.
  const itemInput = page.getByPlaceholder('Search item')
  await expect(itemInput).toBeVisible({ timeout: 5_000 })
  await itemInput.click()
  await itemInput.fill('Universal Remote Control')
  const option = page.getByRole('button', { name: /Universal Remote Control/ }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()

  // Not serial-tracked — the manual quantity + "Add" path, not the
  // multi-serial picker.
  await clickStable(
    modalForm.getByRole('button', { name: 'Add', exact: true }),
    page.getByText('— 1 unit', { exact: false })
  )

  await expect(async () => {
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Move Stock' })).toHaveCount(0, {
      timeout: 3_000,
    })
  }).toPass({ timeout: 15_000 })

  return findWarehouseRequestIdByNotes(page.request, uniqueNotes)
}

async function openMine(page: import('@playwright/test').Page, uniqueNotes: string) {
  await expect(async () => {
    await page.locator('tbody tr').first().click()
    const modal = detailModal(page)
    await expect(modal.getByRole('button', { name: 'Close dialog' })).toBeVisible({
      timeout: 3_000,
    })
    const isMine = await modal
      .getByText(uniqueNotes, { exact: false })
      .isVisible()
      .catch(() => false)
    if (!isMine) {
      await modal.getByRole('button', { name: 'Close dialog' }).click()
      throw new Error('opened warehouse request is not the one just created — retrying')
    }
  }).toPass({ timeout: 20_000 })
}

test.describe('Inventory — Warehouse Requests (Scenario 27 Part 4b/4c/5b)', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request, browser }) => {
    await sweepE2EWarehouseRequests(request, NOTES_PREFIX)
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await ensureWarehouseStock(page, {
      warehouseCode: 'WH-NEGROS',
      itemQuery: 'Universal Remote Control',
      quantity: 50,
    })
    await context.close()
  })

  test.afterEach(async ({ request }) => {
    for (const id of createdIds)
      await request.patch(`/api/inventory/warehouse-requests/${id}/cancel`).catch(() => {})
    createdIds = []
  })

  test('creates a warehouse movement and it appears in the list', async ({ page }) => {
    const uniqueNotes = `${NOTES_PREFIX}CREATE-${Date.now()}`
    createdIds.push(await createWarehouseMovement(page, uniqueNotes))

    await gotoReady(page, '/inventory/warehouse-requests')
    await openMine(page, uniqueNotes)

    const modal = detailModal(page)
    // Business Owner is branchless — always lands on Requested (5b's
    // server-derived rule), never the self-approved Ready state.
    await expect(modal.getByText('Requested', { exact: true })).toBeVisible()
    await expect(modal.getByText('Negros Warehouse', { exact: true })).toBeVisible()
    await expect(modal.getByText('Bago', { exact: true })).toBeVisible()
  })

  test('cancels a requested warehouse request', async ({ page }) => {
    const uniqueNotes = `${NOTES_PREFIX}CANCEL-${Date.now()}`
    const id = await createWarehouseMovement(page, uniqueNotes)
    createdIds.push(id)

    await gotoReady(page, '/inventory/warehouse-requests')
    await openMine(page, uniqueNotes)
    const modal = detailModal(page)

    // Not clickStable — its hardcoded 1s-per-attempt window is fine for an
    // idempotent "open something" click, but too short for a real mutation
    // round-trip (network + invalidateQueries + refetch): a slow-but-in-
    // flight cancel would get misread as a hydration no-op and re-clicked,
    // firing a genuine second cancel attempt that 400s (already cancelled).
    // Same generous-per-attempt reasoning as crm-add-customer.spec.ts's own
    // "Create customer" submit.
    await expect(async () => {
      await modal.getByRole('button', { name: 'Cancel Request' }).click()
      await expect(modal.getByText('Cancelled', { exact: true })).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 20_000 })
    await expect(modal.getByRole('button', { name: 'Cancel Request' })).toHaveCount(0)
  })

  test('receives an in-transit warehouse request — full receipt (Part 5c checklist)', async ({
    page,
    request,
  }) => {
    const uniqueNotes = `${NOTES_PREFIX}RECEIVE-${Date.now()}`
    const id = await createWarehouseMovement(page, uniqueNotes)
    createdIds.push(id)

    // Advances via direct API rather than the accept/dispatch UI — that UI
    // gets its own dedicated coverage below; this test is specifically about
    // receive, so it just needs the record to already be in_transit.
    const acceptRes = await request.patch(`/api/inventory/warehouse-requests/${id}/accept`)
    expect(acceptRes.ok()).toBeTruthy()
    const dispatchRes = await request.patch(`/api/inventory/warehouse-requests/${id}/dispatch`)
    expect(dispatchRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/warehouse-requests')
    await openMine(page, uniqueNotes)
    const modal = detailModal(page)

    await expect(modal.getByText('In Transit', { exact: true })).toBeVisible()
    // "Receive" opens the checklist (Part 5c) — clickStable is fine here,
    // it's just opening a form, no mutation yet.
    await clickStable(
      modal.getByRole('button', { name: 'Receive', exact: true }),
      modal.getByText('Confirm what arrived')
    )
    // Every line defaults to checked (arrived) — confirming as-is is the
    // "everything showed up" happy path.
    await expect(async () => {
      await modal.getByRole('button', { name: 'Confirm Receipt' }).click()
      await expect(modal.getByText('Received', { exact: true })).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 20_000 })
  })

  test('flags a missing unit at receive and lands on Partially Received (Part 5c)', async ({
    page,
    request,
  }) => {
    const uniqueNotes = `${NOTES_PREFIX}PARTIAL-${Date.now()}`
    const id = await createWarehouseMovement(page, uniqueNotes)
    createdIds.push(id)

    const acceptRes = await request.patch(`/api/inventory/warehouse-requests/${id}/accept`)
    expect(acceptRes.ok()).toBeTruthy()
    const dispatchRes = await request.patch(`/api/inventory/warehouse-requests/${id}/dispatch`)
    expect(dispatchRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/warehouse-requests')
    await openMine(page, uniqueNotes)
    const modal = detailModal(page)

    await clickStable(
      modal.getByRole('button', { name: 'Receive', exact: true }),
      modal.getByText('Confirm what arrived')
    )
    // Uncheck the one line — nothing arrived on this request.
    await modal.getByText('Universal Remote Control').click()

    await expect(async () => {
      await modal.getByRole('button', { name: 'Confirm Receipt' }).click()
      await expect(modal.getByText('Partially Received', { exact: true })).toBeVisible({
        timeout: 8_000,
      })
    }).toPass({ timeout: 20_000 })
  })

  test('accepts and dispatches a requested warehouse request (Part 4c)', async ({ page }) => {
    const uniqueNotes = `${NOTES_PREFIX}ACCEPT-DISPATCH-${Date.now()}`
    const id = await createWarehouseMovement(page, uniqueNotes)
    createdIds.push(id)

    await gotoReady(page, '/inventory/warehouse-requests')
    await openMine(page, uniqueNotes)
    const modal = detailModal(page)

    await expect(modal.getByText('Requested', { exact: true })).toBeVisible()
    await expect(async () => {
      await modal.getByRole('button', { name: 'Accept' }).click()
      await expect(modal.getByText('Ready to Dispatch', { exact: true })).toBeVisible({
        timeout: 8_000,
      })
    }).toPass({ timeout: 20_000 })

    await expect(async () => {
      await modal.getByRole('button', { name: 'Dispatch' }).click()
      await expect(modal.getByText('In Transit', { exact: true })).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 20_000 })
  })

  test('rejects a requested warehouse request with a reason (Part 4c)', async ({ page }) => {
    const uniqueNotes = `${NOTES_PREFIX}REJECT-${Date.now()}`
    const id = await createWarehouseMovement(page, uniqueNotes)
    createdIds.push(id)

    await gotoReady(page, '/inventory/warehouse-requests')
    await openMine(page, uniqueNotes)
    const modal = detailModal(page)

    await modal.getByRole('button', { name: 'Reject' }).click()
    await expect(modal.getByLabel('Reason for rejecting')).toBeVisible()
    // Confirm Rejection is disabled with no reason typed — the required
    // reason is real backend validation (RejectWarehouseRequestDto), not
    // just a frontend nicety.
    await expect(modal.getByRole('button', { name: 'Confirm Rejection' })).toBeDisabled()

    await modal.getByPlaceholder('e.g. Not enough stock to spare right now').fill('Out of stock')
    await expect(async () => {
      await modal.getByRole('button', { name: 'Confirm Rejection' }).click()
      await expect(modal.getByText('Rejected', { exact: true })).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 20_000 })
    await expect(modal.getByText('Rejection reason: Out of stock')).toBeVisible()
  })
})
