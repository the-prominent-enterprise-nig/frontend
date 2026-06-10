'use client'

import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BadgeDollarSign, Briefcase, HeartPulse, User } from 'lucide-react'

import { FormData, TabId, TabDefinition } from './types'

import { INITIAL_FORM, TAB_ORDER } from './constants'

import { ModalHeader } from './components/modal/ModalHeader'
import { ModalTabs } from './components/modal/ModalTabs'
import { ModalFooter } from './components/modal/ModalFooter'
import { BasicInfoTab } from './components/tabs/BasicInfoTab'
import { EmploymentTab } from './components/tabs/EmploymentTab'
import { PersonalInfoTab } from './components/tabs/PersonalInfoTab'
import { PayrollTab } from './components/tabs/PayrollTab'
import { CreateEmployeeSchema } from '@/src/schema/human-resource/employees/create'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEmployee } from '../../_actions/create-employee'
import { getRoles } from '@/src/app/(app)/(dashboard)/settings/_actions/get-roles'
import { showToast } from '@/src/components/ui/toast'
import type { Role } from '@/src/schema/settings/list'

interface CreateEmployeeModalProps {
  open?: boolean
  onClose?: () => void
  onSubmit?: (data: FormData) => void
}

const TABS: TabDefinition[] = [
  { id: 'basic', label: 'Basic Info', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'employment', label: 'Employment', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'personal', label: 'Personal', icon: <HeartPulse className="w-3.5 h-3.5" /> },
  { id: 'payroll', label: 'Payroll', icon: <BadgeDollarSign className="w-3.5 h-3.5" /> },
]

export default function CreateEmployeeModal({
  open = true,
  onClose,
  onSubmit,
}: CreateEmployeeModalProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [grantAccess, setGrantAccess] = useState(false)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
    select: (res): Role[] => {
      const d = res.data
      if (!d) return []
      if (Array.isArray(d)) return d
      return (d as { data: Role[] }).data ?? []
    },
    enabled: grantAccess,
  })
  const availableRoles: Role[] = rolesData ?? []

  const createEmployeeMutation = useMutation({
    mutationFn: (data: FormData) => createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'], exact: false })
    },
  })

  const methods = useForm<FormData>({
    mode: 'onChange',
    resolver: zodResolver(CreateEmployeeSchema),
    defaultValues: INITIAL_FORM,
  })
  const {
    handleSubmit,
    trigger,
    reset,
    formState: { errors },
  } = methods

  if (!open) return null

  const activeIndex = TAB_ORDER.indexOf(activeTab)

  const TAB_FIELD_MAP: Partial<Record<TabId, (keyof FormData)[]>> = {
    basic: ['firstName', 'lastName', 'email', 'contactNumber'],
    employment: ['employeeCode'],
    personal: ['dateOfBirth'],
  }

  // Which tab owns a given field
  const getTabForField = (field: keyof FormData): TabId | undefined => {
    for (const [tab, fields] of Object.entries(TAB_FIELD_MAP) as [TabId, (keyof FormData)[]][]) {
      if (fields.includes(field)) return tab
    }
    return undefined
  }

  const handleFormSubmit = handleSubmit(
    (data) => {
      const payload = {
        ...data,
        ...(grantAccess && selectedRoleIds.length > 0 ? { roleIds: selectedRoleIds } : {}),
      }
      createEmployeeMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            showToast({
              title: 'Employee created successfully',
              description: `${data.firstName} ${data.lastName} was added.`,
              status: 'success',
              position: 'top-right',
            })
            onSubmit?.(data)
            handleClose()
          } else {
            showToast({
              title: 'Failed to create employee',
              description: result.error ?? 'Please try again.',
              status: 'error',
              position: 'top-right',
            })
          }
        },
      })
    },
    (validationErrors) => {
      const firstErrorField = Object.keys(validationErrors)[0] as keyof FormData | undefined
      if (firstErrorField) {
        const tab = getTabForField(firstErrorField)
        if (tab) setActiveTab(tab)
      }
      showToast({
        title: 'Please fix the errors before submitting',
        description: 'Some required fields are missing or invalid.',
        status: 'error',
        position: 'top-right',
      })
    }
  )

  const handleClose = () => {
    reset(INITIAL_FORM)
    setActiveTab('basic')
    setGrantAccess(false)
    setSelectedRoleIds([])
    onClose?.()
  }

  const goNext = async () => {
    const fields = TAB_FIELD_MAP[activeTab]
    if (fields) {
      const valid = await trigger(fields)
      if (!valid) return
    }
    if (activeIndex < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[activeIndex + 1])
  }

  const goPrev = () => {
    if (activeIndex > 0) setActiveTab(TAB_ORDER[activeIndex - 1])
  }

  const tabHasError = (tab: TabId): boolean => {
    const fields = TAB_FIELD_MAP[tab]
    if (!fields) return false
    return fields.some((f) => !!errors[f])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={[
          'w-full bg-white flex flex-col overflow-hidden',
          'rounded-t-2xl sm:rounded-2xl',
          'sm:max-w-2xl sm:shadow-2xl',
          'max-h-[92dvh] sm:max-h-[90vh]',
        ].join(' ')}
      >
        <ModalHeader onClose={handleClose} />

        <ModalTabs
          tabs={TABS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          hasError={tabHasError}
        />

        <FormProvider {...methods}>
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            {activeTab === 'basic' && <BasicInfoTab />}
            {activeTab === 'employment' && <EmploymentTab />}
            {activeTab === 'personal' && <PersonalInfoTab />}
            {activeTab === 'payroll' && <PayrollTab />}

            {/* System Access toggle — shown only on the last tab */}
            {activeTab === 'payroll' && (
              <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Create system access?</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Grant this employee a login account with role-based access.
                    </p>
                  </div>
                  <div
                    onClick={() => {
                      setGrantAccess((v) => !v)
                      setSelectedRoleIds([])
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${grantAccess ? 'bg-prominent-purple-700' : 'bg-zinc-200'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${grantAccess ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </div>
                </label>

                {grantAccess && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-zinc-700">
                      Select role(s) <span className="text-red-500">*</span>
                    </p>
                    {availableRoles.length === 0 ? (
                      <p className="text-xs text-zinc-400">Loading roles…</p>
                    ) : (
                      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                        {availableRoles.map((role: Role) => (
                          <label
                            key={role.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRoleIds.includes(role.id)}
                              onChange={() =>
                                setSelectedRoleIds((prev) =>
                                  prev.includes(role.id)
                                    ? prev.filter((id) => id !== role.id)
                                    : [...prev, role.id]
                                )
                              }
                              className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700"
                            />
                            <span className="text-sm text-zinc-800">{role.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {grantAccess && selectedRoleIds.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        Select at least one role to grant access.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </FormProvider>

        <ModalFooter
          activeTab={activeTab}
          onNext={goNext}
          onPrev={goPrev}
          onClose={handleClose}
          onSubmit={() => void handleFormSubmit()}
          isPending={createEmployeeMutation.isPending}
        />
      </div>
    </div>
  )
}
