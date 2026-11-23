import { test, expect } from '@playwright/test'
import { gotoReady, pickCheckoutSession } from './utils'

// Docket #94 — "the serial is in the Stock Ledger but the cashier can't find it
// at checkout". The picker used to load ONE page (20, newest first) of the
// branch's in-stock units and match what the cashier typed over just those, so
// any unit older than the 20 newest could never be found: the search showed
// the model, and inside the model the serial "did not exist".
//
// Uses the seed's ABS-CBN TVPLUS (TN-ITEM-1295): San Sebastian's warehouse
// (WH-14) holds well over 20 of it, so there is always an older unit to look
// for. The unit is found through the same endpoint the picker calls (not
// hard-coded), because which serials are "newest" depends on the seed run.
test.describe('POS Checkout — serial picker beyond the newest page', () => {
  test('typing the serial of a unit older than the newest 20 finds it, and it can be picked', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await pickCheckoutSession(page, 'TN-B14-01')

    // The oldest sellable unit in this branch — the one the first page of 20
    // newest can never contain.
    const branches = ((await (await page.request.get('/api/branches?limit=200')).json()).data ??
      []) as { id: string; name: string }[]
    const branch = branches.find((b) => b.name === 'San Sebastian')
    expect(branch, 'San Sebastian branch').toBeTruthy()
    const items = ((
      await (await page.request.get('/api/inventory/items?search=TVPLUS&limit=5')).json()
    ).data ?? []) as { id: string; name: string }[]
    const item = items.find((i) => i.name.includes('ABS-CBN TVPLUS'))
    expect(item, 'ABS-CBN TVPLUS item').toBeTruthy()
    const all = (
      await (
        await page.request.get(
          `/api/inventory/serial-numbers?itemId=${item!.id}&status=in_stock&forSale=true&branchId=${branch!.id}&limit=1000`
        )
      ).json()
    ).data as { serialNumber: string }[]
    expect(all.length).toBeGreaterThan(20)
    const oldest = all[all.length - 1].serialNumber

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill('TVPLUS')
    const card = page
      .getByRole('button')
      .filter({ has: page.getByText('TN-ITEM-1295', { exact: true }) })
      .first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })

    // Opens on the newest page only — and says so, rather than reading as
    // everything the branch holds.
    const pickerSearch = page.getByPlaceholder('Search serial number…')
    await expect(page.getByText(/Showing the newest 20 of \d+ units/)).toBeVisible({
      timeout: 10_000,
    })
    const oldestButton = page.getByRole('button', { name: oldest, exact: true })
    await expect(oldestButton).toHaveCount(0)

    // Typing the tail of that serial — what a cashier reading it off the box
    // would type — finds it.
    await pickerSearch.fill(oldest.slice(-6))
    await expect(oldestButton).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Showing the newest/)).toHaveCount(0)

    // Clearing the box brings the newest page (and the note) back.
    await pickerSearch.fill('')
    await expect(page.getByText(/Showing the newest 20 of \d+ units/)).toBeVisible({
      timeout: 10_000,
    })
    await expect(oldestButton).toHaveCount(0)

    // And the found unit is a real, pickable one — it lands on the cart line.
    await pickerSearch.fill(oldest.slice(-6))
    await expect(oldestButton).toBeVisible({ timeout: 10_000 })
    await oldestButton.click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toHaveCount(0)
    await expect(page.getByText(oldest, { exact: false }).first()).toBeVisible({ timeout: 10_000 })
  })
})
