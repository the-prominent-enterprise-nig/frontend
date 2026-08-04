export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** Whole months elapsed since `iso`, formatted like "5 Mo(s)". Never stored — always derived. */
export function formatAge(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())
  if (now.getDate() < date.getDate()) months -= 1

  if (months < 1) return '< 1 Mo'
  return `${months} Mo(s)`
}
