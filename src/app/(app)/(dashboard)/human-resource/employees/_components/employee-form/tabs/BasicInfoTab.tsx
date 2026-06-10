'use client'

import { Mail, Phone, User } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { FormData } from '../types'
import { ControlledInput, Field } from '../ui'

export function BasicInfoTab() {
  const {
    formState: { errors },
  } = useFormContext<FormData>()

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="First Name"
          required
          error={errors.firstName?.message}
          icon={<User className="w-3.5 h-3.5" />}
        >
          <ControlledInput
            name="firstName"
            placeholder="e.g. Juan"
            autoComplete="given-name"
            maxLength={60}
          />
        </Field>
        <Field label="Last Name" required error={errors.lastName?.message}>
          <ControlledInput
            name="lastName"
            placeholder="e.g. Dela Cruz"
            autoComplete="family-name"
            maxLength={60}
          />
        </Field>
      </div>

      <Field label="Middle Name">
        <ControlledInput
          name="middleName"
          optional
          placeholder="e.g. Reyes (optional)"
          maxLength={60}
        />
      </Field>

      <Field
        label="Email Address"
        required
        error={errors.email?.message}
        icon={<Mail className="w-3.5 h-3.5" />}
      >
        <ControlledInput
          name="email"
          type="email"
          inputMode="email"
          placeholder="juan.delacruz@company.com"
          autoComplete="email"
          maxLength={60}
        />
      </Field>

      <Field
        label="Contact Number"
        required
        error={errors.contactNumber?.message}
        icon={<Phone className="w-3.5 h-3.5" />}
      >
        <ControlledInput
          name="contactNumber"
          type="tel"
          inputMode="tel"
          placeholder="09171234567"
          autoComplete="tel"
          maxLength={12}
        />
      </Field>
    </>
  )
}
