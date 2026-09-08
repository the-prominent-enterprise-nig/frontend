import { api } from '@/src/libs/api/client'

/**
 * Branches and departments — "per branch → department" — plus the combined
 * option list an expense line's Division picker is built from.
 *
 * There is no Division entity: a line's Division is one pick from the
 * tenant's branches and departments listed together, which is what "dropdown
 * came from branches and departments" means. Whichever kind is picked, the
 * line stores it as divisionBranchId or divisionDepartmentId.
 */
export interface BranchLite {
  id: string
  name: string
  code?: string | null
  /** 'panay' | 'negros'. A payroll sheet names departments by region
   * ("ACCOUNTING & FINANCE-NEGROS"), not by branch, so the importer needs
   * this to resolve them. */
  region?: string | null
}

export interface Department {
  id: string
  /** Null for a company-wide department, which is how the client's own
   * Division list is organised — one "HR DEPARTMENT", with PANAY/NEGROS
   * carried in the line's Description rather than in the department. */
  branchId: string | null
  branch?: BranchLite | null
  name: string
  code?: string | null
  isActive: boolean
}

type Listed<T> = { data: T[]; meta: { total: number } }

export const BranchesApi = {
  list: () => api.get<Listed<BranchLite & { isActive: boolean }>>('/branches'),
}

export const DepartmentsApi = {
  list: (params?: { branchId?: string; includeInactive?: boolean }) =>
    api.get<Listed<Department>>('/departments', params),
  create: (body: { branchId?: string; name: string; code?: string }) =>
    api.post<Department>('/departments', body),
  update: (id: string, body: { name?: string; code?: string; isActive?: boolean }) =>
    api.patch<Department>(`/departments/${id}`, body),
  remove: (id: string) => api.delete<{ deleted: boolean }>(`/departments/${id}`),
}

/** One entry in a line's Division picker — a branch or a department. */
export interface DivisionOption {
  /** `branch:<id>` or `department:<id>` — the picker's own value. */
  value: string
  label: string
  kind: 'branch' | 'department'
  id: string
  /** The bare name, without the branch suffix the label carries. */
  name: string
  /** The owning branch's name, for a department. Matching a spreadsheet's
   * "DEPARTMENT-REGION" cell needs both halves, not just the department. */
  branchName?: string
  /** The owning branch's region — what a payroll sheet's "-NEGROS" /
   * "-PANAY" suffix actually refers to. */
  branchRegion?: string | null
}

/**
 * Builds the Division option list — one flat list of branches and
 * departments, the way the client's own picker reads.
 *
 * Company-wide departments come first (they are the bulk of the client's
 * list), then every branch with any department that still belongs to it.
 */
export function divisionOptions(
  branches: BranchLite[],
  departments: Department[]
): DivisionOption[] {
  const byBranch = new Map<string, Department[]>()
  const companyWide: Department[] = []
  for (const d of departments) {
    if (d.branchId) byBranch.set(d.branchId, [...(byBranch.get(d.branchId) ?? []), d])
    else companyWide.push(d)
  }
  const options: DivisionOption[] = []
  for (const d of companyWide) {
    options.push({
      value: `department:${d.id}`,
      // No branch suffix: the name is already unique company-wide, and the
      // region it applies to lives in the line's Description.
      label: d.name,
      kind: 'department',
      id: d.id,
      name: d.name,
    })
  }
  for (const b of branches) {
    options.push({
      value: `branch:${b.id}`,
      label: b.name,
      kind: 'branch',
      id: b.id,
      name: b.name,
    })
    for (const d of byBranch.get(b.id) ?? []) {
      options.push({
        value: `department:${d.id}`,
        // Department names repeat across branches, so the branch stays
        // visible in the label — the sheet's own "…-NEGROS" / "…-PANAY"
        // suffixes exist for exactly this reason.
        label: `${d.name} — ${b.name}`,
        kind: 'department',
        id: d.id,
        name: d.name,
        branchName: b.name,
        branchRegion: b.region ?? null,
      })
    }
  }
  return options
}

/** The two ids a picked option maps onto, for sending to the API. */
export function divisionIdsFor(value: string): {
  divisionBranchId?: string
  divisionDepartmentId?: string
} {
  if (value.startsWith('branch:')) return { divisionBranchId: value.slice(7) }
  if (value.startsWith('department:')) return { divisionDepartmentId: value.slice(11) }
  return {}
}

/** The picker value a stored line reopens with. */
export function divisionValueFor(line: {
  divisionBranchId?: string | null
  divisionDepartmentId?: string | null
}): string {
  if (line.divisionDepartmentId) return `department:${line.divisionDepartmentId}`
  if (line.divisionBranchId) return `branch:${line.divisionBranchId}`
  return ''
}
