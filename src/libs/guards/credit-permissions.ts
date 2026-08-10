// Scenario 22 follow-up (2026-08-08): Credit was folded into the pos
// permission module — every real permission overlap already lived there
// (Cashier opens/signs at checkout, Branch Manager approves via their
// existing pos:* wildcard, Business Owner has everything). Only Credit
// Investigator holds a narrow slice of these without any other pos:*
// access — same shape as Master Data Approver's narrow slice of
// inventory:items. Kept as its own named export (not merged into
// pos-permissions.ts) since Credit Application/Investigation/Promissory
// Note are still a distinct feature area worth naming clearly, even
// though they're no longer a distinct RBAC module.
export const CREDIT_PERMISSIONS = {
  APPLICATION_CREATE: 'pos:application:create',
  APPLICATION_VIEW: 'pos:application:view',
  APPLICATION_UPDATE: 'pos:application:update',
  APPLICATION_CANCEL: 'pos:application:cancel',
  APPLICATION_APPROVE: 'pos:application:approve',
  INVESTIGATION_START: 'pos:investigation:start',
  INVESTIGATION_RECORD: 'pos:investigation:record',
  PROMISSORY_NOTE_SIGN: 'pos:promissory-note:sign',
  WILDCARD: 'pos:*',
} as const

export const CREDIT_PERMISSION_DESCRIPTIONS: Record<
  (typeof CREDIT_PERMISSIONS)[keyof typeof CREDIT_PERMISSIONS],
  string
> = {
  'pos:application:create': 'Open a new credit application',
  'pos:application:view': 'View credit applications',
  'pos:application:update': 'Edit a draft credit application, manage its documents, or submit it',
  'pos:application:cancel': 'Cancel a draft credit application',
  'pos:application:approve': 'Approve or decline a pending credit application',
  'pos:investigation:start': 'Claim a submitted credit application for investigation',
  'pos:investigation:record': 'Record a credit investigation outcome',
  'pos:promissory-note:sign': 'Mark a promissory note as signed',
  'pos:*': 'Full access to the Point of Sale module',
}

export type CreditPermission = (typeof CREDIT_PERMISSIONS)[keyof typeof CREDIT_PERMISSIONS]
