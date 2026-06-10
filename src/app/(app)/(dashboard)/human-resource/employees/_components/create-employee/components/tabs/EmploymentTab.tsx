'use client'

import { Briefcase, Building2, Calendar, MapPinCheck, Hash } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { FormData } from '../../types'
import { ControlledInput, ControlledSelect, Field, SelectWrapper } from '../ui'
import {
  fetchOrgRelations,
  OrgRelations,
} from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/fetch-org-relations'

export function EmploymentTab() {
  const {
    formState: { errors },
  } = useFormContext<FormData>()

  const {
    data: orgRelations,
    isLoading,
    isError,
  } = useQuery<OrgRelations>({
    queryKey: ['org-relations'],
    queryFn: async () => {
      return await fetchOrgRelations()
    },
  })

  const departments = orgRelations?.departments || []
  const positions = orgRelations?.positions || []
  const branches = orgRelations?.branches || []

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Employee Code"
          required
          error={errors.employeeCode?.message}
          icon={<Hash className="w-3.5 h-3.5" />}
        >
          <ControlledInput name="employeeCode" placeholder="e.g. EMP-0001" />
        </Field>

        <Field label="Hire Date" icon={<Calendar className="w-3.5 h-3.5" />}>
          <ControlledInput name="hireDate" optional type="date" />
        </Field>
      </div>

      <Field label="Status">
        <SelectWrapper>
          <ControlledSelect name="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
          </ControlledSelect>
        </SelectWrapper>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Department" icon={<Building2 className="w-3.5 h-3.5" />}>
          <SelectWrapper>
            <ControlledSelect name="departmentId" optional defaultValue="" disabled={isLoading}>
              <option value="">
                {isLoading
                  ? 'Loading departments...'
                  : isError
                    ? 'Error loading departments'
                    : 'Select department'}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </ControlledSelect>
          </SelectWrapper>
        </Field>

        <Field label="Branch" icon={<MapPinCheck className="w-3.5 h-3.5" />}>
          <SelectWrapper>
            <ControlledSelect name="branchId" optional defaultValue="" disabled={isLoading}>
              <option value="">
                {isLoading
                  ? 'Loading branches...'
                  : isError
                    ? 'Error loading branches'
                    : 'Select branch'}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </ControlledSelect>
          </SelectWrapper>
        </Field>
      </div>

      <Field label="Position" icon={<Briefcase className="w-3.5 h-3.5" />}>
        <SelectWrapper>
          <ControlledSelect name="positionId" optional defaultValue="" disabled={isLoading}>
            <option value="">
              {isLoading
                ? 'Loading positions...'
                : isError
                  ? 'Error loading positions'
                  : 'Select position'}
            </option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </ControlledSelect>
        </SelectWrapper>
      </Field>
    </>
  )
}
