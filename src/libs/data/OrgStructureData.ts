import { api } from '@/src/libs/api/client'

/**
 * Branches, departments and divisions — the three payroll dimensions the
 * Expense form cascades through, and the branch the CRM customer list
 * filters by.
 *
 * A department belongs to exactly one branch ("per branch → department"),
 * and a division is defined by the branch/department pair it sits under,
 * which is what makes the Division dropdown derivable from the branch and
 * department already picked. A division with no department of its own is
 * branch-wide and valid under every department in that branch.
 */
export interface BranchLite {
  id: string
  name: string
  code?: string | null
}

export interface Department {
  id: string
  branchId: string
  branch?: BranchLite | null
  name: string
  code?: string | null
  isActive: boolean
}

export interface Division {
  id: string
  branchId: string
  branch?: BranchLite | null
  departmentId?: string | null
  department?: { id: string; name: string; code?: string | null } | null
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
  create: (body: { branchId: string; name: string; code?: string }) =>
    api.post<Department>('/departments', body),
  update: (id: string, body: { name?: string; code?: string; isActive?: boolean }) =>
    api.patch<Department>(`/departments/${id}`, body),
  remove: (id: string) => api.delete<{ deleted: boolean }>(`/departments/${id}`),
}

export const DivisionsApi = {
  // Passing departmentId narrows to that department's divisions plus the
  // branch-wide ones; passing branchId alone returns every division in it.
  list: (params?: { branchId?: string; departmentId?: string; includeInactive?: boolean }) =>
    api.get<Listed<Division>>('/divisions', params),
  create: (body: { branchId: string; departmentId?: string; name: string; code?: string }) =>
    api.post<Division>('/divisions', body),
  update: (
    id: string,
    body: { name?: string; code?: string; departmentId?: string | null; isActive?: boolean }
  ) => api.patch<Division>(`/divisions/${id}`, body),
  remove: (id: string) => api.delete<{ deleted: boolean }>(`/divisions/${id}`),
}
