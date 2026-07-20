import { expect, type Locator, type Page } from '@playwright/test'

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
 * Logs in as an arbitrary seeded user (prisma/seed.ts) rather than the shared
 * Business Owner session every other spec inherits from playwright.config.ts's
 * storageState — use this for specs that need to exercise a specific role's
 * permissions. Callers must opt out of the default storageState first via
 * `test.use({ storageState: { cookies: [], origins: [] } })`, otherwise the
 * page is already authenticated as Business Owner before this ever runs.
 * Same dev-only DEV_API_KEY bypass documented in auth.setup.ts.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await gotoReady(page, '/login')
  // Re-fills on every retry, not just once up front: a hydration reconciliation
  // can silently wipe fields *after* fillAllStable's own verification passes
  // but *before* the click lands (same race fillAllStable's own docstring
  // describes) — retrying fill+click together is the only way to close it.
  await expect(async () => {
    await fillAllStable([
      { locator: page.locator('#email'), value: email },
      { locator: page.locator('#password'), value: password },
    ])
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL('/login', { timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}
