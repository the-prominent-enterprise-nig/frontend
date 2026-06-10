'use client'

import { Accessibility, HeartPulse } from 'lucide-react'
import { ControlledInput, ControlledSelect, Field, SectionLabel, SelectWrapper } from '../ui'
import { BLOOD_TYPES } from '../constants'

export function PersonalInfoTab() {
  return (
    <>
      <SectionLabel>Health & Status</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Blood Type" icon={<HeartPulse className="w-3.5 h-3.5" />}>
          <SelectWrapper>
            <ControlledSelect name="bloodType" optional defaultValue="">
              <option value="">Select blood type</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </ControlledSelect>
          </SelectWrapper>
        </Field>

        <Field label="Marital Status">
          <SelectWrapper>
            <ControlledSelect name="maritalStatus" defaultValue="Single">
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
            </ControlledSelect>
          </SelectWrapper>
        </Field>
      </div>

      <Field label="PWD Type" icon={<Accessibility className="w-3.5 h-3.5" />}>
        <ControlledInput
          name="pwdType"
          optional
          placeholder="e.g. Visual Impairment (leave blank if N/A)"
        />
      </Field>
    </>
  )
}
