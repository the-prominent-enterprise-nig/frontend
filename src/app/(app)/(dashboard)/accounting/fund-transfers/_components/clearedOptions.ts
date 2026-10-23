// The two answers to "when does this transfer clear the bank?" — the client's
// spec: "On the same date" or "On a later date". Used by the new-transfer form
// and by editing a posted transfer, so both read and behave the same.
export type ClearedType = 'SAME_DATE' | 'LATER_DATE'

export const CLEARED_OPTIONS: { value: ClearedType; label: string }[] = [
  { value: 'SAME_DATE', label: 'On the same date' },
  { value: 'LATER_DATE', label: 'On a later date' },
]
