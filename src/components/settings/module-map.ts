import { type Permission } from '@/src/schema/settings/list'

// Scenario 74, Modules and Sharing Plan. The module map comes from the backend
// (GET /permissions/access-map, src/auth/access-map.ts there): every
// permission resource belongs to one feature, owned by one module, with the
// modules that also use it and what its screens need from other features.
// This file turns a role's permissions into "Module: access level".

export type AccessFeature = {
  key: string
  label: string
  module: string
  /** `module:resource`, every action of each. */
  resources: string[]
  sharedWith: string[]
  /** Exact permissions that come with the feature, view or pick only. */
  needs: string[]
  /** A part owned by more than one module (ownership answers A, D and F). */
  jointOwners?: { part: string; owners: string[] }
}

export type AccessMap = {
  features: AccessFeature[]
  /** Need permission → what it reads as ("Customers", "Files (upload and attach)"). */
  needLabels: Record<string, string>
  /** Permission → what it does, for "All access *". */
  protectedPermissions: Record<string, string>
}

export type ModuleSummary = {
  kind: 'all' | 'all-protected' | 'partial' | 'none'
  featuresOn: number
  featuresTotal: number
  /** The protected steps the role doesn't hold, for "All access *". */
  missingProtected: string[]
}

export const EMPTY_ACCESS_MAP: AccessMap = {
  features: [],
  needLabels: {},
  protectedPermissions: {},
}

export const MODULE_LABELS: Record<string, string> = {
  accounting: 'Accounting',
  inventory: 'Inventory',
  pos: 'POS',
  crm: 'CRM',
  files: 'Files',
}

export function permissionSlug(permission: Permission): string {
  return `${permission.module}:${permission.resource}:${permission.action}`
}

/** Whether a held permission (wildcards allowed) reaches `perm`. */
function covers(held: string, perm: string): boolean {
  const [hm, hr, ha] = held.split(':')
  const [pm, pr, pa] = perm.split(':')
  return (hm === '*' || hm === pm) && (hr === '*' || hr === pr) && (ha === '*' || ha === pa)
}

/** Whether a held permission reaches any action of `module:resource`. */
function reachesResource(held: string, resource: string): boolean {
  const [hm, hr] = held.split(':')
  const [rm, rr] = resource.split(':')
  return (hm === '*' || hm === rm) && (hr === '*' || hr === rr)
}

function holdsFeature(feature: AccessFeature, held: string[]): boolean {
  return feature.resources.some((resource) => held.some((h) => reachesResource(h, resource)))
}

export function featureOfPermission(map: AccessMap, perm: string): AccessFeature | undefined {
  const resource = perm.split(':').slice(0, 2).join(':')
  return map.features.find((feature) => feature.resources.includes(resource))
}

/**
 * The role's own permissions: without rows that only repeat what a feature
 * in another module brings anyway (the Accountant's supplier list, brought by
 * Payables). Those are "used by other modules, nothing to set", not access to
 * that module. Needs within the same module stay: they're part of it.
 */
export function ownPermissions(map: AccessMap, held: string[]): string[] {
  const needed = new Set(
    map.features
      .filter((feature) => holdsFeature(feature, held))
      .flatMap((feature) => feature.needs.filter((need) => need.split(':')[0] !== feature.module))
  )
  return held.filter((perm) => !needed.has(perm))
}

/** Plain names for a list of needs, without repeats. */
export function needNames(map: AccessMap, needs: string[]): string {
  return [...new Set(needs.map((perm) => map.needLabels[perm] ?? perm))].join(', ')
}

/** The needs a role's features bring, for "comes with" lists. */
export function sharedAccessFor(map: AccessMap, held: string[]): string[] {
  const own = ownPermissions(map, held)
  const needs = map.features
    .filter((feature) => holdsFeature(feature, own))
    .flatMap((feature) => feature.needs)
  return [...new Set(needs)].filter((perm) => !own.some((h) => covers(h, perm)))
}

export function isFeatureOn(feature: AccessFeature, held: string[]): boolean {
  return holdsFeature(feature, held)
}

/** "Module: access level" for one module, or null when the map doesn't cover it. */
export function summarizeModule(
  map: AccessMap,
  held: string[],
  moduleKey: string,
  available: Permission[]
): ModuleSummary | null {
  const features = map.features.filter((feature) => feature.module === moduleKey)
  if (features.length === 0) return null
  const own = ownPermissions(map, held)
  const featuresOn = features.filter((feature) => holdsFeature(feature, own)).length
  const missing = available
    .filter((p) => p.module === moduleKey && p.resource !== '*' && p.action !== '*')
    .map(permissionSlug)
    .filter((perm) => !own.some((h) => covers(h, perm)))
  const missingProtected = missing.filter((perm) => perm in map.protectedPermissions)
  const kind: ModuleSummary['kind'] =
    featuresOn === 0
      ? 'none'
      : missing.length === 0
        ? 'all'
        : missing.length === missingProtected.length
          ? 'all-protected'
          : 'partial'
  return { kind, featuresOn, featuresTotal: features.length, missingProtected }
}

export function formatModuleSummary(summary: ModuleSummary): string {
  if (summary.kind === 'all') return 'All access'
  if (summary.kind === 'all-protected') return 'All access *'
  if (summary.kind === 'partial') {
    const count = `${summary.featuresOn} of ${summary.featuresTotal} features`
    // Every feature on, but some steps inside them off.
    return summary.featuresOn === summary.featuresTotal
      ? `Partial (${count}, some steps off)`
      : `Partial (${count})`
  }
  return 'No access'
}

/** One line per module the roles touch, for Add User's read-back. */
export function summarizeRoles(
  map: AccessMap,
  held: string[],
  available: Permission[]
): { module: string; label: string; summary: ModuleSummary }[] {
  return Object.keys(MODULE_LABELS)
    .filter((module) => module !== 'files')
    .map((module) => ({
      module,
      label: MODULE_LABELS[module],
      summary: summarizeModule(map, held, module, available),
    }))
    .filter(
      (row): row is { module: string; label: string; summary: ModuleSummary } =>
        row.summary !== null
    )
}
