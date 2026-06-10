'use client'

import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BadgeDollarSign, Briefcase, HeartPulse, User } from 'lucide-react'

import { FormData, TabId, TabDefinition } from '../types'
import { INITIAL_FORM, TAB_ORDER } from '../constants'

import { ModalHeader } from './ModalHeader'
import { ModalTabs } from './ModalTabs'
import { ModalFooter } from './ModalFooter'
import { BasicInfoTab } from '../tabs/BasicInfoTab'
import { EmploymentTab } from '../tabs/EmploymentTab'
import { PersonalInfoTab } from '../tabs/PersonalInfoTab'
import { PayrollTab } from '../tabs/PayrollTab'
import { UpdateEmployeeSchema } from '@/src/schema/human-resource/employees/update'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { updateEmployee } from '../../../_actions/update-employee'
import { getEmployee } from '../../../_actions/get-employee'
import { showToast } from '@/src/components/ui/toast'

interface UpdateEmployeeModalProps {
  employeeId: string
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

export default function UpdateEmployeeModal({
  employeeId,
  open = true,
  onClose,
  onSubmit,
}: UpdateEmployeeModalProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('basic')

  const methods = useForm<FormData>({
    mode: 'onChange',
    resolver: zodResolver(UpdateEmployeeSchema),
    defaultValues: INITIAL_FORM,
  })
  const {
    handleSubmit,
    trigger,
    reset,
    formState: { errors },
  } = methods

  // Fetch employee data and transform to form format
  const { isLoading: isLoadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      const result = await getEmployee(employeeId)
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch employee')
      }

      const employee = result.data

      // Format hireDate for date input (expects YYYY-MM-DD)
      let formattedHireDate: string | undefined = undefined
      if (employee.hireDate) {
        try {
          const date = new Date(employee.hireDate)
          formattedHireDate = date.toISOString().split('T')[0]
        } catch (e) {
          console.error('Error parsing hireDate:', e)
        }
      }

      // Transform to FormData format
      const formData: FormData = {
        employeeCode: employee.employeeCode ?? '',
        firstName: employee.firstName ?? '',
        lastName: employee.lastName ?? '',
        middleName: employee.middleName ?? undefined,
        email: employee.email ?? '',
        contactNumber: employee.contactNumber ?? '',
        dateOfBirth: employee.dateOfBirth
          ? new Date(employee.dateOfBirth).toISOString().split('T')[0]
          : '',
        hireDate: formattedHireDate,
        status: employee.status ?? 'active',
        bloodType: employee.bloodType ?? undefined,
        maritalStatus: employee.maritalStatus ?? 'Single',
        pwdType: employee.pwdType ?? undefined,
        allowance: employee.allowance ?? 0,
        allowancePayoutCycle: employee.allowancePayoutCycle ?? 'FirstCycle',
        loan: employee.loan ?? 0,
        loanDeduction: employee.loanDeduction ?? 0,
        silc: employee.silc ?? 0,
        departmentId: employee.department?.id ?? undefined,
        positionId: employee.position?.id ?? undefined,
        branchId: employee.branch?.id ?? undefined,
      }

      // Reset form with fetched data (only happens once per employeeId)
      reset(formData)

      return formData
    },
    enabled: open && !!employeeId,
    refetchOnMount: 'always',
  })

  const updateEmployeeMutation = useMutation({
    mutationFn: (data: FormData) => updateEmployee(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId], exact: false })
    },
  })

  if (!open) return null

  const activeIndex = TAB_ORDER.indexOf(activeTab)

  const TAB_REQUIRED_FIELDS: Partial<Record<TabId, (keyof FormData)[]>> = {
    basic: ['firstName', 'lastName', 'email', 'contactNumber'],
    employment: ['employeeCode'],
  }

  const handleFormSubmit = handleSubmit((data) => {
    updateEmployeeMutation.mutate(data, {
      onSuccess: (result) => {
        if (result.success) {
          showToast({
            title: 'Employee updated successfully',
            description: `${data.firstName} ${data.lastName} was updated.`,
            status: 'success',
            position: 'top-right',
          })
          onSubmit?.(data)
          handleClose()
        } else {
          showToast({
            title: 'Update failed',
            description: result.error || 'Failed to update employee',
            status: 'error',
            position: 'top-right',
          })
        }
      },
    })
  })

  const handleClose = () => {
    reset(INITIAL_FORM)
    setActiveTab('basic')
    onClose?.()
  }

  const goNext = async () => {
    const fields = TAB_REQUIRED_FIELDS[activeTab]
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
    const fields = TAB_REQUIRED_FIELDS[tab]
    if (!fields) return false
    return fields.some((f) => !!errors[f])
  }

  return (
    <div
      className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className={[
          'w-full bg-white flex flex-col overflow-hidden',
          'rounded-t-2xl sm:rounded-2xl',
          'sm:max-w-2xl sm:shadow-2xl',
          'max-h-[92dvh] sm:max-h-[90vh]',
        ].join(' ')}
      >
        <ModalHeader
          onClose={handleClose}
          title="Update Employee"
          description="Edit employee information and save changes"
        />

        <ModalTabs
          tabs={TABS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          hasError={tabHasError}
        />

        {isLoadingEmployee ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading employee data...</p>
            </div>
          </div>
        ) : (
          <FormProvider {...methods}>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              {activeTab === 'basic' && <BasicInfoTab />}
              {activeTab === 'employment' && <EmploymentTab />}
              {activeTab === 'personal' && <PersonalInfoTab />}
              {activeTab === 'payroll' && <PayrollTab />}
            </div>
          </FormProvider>
        )}

        <ModalFooter
          btnLabel="Update Employee"
          activeTab={activeTab}
          onNext={goNext}
          onPrev={goPrev}
          onClose={handleClose}
          onSubmit={() => void handleFormSubmit()}
          isPending={updateEmployeeMutation.isPending || isLoadingEmployee}
        />
      </div>
    </div>
  )
}
