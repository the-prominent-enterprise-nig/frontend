import { type Permission, type Role } from '@/src/schema/settings/list'

export type AccessLevel = 'none' | 'view' | 'manage' | 'full'

export type AccessModule = {
  key: string
  label: string
  permissionModules: string[]
}

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'No Access',
  view: 'View Only',
  manage: 'Manage / Edit',
  full: 'Full Access',
}

export const ACCESS_MODULES: AccessModule[] = [
  {
    key: 'hr',
    label: 'HR & Payroll',
    permissionModules: ['hr', 'employees', 'attendance', 'leave', 'payroll', 'payslips'],
  },
  { key: 'accounting', label: 'Accounting', permissionModules: ['accounting'] },
  { key: 'inventory', label: 'Inventory', permissionModules: ['inventory'] },
  { key: 'procurement', label: 'Procurement', permissionModules: ['procurement'] },
  { key: 'pos', label: 'Point of Sale', permissionModules: ['pos'] },
  { key: 'crm', label: 'CRM', permissionModules: ['crm'] },
  { key: 'sales', label: 'Sales & Orders', permissionModules: ['sales'] },
  { key: 'files', label: 'Files', permissionModules: ['files'] },
]

const READ_ACTIONS = new Set([
  'read',
  'view',
  'list',
  'search',
  'export',
  'download',
  'valuation',
  'turnover',
])

const EDIT_ACTIONS = new Set([
  'create',
  'update',
  'upload',
  'edit',
  'open',
  'close',
  'send',
  'receive',
  'dispatch',
  'issue',
  'call',
  'serve',
  'return',
  'run',
  'log',
  'request',
  'generate',
])

const FULL_ACTIONS = new Set([
  'delete',
  'approve',
  'reject',
  'cancel',
  'void',
  'admin',
  'configure',
  'manage',
  'manage_lifecycle',
  'manage_documents',
  'reset',
  'post',
])

function permissionKey(permission: Permission): string {
  return `${permission.module}:${permission.resource}:${permission.action}`
}

function isWildcard(permission: Permission): boolean {
  return permission.resource === '*' || permission.action === '*'
}

function actionMatches(action: string, actions: Set<string>): boolean {
  return actions.has(action) || Array.from(actions).some((item) => action.includes(item))
}

export function getModulePermissions(
  permissions: Permission[],
  moduleConfig: AccessModule
): Permission[] {
  return permissions.filter((permission) =>
    moduleConfig.permissionModules.includes(permission.module)
  )
}

export function isReadPermission(permission: Permission): boolean {
  return actionMatches(permission.action, READ_ACTIONS)
}

export function isManagePermission(permission: Permission): boolean {
  return (
    actionMatches(permission.action, READ_ACTIONS) || actionMatches(permission.action, EDIT_ACTIONS)
  )
}

export function isFullPermission(permission: Permission): boolean {
  return isWildcard(permission) || actionMatches(permission.action, FULL_ACTIONS)
}

export function getAccessLevelForPermissions(permissions: Permission[]): AccessLevel {
  if (permissions.length === 0) return 'none'
  if (permissions.some(isFullPermission)) return 'full'
  if (permissions.some((permission) => actionMatches(permission.action, EDIT_ACTIONS)))
    return 'manage'
  return 'view'
}

export function getAccessLevelForRole(role: Role, moduleConfig: AccessModule): AccessLevel {
  const permissions = role.permissions
    .map((rolePermission) => rolePermission.permission)
    .filter((permission) => moduleConfig.permissionModules.includes(permission.module))

  return getAccessLevelForPermissions(permissions)
}

export function getSelectedPermissionIdsForLevel(
  availablePermissions: Permission[],
  moduleConfig: AccessModule,
  level: AccessLevel
): string[] {
  const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)

  if (level === 'none') return []
  if (level === 'view')
    return modulePermissions.filter(isReadPermission).map((permission) => permission.id)
  if (level === 'manage')
    return modulePermissions.filter(isManagePermission).map((permission) => permission.id)
  return modulePermissions.map((permission) => permission.id)
}

export function formatPermission(permission: Permission): string {
  return permission.description || permissionKey(permission)
}
