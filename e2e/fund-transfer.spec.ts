import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { fillStable, gotoReady, loginAs, pickFromCustomSelect } from './utils'

// Picks an account in one of the form's comboboxes by typing part of its label
// and pressing Enter (the component's own keyboard path: Enter takes the first
// match). Typing rather than clicking into the floating option list, which sits
// in a portal that re-positions on every scroll and is easy to mis-click.
//
// The list must be open BEFORE typing: it only opens once the form has
// hydrated, and typing in the first milliseconds after the route appears (a
// click and a fill back to back) sent the page back to the list in this
// suite. Waiting for the options is the same "wait for hydration" idea as
// fillStable, applied to a combobox.
async function pickAccount(page: Page, fieldLabel: string, optionText: string) {
  const input = page.locator('label', { hasText: fieldLabel }).locator('input').first()
  const anyOption = page.getByTestId('searchable-select-option').first()
  const option = page
    .getByTestId('searchable-select-option')
    .filter({ hasText: optionText })
    .first()
  await expect(async () => {
    await input.click()
    await expect(anyOption).toBeVisible({ timeout: 2_000 })
    await input.fill(optionText)
    await expect(option).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await input.press('Enter')
  await expect(input).toHaveValue(new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
    timeout: 5_000,
  })
}

// Scenario 40 Part 3 / Scenario 61 — Inter-Account Transfer (formerly Fund
// Transfer). A real inter-account transfer (e.g. funding a Petty Cash Fund
// from the main operating account).
//
// Scenario 72 Part 1 — a transfer can now be voided, so this spec voids the
// transfer it creates: that is its cleanup (the voided row and its reversed
// entry pair stay, net zero) and it is the UI proof of the void itself.
// Recording a transfer makes a draft bank reconciliation for each bank side that
// has a statement; these transfers are only for the test, so the draft goes too.
// Only unfinished auto-drafts on the named bank are touched.
async function dropAutoDrafts(request: APIRequestContext, bankName: string) {
  const banksBody = await (await request.get('/api/bank-accounts')).json()
  const banks = (Array.isArray(banksBody) ? banksBody : banksBody.data) as {
    id: string
    name: string
  }[]
  const bank = banks.find((b) => b.name === bankName)
  if (!bank) return
  const recsBody = await (await request.get('/api/bank-accounts/reconciliations')).json()
  const recs = (Array.isArray(recsBody) ? recsBody : recsBody.data) as {
    id: string
    bankAccountId: string
    autoCreated?: boolean
    reconciled: boolean
  }[]
  for (const r of recs.filter(
    (r) => r.bankAccountId === bank.id && r.autoCreated && !r.reconciled
  )) {
    await request.delete(`/api/bank-accounts/reconciliations/${r.id}`)
  }
}

// Handed from the main flow to the branch-user tests below, which run after it.
let taggedVoucher = ''
let taggedUrl = ''
const BRANCH_PASSWORD = 'dev-prominent-enterprise-2026'

test.describe.configure({ mode: 'serial' })

test.describe('Accounting — Inter-Account Transfer (Scenario 40 Part 3 / Scenario 61)', () => {
  test('transfers money, shows the voucher pop-up, lists it in history, and edits only clearing date + reference', async ({
    page,
    request,
  }) => {
    await gotoReady(page, '/accounting/bank-accounts')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    const pettyCashRow = page.locator('tbody tr', { hasText: 'Petty Cash Fund' }).first()
    await expect(pettyCashRow).toBeVisible({ timeout: 10_000 })
    const pettyCashName = (await pettyCashRow.locator('td').first().textContent())?.trim()
    const balanceBeforeText = (await pettyCashRow.locator('td').nth(5).textContent())?.trim() ?? ''
    const balanceBefore = Number(balanceBeforeText.replace(/[^\d.-]/g, ''))
    expect(pettyCashName).toBeTruthy()
    expect(Number.isFinite(balanceBefore)).toBe(true)

    await gotoReady(page, '/accounting/fund-transfers')
    await expect(page.getByRole('heading', { name: 'Inter-Account Transfers' })).toBeVisible({
      timeout: 10_000,
    })
    // The New Transfer link goes to a page, not a modal. The form is then loaded
    // directly rather than by clicking through: typing into it within a
    // fraction of a second of a client-side route change from this list bounced
    // the page back to the list in this suite (a click and a fill back to back,
    // not reproducible at human speed), which has nothing to do with what is
    // being tested here.
    await expect(page.getByRole('link', { name: 'New Transfer' })).toHaveAttribute(
      'href',
      '/accounting/fund-transfers/new'
    )
    await gotoReady(page, '/accounting/fund-transfers/new')
    // exact: the list's own heading is "Inter-Account Transfers", which a loose
    // match also accepts.
    await expect(
      page.getByRole('heading', { name: 'Inter-Account Transfer', exact: true })
    ).toBeVisible({ timeout: 30_000 })

    // Both account fields are SearchableSelect comboboxes (type-ahead input +
    // option list), not native <select>s, and share one placeholder — so each is
    // found through its own label.
    await pickAccount(page, 'From (source) *', '(Operating)')
    const sourceName = (
      await page
        .locator('label', { hasText: 'From (source) *' })
        .locator('input')
        .first()
        .inputValue()
    ).replace(/ \(Operating\)$/, '')
    await pickAccount(page, 'To (destination) *', pettyCashName as string)

    await page.getByLabel('Amount *').fill('250')

    // Scenario 72 Part 6 — tag it with the branch / location responsible. The
    // Owner picks any branch (or leaves it head-office).
    await pickAccount(page, 'Branch / Location', 'Bago')

    // Scenario 72 Part 5 — a supporting document can be attached while recording
    // the transfer. It is held until the transfer exists, then uploaded.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'bank-advice.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('E2E bank advice'),
    })
    await expect(page.getByText('bank-advice.txt')).toBeVisible()
    await expect(page.getByText('(pending save)')).toBeVisible()

    await page.getByRole('button', { name: 'Transfer' }).click()

    // Lands on the new transfer's own page (no pop-up — client UI/UX
    // direction) with a "Transfer recorded" banner and its printable voucher.
    await page.waitForURL(/\/accounting\/fund-transfers\/[0-9a-f-]{36}\?created=1$/, {
      timeout: 10_000,
    })
    const transferUrl = page.url().split('?')[0]
    await expect(page.getByText('Transfer recorded.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print Voucher' }).first()).toBeVisible()
    // Scenario 72 Part 4 — the client's control series (INTRA0926-001, …).
    const voucherNumber = (await page.getByText(/^INTRA0926-\d{3,}$/).textContent())?.trim()
    expect(voucherNumber).toBeTruthy()
    taggedVoucher = voucherNumber as string
    taggedUrl = transferUrl

    // The branch shows on the transfer.
    await expect(page.locator('dt', { hasText: 'Branch / Location' }).locator('..')).toContainText(
      'Bago'
    )

    // The form's Cleared dropdown defaults to "On the same date", so the
    // clearing date is the transfer date (today) and Scenario 72 Part 3's status
    // reads Cleared from the start — it was "Not yet cleared" before that
    // dropdown existed.
    await expect(page.getByText('Cleared', { exact: true })).toBeVisible()
    await expect(page.getByText('Pending', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Not yet cleared')).toHaveCount(0)

    // The staged document was uploaded and linked when the transfer was saved.
    await expect(page.getByRole('link', { name: 'bank-advice.txt' })).toBeVisible({
      timeout: 15_000,
    })

    // Documents can be added after posting (a bank advice often arrives late) and
    // removed again; removing asks inline, not in a pop-up.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'transfer-slip.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('E2E transfer slip'),
    })
    await expect(page.getByRole('link', { name: 'transfer-slip.txt' })).toBeVisible({
      timeout: 15_000,
    })
    await page
      .locator('li', { hasText: 'transfer-slip.txt' })
      .getByRole('button', { name: 'Remove attachment' })
      .click()
    await expect(page.getByText('Remove this attachment?')).toBeVisible()
    await page.getByRole('button', { name: 'Yes, remove' }).click()
    await expect(page.getByRole('link', { name: 'transfer-slip.txt' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(page.getByRole('link', { name: 'bank-advice.txt' })).toBeVisible()

    // Neither reconciliation line is "Outstanding" — nothing has reconciled this
    // transfer yet, which is what the label now says.
    await expect(page.getByText('Not yet reconciled')).toHaveCount(2)
    await expect(page.getByText('Outstanding')).toHaveCount(0)

    // Only the clearing date and reference are editable, and the clearing date is
    // chosen the way it was when recording: "On the same date" or "On a later
    // date" (which asks for the date). Moving it to a later date makes the
    // transfer Pending again.
    await page.getByRole('button', { name: 'Edit' }).click()
    const form = page.locator('form')
    await expect(form.getByText('Cleared', { exact: true })).toBeVisible()
    await expect(form.getByText('Reference', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'On the same date' })).toBeVisible()
    // Same date: no separate date to type.
    await expect(page.getByLabel('Cleared Date')).toHaveCount(0)
    const today = new Date().toISOString().slice(0, 10)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await pickFromCustomSelect(page, 'On the same date', 'On a later date')
    await fillStable(page.getByLabel('Cleared Date'), nextWeek)
    await page.getByLabel('Reference').fill('E2E-IAT-REF')
    await page.getByRole('button', { name: 'Save' }).click()
    // The reference shows twice: as the Reference field and as the journal
    // entry's code, which follows it.
    await expect(page.getByText('E2E-IAT-REF').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.getByText('Cleared', { exact: true })).toHaveCount(0)

    // A later date with none typed is refused, as when recording it.
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('combobox', { name: 'On a later date' })).toBeVisible()
    await expect(page.getByLabel('Cleared Date')).toHaveValue(nextWeek)
    await page.getByLabel('Cleared Date').fill('')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByLabel('Cleared Date')).toBeVisible()
    await expect(page.getByText('Pending', { exact: true })).toBeVisible()

    // And back to the same date, which has arrived, so it is Cleared again.
    await pickFromCustomSelect(page, 'On a later date', 'On the same date')
    await expect(page.getByLabel('Cleared Date')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Cleared', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pending', { exact: true })).toHaveCount(0)
    await expect(page.locator('dt', { hasText: 'Clearing Date' }).locator('..')).toContainText(
      today
    )

    // The journal entry traces back to the transfer through its source link —
    // this matches on the INTRA prefix, as it did on IAT- before.
    await page.getByRole('link', { name: 'E2E-IAT-REF' }).click()
    await page.waitForURL(/\/accounting\/journal-entries\/[0-9a-f-]{36}$/, { timeout: 10_000 })
    // By its number, not its kind: the sidebar also has an "Inter-Account
    // Transfers" link.
    const sourceLink = page.getByRole('link', { name: new RegExp(voucherNumber as string) })
    await expect(sourceLink).toBeVisible({ timeout: 10_000 })
    await expect(sourceLink).toContainText('Inter-Account Transfer')
    await expect(sourceLink).toHaveAttribute('href', transferUrl.replace(/^https?:\/\/[^/]+/, ''))
    await sourceLink.click()
    await page.waitForURL(transferUrl, { timeout: 10_000 })
    await expect(page.getByText(voucherNumber as string)).toBeVisible()

    // History shows it.
    await gotoReady(page, '/accounting/fund-transfers')
    await page.getByPlaceholder('Voucher #, reference, account').fill(voucherNumber as string)
    const historyRow = page.locator('tbody tr', { hasText: voucherNumber as string })
    await expect(historyRow).toBeVisible({ timeout: 10_000 })
    await expect(historyRow).toContainText('E2E-IAT-REF')
    await expect(historyRow).toContainText(today)
    await expect(historyRow).toContainText('Cleared')
    await expect(historyRow).toContainText('Bago')

    // The Owner's Branch filter narrows to it, and away from it.
    await page.getByPlaceholder('Voucher #, reference, account').fill('')
    await page
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption({ label: 'Bago' })
    await expect(page.locator('tbody tr', { hasText: voucherNumber as string })).toBeVisible({
      timeout: 10_000,
    })
    await page
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption({ label: 'Mabinay' })
    await expect(page.locator('tbody tr', { hasText: voucherNumber as string })).toHaveCount(0, {
      timeout: 10_000,
    })
    await page.getByRole('combobox', { name: 'Branch', exact: true }).selectOption('')
    await page.getByPlaceholder('Voucher #, reference, account').fill(voucherNumber as string)

    await gotoReady(page, '/accounting/bank-accounts')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const pettyCashRowAfter = page.locator('tbody tr', { hasText: pettyCashName as string }).first()
    await expect
      .poll(
        async () => {
          const text = (await pettyCashRowAfter.locator('td').nth(5).textContent())?.trim() ?? ''
          return Number(text.replace(/[^\d.-]/g, ''))
        },
        { timeout: 10_000 }
      )
      .toBeCloseTo(balanceBefore + 250, 2)

    // Scenario 72 Part 1 — void it. The reason is typed on the page (no
    // pop-up); voiding reverses the entry, so the balance goes back.
    await gotoReady(page, transferUrl)
    await expect(page.getByText(voucherNumber as string)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Void', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /Void this transfer/ }).click()
    const voidForm = page.getByRole('form', { name: 'Void transfer' })
    await expect(voidForm).toBeVisible()
    await fillStable(voidForm.getByLabel('Reason *'), 'E2E cleanup — keyed for the test')
    await voidForm.getByRole('button', { name: 'Void transfer' }).click()

    await expect(page.getByText('Void', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/This transfer was voided on/)).toBeVisible()
    await expect(page.getByText('Reason: E2E cleanup — keyed for the test')).toBeVisible()
    // A void transfer's documents stay visible but can no longer be changed.
    await expect(page.getByRole('link', { name: 'bank-advice.txt' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add attachment' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove attachment' })).toHaveCount(0)
    await expect(page.getByText('This transfer is read-only.')).toBeVisible()

    // A void transfer can't be edited or voided again, but still prints.
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Void this transfer/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Print Voucher' }).first()).toBeVisible()

    // History marks it VOID.
    await gotoReady(page, '/accounting/fund-transfers')
    await page.getByPlaceholder('Voucher #, reference, account').fill(voucherNumber as string)
    const voidedRow = page.locator('tbody tr', { hasText: voucherNumber as string })
    await expect(voidedRow).toBeVisible({ timeout: 10_000 })
    await expect(voidedRow).toContainText('Void')

    // The Status filter finds it under Void and not under Pending.
    await page.getByPlaceholder('Voucher #, reference, account').fill('')
    await page.getByLabel('Status').selectOption('void')
    await expect(page.locator('tbody tr', { hasText: voucherNumber as string })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByLabel('Status').selectOption('pending')
    await expect(page.locator('tbody tr', { hasText: voucherNumber as string })).toHaveCount(0, {
      timeout: 10_000,
    })

    // And the money is back where it started.
    await gotoReady(page, '/accounting/bank-accounts')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const pettyCashRowVoided = page
      .locator('tbody tr', { hasText: pettyCashName as string })
      .first()
    await expect
      .poll(
        async () => {
          const text = (await pettyCashRowVoided.locator('td').nth(5).textContent())?.trim() ?? ''
          return Number(text.replace(/[^\d.-]/g, ''))
        },
        { timeout: 10_000 }
      )
      .toBeCloseTo(balanceBefore, 2)

    // The transfer made a draft reconciliation for its bank; it was only for the test.
    await dropAutoDrafts(request, sourceName)
  })

  // Amount fields group thousands as you type (500000 -> 500,000) while the form
  // keeps the plain number. The main flow above proves the plain number is what
  // gets saved: it types 250 and checks the bank balance moved by exactly 250.
  test('amount fields show thousands separators as you type, and keep the cursor', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/fund-transfers/new')
    await expect(
      page.getByRole('heading', { name: 'Inter-Account Transfer', exact: true })
    ).toBeVisible({ timeout: 30_000 })

    const amount = page.getByLabel('Amount *')
    // Typing only takes once the form has hydrated, so the first try retries.
    await expect(async () => {
      await amount.fill('')
      await amount.pressSequentially('1234567.89')
      await expect(amount).toHaveValue('1,234,567.89')
    }).toPass({ timeout: 15_000 })

    // Letters, a second decimal point and a third decimal place are refused.
    await amount.fill('')
    await amount.pressSequentially('12ab3.4.567')
    await expect(amount).toHaveValue('123.45')
    // A transfer amount is never negative.
    await amount.fill('')
    await amount.pressSequentially('-5')
    await expect(amount).toHaveValue('5')

    // Typing in the middle of a number leaves the cursor where it was typed.
    await amount.fill('1234')
    await expect(amount).toHaveValue('1,234')
    await amount.press('Home')
    await amount.pressSequentially('99')
    await expect(amount).toHaveValue('991,234')

    // The reconciliation's Statement Balance behaves the same, and may be negative
    // (a statement can be overdrawn).
    await gotoReady(page, '/accounting/bank-reconciliation/new')
    await expect(page.getByRole('heading', { name: 'New Reconciliation' })).toBeVisible({
      timeout: 30_000,
    })
    const balance = page.getByLabel('Statement Balance *')
    await expect(async () => {
      await balance.fill('')
      await balance.pressSequentially('500000')
      await expect(balance).toHaveValue('500,000')
    }).toPass({ timeout: 15_000 })
    await balance.fill('')
    await balance.pressSequentially('-1500.5')
    await expect(balance).toHaveValue('-1,500.5')
  })

  // Scenario 72 Part 6 — a branch-assigned user only ever deals with their own
  // branch's transfers. These log in as seeded branch accountants, so they start
  // from a clean browser (no owner session).
  test.describe('branch users', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test("a Bago accountant sees only Bago's transfers, has no branch filter, and the form is locked to Bago", async ({
      page,
    }) => {
      test.skip(!taggedVoucher, 'needs the transfer the main flow tagged with Bago')
      await loginAs(page, 'technova.b1.accounting@test.com', BRANCH_PASSWORD)

      await gotoReady(page, '/accounting/fund-transfers')
      await expect(page.getByRole('heading', { name: 'Inter-Account Transfers' })).toBeVisible({
        timeout: 30_000,
      })
      // Their own branch's transfer is there...
      await expect(page.locator('tbody tr', { hasText: taggedVoucher })).toBeVisible({
        timeout: 15_000,
      })
      // ...every row on the page is Bago's (the Branch column is the fifth)...
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      expect(count).toBeGreaterThan(0)
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('td').nth(4)).toHaveText('Bago')
      }
      // ...and there is no branch filter to widen it.
      await expect(page.getByRole('combobox', { name: 'Branch', exact: true })).toHaveCount(0)

      // Recording a transfer: the branch is theirs and can't be changed.
      await gotoReady(page, '/accounting/fund-transfers/new')
      await expect(
        page.getByRole('heading', { name: 'Inter-Account Transfer', exact: true })
      ).toBeVisible({ timeout: 30_000 })
      const branchField = page.getByLabel('Branch / Location')
      await expect(branchField).toHaveValue('Bago')
      await expect(branchField).toHaveJSProperty('readOnly', true)
    })

    test("a Mabinay accountant can't see or open it", async ({ page }) => {
      test.skip(!taggedVoucher, 'needs the transfer the main flow tagged with Bago')
      await loginAs(page, 'technova.b10.accounting@test.com', BRANCH_PASSWORD)

      await gotoReady(page, '/accounting/fund-transfers')
      await expect(page.getByRole('heading', { name: 'Inter-Account Transfers' })).toBeVisible({
        timeout: 30_000,
      })
      // Once the list has loaded, the Bago voucher is nowhere in it and every
      // row that is there is Mabinay's own (the Branch column is the fifth).
      await expect(page.locator('tbody')).not.toContainText('Loading', { timeout: 15_000 })
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('tbody')).not.toContainText(taggedVoucher)
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('td').nth(4)).toHaveText('Mabinay')
      }

      // Opening it by its address finds nothing — not "forbidden".
      await gotoReady(page, taggedUrl)
      await expect(page.getByText('Transfer not found.')).toBeVisible({ timeout: 15_000 })
    })
  })
})
