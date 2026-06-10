'use client'
import { usePermission } from '@/src/hooks/usePermission'

interface SessionUser {
  id: string
  roles: string[]
  permissions: string[]
}

export function PermissionGate({
  session,
  permission,
  fallback = null,
  children,
}: {
  session: SessionUser | null
  permission: string
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const allowed = usePermission(session, permission)
  return allowed ? <>{children}</> : <>{fallback}</>
}
