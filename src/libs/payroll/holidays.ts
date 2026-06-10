export type HolidayMap = Record<string, string>

export const HOLIDAYS: {
  regular_holidays: HolidayMap
  special_non_working_days: HolidayMap
} = {
  regular_holidays: {
    'New Years Day': '01/01',
    'Maundy Thursday': '04/02',
    'Good Friday': '04/03',
    'Araw ng Kagitingan': '04/09',
    'Labor Day': '05/01',
    'Independence Day': '06/12',
    'National Heroes Day': '08/25',
    'Bonifacio Day': '11/30',
    'Christmas Day': '12/25',
    'Rizal Day': '12/30',
  },
  special_non_working_days: {
    'Evelio Javier': '02/11',
    'EDSA People Power Revolution Anniversary': '02/25',
    'Ninoy Aquino Day': '08/21',
    'All Saints Day': '11/01',
    'Feast of the Immaculate Conception of Mary': '12/08',
    'Last day of the year': '12/31',
    'Chinese New Year': '02/09',
    'Black Saturday': '04/04',
    'All Souls Day': '11/02',
    'Christmas Eve': '12/24',
  },
}

export function parseHolidaysForYear(holidays: HolidayMap, year: number): Record<string, Date> {
  const result: Record<string, Date> = {}
  Object.entries(holidays).forEach(([name, dateStr]) => {
    const [month, day] = dateStr.split('/')
    result[name] = new Date(Date.UTC(year, parseInt(month, 10) - 1, parseInt(day, 10)))
  })
  return result
}

export function getHolidaysInRange(startDate: Date, endDate: Date) {
  const holidays: Array<{ date: string; name: string; type: 'Regular' | 'Special' }> = []
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    const regular = parseHolidaysForYear(HOLIDAYS.regular_holidays, year)
    const special = parseHolidaysForYear(HOLIDAYS.special_non_working_days, year)

    Object.entries(regular).forEach(([name, date]) => {
      if (date >= startDate && date <= endDate) {
        holidays.push({ date: toDateStr(date), name, type: 'Regular' })
      }
    })
    Object.entries(special).forEach(([name, date]) => {
      if (date >= startDate && date <= endDate) {
        holidays.push({ date: toDateStr(date), name, type: 'Special' })
      }
    })
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

export function getWeekendsInRange(
  startDate: Date,
  endDate: Date,
  holidayDates: Set<string>
): Array<{ date: string; label: string }> {
  const weekends: Array<{ date: string; label: string }> = []
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  while (current <= end) {
    const day = current.getDay()
    const dateStr = toDateStr(current)
    if ((day === 0 || day === 6) && !holidayDates.has(dateStr)) {
      weekends.push({ date: dateStr, label: day === 0 ? 'Sunday' : 'Saturday' })
    }
    current.setDate(current.getDate() + 1)
  }
  return weekends
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isThirteenthMonthPeriod(startDate: Date, endDate: Date): boolean {
  const dec11 = new Date(startDate.getFullYear(), 11, 11)
  const dec25 = new Date(startDate.getFullYear(), 11, 25)
  return startDate <= dec25 && endDate >= dec11
}
