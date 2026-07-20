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
 * Same hydration race as fillStable, but for <select> elements: selectOption
 * dispatches a native 'change' event that a not-yet-hydrated onChange handler
 * silently misses, leaving React state at its default (e.g. an "All" filter
 * never actually narrows). Retries until the selected option's visible text
 * matches, rather than trusting the DOM value alone.
 */
export async function selectStable(select: Locator, label: string): Promise<void> {
  await expect(async () => {
    await select.selectOption({ label })
    await expect(select.locator('option:checked')).toHaveText(label)
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
