import { hasPrivilegedRole, isSuperAdmin, type SessionUser } from '@/src/libs/guards/permission'

// Seeded as "EDP Head"; the client's sheet calls it "Inventory/EDP Head".
const SERIAL_EDITOR_ROLES = new Set(['EDP HEAD', 'INVENTORY/EDP HEAD'])

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
}

/** The user sits at the Mabini Head Office branch — not San Sebastian, the other one. */
function atMabiniHeadOffice(user: SessionUser): boolean {
  return user.branchIsHeadOffice === true && norm(user.branchName) === 'MABINI'
}

/**
 * Correcting or deleting a unit: the Business Owner, or the Inventory/EDP Head
 * at Mabini (NIG, 2026-11-20). Mirrors the backend's assertCanEditSerials.
 */
export function canEditSerialNumbers(user: SessionUser): boolean {
  if (isSuperAdmin(user) || hasPrivilegedRole(user)) return true
  return user.roles.some((role) => SERIAL_EDITOR_ROLES.has(norm(role))) && atMabiniHeadOffice(user)
}
