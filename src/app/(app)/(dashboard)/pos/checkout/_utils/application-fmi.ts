import { dateInputFromToday } from './typed-plan'

/** How far ahead an FMI date may sit and still be honoured — the same window
 * the server applies (FMI_MAX_DAYS_AHEAD) and a typed plan's first due date is
 * held to. */
const FMI_MAX_DAYS_AHEAD = 366

export type ApplicationFmiNote = {
  /** True when the application's date will NOT be used. */
  warn: boolean
  text: string
}

function longDate(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * What the till tells the cashier about the FMI date on the credit application
 * they picked. The server decides (CreditApplication → schedule); this only
 * mirrors its rule so the answer is on screen before Confirm:
 *
 * - a date from today up to a year out starts the schedule — and a plan typed
 *   at the till is the way to change it;
 * - a date that has passed by sale day (the application is raised days before
 *   the customer collects), or one more than a year out, is not used and the
 *   first installment falls due one month after the sale.
 *
 * Null when the application carries no date, so there is nothing to say.
 */
export function applicationFmiNote(
  firstDueDate: string | null | undefined
): ApplicationFmiNote | null {
  if (!firstDueDate) return null
  const fmi = firstDueDate.slice(0, 10)
  const label = longDate(fmi)
  if (fmi < dateInputFromToday({})) {
    return {
      warn: true,
      text: `This application’s FMI date (${label}) has passed, so the first installment will fall due one month after this sale instead.`,
    }
  }
  if (fmi > dateInputFromToday({ days: FMI_MAX_DAYS_AHEAD })) {
    return {
      warn: true,
      text: `This application’s FMI date (${label}) is more than a year away, so it won’t be used — the first installment will fall due one month after this sale.`,
    }
  }
  return {
    warn: false,
    text: `First installment due ${label} — the FMI date on this application. To change it, type the terms yourself.`,
  }
}
