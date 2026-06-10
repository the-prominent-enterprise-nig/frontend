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
import { CreateEmployeeSchema } from '@/src/schema/human-resource/employees/create'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployee } from '../../../_actions/create-employee'
import { showToast } from '@/src/components/ui/toast'

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

  const TAB_REQUIRED_FIELDS: Partial<Record<TabId, (keyof FormData)[]>> = {
    basic: ['firstName', 'lastName', 'email', 'contactNumber'],
    employment: ['employeeCode'],
  }

  const handleFormSubmit = handleSubmit((data) => {
    createEmployeeMutation.mutate(data, {
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
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
