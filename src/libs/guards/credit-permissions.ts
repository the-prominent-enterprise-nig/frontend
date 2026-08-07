export const CREDIT_PERMISSIONS = {
  APPLICATION_CREATE: 'credit:application:create',
  APPLICATION_VIEW: 'credit:application:view',
  APPLICATION_UPDATE: 'credit:application:update',
  APPLICATION_CANCEL: 'credit:application:cancel',
  APPLICATION_APPROVE: 'credit:application:approve',
  INVESTIGATION_START: 'credit:investigation:start',
  INVESTIGATION_RECORD: 'credit:investigation:record',
  PROMISSORY_NOTE_SIGN: 'credit:promissory-note:sign',
  WILDCARD: 'credit:*',
} as const

export const CREDIT_PERMISSION_DESCRIPTIONS: Record<
  (typeof CREDIT_PERMISSIONS)[keyof typeof CREDIT_PERMISSIONS],
  string
> = {
  'credit:application:create': 'Open a new credit application',
  'credit:application:view': 'View credit applications',
  'credit:application:update':
    'Edit a draft credit application, manage its documents, or submit it',
  'credit:application:cancel': 'Cancel a draft credit application',
  'credit:application:approve': 'Approve or decline a pending credit application',
  'credit:investigation:start': 'Claim a submitted credit application for investigation',
  'credit:investigation:record': 'Record a credit investigation outcome',
  'credit:promissory-note:sign': 'Mark a promissory note as signed',
  'credit:*': 'Full access to the Credit module',
}

export type CreditPermission = (typeof CREDIT_PERMISSIONS)[keyof typeof CREDIT_PERMISSIONS]
