export const FILES_PERMISSIONS = {
  // ── Files ──────────────────────────────────────────────────────────────────
  FILES_VIEW: 'files:files:view',
  FILES_LIST: 'files:files:list',
  FILES_DOWNLOAD: 'files:files:download',
  FILES_UPLOAD: 'files:files:upload',
  FILES_DELETE: 'files:files:delete',
  FILES_MANAGE: 'files:files:manage',

  // ── Wildcard ───────────────────────────────────────────────────────────────
  WILDCARD: 'files:*',
} as const

export const FILES_PERMISSION_DESCRIPTIONS: Record<
  (typeof FILES_PERMISSIONS)[keyof typeof FILES_PERMISSIONS],
  string
> = {
  'files:files:view': 'View file details and metadata',
  'files:files:list': 'Browse and search uploaded files',
  'files:files:download': 'Download files',
  'files:files:upload': 'Upload new files',
  'files:files:delete': 'Delete uploaded files',
  'files:files:manage': 'Full control over all files',
  'files:*': 'Wildcard full Files access',
}

export type FilesPermission = (typeof FILES_PERMISSIONS)[keyof typeof FILES_PERMISSIONS]
