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

export function longDate(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** What is wrong with an FMI date entered on the sale, or null (also null when
 * nothing is entered — the field is optional). Mirrors the server, which
 * refuses a date that has passed or sits more than a year out. */
export function fmiDateProblem(value: string | undefined): string | null {
  if (!value) return null
  if (Number.isNaN(Date.parse(value))) return 'Pick a valid FMI date.'
  if (value < dateInputFromToday({})) return 'The FMI date cannot be in the past.'
  if (value > dateInputFromToday({ days: FMI_MAX_DAYS_AHEAD })) {
    return 'The FMI date is more than a year away.'
  }
  return null
}

/**
 * What the till tells the cashier about the FMI date on the credit application
 * they picked. The server decides (CreditApplication → schedule); this only
 * mirrors its rule so the answer is on screen before Confirm:
 *
 * - a date from today up to a year out starts the schedule — and an FMI date
 *   entered on the sale is the way to change it;
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
    text: `First installment due ${label} — the FMI date on this application. To use another date, enter it in the FMI date field.`,
  }
}
