import { z } from 'zod'
import { passwordRules } from './reset-password'

const emailRule = z.string().min(1, 'Email is required').email('Please enter a valid email address')

/** Step 1 of "First sign in?": only the email. */
export const FirstLoginEmailSchema = z.object({ email: emailRule })

export type FirstLoginEmailInput = z.infer<typeof FirstLoginEmailSchema>

/** Step 2: the email carried over from step 1, plus the new password twice. */
export const FirstLoginSchema = z
  .object({
    email: emailRule,
    password: passwordRules,
    confirmPassword: z.string().min(1, 'Please re-enter your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type FirstLoginInput = z.infer<typeof FirstLoginSchema>
