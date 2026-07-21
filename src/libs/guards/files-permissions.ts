export const FILES_PERMISSIONS = {
  // ── Files ──────────────────────────────────────────────────────────────────
  FILES_READ: 'files:files:read',
  FILES_CREATE: 'files:files:create',
  FILES_DELETE: 'files:files:delete',

  // ── Attachments ────────────────────────────────────────────────────────────
  ATTACHMENTS_READ: 'files:attachments:read',
  ATTACHMENTS_CREATE: 'files:attachments:create',
  ATTACHMENTS_DELETE: 'files:attachments:delete',

  // ── Wildcard ───────────────────────────────────────────────────────────────
  WILDCARD: 'files:*',
} as const

export const FILES_PERMISSION_DESCRIPTIONS: Record<
  (typeof FILES_PERMISSIONS)[keyof typeof FILES_PERMISSIONS],
  string
> = {
  'files:files:read': 'View and download files',
  'files:files:create': 'Upload new files',
  'files:files:delete': 'Delete uploaded files',
  'files:attachments:read': 'View attachments on a record',
  'files:attachments:create': 'Attach a file to a record',
  'files:attachments:delete': 'Detach a file from a record',
  'files:*': 'Wildcard full Files access',
}

export type FilesPermission = (typeof FILES_PERMISSIONS)[keyof typeof FILES_PERMISSIONS]
