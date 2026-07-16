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
