import { z } from 'zod'
import { withPasswordComposition } from './reset-password'

/**
 * The sign-in system (Auth0) wants at least 15 characters for a new login, so
 * first sign in says so before the person submits instead of failing after.
 */
export const FIRST_LOGIN_MIN_PASSWORD_LENGTH = 15

const emailRule = z.string().min(1, 'Email is required').email('Please enter a valid email address')

/** Step 1 of "First sign in?": only the email. */
export const FirstLoginEmailSchema = z.object({ email: emailRule })

export type FirstLoginEmailInput = z.infer<typeof FirstLoginEmailSchema>

/** Step 2: the email carried over from step 1, plus the new password twice. */
export const FirstLoginSchema = z
  .object({
    email: emailRule,
    password: withPasswordComposition(
      z
        .string()
        .min(
          FIRST_LOGIN_MIN_PASSWORD_LENGTH,
          `Password must be at least ${FIRST_LOGIN_MIN_PASSWORD_LENGTH} characters`
        )
    ),
    confirmPassword: z.string().min(1, 'Please re-enter your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type FirstLoginInput = z.infer<typeof FirstLoginSchema>
