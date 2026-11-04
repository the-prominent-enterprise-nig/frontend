import { test, expect } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

// Journal Entry — Bank / Cash Account. Every bank shares the one Cash and Cash
// Equivalents GL account (1-01-010), so a cash line has to say which bank it
// moves; the entry's detail page then shows that beside the line so the
// transaction can be told apart from another bank's.
//
// The draft this creates is deleted at the end — it is the spec's cleanup.
test.describe.configure({ mode: 'serial' })

test.describe('Accounting — Journal Entry Bank / Cash Account column', () => {
  test('a Cash and Cash Equivalents line asks for its bank, and the entry shows it', async ({
    page,
    request,
  }) => {
    const description = `E2E JE bank column ${Date.now()}`

    await gotoReady(page, '/accounting/journal-entries')
    await expect(page.getByRole('heading', { name: 'Journal Entries' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: 'New Entry' }).click()
    await expect(page.getByRole('heading', { name: 'New Journal Entry' })).toBeVisible()

    await fillStable(page.getByLabel('Description', { exact: true }), description)

    const accountSelects = page.locator('tbody select')
    const cashSelect = accountSelects.nth(0)
    const otherSelect = accountSelects.nth(1)

    // Line 1 = Cash and Cash Equivalents, line 2 = any other account.
    const cashValue = await cashSelect
      .locator('option', { hasText: '1-01-010' })
      .first()
      .getAttribute('value')
    expect(cashValue).toBeTruthy()
    const otherValue = await otherSelect
      .locator('option')
      .evaluateAll(
        (opts) =>
          (opts as HTMLOptionElement[]).find((o) => o.value && !o.textContent?.includes('1-01-010'))
            ?.value ?? null
      )
    expect(otherValue).toBeTruthy()

    // No bank is asked for until the line is on the cash account.
    await expect(page.getByLabel('Bank / Cash Account for line 1')).toHaveCount(0)
    await cashSelect.selectOption(cashValue!)
    await otherSelect.selectOption(otherValue!)
    const bankPicker = page.getByLabel('Bank / Cash Account for line 1')
    await expect(bankPicker).toBeVisible()
    await expect(page.getByLabel('Bank / Cash Account for line 2')).toHaveCount(0)

    await page.locator('tbody tr').nth(0).locator('input[type="number"]').nth(0).fill('100')
    await page.locator('tbody tr').nth(1).locator('input[type="number"]').nth(1).fill('100')

    // Saving without the bank is refused, in the form.
    await page.getByRole('button', { name: 'Create Draft' }).click()
    await expect(
      page.getByText('Pick the Bank / Cash Account for each Cash and Cash Equivalents line.')
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New Journal Entry' })).toBeVisible()

    // Pick the first real bank (index 0 of the list is the "— Select —" reset).
    await bankPicker.click()
    const firstBank = page.locator('div.fixed.z-100 button').nth(1)
    await expect(firstBank).toBeVisible()
    const bankText = (await firstBank.textContent())?.trim() ?? ''
    expect(bankText).not.toBe('')
    await firstBank.click()
    await expect(bankPicker).toHaveValue(bankText)

    // Moving the line off the cash account drops the bank picker again.
    await cashSelect.selectOption(otherValue!)
    await expect(page.getByLabel('Bank / Cash Account for line 1')).toHaveCount(0)
    await cashSelect.selectOption(cashValue!)
    await expect(page.getByLabel('Bank / Cash Account for line 1')).toBeVisible()
    // ...and the choice was cleared with it, so it has to be made again.
    await expect(page.getByLabel('Bank / Cash Account for line 1')).toHaveValue('')
    await page.getByLabel('Bank / Cash Account for line 1').click()
    await page.locator('div.fixed.z-100 button').nth(1).click()
    await expect(page.getByLabel('Bank / Cash Account for line 1')).toHaveValue(bankText)

    await page.getByRole('button', { name: 'Create Draft' }).click()
    await expect(page.getByRole('heading', { name: 'New Journal Entry' })).toBeHidden({
      timeout: 15_000,
    })

    // The entry's page shows which bank the cash line moved.
    await page.getByPlaceholder(/search/i).fill(description)
    await page.getByRole('row', { name: new RegExp(description) }).click()
    await expect(page).toHaveURL(/\/accounting\/journal-entries\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    })
    const id = page.url().split('/').pop()!

    await expect(page.getByRole('columnheader', { name: 'Bank / Cash Account' })).toBeVisible()
    const cashRow = page.getByRole('row', { name: /1-01-010/ })
    await expect(cashRow).toContainText(bankText.split(' (')[0])
    // A line that moves no bank has nothing in that column.
    const otherRow = page.locator('tbody tr').filter({ hasNotText: '1-01-010' }).first()
    await expect(otherRow.locator('td').nth(1)).toHaveText('—')

    // Cleanup: the draft goes.
    const del = await request.delete(`/api/journal-entries/${id}`)
    expect(del.ok()).toBe(true)
  })

  test('the API refuses a bank on a non-cash line and a cash line with no bank', async ({
    request,
  }) => {
    const accountsBody = await (await request.get('/api/accounts?limit=500')).json()
    const accounts = (accountsBody.items ??
      accountsBody.data?.items ??
      accountsBody.data ??
      accountsBody) as {
      id: string
      number: string
    }[]
    const cash = accounts.find((a) => a.number === '1-01-010')!
    const other = accounts.find((a) => a.number !== '1-01-010')!
    const banksBody = await (await request.get('/api/bank-accounts/options')).json()
    const banks = (Array.isArray(banksBody) ? banksBody : banksBody.data) as { id: string }[]
    expect(cash && other && banks.length).toBeTruthy()

    const entry = (lines: object[]) => ({
      date: new Date().toISOString().slice(0, 10),
      description: `E2E JE bank tag ${Date.now()}`,
      journalType: 'GENERAL',
      transactions: lines,
    })

    const noBank = await request.post('/api/journal-entries', {
      data: entry([
        { accountId: cash.id, debit: 10, credit: 0 },
        { accountId: other.id, debit: 0, credit: 10 },
      ]),
    })
    expect(noBank.status()).toBe(400)

    const bankOnOther = await request.post('/api/journal-entries', {
      data: entry([
        { accountId: cash.id, debit: 10, credit: 0, bankAccountId: banks[0].id },
        { accountId: other.id, debit: 0, credit: 10, bankAccountId: banks[0].id },
      ]),
    })
    expect(bankOnOther.status()).toBe(400)

    const ok = await request.post('/api/journal-entries', {
      data: entry([
        { accountId: cash.id, debit: 10, credit: 0, bankAccountId: banks[0].id },
        { accountId: other.id, debit: 0, credit: 10 },
      ]),
    })
    expect(ok.status()).toBe(201)
    const body = await ok.json()
    const cashLine = body.transactions.find((t: { accountId: string }) => t.accountId === cash.id)
    expect(cashLine.bankAccountId).toBe(banks[0].id)
    expect(cashLine.bankAccount?.name).toBeTruthy()

    // Cleanup: the draft goes.
    expect((await request.delete(`/api/journal-entries/${body.id}`)).ok()).toBe(true)
  })
})
